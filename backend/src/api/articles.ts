import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

// GET /articles?sport=tennis&status=published&limit=20
router.get("/", async (req, res) => {
  const sport = String(req.query.sport ?? "");
  const status = String(req.query.status ?? "published");
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const db = getDb();
  const args: unknown[] = [limit, status];
  let where = `WHERE status = $2`;
  if (sport && ["tennis", "pickleball", "padel"].includes(sport)) {
    where += ` AND sport = $3`;
    args.push(sport);
  }
  const r = await db.query(
    `SELECT id, slug, sport, title, content_markdown, source_video_id, status, published_at, created_at, updated_at
     FROM articles ${where} ORDER BY COALESCE(published_at, created_at) DESC LIMIT $1`,
    args,
  );
  res.json({ articles: r.rows });
});

// GET /articles/:slug
router.get("/:slug", async (req, res) => {
  const db = getDb();
  const r = await db.query(
    `SELECT id, slug, sport, title, content_markdown, source_video_id, status, published_at, created_at, updated_at
     FROM articles WHERE slug = $1`,
    [req.params.slug],
  );
  if (!r.rowCount) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ article: r.rows[0] });
});

export default router;
