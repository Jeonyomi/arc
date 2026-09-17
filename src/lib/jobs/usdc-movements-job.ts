import { getDb } from "@/lib/db";
import { usdcMovements } from "@/db/schema";
import { recordJobRun } from "./record-job-run";
import { collectUsdcMovements, type UsdcScanResult } from "@/lib/sources/arc/collect-usdc-movements";
import { chainStatSnapshots } from "@/db/schema";
import { desc } from "drizzle-orm";

const CHUNK = 500;
const LOGS_MAX_CHUNK = 40; // ~1800 logs at observed density; RPC caps getLogs at 2000 results

/** Scan one chunk, shrinking the window if the provider rejects the range. */
async function scanChunk(fromBlock: number, toBlock: number): Promise<UsdcScanResult> {
  let lo = fromBlock;
  let hi = toBlock;
  for (;;) {
    try {
      return await collectUsdcMovements(lo, hi);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const hint = msg.match(/retry with the range (\d+)-(\d+)/);
      if (hint) {
        lo = Number(hint[1]);
        hi = Number(hint[2]);
        continue;
      }
      if ((msg.includes("max allowed range") || msg.includes("max results")) && hi > lo) {
        const mid = Math.floor((lo + hi) / 2);
        const first = await scanChunk(lo, mid);
        const second = await scanChunk(mid + 1, hi);
        return { fromBlock: lo, toBlock: hi, movements: [...first.movements, ...second.movements] };
      }
      throw error;
    }
  }
}

/** Scan [fromBlock+1, toBlock] in provider-safe chunks. */
async function scanRange(fromBlock: number, toBlock: number) {
  const movements = [];
  let start = fromBlock + 1;
  while (start <= toBlock) {
    const end = Math.min(start + LOGS_MAX_CHUNK - 1, toBlock);
    const { movements: rows } = await scanChunk(start, end);
    movements.push(...rows);
    start = end + 1;
  }
  return movements;
}

/**
 * Scan the last `lookbackBlocks` blocks for native USDC movements.
 * Cursor = highest stored block; falls back to chain head minus lookback.
 * Overlap of a few blocks is intentional — unique(txHash, logIndex) dedupes.
 */
export async function runUsdcMovementsJob(lookbackBlocks = 600): Promise<number> {
  return recordJobRun("arc-rpc", "usdc-movements", async () => {
    const db = getDb();

    const [lastRow] = await db
      .select({ blockNumber: usdcMovements.blockNumber })
      .from(usdcMovements)
      .orderBy(desc(usdcMovements.blockNumber))
      .limit(1);
    const [headRow] = await db
      .select({ blockNumber: chainStatSnapshots.blockNumber })
      .from(chainStatSnapshots)
      .orderBy(desc(chainStatSnapshots.blockNumber))
      .limit(1);

    const head = headRow?.blockNumber ?? (await collectHeadBlock());
    const fromBlock = lastRow ? lastRow.blockNumber - 5 : head - lookbackBlocks;
    const toBlock = head;
    if (toBlock <= fromBlock) return 0;

    const movements = await scanRange(fromBlock, toBlock);
    let inserted = 0;
    for (let i = 0; i < movements.length; i += CHUNK) {
      const chunk = movements.slice(i, i + CHUNK);
      const result = await db
        .insert(usdcMovements)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: usdcMovements.id });
      inserted += result.length;
    }
    return inserted;
  });
}

async function collectHeadBlock(): Promise<number> {
  const { arcClient } = await import("@/lib/sources/arc/client");
  const block = await arcClient().getBlock({ blockTag: "latest" });
  return Number(block.number);
}
