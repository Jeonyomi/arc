"use client";

import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { formatNumber, formatUsd, shortAddress, timeAgo } from "@/lib/format";

interface OverviewResponse {
  data: {
    chain: { headBlock: number; headTimestamp: string; baseFeeGwei: number | null; txCountInHeadBlock: number; observedBlocks: number };
    usdc: { window: string; transferCount: number; mintCount: number; burnCount: number; volumeUsdc: number; uniqueAddresses: number; netMintUsdc: number };
    tokens: Array<{ address: string; symbol: string | null; kind: string; transferCount: number; volume: number }>;
  } | null;
  meta: { uiOnly?: boolean; message?: string };
}

interface TimelineResponse {
  data: Array<{ timestamp: string; transfers: number; volumeUsdc: number; mints: number; burns: number }> | null;
  meta: { uiOnly?: boolean };
}

interface MovementsResponse {
  data: Array<{
    id: number; blockNumber: number; txHash: string; fromAddress: string; toAddress: string;
    valueUsdc: number; kind: string; blockTimestamp: string;
  }> | null;
  meta: { uiOnly?: boolean };
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub ? <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div> : null}
    </div>
  );
}

export default function OverviewView({ window }: { window: string }) {
  const overview = useQuery<OverviewResponse>({
    queryKey: ["overview", window],
    queryFn: () => fetch(`/api/v1/overview?window=${window}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });
  const timeline = useQuery<TimelineResponse>({
    queryKey: ["usdc-timeline", window],
    queryFn: () => fetch(`/api/v1/usdc-timeline?window=${window}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });
  const movements = useQuery<MovementsResponse>({
    queryKey: ["movements"],
    queryFn: () => fetch("/api/v1/movements?limit=15").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  if (overview.data?.meta?.uiOnly) {
    return (
      <div className="panel text-sm text-[var(--muted)]">
        {overview.data.meta.message ?? "No data yet. Run the local sync to collect observations."}
      </div>
    );
  }

  const d = overview.data?.data;
  const tl = timeline.data?.data ?? [];
  const mv = movements.data?.data ?? [];

  const chartOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: { data: ["Transfers", "Volume (USDC)"], textStyle: { color: "#8a94a6" } },
    grid: { left: 60, right: 60, top: 40, bottom: 30 },
    xAxis: { type: "category", data: tl.map((t) => t.timestamp.slice(11, 16)), axisLabel: { color: "#8a94a6" } },
    yAxis: [
      { type: "value", name: "Transfers", axisLabel: { color: "#8a94a6" }, splitLine: { lineStyle: { color: "#1e2633" } } },
      { type: "value", name: "Volume", axisLabel: { color: "#8a94a6", formatter: formatUsd }, splitLine: { show: false } },
    ],
    series: [
      { name: "Transfers", type: "bar", data: tl.map((t) => t.transfers), itemStyle: { color: "#2775ca" } },
      { name: "Volume (USDC)", type: "line", yAxisIndex: 1, data: tl.map((t) => t.volumeUsdc), itemStyle: { color: "#16a34a" }, showSymbol: false },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Chain head" value={d ? formatNumber(d.chain.headBlock) : "—"} sub={d ? `observed ${timeAgo(d.chain.headTimestamp)}` : undefined} />
        <Kpi label="Base fee" value={d?.chain.baseFeeGwei != null ? `${d.chain.baseFeeGwei.toFixed(2)}` : "—"} sub="gwei" />
        <Kpi label={`Transfers (${window})`} value={d ? formatNumber(d.usdc.transferCount) : "—"} sub="native USDC" />
        <Kpi label={`Volume (${window})`} value={d ? formatUsd(d.usdc.volumeUsdc) : "—"} sub="USDC" />
        <Kpi label={`Mints / Burns`} value={d ? `${formatNumber(d.usdc.mintCount)} / ${formatNumber(d.usdc.burnCount)}` : "—"} sub={d ? `net ${formatUsd(d.usdc.netMintUsdc)}` : undefined} />
        <Kpi label={`Unique addrs (${window})`} value={d ? formatNumber(d.usdc.uniqueAddresses) : "—"} />
      </div>

      <div className="panel">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">USDC Movement Timeline</h2>
        {tl.length > 0 ? (
          <ReactECharts option={chartOption} style={{ height: 280 }} notMerge />
        ) : (
          <div className="py-10 text-center text-sm text-[var(--muted)]">No timeline data in this window yet.</div>
        )}
      </div>

      <div className="panel">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Recent Native USDC Movements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">Block</th>
                <th>Kind</th>
                <th>From</th>
                <th>To</th>
                <th className="text-right">Amount (USDC)</th>
                <th className="text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {mv.map((m) => (
                <tr key={m.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="mono py-2">{formatNumber(m.blockNumber)}</td>
                  <td>
                    <span className={`badge ${m.kind === "mint" ? "badge-healthy" : m.kind === "burn" ? "badge-error" : "badge-unknown"}`}>{m.kind}</span>
                  </td>
                  <td className="mono">{shortAddress(m.fromAddress)}</td>
                  <td className="mono">{shortAddress(m.toAddress)}</td>
                  <td className="text-right font-variant-numeric">{formatUsd(m.valueUsdc)}</td>
                  <td className="text-right text-[var(--muted)]">{timeAgo(m.blockTimestamp)}</td>
                </tr>
              ))}
              {mv.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-[var(--muted)]">No movements stored yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
