import { getDb } from "@/lib/db";
import { tokenTransfers, tokens } from "@/db/schema";
import { recordJobRun } from "./record-job-run";
import { collectTokenTransfers, type TokenTransfer } from "@/lib/sources/arc/collect-token-transfers";
import { chainStatSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SYSTEM_TOKENS } from "@/lib/sources/arc/system-tokens";
import { arcClient } from "@/lib/sources/arc/client";

const CHUNK = 500;
const LOGS_MAX_CHUNK = 120; // per-token density is lower; stay well under the 2000-result cap

/** Scan one token chunk, shrinking on provider range rejection. */
async function scanTokenRange(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<TokenTransfer[]> {
  const all: TokenTransfer[] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    let lo = start;
    let hi = Math.min(start + LOGS_MAX_CHUNK - 1, toBlock);
    for (;;) {
      try {
        const result = await collectTokenTransfers(lo, hi, [tokenAddress]);
        all.push(...result.perToken[tokenAddress] ?? []);
        break;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const hint = msg.match(/retry with the range (\d+)-(\d+)/);
        if (hint) { lo = Number(hint[1]); hi = Number(hint[2]); continue; }
        if ((msg.includes("max allowed range") || msg.includes("max results")) && hi > lo) {
          const mid = Math.floor((lo + hi) / 2);
          all.push(...(await scanTokenRange(tokenAddress, lo, mid)));
          start = mid + 1;
          lo = start;
          hi = Math.min(start + LOGS_MAX_CHUNK - 1, toBlock);
          continue;
        }
        throw error;
      }
    }
    start = hi + 1;
  }
  return all;
}

/** Ensure system tokens exist in the registry before scanning. */
async function ensureSystemTokens(): Promise<void> {
  const db = getDb();
  const client = arcClient();
  for (const token of SYSTEM_TOKENS) {
    // Read totalSupply live (best-effort; registry row persists regardless).
    let supplyRaw: string | null = null;
    try {
      const raw = await client.readContract({
        address: token.address as `0x${string}`,
        abi: [{ type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
        functionName: "totalSupply",
      });
      supplyRaw = (raw as bigint).toString();
    } catch {
      supplyRaw = null;
    }
    await db
      .insert(tokens)
      .values({
        address: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        kind: token.kind,
        isSystem: token.isSystem,
        totalSupplyRaw: supplyRaw,
      })
      .onConflictDoUpdate({
        target: tokens.address,
        set: { symbol: token.symbol, name: token.name, totalSupplyRaw: supplyRaw, lastSeenAt: new Date() },
      });
  }
}

export async function runTokenTransfersJob(lookbackBlocks = 600): Promise<number> {
  return recordJobRun("arc-rpc", "token-transfers", async () => {
    await ensureSystemTokens();
    const db = getDb();

    const [headRow] = await db
      .select({ blockNumber: chainStatSnapshots.blockNumber })
      .from(chainStatSnapshots)
      .orderBy(desc(chainStatSnapshots.blockNumber))
      .limit(1);
    const head = headRow?.blockNumber ?? Number((await arcClient().getBlock({ blockTag: "latest" })).number);

    const fromBlock = head - lookbackBlocks;
    const targets = SYSTEM_TOKENS.map((t) => t.address.toLowerCase());
    const rowsByToken = await Promise.all(targets.map(async (addr) => ({ addr, rows: await scanTokenRange(addr, fromBlock, head) })));
    const perToken: Record<string, TokenTransfer[]> = {};
    for (const { addr, rows } of rowsByToken) perToken[addr] = rows;
    let inserted = 0;
    for (const [, rows] of Object.entries(perToken)) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const result = await db
          .insert(tokenTransfers)
          .values(chunk)
          .onConflictDoNothing()
          .returning({ id: tokenTransfers.id });
        inserted += result.length;
      }
    }
    return inserted;
  });
}

export { eq };
