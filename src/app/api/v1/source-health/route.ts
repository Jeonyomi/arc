import { NextResponse } from "next/server";
import { dataAvailable, errorResponse, tryDatabase, uiOnlyResponse } from "@/lib/api-helpers";
import { getSourceHealth } from "@/lib/queries";

export const dynamic = "force-dynamic";

const FRESH_MS = 15 * 60_000; // healthy if a job succeeded within 15 minutes
const STALE_MS = 2 * 3600_000; // degraded after 2 hours

function classify(status: string | null, lastSuccessAt: Date | null): string {
  if (status === "error") return "error";
  if (!lastSuccessAt) return "unknown";
  const age = Date.now() - lastSuccessAt.getTime();
  if (age <= FRESH_MS) return "healthy";
  if (age <= STALE_MS) return "degraded";
  return "stale";
}

export async function GET() {
  const endpoint = "/api/v1/source-health";
  try {
    if (!dataAvailable()) return uiOnlyResponse(endpoint);
    const result = await tryDatabase(() => getSourceHealth());
    if (!result.ok) {
      return NextResponse.json({ data: null, meta: { uiOnly: true, endpoint, error: "database query failed" } }, { status: 503 });
    }
    const sources = result.data.map((row) => ({
      source: row.source,
      job: row.jobName,
      status: classify(row.status, row.lastSuccessAt),
      lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
      lastError: row.lastError,
      recordsProcessed: row.recordsProcessed,
    }));
    const overall = sources.some((s) => s.status === "error")
      ? "degraded"
      : sources.every((s) => s.status === "healthy")
        ? "healthy"
        : "degraded";
    return NextResponse.json({ data: { sources, overallStatus: overall }, meta: { servedFrom: "neon-postgres" } });
  } catch (error) {
    return errorResponse(endpoint, error);
  }
}
