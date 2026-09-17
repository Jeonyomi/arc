# ArcWatch

**Evidence-first analytics for Circle's Arc blockchain** — chain state, native USDC
movements (EIP-7708), and tracked stablecoin activity with source and freshness labels.

Web app: https://arcwatch.vercel.app · Repository: https://github.com/Jeonyomi/arc

Independent public-source research project. Not affiliated with or endorsed by Circle.
The product does not provide investment advice, trade execution, or predictive signals.

## Product question

What is happening on Arc, where is USDC flowing, and what raw evidence supports that view?

ArcWatch answers this in layers:

- **Chain state**: block head, gas (base fee), block cadence — observed from the Arc RPC.
- **Native USDC movements**: every explicit transfer, mint, and burn indexed from the
  **EIP-7708 system emitter** (`0xfff…FFfE`, 18 decimals) — complete window coverage,
  not sampled.
- **Tracked token streams**: bounded ERC-20 Transfer observations for system tokens
  (USDC ERC-20 interface, EURC, USYC, cirBTC) — kept **separate** from the native
  stream to avoid double counting.

## Architecture

| Layer | Choice |
|---|---|
| Web | Next.js 16 · React 19 · Tailwind 4 |
| Chain access | `viem` (built-in `arc` chain, ID 5042) → `https://rpc.mainnet.arc.io` |
| Storage | Neon Postgres (pooled HTTP driver) |
| Hosting | Vercel |

### Data sources

| Source | Data used | Scope |
|---|---|---|
| Arc mainnet RPC | chain head, EIP-7708 USDC movements, ERC-20 transfers, token supply | free public endpoint |
| Arc docs (static) | system token registry (USDC/EURC/USYC/cirBTC addresses, decimals) | versioned in repo |

Missing data stays unavailable — no synthetic values, no imputation.

## Key design decisions

1. **Two USDC event streams, never mixed.** An ERC-20 `transfer()` emits *two* logs:
   the 6-decimal ERC-20 log from `0x3600…0000` and the 18-decimal system log from
   `0xfff…FFfE`. ArcWatch counts each stream by emitter address and stores decimals
   context with every row (per [USDC system events](https://docs.arc.io/arc/references/usdc-system-events.md)).
2. **Full-coverage USDC indexing.** The system emitter logs every native movement,
   so unlike sampled designs there is no "observation exposure" gap — hourly
   aggregates are directly comparable.
3. **Bounded per-token scans.** ERC-20 token streams are bounded recent-window scans
   with explicit coverage labels.
4. **Fail-closed source health.** Every collector job writes a heartbeat
   (`source_sync_state`); the API classifies freshness (healthy ≤15m, degraded ≤2h,
   stale beyond, error on failure) and the UI shows it verbatim.

## Local development

```bash
pnpm install
cp .env.example .env.local   # set DATABASE_URL (Neon connection string)
pnpm db:push                 # create tables
pnpm sync                    # chain stats → USDC movements → token transfers
pnpm dev                     # http://localhost:3000
```

Sync jobs (also runnable individually):

| Job | Command | What it does |
|---|---|---|
| `chain` | `pnpm sync:chain` | observe chain head + gas → `chain_stat_snapshots` |
| `transfers` | `pnpm sync:transfers` | EIP-7708 scan → `usdc_movements` |
| `tokens` | `pnpm sync:tokens` | registry + ERC-20 scan → `tokens`, `token_transfers` |

`SYNC_LOOKBACK_BLOCKS` (default 600) bounds each scan; a 5-block overlap plus
unique indexes dedupe re-scans.

## API (v1)

| Endpoint | Description |
|---|---|
| `GET /api/v1/overview?window=1h\|6h\|24h` | chain head KPIs + USDC window aggregates + token table |
| `GET /api/v1/usdc-timeline?window=…` | hourly transfers/volume/mints/burns buckets |
| `GET /api/v1/movements?limit=` | recent native USDC movements |
| `GET /api/v1/transfers?limit=` | recent ERC-20 transfers (tracked tokens) |
| `GET /api/v1/tokens` | registry + 24h per-token stats |
| `GET /api/v1/source-health` | per-job freshness classification + overall status |

Without `DATABASE_URL` every endpoint returns an explicit `uiOnly` empty state.

## Deployment

- Vercel project linked to this repo; set `DATABASE_URL` (Production).
- Local collector (Task Scheduler / cron) runs `pnpm sync` periodically to keep
  Neon populated; the web app is read-only over that store.
