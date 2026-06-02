// Transcription agent: given a video_id (db row), download the audio and run
// it through OpenAI Whisper. Stores result in transcripts table and enqueues
// the understanding job.
//
// Implementation note: in production you'd use yt-dlp or a third-party API to
// extract audio. Here we stub the audio fetch with a clear TODO so the rest
// of the pipeline is testable end-to-end without sinking days into a YouTube
// extractor that breaks every quarter.
//
import { getDb } from "../db/index.js";
import { enqueue } from "../queue/index.js";
import { llmGuard, openai, hasOpenAI } from "./_openai.js";

export async function runTranscription(input: { video_id: string; youtube_id: string }): Promise<void> {
  const db = getDb();
  const v = await db.query<{ title: string; url: string }>(
    `SELECT title, url FROM videos WHERE id = $1`, [input.video_id],
  );
  if (!v.rowCount) throw new Error(`Video ${input.video_id} not found`);

  // In production: download audio (yt-dlp) and pass File to whisper.transcribe.
  // For now we record a placeholder transcript so the pipeline runs end-to-end.
  // Replace this block once you have an audio extraction service.
  let content: string;
  if (hasOpenAI() && process.env.WHISPER_AUDIO_URL) {
    // If you want to wire up Whisper, fetch the audio, then:
    await llmGuard(0.05); // ~5¢ per Whisper minute -- adjust per duration
    const audioRes = await fetch(process.env.WHISPER_AUDIO_URL);
    const audioBuf = await audioRes.arrayBuffer();
    const tr = await openai().audio.transcriptions.create({
      file: new File([audioBuf], "audio.mp3", { type: "audio/mpeg" }),
      model: "whisper-1",
    });
    content = tr.text;
  } else {
    content = `[Transcript placeholder for "${v.rows[0].title}". ` +
      `Wire up an audio extractor (yt-dlp or supadata.io) and set WHISPER_AUDIO_URL ` +
      `to enable real Whisper transcription.]`;
  }

  await db.query(
    `INSERT INTO transcripts (video_id, content, word_count, language)
     VALUES ($1, $2, $3, 'en')
     ON CONFLICT (video_id) DO UPDATE SET content = $2, word_count = $3`,
    [input.video_id, content, content.split(/\s+/).length],
  );
  await enqueue("understanding", { video_id: input.video_id });
}
