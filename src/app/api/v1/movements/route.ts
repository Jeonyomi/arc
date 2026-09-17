import { NextResponse } from "next/server";
import { dataAvailable, errorResponse, tryDatabase, uiOnlyResponse } from "@/lib/api-helpers";
import { getRecentMovements } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const endpoint = "/api/v1/movements";
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 25), 100);
  try {
    if (!dataAvailable()) return uiOnlyResponse(endpoint);
    const result = await tryDatabase(() => getRecentMovements(limit));
    if (!result.ok) {
      return NextResponse.json({ data: null, meta: { uiOnly: true, endpoint, error: "database query failed" } }, { status: 503 });
    }
    return NextResponse.json({ data: result.data, meta: { servedFrom: "neon-postgres", count: result.data.length } });
  } catch (error) {
    return errorResponse(endpoint, error);
  }
}
