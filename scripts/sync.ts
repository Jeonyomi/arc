import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { syncAll } from "../src/lib/jobs/sync-all";
import { runChainStatsJob } from "../src/lib/jobs/chain-stats-job";
import { runUsdcMovementsJob } from "../src/lib/jobs/usdc-movements-job";
import { runTokenTransfersJob } from "../src/lib/jobs/token-transfers-job";
import { hasDatabase } from "../src/lib/db";

async function main() {
  const job = process.argv[2] ?? "all";
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not configured. Copy .env.example to .env.local and set it.");
    process.exit(1);
  }
  const lookback = process.env.SYNC_LOOKBACK_BLOCKS ? Number(process.env.SYNC_LOOKBACK_BLOCKS) : 600;
  if (job === "chain") {
    const n = await runChainStatsJob();
    console.log(JSON.stringify({ job: "chain", records: n }));
  } else if (job === "transfers") {
    const n = await runUsdcMovementsJob(lookback);
    console.log(JSON.stringify({ job: "transfers", records: n }));
  } else if (job === "tokens") {
    const n = await runTokenTransfersJob(lookback);
    console.log(JSON.stringify({ job: "tokens", records: n }));
  } else {
    const result = await syncAll(lookback);
    console.log(JSON.stringify({ job: "all", ...result }));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
