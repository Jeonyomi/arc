import { formatUnits } from "viem";
import { arcClient } from "./client";
import { SYSTEM_TOKENS } from "./system-tokens";

export interface TokenTransfer {
  tokenAddress: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  rawValue: string;
  normalizedValue: number;
  blockTimestamp: Date;
}

export interface TokenScanResult {
  fromBlock: number;
  toBlock: number;
  perToken: Record<string, TokenTransfer[]>;
}

const TRANSFER_TOPIC0 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Bounded per-token ERC-20 Transfer scan. This is a separate stream from the
 * EIP-7708 system emitter — an ERC-20 transfer() emits BOTH logs; we filter by
 * emitter address to avoid double counting (docs.arc.io usdc-system-events).
 */
export async function collectTokenTransfers(
  fromBlock: number,
  toBlock: number,
  tokenFilter?: readonly string[],
): Promise<TokenScanResult> {
  const client = arcClient();
  const targets = SYSTEM_TOKENS.filter((t) => !tokenFilter || tokenFilter.includes(t.address));
  const perToken: Record<string, TokenTransfer[]> = {};

  const blockCache = new Map<number, Date>();
  const blockTs = async (n: number): Promise<Date> => {
    let ts = blockCache.get(n);
    if (!ts) {
      const block = await client.getBlock({ blockNumber: BigInt(n) });
      ts = new Date(Number(block.timestamp) * 1000);
      blockCache.set(n, ts);
    }
    return ts;
  };

  for (const token of targets) {
    const logs = await client.getLogs({
      address: token.address as `0x${string}`,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });
    const rows: TokenTransfer[] = [];
    for (const log of logs) {
      // Only the canonical Transfer topic — skip oddities rather than guess.
      if (log.topics[0] !== TRANSFER_TOPIC0 || log.topics.length < 3 || !log.topics[1] || !log.topics[2]) continue;
      const raw = (log.data === "0x" ? "0" : BigInt(log.data).toString()) as string;
      rows.push({
        tokenAddress: token.address.toLowerCase(),
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        fromAddress: ("0x" + log.topics[1].slice(26)).toLowerCase(),
        toAddress: ("0x" + log.topics[2].slice(26)).toLowerCase(),
        rawValue: raw,
        normalizedValue: Number(formatUnits(BigInt(raw), token.decimals)),
        blockTimestamp: await blockTs(Number(log.blockNumber)),
      });
    }
    perToken[token.address.toLowerCase()] = rows;
  }

  return { fromBlock, toBlock, perToken };
}
