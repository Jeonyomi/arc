import { getDb } from "@/lib/db";
import { tokenTransfers, tokens } from "@/db/schema";
import { recordJobRun } from "./record-job-run";
import { collectTokenTransfers } from "@/lib/sources/arc/collect-token-transfers";
import { chainStatSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SYSTEM_TOKENS } from "@/lib/sources/arc/system-tokens";
import { arcClient } from "@/lib/sources/arc/client";

const CHUNK = 500;

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

    const { perToken } = await collectTokenTransfers(head - lookbackBlocks, head);
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
