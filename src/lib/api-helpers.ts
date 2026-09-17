import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";

export const PUBLIC_OBSERVATION_WINDOWS = ["1h", "6h", "24h"] as const;
export type PublicObservationWindow = (typeof PUBLIC_OBSERVATION_WINDOWS)[number];

export function parseObservationWindow(request: Request): PublicObservationWindow {
  const value = new URL(request.url).searchParams.get("window") || "24h";
  return PUBLIC_OBSERVATION_WINDOWS.includes(value as PublicObservationWindow)
    ? (value as PublicObservationWindow)
    : "24h";
}

/**
 * Explicit empty state when the cloud database is not configured.
 * Missing data stays unavailable — never replaced with synthetic values.
 */
export function uiOnlyResponse(endpoint: string) {
  return NextResponse.json({
    data: null,
    meta: {
      uiOnly: true,
      message: "Cloud database is not configured.",
      endpoint,
    },
  });
}

export function dataAvailable(): boolean {
  return hasDatabase();
}

export async function tryDatabase<T>(load: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false }
> {
  if (!dataAvailable()) return { ok: false };
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    console.error("Neon query failed:", error);
    return { ok: false };
  }
}

export function errorResponse(endpoint: string, error: unknown) {
  return NextResponse.json(
    {
      data: null,
      meta: {
        error: true,
        endpoint,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    },
    { status: 500 },
  );
}
