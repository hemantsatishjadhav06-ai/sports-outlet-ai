import { Router } from "express";
import { z } from "zod";
import { enqueue } from "../queue/index.js";
import { requireIngestKey } from "./_authenticate.js";

const router = Router();

const Body = z.object({
  channelId: z.string().min(1),
  sport: z.enum(["tennis", "pickleball", "padel"]),
  maxResults: z.number().int().min(1).max(50).optional(),
});

// POST /ingest/channel -- enqueue a YouTube channel for ingestion.
// The actual fetch + upsert happens asynchronously in the worker.
router.post("/channel", requireIngestKey, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const jobId = await enqueue("ingestion", parsed.data);
    res.json({ ok: true, job_id: jobId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
