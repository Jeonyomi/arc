import { formatUnits, pad, toHex } from "viem";
import { arcClient } from "./client";
import { ARC_USDC_SYSTEM_EMITTER, TRANSFER_TOPIC, ZERO_ADDRESS } from "@/lib/config";

const EMITTER_PADDED = pad(ARC_USDC_SYSTEM_EMITTER);
const ZERO_PADDED = pad(ZERO_ADDRESS);

export interface UsdcMovement {
  blockNumber: number;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  rawValue: string;
  valueUsdc: number;
  kind: "transfer" | "mint" | "burn";
  blockTimestamp: Date;
}

export interface UsdcScanResult {
  fromBlock: number;
  toBlock: number;
  movements: UsdcMovement[];
}

/**
 * Scan the EIP-7708 system emitter for native USDC Transfer logs.
 * The system emitter logs every explicit USDC movement (native sends, ERC-20
 * transfers, mints, burns) at 18 decimals — full window coverage, unlike
 * sampled per-token streams. Mint/burn = zero-address involvement.
 */
export async function collectUsdcMovements(fromBlock: number, toBlock: number): Promise<UsdcScanResult> {
  const client = arcClient();
  const logs = await client.getLogs({
    address: ARC_USDC_SYSTEM_EMITTER,
    event: {
      type: "event",
      name: "Transfer",
      inputs: [
        { type: "address", name: "from", indexed: true },
        { type: "address", name: "to", indexed: true },
        { type: "uint256", name: "value", indexed: false },
      ],
    },
    fromBlock: BigInt(fromBlock),
    toBlock: BigInt(toBlock),
  });

  // Deduplicate block timestamps via one getBlock per distinct block.
  const blockCache = new Map<number, Date>();
  const movements: UsdcMovement[] = [];

  for (const log of logs) {
    const blockNumber = Number(log.blockNumber);
    let ts = blockCache.get(blockNumber);
    if (!ts) {
      const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
      ts = new Date(Number(block.timestamp) * 1000);
      blockCache.set(blockNumber, ts);
    }
    const from = log.args.from?.toLowerCase() ?? ZERO_ADDRESS;
    const to = log.args.to?.toLowerCase() ?? ZERO_ADDRESS;
    const raw = log.args.value!.toString();
    movements.push({
      blockNumber,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      fromAddress: from,
      toAddress: to,
      rawValue: raw,
      valueUsdc: Number(formatUnits(BigInt(raw), 18)),
      kind: from === ZERO_ADDRESS && to !== ZERO_ADDRESS ? "mint" : to === ZERO_ADDRESS && from !== ZERO_ADDRESS ? "burn" : "transfer",
      blockTimestamp: ts,
    });
  }

  return { fromBlock, toBlock, movements };
}

export { EMITTER_PADDED, ZERO_PADDED, TRANSFER_TOPIC, toHex };
