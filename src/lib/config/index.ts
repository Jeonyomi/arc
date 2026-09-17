import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default(""),
  ARC_RPC_URL: z.string().url().default("https://rpc.mainnet.arc.io"),
});

let _env: z.infer<typeof envSchema> | null = null;

function loadEnv() {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  _env = parsed.data;
  return _env;
}

/** Lazy env — validates only at first access, not at module load / build time. */
export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop) {
    const loaded = loadEnv();
    return loaded[prop as keyof typeof loaded];
  },
});

export const ARC_CHAIN_ID = 5042;
export const ARC_TESTNET_CHAIN_ID = 5042002;

/** Arc-specific addresses (docs.arc.io contract-addresses). */
export const ARC_USDC_ERC20 = "0x3600000000000000000000000000000000000000";
export const ARC_USDC_SYSTEM_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getRpcUrl(): string {
  return env.ARC_RPC_URL;
}
