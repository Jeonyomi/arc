import { createPublicClient, http } from "viem";
import { arc } from "viem/chains";
import { getRpcUrl } from "@/lib/config";

let _client: ReturnType<typeof createPublicClient> | null = null;

/** Shared Arc mainnet public client (rate-limit friendly: single http transport). */
export function arcClient() {
  if (_client) return _client;
  _client = createPublicClient({
    chain: arc,
    transport: http(getRpcUrl(), { retryCount: 1, timeout: 20_000 }),
  });
  return _client;
}
