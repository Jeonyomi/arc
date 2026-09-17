# ArcWatch Operations Runbook

## 1. Vercel deployment (UI only)

ArcWatch follows the same split as Robinwatch: **Vercel serves the UI and reads
from Neon**; the local collector populates Neon.

1. Push to `main` (already done — Vercel picks up the repo on import).
2. In Vercel: **New Project → Import `Jeonyomi/arc`**.
3. Environment Variables (Production):
   - `DATABASE_URL` = the Neon `arcwatch` connection string (pooled).
4. Deploy. Verify: `https://<project>.vercel.app/api/v1/overview` returns
   `servedFrom: "neon-postgres"` (not `uiOnly`).

No CRON jobs on Vercel — the local scheduler feeds data.

## 2. Local scheduled sync (already installed)

| Item | Value |
|---|---|
| Task name | `ArcWatchSync` |
| Schedule | hourly (`PT1H`) |
| Launcher | `scripts\ops\sync-hidden.vbs` → `sync-arcwatch.cmd` (silent, no cmd window) |
| Log | `data\sync.log` |
| Runtime | ~4.5 min (chain → USDC movements → token transfers) |

Commands:

```powershell
# status
Get-ScheduledTask -TaskName ArcWatchSync | Get-ScheduledTaskInfo

# run now
Start-ScheduledTask -TaskName ArcWatchSync

# remove
Unregister-ScheduledTask -TaskName ArcWatchSync -Confirm:$false
```

The `.cmd` wrapper invokes `node node_modules\tsx\dist\cli.mjs scripts\sync.ts`
directly (no pnpm shim) — this avoids the cmd-window `'M' is not recognized`
line-ending issue seen with RobinSync.

## 3. RPC constraints (learned the hard way)

- `eth_getLogs` on `rpc.mainnet.arc.io` caps at **2000 results per query**;
  at current density (~45 USDC movements/block peak) a 600-block range can
  return 15k+ logs and fail with:
  `request exceeded max allowed range: query exceeds max results 2000, retry with the range X-Y`.
- Both scan jobs therefore chunk ranges (40 blocks for USDC, 120 for tokens)
  and honor the provider's retry hint / binary-search on rejection.
- Keep chunk sizes conservative; density grows with chain usage.

## 4. Data model notes

- `usdc_movements` = EIP-7708 system emitter stream (18 decimals) — full native
  coverage, mints/burns via zero-address transfers.
- `token_transfers` = per-token ERC-20 stream (6 decimals for USDC/EURC/USYC) —
  bounded scans, kept separate to avoid double counting.
- `source_sync_state` = per-job heartbeats; the UI classifies fresh/degraded/stale.
