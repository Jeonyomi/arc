import { NextResponse } from "next/server";
import { dataAvailable, errorResponse, tryDatabase, uiOnlyResponse } from "@/lib/api-helpers";
import { getRecentTokenTransfers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const endpoint = "/api/v1/transfers";
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 25), 100);
  try {
    if (!dataAvailable()) return uiOnlyResponse(endpoint);
    const result = await tryDatabase(() => getRecentTokenTransfers(limit));
    if (!result.ok) {
      return NextResponse.json({ data: null, meta: { uiOnly: true, endpoint, error: "database query failed" } }, { status: 503 });
    }
    return NextResponse.json({ data: result.data, meta: { servedFrom: "neon-postgres", count: result.data.length } });
  } catch (error) {
    return errorResponse(endpoint, error);
  }
}
