import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

// ── Source Sync State ───────────────────────────────────────────────────────
// One row per (source, job) — collector heartbeat and health attribution.

export const sourceSyncState = pgTable(
  "source_sync_state",
  {
    source: text("source").notNull(),
    jobName: text("job_name").notNull(),
    cursor: jsonb("cursor").$type<unknown>(),
    lastStartedAt: timestamptz("last_started_at"),
    lastSuccessAt: timestamptz("last_success_at"),
    lastErrorAt: timestamptz("last_error_at"),
    lastError: text("last_error"),
    recordsProcessed: integer("records_processed"),
    status: text("status"), // ok | degraded | error
  },
  (table) => [uniqueIndex("source_sync_state_pk").on(table.source, table.jobName)],
);

// ── Chain Stat Snapshots ────────────────────────────────────────────────────
// Point-in-time chain-wide observations from the Arc RPC.

export const chainStatSnapshots = pgTable(
  "chain_stat_snapshots",
  {
    id: serial("id").primaryKey(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: text("block_hash").notNull(),
    blockTimestamp: timestamptz("block_timestamp").notNull(),
    txCountInBlock: integer("tx_count_in_block").notNull().default(0),
    gasUsedInBlock: numeric("gas_used_in_block"),
    gasLimitInBlock: numeric("gas_limit_in_block"),
    baseFeePerGasGwei: doublePrecision("base_fee_per_gas_gwei"),
    observedAt: timestamptz("observed_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chain_stat_snapshots_block_uq").on(table.blockNumber),
    index("chain_stat_snapshots_ts_idx").on(table.blockTimestamp),
  ],
);

// ── Token Registry ──────────────────────────────────────────────────────────
// System tokens seeded from docs.arc.io contract addresses plus discovered ERC-20s.

export const tokens = pgTable(
  "tokens",
  {
    address: text("address").primaryKey(),
    symbol: text("symbol"),
    name: text("name"),
    decimals: integer("decimals"),
    kind: text("kind").notNull().default("erc20"), // system_native | system_erc20 | erc20
    isSystem: boolean("is_system").notNull().default(false),
    holdersCount: bigint("holders_count", { mode: "number" }),
    totalSupplyRaw: text("total_supply_raw"),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
  },
  (table) => [index("tokens_kind_idx").on(table.kind)],
);

// ── USDC Movements (EIP-7708 system stream) ─────────────────────────────────
// Every explicit native USDC transfer, logged by the system emitter at 18 decimals.
// Mint/burn are transfers involving the zero address.

export const usdcMovements = pgTable(
  "usdc_movements",
  {
    id: serial("id").primaryKey(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    rawValue: text("raw_value").notNull(), // 18-decimal raw string
    valueUsdc: doublePrecision("value_usdc").notNull(), // 18-decimal raw / 1e18
    kind: text("kind").notNull(), // transfer | mint | burn
    blockTimestamp: timestamptz("block_timestamp").notNull(),
    observedAt: timestamptz("observed_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usdc_movements_uq").on(table.txHash, table.logIndex),
    index("usdc_movements_ts_idx").on(table.blockTimestamp),
    index("usdc_movements_from_idx").on(table.fromAddress, table.blockTimestamp),
    index("usdc_movements_to_idx").on(table.toAddress, table.blockTimestamp),
    index("usdc_movements_kind_ts_idx").on(table.kind, table.blockTimestamp),
  ],
);

// ── ERC-20 Token Transfers (per-token stream) ───────────────────────────────
// Bounded observations of tracked system tokens (USDC ERC-20 interface, EURC, USYC, cirBTC).
// Decimals-aware normalization at write time.

export const tokenTransfers = pgTable(
  "token_transfers",
  {
    id: serial("id").primaryKey(),
    tokenAddress: text("token_address").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    rawValue: text("raw_value").notNull(),
    normalizedValue: doublePrecision("normalized_value").notNull(),
    blockTimestamp: timestamptz("block_timestamp").notNull(),
    observedAt: timestamptz("observed_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("token_transfers_uq").on(table.tokenAddress, table.txHash, table.logIndex),
    index("token_transfers_token_ts_idx").on(table.tokenAddress, table.blockTimestamp),
  ],
);

// ── Token Stat Snapshots ────────────────────────────────────────────────────

export const tokenStatSnapshots = pgTable(
  "token_stat_snapshots",
  {
    id: serial("id").primaryKey(),
    tokenAddress: text("token_address").notNull(),
    windowStart: timestamptz("window_start").notNull(),
    windowEnd: timestamptz("window_end").notNull(),
    transferCount: integer("transfer_count").notNull().default(0),
    uniqueAddresses: integer("unique_addresses").notNull().default(0),
    totalValue: doublePrecision("total_value").notNull().default(0),
    mintCount: integer("mint_count").notNull().default(0),
    burnCount: integer("burn_count").notNull().default(0),
    observedAt: timestamptz("observed_at").notNull().defaultNow(),
  },
  (table) => [
    index("token_stat_snapshots_token_idx").on(table.tokenAddress, table.windowEnd),
  ],
);
