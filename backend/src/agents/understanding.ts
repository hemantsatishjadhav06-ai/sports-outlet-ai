// Understanding agent: given a transcript, extract structured insights:
// topics, tips, product mentions, difficulty level.
//
// Uses GPT-4o-mini (cheap, fast, structured output via JSON mode).
//
import { z } from "zod";
import { getDb } from "../db/index.js";
import { enqueue } from "../queue/index.js";
import { llmGuard, openai, hasOpenAI } from "./_openai.js";

const InsightShape = z.object({
  topics: z.array(z.string()).max(10),
  tips: z.array(z.string()).max(20),
  product_mentions: z.array(z.string()).max(15),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "unknown"]),
  confidence: z.number().min(0).max(1),
});

export async function runUnderstanding(input: { video_id: string }): Promise<void> {
  const db = getDb();
  const r = await db.query<{ content: string; sport: string; title: string }>(
    `SELECT t.content, v.sport, v.title
     FROM transcripts t JOIN videos v ON v.id = t.video_id
     WHERE t.video_id = $1`,
    [input.video_id],
  );
  if (!r.rowCount) throw new Error(`No transcript for ${input.video_id}`);
  const { content, sport, title } = r.rows[0];

  let parsed: z.infer<typeof InsightShape>;
  if (hasOpenAI() && content && !content.startsWith("[Transcript placeholder")) {
    await llmGuard(0.01);
    const resp = await openai().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You extract structured insights from ${sport} coaching video transcripts. ` +
            `Return JSON with keys: topics (string[]), tips (string[]), product_mentions (string[]), ` +
            `difficulty ('beginner'|'intermediate'|'advanced'|'unknown'), confidence (0-1). ` +
            `Be concise and factual. Confidence reflects how clearly the transcript supports the extraction.`,
        },
        { role: "user", content: `TITLE: ${title}\n\nTRANSCRIPT:\n${content.slice(0, 12000)}` },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    parsed = InsightShape.parse(JSON.parse(raw));
  } else {
    // Stub when LLM isn't available -- keeps the pipeline runnable.
    parsed = {
      topics: [],
      tips: [],
      product_mentions: [],
      difficulty: "unknown",
      confidence: 0,
    };
  }

  await db.query(
    `INSERT INTO insights (video_id, topics, tips, product_mentions, difficulty, confidence)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (video_id) DO UPDATE
       SET topics = $2, tips = $3, product_mentions = $4, difficulty = $5, confidence = $6, verified = false`,
    [input.video_id, parsed.topics, parsed.tips, parsed.product_mentions, parsed.difficulty, parsed.confidence],
  );
  await enqueue("verification", { video_id: input.video_id });
}
