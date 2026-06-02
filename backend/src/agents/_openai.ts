// Shared OpenAI client + spend tracker. Every agent should call llmGuard()
// before making a billable LLM request to honor the daily ceiling.
import { OpenAI } from "openai";
import { config } from "../config.js";
import { getDb } from "../db/index.js";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (client) return client;
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY missing -- cannot call OpenAI");
  }
  client = new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

export function hasOpenAI(): boolean {
  return Boolean(config.openaiApiKey);
}

// Hard daily-spend ceiling. Caller passes the *estimated* cost; we add and
// throw if we'd cross the line. Estimates don't have to be exact -- they're
// a guardrail, not a billing system.
export async function llmGuard(estimatedUsd: number): Promise<void> {
  if (!config.databaseUrl) return; // dev mode without DB -- skip
  const db = getDb();
  const r = await db.query<{ usd_spent: string }>(
    `INSERT INTO llm_spend (day, usd_spent) VALUES (CURRENT_DATE, 0)
     ON CONFLICT (day) DO NOTHING
     RETURNING usd_spent`,
  );
  // Get current spend
  const cur = await db.query<{ usd_spent: string }>(
    `SELECT usd_spent FROM llm_spend WHERE day = CURRENT_DATE`,
  );
  const spent = Number(cur.rows[0]?.usd_spent ?? 0);
  if (spent + estimatedUsd > config.llmMaxDailyUsd) {
    throw new Error(
      `LLM_MAX_DAILY_USD ceiling hit ($${spent.toFixed(2)} + $${estimatedUsd} > $${config.llmMaxDailyUsd}). ` +
      `Raise the cap or wait for tomorrow.`,
    );
  }
  await db.query(
    `UPDATE llm_spend SET usd_spent = usd_spent + $1 WHERE day = CURRENT_DATE`,
    [estimatedUsd],
  );
}
