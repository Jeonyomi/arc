import { getDb } from "@/lib/db";
import { chainStatSnapshots } from "@/db/schema";
import { recordJobRun } from "./record-job-run";
import { collectChainStats } from "@/lib/sources/arc/collect-chain-stats";

/** Observe the chain head and persist one stat snapshot. */
export async function runChainStatsJob(): Promise<number> {
  return recordJobRun("arc-rpc", "chain-stats", async () => {
    const obs = await collectChainStats();
    const db = getDb();
    await db
      .insert(chainStatSnapshots)
      .values({
        blockNumber: obs.blockNumber,
        blockHash: obs.blockHash,
        blockTimestamp: obs.blockTimestamp,
        txCountInBlock: obs.txCountInBlock,
        gasUsedInBlock: obs.gasUsedInBlock,
        gasLimitInBlock: obs.gasLimitInBlock,
        baseFeePerGasGwei: obs.baseFeePerGasGwei,
      })
      .onConflictDoNothing({ target: chainStatSnapshots.blockNumber });
    return 1;
  });
}
