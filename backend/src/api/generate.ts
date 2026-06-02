import { Router } from "express";
import { z } from "zod";
import { enqueue } from "../queue/index.js";
import { requireIngestKey } from "./_authenticate.js";

const router = Router();

const Body = z.object({
  video_id: z.string().uuid(),
});

// POST /generate -- manually trigger content generation for a specific video.
// Useful when an editor wants to retry a draft or generate from a video the
// auto-pipeline hasn't reached yet.
router.post("/", requireIngestKey, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const jobId = await enqueue("content-generation", parsed.data);
  res.json({ ok: true, job_id: jobId });
});

export default router;
