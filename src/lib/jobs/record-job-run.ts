import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sourceSyncState } from "@/db/schema";

/** Upsert the (source, job) heartbeat: started → ok / error. */
export async function recordJobRun(
  source: string,
  jobName: string,
  fn: () => Promise<number>,
): Promise<number> {
  const db = getDb();
  const startedAt = new Date();
  await db
    .insert(sourceSyncState)
    .values({ source, jobName, lastStartedAt: startedAt, status: "running" })
    .onConflictDoUpdate({
      target: [sourceSyncState.source, sourceSyncState.jobName],
      set: { lastStartedAt: startedAt, status: "running", lastError: null },
    });
  try {
    const records = await fn();
    const now = new Date();
    await db
      .insert(sourceSyncState)
      .values({
        source,
        jobName,
        lastStartedAt: startedAt,
        lastSuccessAt: now,
        recordsProcessed: records,
        status: "ok",
      })
      .onConflictDoUpdate({
        target: [sourceSyncState.source, sourceSyncState.jobName],
        set: { lastSuccessAt: now, recordsProcessed: records, status: "ok", lastError: null },
      });
    return records;
  } catch (error) {
    const now = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await db
      .insert(sourceSyncState)
      .values({
        source,
        jobName,
        lastStartedAt: startedAt,
        lastErrorAt: now,
        lastError: message.slice(0, 500),
        status: "error",
      })
      .onConflictDoUpdate({
        target: [sourceSyncState.source, sourceSyncState.jobName],
        set: { lastErrorAt: now, lastError: message.slice(0, 500), status: "error" },
      });
    throw error;
  }
}

export { sql };
