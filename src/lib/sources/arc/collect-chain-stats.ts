import { arcClient } from "./client";

export interface ChainStatObservation {
  blockNumber: number;
  blockHash: string;
  blockTimestamp: Date;
  txCountInBlock: number;
  gasUsedInBlock: string;
  gasLimitInBlock: string;
  baseFeePerGasGwei: number | null;
}

/** One bounded chain-head observation per invocation. */
export async function collectChainStats(): Promise<ChainStatObservation> {
  const client = arcClient();
  const block = await client.getBlock({ blockTag: "latest" });
  return {
    blockNumber: Number(block.number),
    blockHash: block.hash,
    blockTimestamp: new Date(Number(block.timestamp) * 1000),
    txCountInBlock: block.transactions.length,
    gasUsedInBlock: block.gasUsed.toString(),
    gasLimitInBlock: block.gasLimit.toString(),
    baseFeePerGasGwei: block.baseFeePerGas ? Number(block.baseFeePerGas) / 1e9 : null,
  };
}
