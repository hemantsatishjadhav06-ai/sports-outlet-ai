import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

// GET /videos?sport=tennis&limit=20
router.get("/", async (req, res) => {
  const sport = String(req.query.sport ?? "");
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const db = getDb();
  const args: unknown[] = [limit];
  let where = "";
  if (sport && ["tennis", "pickleball", "padel"].includes(sport)) {
    where = `WHERE sport = $2`;
    args.push(sport);
  }
  const r = await db.query(
    `SELECT id, youtube_id, title, channel, sport, url, duration_seconds, published_at, ingested_at
     FROM videos ${where} ORDER BY ingested_at DESC LIMIT $1`,
    args,
  );
  res.json({ videos: r.rows });
});

export default router;
