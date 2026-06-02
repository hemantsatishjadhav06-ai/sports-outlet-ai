// Content generator: turns verified insights into a draft blog article.
// Output is markdown, status=draft. Editor reviews before publish.
//
import { getDb } from "../db/index.js";
import { llmGuard, openai, hasOpenAI } from "./_openai.js";
import { upsert as kbUpsert } from "../knowledge/index.js";
import { slugify } from "@sports-outlet-ai/utils";

export async function runContentGeneration(input: { video_id: string }): Promise<{ article_id: string }> {
  const db = getDb();
  const r = await db.query<{
    title: string;
    sport: string;
    topics: string[];
    tips: string[];
    product_mentions: string[];
    difficulty: string;
  }>(
    `SELECT v.title, v.sport, i.topics, i.tips, i.product_mentions, i.difficulty
     FROM insights i JOIN videos v ON v.id = i.video_id
     WHERE i.video_id = $1`,
    [input.video_id],
  );
  if (!r.rowCount) throw new Error(`No insights for ${input.video_id}`);
  const row = r.rows[0];

  let title: string;
  let markdown: string;

  if (hasOpenAI()) {
    await llmGuard(0.03);
    const resp = await openai().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            `You're a ${row.sport} writer. Write a 600-900 word blog post in markdown ` +
            `from the provided insights. Voice: friendly coach, not salesy. Structure: ` +
            `compelling H1 title, intro hook, 3-5 H2 sections covering tips, brief product callouts ` +
            `where mentioned (just names; do not invent specs), conclusion. ` +
            `Return: first line = the title (no hash), then a blank line, then the markdown body.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            video_title: row.title,
            sport: row.sport,
            topics: row.topics,
            tips: row.tips,
            product_mentions: row.product_mentions,
            difficulty: row.difficulty,
          }),
        },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "";
    const idx = raw.indexOf("\n");
    title = (idx >= 0 ? raw.slice(0, idx) : raw).trim().replace(/^#+\s*/, "") || row.title;
    markdown = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  } else {
    title = `Coach's notes on ${row.title}`;
    markdown =
      `_(Stub article -- set OPENAI_API_KEY to generate real content)_\n\n` +
      `## Topics\n${row.topics.map((t) => `- ${t}`).join("\n") || "_none_"}\n\n` +
      `## Tips\n${row.tips.map((t) => `- ${t}`).join("\n") || "_none_"}\n\n` +
      `## Products mentioned\n${row.product_mentions.map((p) => `- ${p}`).join("\n") || "_none_"}\n`;
  }

  const slug = `${slugify(title)}-${input.video_id.slice(0, 8)}`;
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO articles (slug, sport, title, content_markdown, source_video_id, status)
     VALUES ($1, $2, $3, $4, $5, 'draft')
     ON CONFLICT (slug) DO UPDATE SET content_markdown = $4, updated_at = now()
     RETURNING id`,
    [slug, row.sport, title, markdown, input.video_id],
  );
  const articleId = inserted.rows[0].id;

  // Index in vector store for related-article recommendations later
  try {
    await kbUpsert(articleId, `${title}\n\n${markdown}`, { sport: row.sport, slug });
  } catch (e) {
    console.warn(`[content-gen] knowledge upsert failed:`, e);
  }
  return { article_id: articleId };
}
