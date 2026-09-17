import { ARC_USDC_ERC20 } from "@/lib/config";

/**
 * Arc system tokens (docs.arc.io/arc/references/contract-addresses).
 * Mainnet addresses only — ArcWatch observes mainnet.
 */
export const SYSTEM_TOKENS = [
  {
    address: ARC_USDC_ERC20,
    symbol: "USDC",
    name: "USD Coin (native, ERC-20 interface)",
    decimals: 6,
    kind: "system_erc20",
    isSystem: true,
  },
  {
    address: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    kind: "system_erc20",
    isSystem: true,
  },
  {
    address: "0x8a5D989Bbb96929F689B0200f435f53dA42bF490",
    symbol: "USYC",
    name: "Hashnote US Yield Coin",
    decimals: 6,
    kind: "system_erc20",
    isSystem: true,
  },
  {
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    symbol: "cirBTC",
    name: "Circle Wrapped Bitcoin",
    decimals: 8,
    kind: "erc20",
    isSystem: false,
  },
] as const;
