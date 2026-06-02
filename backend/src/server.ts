// Main Express server. Mounts the 5 content-factory APIs and starts in-process
// BullMQ workers for the 5 pipeline stages.
//
// In production you may want to split workers into a separate Render service
// (background worker type) so a stuck job can't pin web request latency.
// For v1, in-process is simpler and the worker concurrency is capped at 2.
//
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { config, assertProductionConfig } from "./config.js";
import { startWorker } from "./queue/index.js";

import ingestRouter from "./api/ingest.js";
import videosRouter from "./api/videos.js";
import articlesRouter from "./api/articles.js";
import generateRouter from "./api/generate.js";
import recommendationsRouter from "./api/recommendations.js";

import { runIngestion } from "./agents/ingestion.js";
import { runTranscription } from "./agents/transcription.js";
import { runUnderstanding } from "./agents/understanding.js";
import { runVerification } from "./agents/verification.js";
import { runContentGeneration } from "./agents/content-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

assertProductionConfig();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Rate limit -- generous on reads, tight on writes
app.use(
  "/ingest",
  rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }),
);
app.use(
  "/generate",
  rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }),
);

// Health check -- Render uses this for the /healthz default
app.get("/", (_req, res) => {
  res.json({
    name: "sports-outlet-ai backend",
    version: "0.1.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    db: Boolean(config.databaseUrl),
    redis: Boolean(config.redisUrl),
    openai: Boolean(config.openaiApiKey),
    pinecone: Boolean(config.pineconeApiKey),
  });
});

// Content-factory routes
app.use("/ingest", ingestRouter);
app.use("/videos", videosRouter);
app.use("/articles", articlesRouter);
app.use("/generate", generateRouter);
app.use("/recommendations", recommendationsRouter);

// Legacy chatbot is deployed as a SEPARATE Render service (see infra/render.yaml
// notes on chatbot deploys). Frontends embed it via NEXT_PUBLIC_CHATBOT_URL.
// We expose a tiny info endpoint so downstream debugging is easier.
app.get("/chatbot", (_req, res) => {
  res.json({
    note:
      "Legacy chatbot lives in backend/chatbot-legacy and ships as its own Render " +
      "service per sport (tennisoutlet-chatbot, pickleballoutlet-chatbot, padeloutlet-chatbot). " +
      "Configure each frontend with NEXT_PUBLIC_CHATBOT_URL to point at the right one.",
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "not found", path: req.path });
});

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error", err);
  res.status(500).json({ error: "internal server error" });
});

// ----- Start workers (in-process; move to a worker service when scaling) -----
function startAllWorkers(): void {
  if (!config.redisUrl) {
    console.warn("[server] REDIS_URL missing -- workers NOT started. Pipeline jobs will queue but never run.");
    return;
  }
  startWorker("ingestion", runIngestion);
  startWorker("transcription", runTranscription);
  startWorker("understanding", runUnderstanding);
  startWorker("verification", runVerification);
  startWorker("content-generation", runContentGeneration);
  console.log("[server] 5 workers started: ingestion, transcription, understanding, verification, content-generation");
}

// ----- Listen -----
const port = config.port;
app.listen(port, () => {
  console.log(`[server] sports-outlet-ai backend listening on :${port}`);
  startAllWorkers();
});

// Graceful shutdown -- give in-flight jobs a chance
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    console.log(`[server] received ${sig}, shutting down...`);
    process.exit(0);
  });
}
