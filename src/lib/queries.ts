import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { chainStatSnapshots, sourceSyncState, tokenTransfers, tokenStatSnapshots, tokens, usdcMovements } from "@/db/schema";

export function windowHours(window: "1h" | "6h" | "24h"): number {
  return window === "1h" ? 1 : window === "6h" ? 6 : 24;
}

export async function getChainHead() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(chainStatSnapshots)
    .orderBy(desc(chainStatSnapshots.blockNumber))
    .limit(1);
  return row ?? null;
}

export interface OverviewData {
  chain: {
    headBlock: number;
    headTimestamp: string;
    baseFeeGwei: number | null;
    txCountInHeadBlock: number;
    observedBlocks: number;
  };
  usdc: {
    window: string;
    transferCount: number;
    mintCount: number;
    burnCount: number;
    volumeUsdc: number;
    uniqueAddresses: number;
    netMintUsdc: number;
  };
  tokens: Array<{
    address: string;
    symbol: string | null;
    kind: string;
    transferCount: number;
    volume: number;
  }>;
}

export async function getOverview(window: "1h" | "6h" | "24h"): Promise<OverviewData> {
  const db = getDb();
  const since = new Date(Date.now() - windowHours(window) * 3600_000);

  const [head, headCount] = await Promise.all([
    getChainHead(),
    db.select({ n: count() }).from(chainStatSnapshots),
  ]);

  const [agg] = await db
    .select({
      transferCount: count(),
      volume: sum(usdcMovements.valueUsdc),
      mintCount: sql<number>`count(*) filter (where ${usdcMovements.kind} = 'mint')`.mapWith(Number),
      burnCount: sql<number>`count(*) filter (where ${usdcMovements.kind} = 'burn')`.mapWith(Number),
      mintBurnNet: sql<number>`coalesce(sum(case when ${usdcMovements.kind} = 'mint' then ${usdcMovements.valueUsdc} when ${usdcMovements.kind} = 'burn' then -${usdcMovements.valueUsdc} else 0 end), 0)`.mapWith(Number),
      uniqueAddresses: sql<number>`count(distinct ${usdcMovements.fromAddress}) + count(distinct ${usdcMovements.toAddress})`.mapWith(Number),
    })
    .from(usdcMovements)
    .where(gte(usdcMovements.blockTimestamp, since));

  const tokenRows = await db
    .select({
      address: tokens.address,
      symbol: tokens.symbol,
      kind: tokens.kind,
      transferCount: count(tokenTransfers.id),
      volume: sum(tokenTransfers.normalizedValue),
    })
    .from(tokens)
    .leftJoin(
      tokenTransfers,
      and(eq(tokenTransfers.tokenAddress, tokens.address), gte(tokenTransfers.blockTimestamp, since)),
    )
    .where(eq(tokens.isSystem, true))
    .groupBy(tokens.address, tokens.symbol, tokens.kind)
    .orderBy(desc(count(tokenTransfers.id)));

  return {
    chain: {
      headBlock: head?.blockNumber ?? 0,
      headTimestamp: head?.blockTimestamp?.toISOString() ?? new Date(0).toISOString(),
      baseFeeGwei: head?.baseFeePerGasGwei ?? null,
      txCountInHeadBlock: head?.txCountInBlock ?? 0,
      observedBlocks: headCount[0]?.n ?? 0,
    },
    usdc: {
      window,
      transferCount: Number(agg?.transferCount ?? 0),
      mintCount: agg?.mintCount ?? 0,
      burnCount: agg?.burnCount ?? 0,
      volumeUsdc: Number(agg?.volume ?? 0),
      uniqueAddresses: agg?.uniqueAddresses ?? 0,
      netMintUsdc: agg?.mintBurnNet ?? 0,
    },
    tokens: tokenRows.map((r) => ({
      address: r.address,
      symbol: r.symbol,
      kind: r.kind,
      transferCount: Number(r.transferCount ?? 0),
      volume: Number(r.volume ?? 0),
    })),
  };
}

export async function getUsdcTimeline(window: "1h" | "6h" | "24h") {
  const db = getDb();
  const since = new Date(Date.now() - windowHours(window) * 3600_000);
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc('hour', ${usdcMovements.blockTimestamp})`,
      transfers: count(),
      volume: sum(usdcMovements.valueUsdc),
      mints: sql<number>`count(*) filter (where ${usdcMovements.kind} = 'mint')`.mapWith(Number),
      burns: sql<number>`count(*) filter (where ${usdcMovements.kind} = 'burn')`.mapWith(Number),
    })
    .from(usdcMovements)
    .where(gte(usdcMovements.blockTimestamp, since))
    .groupBy(sql`date_trunc('hour', ${usdcMovements.blockTimestamp})`)
    .orderBy(sql`date_trunc('hour', ${usdcMovements.blockTimestamp})`);
  return rows.map((r) => ({
    timestamp: r.bucket,
    transfers: Number(r.transfers ?? 0),
    volumeUsdc: Number(r.volume ?? 0),
    mints: r.mints,
    burns: r.burns,
  }));
}

export async function getRecentMovements(limit = 25) {
  const db = getDb();
  return db
    .select()
    .from(usdcMovements)
    .orderBy(desc(usdcMovements.blockNumber), desc(usdcMovements.logIndex))
    .limit(limit);
}

export async function getTokenStats() {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 3600_000);
  return db
    .select({
      address: tokens.address,
      symbol: tokens.symbol,
      name: tokens.name,
      kind: tokens.kind,
      decimals: tokens.decimals,
      holdersCount: tokens.holdersCount,
      totalSupplyRaw: tokens.totalSupplyRaw,
      transferCount: count(tokenTransfers.id),
      volume: sum(tokenTransfers.normalizedValue),
    })
    .from(tokens)
    .leftJoin(
      tokenTransfers,
      and(eq(tokenTransfers.tokenAddress, tokens.address), gte(tokenTransfers.blockTimestamp, since)),
    )
    .groupBy(tokens.address, tokens.symbol, tokens.name, tokens.kind, tokens.decimals, tokens.holdersCount, tokens.totalSupplyRaw)
    .orderBy(desc(count(tokenTransfers.id)));
}

export async function getSourceHealth() {
  const db = getDb();
  return db.select().from(sourceSyncState).orderBy(sourceSyncState.source, sourceSyncState.jobName);
}

export async function getRecentTokenTransfers(limit = 25) {
  const db = getDb();
  return db
    .select({
      tokenAddress: tokenTransfers.tokenAddress,
      symbol: tokens.symbol,
      fromAddress: tokenTransfers.fromAddress,
      toAddress: tokenTransfers.toAddress,
      normalizedValue: tokenTransfers.normalizedValue,
      txHash: tokenTransfers.txHash,
      blockTimestamp: tokenTransfers.blockTimestamp,
    })
    .from(tokenTransfers)
    .leftJoin(tokens, eq(tokens.address, tokenTransfers.tokenAddress))
    .orderBy(desc(tokenTransfers.blockNumber), desc(tokenTransfers.logIndex))
    .limit(limit);
}

export { tokenStatSnapshots };
