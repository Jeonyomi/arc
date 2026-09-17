"use client";

import { useQuery } from "@tanstack/react-query";
import { formatNumber, formatUsd, shortAddress } from "@/lib/format";

interface TokensResponse {
  data: Array<{
    address: string; symbol: string | null; name: string | null; kind: string;
    decimals: number | null; holdersCount: number | null; totalSupplyRaw: string | null;
    transferCount: number; volume: number;
  }> | null;
  meta: { uiOnly?: boolean; message?: string };
}

export default function TokensView() {
  const { data, isLoading } = useQuery<TokensResponse>({
    queryKey: ["tokens"],
    queryFn: () => fetch("/api/v1/tokens").then((r) => r.json()),
    refetchInterval: 120_000,
  });

  if (data?.meta?.uiOnly) {
    return <div className="panel text-sm text-[var(--muted)]">{data.meta.message ?? "No data yet."}</div>;
  }

  const rows = data?.data ?? [];

  return (
    <div className="panel">
      <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
        Tracked Tokens · 24h activity (bounded ERC-20 stream)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-[var(--muted)]">
            <tr>
              <th className="py-2">Token</th>
              <th>Kind</th>
              <th className="text-right">Transfers (24h)</th>
              <th className="text-right">Volume</th>
              <th className="text-right">Holders</th>
              <th className="text-right">Supply</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.address} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-2">
                  <div className="font-medium">{t.symbol ?? shortAddress(t.address)}</div>
                  <div className="text-xs text-[var(--muted)]">{t.name ?? shortAddress(t.address)}</div>
                </td>
                <td><span className="badge badge-unknown">{t.kind}</span></td>
                <td className="text-right">{formatNumber(t.transferCount)}</td>
                <td className="text-right">{formatUsd(t.volume)}</td>
                <td className="text-right text-[var(--muted)]">{t.holdersCount != null ? formatNumber(t.holdersCount) : "—"}</td>
                <td className="text-right text-[var(--muted)] mono">{t.totalSupplyRaw ? formatUsd(Number(t.totalSupplyRaw) / 10 ** (t.decimals ?? 6)) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="py-6 text-center text-[var(--muted)]">No tokens registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
