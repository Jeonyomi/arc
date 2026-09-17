import { NextResponse } from "next/server";
import { dataAvailable, errorResponse, parseObservationWindow, tryDatabase, uiOnlyResponse } from "@/lib/api-helpers";
import { getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const window = parseObservationWindow(request);
  const endpoint = "/api/v1/overview";
  try {
    if (!dataAvailable()) return uiOnlyResponse(endpoint);
    const result = await tryDatabase(() => getOverview(window));
    if (!result.ok) {
      return NextResponse.json({ data: null, meta: { uiOnly: true, endpoint, error: "database query failed" } }, { status: 503 });
    }
    return NextResponse.json({ data: result.data, meta: { window, servedFrom: "neon-postgres" } });
  } catch (error) {
    return errorResponse(endpoint, error);
  }
}
