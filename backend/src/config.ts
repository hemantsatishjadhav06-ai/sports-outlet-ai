import dotenv from "dotenv";
dotenv.config();

function read(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v == null || v === "") {
    if (fallback !== undefined) return fallback;
    return "";
  }
  return v;
}

function readNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  nodeEnv: read("NODE_ENV", "development"),
  port: readNum("PORT", 3001),

  databaseUrl: read("DATABASE_URL"),
  redisUrl: read("REDIS_URL"),

  openaiApiKey: read("OPENAI_API_KEY"),
  openrouterApiKey: read("OPENROUTER_API_KEY"),
  openrouterModel: read("OPENROUTER_MODEL", "openai/gpt-4o"),

  pineconeApiKey: read("PINECONE_API_KEY"),
  pineconeIndex: read("PINECONE_INDEX", "sports-outlet-ai"),

  youtubeApiKey: read("YOUTUBE_API_KEY"),

  llmMaxDailyUsd: readNum("LLM_MAX_DAILY_USD", 10),
  ingestApiKey: read("INGEST_API_KEY"),

  magento: {
    baseUrl: read("MAGENTO_BASE_URL", "https://console.tennisoutlet.in/rest/V1"),
    storeUrl: read("MAGENTO_STORE_URL", "https://tennisoutlet.in"),
    token: read("MAGENTO_TOKEN"),
  },

  storeUrls: {
    tennis: read("TENNIS_STORE_URL", "https://tennisoutlet.in"),
    pickleball: read("PICKLEBALL_STORE_URL", "https://pickleballoutlet.in"),
    padel: read("PADEL_STORE_URL", "https://padeloutlet.in"),
  },
} as const;

export function assertProductionConfig(): void {
  const missing: string[] = [];
  // The bare minimum to start the server in production
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  // Redis is optional locally; required in prod for queue work
  // OpenAI is required for any agent to function; warn if missing
  if (!config.openaiApiKey) {
    console.warn("[config] OPENAI_API_KEY missing -- agents will return stubbed data");
  }
  if (config.nodeEnv === "production" && missing.length) {
    throw new Error(`Cannot start in production without: ${missing.join(", ")}`);
  }
}
