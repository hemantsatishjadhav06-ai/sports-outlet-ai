// Ingestion agent: given a YouTube channel handle, fetch recent videos and
// upsert them into the videos table. Each new video then gets a transcription
// job enqueued.
//
// Requires YOUTUBE_API_KEY (Google Cloud → YouTube Data API v3).
//
import axios from "axios";
import { getDb } from "../db/index.js";
import { enqueue } from "../queue/index.js";
import { config } from "../config.js";
import type { Sport } from "@sports-outlet-ai/types";

interface IngestInput {
  channelId: string;     // UC... format (or use channelHandle resolution)
  sport: Sport;
  maxResults?: number;
}

interface YTVideo {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  duration?: number;
}

export async function runIngestion(input: IngestInput): Promise<{ ingested: number; skipped: number }> {
  if (!config.youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY not set -- cannot ingest");
  }
  const max = Math.min(input.maxResults ?? 10, 50);

  // Step 1: search recent uploads from this channel
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${input.channelId}&order=date&type=video&maxResults=${max}&key=${config.youtubeApiKey}`;
  const sr = await axios.get(searchUrl, { timeout: 15000 });
  const items = (sr.data.items ?? []) as Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string } }>;
  const videos: YTVideo[] = items.map((i) => ({
    id: i.id.videoId,
    title: i.snippet.title,
    channelTitle: i.snippet.channelTitle,
    publishedAt: i.snippet.publishedAt,
  }));

  // Step 2: upsert into DB and enqueue transcription jobs for new ones
  const db = getDb();
  let ingested = 0, skipped = 0;
  for (const v of videos) {
    const existing = await db.query(`SELECT id FROM videos WHERE youtube_id = $1`, [v.id]);
    if (existing.rowCount && existing.rowCount > 0) {
      skipped++;
      continue;
    }
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO videos (youtube_id, title, channel, sport, url, published_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [v.id, v.title, v.channelTitle, input.sport, `https://www.youtube.com/watch?v=${v.id}`, v.publishedAt],
    );
    const dbId = inserted.rows[0].id;
    await enqueue("transcription", { video_id: dbId, youtube_id: v.id });
    ingested++;
  }
  return { ingested, skipped };
}
