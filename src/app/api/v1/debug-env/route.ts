import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** TEMPORARY diagnosis route — reports presence only, never secret values. */
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  return NextResponse.json({
    hasDatabaseUrl: raw.length > 0,
    length: raw.length,
    isPostgres: /^postgres(ql)?:\/\//i.test(raw),
    startsWith: raw.slice(0, 11),
  });
}
