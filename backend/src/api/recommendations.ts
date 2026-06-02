import { Router } from "express";
import { getDb } from "../db/index.js";
import { query as kbQuery } from "../knowledge/index.js";

const router = Router();

// GET /recommendations?article_id=...&limit=5
// Returns related articles based on vector similarity (Pinecone or in-memory).
router.get("/", async (req, res) => {
  const articleId = String(req.query.article_id ?? "");
  const limit = Math.min(Number(req.query.limit ?? 5), 20);
  if (!articleId) {
    res.status(400).json({ error: "article_id is required" });
    return;
  }
  const db = getDb();
  const a = await db.query<{ title: string; content_markdown: string; sport: string }>(
    `SELECT title, content_markdown, sport FROM articles WHERE id = $1`,
    [articleId],
  );
  if (!a.rowCount) {
    res.status(404).json({ error: "article not found" });
    return;
  }
  const seed = `${a.rows[0].title}\n\n${a.rows[0].content_markdown}`;
  const matches = await kbQuery(seed, limit + 1);
  // Drop the article itself if it's the top hit
  const filtered = matches.filter((m) => m.id !== articleId).slice(0, limit);
  res.json({ recommendations: filtered });
});

export default router;
