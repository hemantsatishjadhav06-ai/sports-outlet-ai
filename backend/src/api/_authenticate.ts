import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

// Lightweight shared-secret auth for ingest/* endpoints.
// Frontends and public endpoints don't need this.
export function requireIngestKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.ingestApiKey) {
    res.status(503).json({ error: "INGEST_API_KEY not configured on server" });
    return;
  }
  const got = req.header("X-Ingest-Key");
  if (got !== config.ingestApiKey) {
    res.status(401).json({ error: "invalid X-Ingest-Key" });
    return;
  }
  next();
}
