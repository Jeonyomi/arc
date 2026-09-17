import { runChainStatsJob } from "./chain-stats-job";
import { runUsdcMovementsJob } from "./usdc-movements-job";
import { runTokenTransfersJob } from "./token-transfers-job";

export interface SyncResult {
  chainStats: number;
  usdcMovements: number;
  tokenTransfers: number;
  elapsedMs: number;
}

/** Full pipeline in dependency order. Each job records its own heartbeat. */
export async function syncAll(lookbackBlocks = 600): Promise<SyncResult> {
  const started = Date.now();
  const chainStats = await runChainStatsJob();
  const usdcMovements = await runUsdcMovementsJob(lookbackBlocks);
  const tokenTransfers = await runTokenTransfersJob(lookbackBlocks);
  return { chainStats, usdcMovements, tokenTransfers, elapsedMs: Date.now() - started };
}
