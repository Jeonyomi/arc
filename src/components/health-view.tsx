"use client";

import { useQuery } from "@tanstack/react-query";
import { timeAgo } from "@/lib/format";

interface HealthResponse {
  data: {
    sources: Array<{
      source: string; job: string; status: string;
      lastStartedAt: string | null; lastSuccessAt: string | null;
      lastErrorAt: string | null; lastError: string | null; recordsProcessed: number | null;
    }>;
    overallStatus: string;
  } | null;
  meta: { uiOnly?: boolean; message?: string };
}

const BADGE: Record<string, string> = {
  healthy: "badge-healthy",
  degraded: "badge-degraded",
  stale: "badge-stale",
  error: "badge-error",
  unknown: "badge-unknown",
};

export default function HealthView() {
  const { data } = useQuery<HealthResponse>({
    queryKey: ["source-health"],
    queryFn: () => fetch("/api/v1/source-health").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  if (data?.meta?.uiOnly) {
    return <div className="panel text-sm text-[var(--muted)]">{data.meta.message ?? "No data yet."}</div>;
  }

  const sources = data?.data?.sources ?? [];

  return (
    <div className="space-y-4">
      <div className="panel flex items-center justify-between">
        <div>
          <div className="kpi-label">Overall status</div>
          <div className="kpi-value capitalize">{data?.data?.overallStatus ?? "—"}</div>
        </div>
        <span className={`badge ${BADGE[data?.data?.overallStatus ?? "unknown"]} text-sm`}>
          {data?.data?.overallStatus ?? "unknown"}
        </span>
      </div>

      <div className="panel">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-[var(--muted)]">
            <tr>
              <th className="py-2">Source</th>
              <th>Job</th>
              <th>Status</th>
              <th className="text-right">Last success</th>
              <th className="text-right">Records</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={`${s.source}:${s.job}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="mono py-2">{s.source}</td>
                <td>{s.job}</td>
                <td><span className={`badge ${BADGE[s.status] ?? "badge-unknown"}`}>{s.status}</span></td>
                <td className="text-right">{timeAgo(s.lastSuccessAt)}</td>
                <td className="text-right text-[var(--muted)]">{s.recordsProcessed ?? "—"}</td>
                <td className="max-w-64 truncate text-xs text-[var(--muted)]" title={s.lastError ?? ""}>{s.lastError ?? "—"}</td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-[var(--muted)]">No collector runs recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
