import { NextResponse } from "next/server";
import { dataAvailable, errorResponse, tryDatabase, uiOnlyResponse } from "@/lib/api-helpers";
import { getTokenStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = "/api/v1/tokens";
  try {
    if (!dataAvailable()) return uiOnlyResponse(endpoint);
    const result = await tryDatabase(() => getTokenStats());
    if (!result.ok) {
      return NextResponse.json({ data: null, meta: { uiOnly: true, endpoint, error: "database query failed" } }, { status: 503 });
    }
    return NextResponse.json({ data: result.data, meta: { servedFrom: "neon-postgres", count: result.data.length } });
  } catch (error) {
    return errorResponse(endpoint, error);
  }
}
