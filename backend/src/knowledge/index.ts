// Vector store wrapper with two backends:
//   - Pinecone (when PINECONE_API_KEY is set)
//   - In-memory fallback (cosine similarity over a Map)
//
// The fallback is suitable for dev / small-scale; switch to Pinecone for prod.
//
// Embeddings are produced via OpenAI's text-embedding-3-small model. If
// OPENAI_API_KEY is missing we return a deterministic hash-based vector so
// downstream code doesn't crash; semantic quality is zero in that mode.

import { config } from "../config.js";
import { OpenAI } from "openai";

const EMBED_DIM = 1536; // text-embedding-3-small
const EMBED_MODEL = "text-embedding-3-small";

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (openai) return openai;
  openai = new OpenAI({ apiKey: config.openaiApiKey });
  return openai;
}

export async function embed(text: string): Promise<number[]> {
  const client = getOpenAI();
  if (!client) {
    return hashVector(text); // graceful fallback so callers don't crash
  }
  const r = await client.embeddings.create({ model: EMBED_MODEL, input: text });
  return r.data[0].embedding;
}

// Crude deterministic embedding for offline/dev use only -- DO NOT rely on
// this for any semantic quality.
function hashVector(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  for (let i = 0; i < text.length; i++) {
    v[i % EMBED_DIM] += (text.charCodeAt(i) % 37) / 100;
  }
  // L2 normalize
  let n = 0;
  for (const x of v) n += x * x;
  const norm = Math.sqrt(n) || 1;
  return v.map((x) => x / norm);
}

// In-memory store (used when Pinecone isn't configured)
type StoreEntry = { id: string; vector: number[]; metadata: Record<string, unknown> };
const memStore: StoreEntry[] = [];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function upsert(id: string, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const vector = await embed(text);
  if (config.pineconeApiKey) {
    // Pinecone path -- using REST so we don't pull a giant SDK
    const url = `https://${config.pineconeIndex}.svc.pinecone.io/vectors/upsert`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": config.pineconeApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vectors: [{ id, values: vector, metadata }] }),
    });
    if (!res.ok) {
      console.warn(`[knowledge] Pinecone upsert failed (${res.status}); falling back to memory`);
    } else {
      return;
    }
  }
  // memory fallback
  const i = memStore.findIndex((e) => e.id === id);
  if (i >= 0) memStore[i] = { id, vector, metadata };
  else memStore.push({ id, vector, metadata });
}

export async function query(text: string, topK = 5): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
  const vector = await embed(text);
  if (config.pineconeApiKey) {
    const url = `https://${config.pineconeIndex}.svc.pinecone.io/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": config.pineconeApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vector, topK, includeMetadata: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
      return (data.matches ?? []).map((m) => ({ id: m.id, score: m.score, metadata: m.metadata ?? {} }));
    }
    console.warn(`[knowledge] Pinecone query failed (${res.status}); falling back to memory`);
  }
  // memory fallback
  return memStore
    .map((e) => ({ id: e.id, score: cosine(vector, e.vector), metadata: e.metadata }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
