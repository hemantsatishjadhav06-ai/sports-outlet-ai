// Cron job: enqueue ingestion for each configured channel.
// Wire this up as a Render Cron Job pointing at this file:
//   tsx scripts/cron-jobs/refresh-content.ts
//
// Schedule suggestion: daily at 04:00 UTC (low traffic, before US morning).
//
// Channels live in env var INGEST_CHANNELS as JSON:
//   [{"channelId":"UCxxx","sport":"tennis"}, ...]
//
import { enqueue } from "../../backend/src/queue/index.js";

interface Channel {
  channelId: string;
  sport: "tennis" | "pickleball" | "padel";
  maxResults?: number;
}

async function main() {
  const raw = process.env.INGEST_CHANNELS;
  if (!raw) {
    console.error("INGEST_CHANNELS env var not set; nothing to do");
    process.exit(0);
  }
  let channels: Channel[];
  try {
    channels = JSON.parse(raw);
  } catch (e) {
    console.error("INGEST_CHANNELS is not valid JSON:", e);
    process.exit(1);
  }
  for (const c of channels) {
    try {
      const jobId = await enqueue("ingestion", c);
      console.log(`[cron] queued ingestion for ${c.sport}/${c.channelId} -> job ${jobId}`);
    } catch (e) {
      console.error(`[cron] failed to enqueue ${c.sport}/${c.channelId}:`, e);
    }
  }
  process.exit(0);
}

main();
