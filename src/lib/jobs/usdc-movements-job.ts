import { getDb } from "@/lib/db";
import { usdcMovements } from "@/db/schema";
import { recordJobRun } from "./record-job-run";
import { collectUsdcMovements } from "@/lib/sources/arc/collect-usdc-movements";
import { chainStatSnapshots } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

const CHUNK = 500;

/**
 * Scan the last `lookbackBlocks` blocks for native USDC movements.
 * Cursor = highest stored block; falls back to chain head minus lookback.
 * Overlap of a few blocks is intentional — unique(txHash, logIndex) dedupes.
 */
export async function runUsdcMovementsJob(lookbackBlocks = 600): Promise<number> {
  return recordJobRun("arc-rpc", "usdc-movements", async () => {
    const db = getDb();

    // Determine scan range from stored progress or chain head.
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

    const { movements } = await collectUsdcMovements(fromBlock + 1, toBlock);
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

export { sql };
