// Self-improvement agent (v0): scaffold for feedback-driven prompt refinement.
//
// Real implementation requires:
//   - A telemetry pipeline capturing CTR / dwell time / shares per article
//   - A scoring rubric (engagement quality, factual accuracy, style)
//   - A prompt registry with versioning so we can A/B test
//   - A feedback loop that re-ranks prompt variants based on score
//
// For v1 we record any provided feedback row to a table and stop there.
// This is intentional -- closing the loop reliably is months of work and
// shouldn't ship until the rest of the pipeline is producing data worth
// optimizing on.
import { getDb } from "../db/index.js";

export interface FeedbackEvent {
  article_id: string;
  signal: "view" | "click" | "share" | "dwell_seconds";
  value: number;
}

export async function recordFeedback(ev: FeedbackEvent): Promise<void> {
  const db = getDb();
  // Lightweight events table; create on first use to avoid migration noise
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedback_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID NOT NULL,
      signal TEXT NOT NULL,
      value REAL NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(
    `INSERT INTO feedback_events (article_id, signal, value) VALUES ($1, $2, $3)`,
    [ev.article_id, ev.signal, ev.value],
  );
}

// Stub until the loop is built -- documents the interface so downstream code
// has something to call against.
export async function refinePrompts(): Promise<void> {
  console.log("[self-improvement] refinePrompts() not yet implemented -- see comment in self-improvement.ts");
}
