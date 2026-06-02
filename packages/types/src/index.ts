// Shared types across backend + frontends. Keep these stable -- changes here
// require coordinated deploys across all 4 services.

export type Sport = "tennis" | "pickleball" | "padel";

export interface SiteConfig {
  sport: Sport;
  domain: string;
  brand: string;
  tagline: string;
  emoji: string;
  primaryColor: string;
}

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  channel: string;
  sport: Sport;
  url: string;
  duration_seconds: number | null;
  published_at: string | null; // ISO 8601
  ingested_at: string;          // ISO 8601
}

export interface Transcript {
  id: string;
  video_id: string;
  content: string;
  word_count: number;
  language: string;             // e.g. "en"
  created_at: string;
}

export interface Insight {
  id: string;
  video_id: string;
  topics: string[];             // ["forehand technique", "grip"]
  tips: string[];               // ["keep elbow close to body"]
  product_mentions: string[];   // ["Wilson Pro Staff"]
  difficulty: "beginner" | "intermediate" | "advanced" | "unknown";
  confidence: number;           // 0-1, set by verification-agent
  verified: boolean;
  created_at: string;
}

export interface Article {
  id: string;
  slug: string;
  sport: Sport;
  title: string;
  content_markdown: string;
  source_video_id: string | null;
  status: "draft" | "review" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  article_id: string;
  related_article_id: string;
  similarity: number;           // 0-1 cosine
}
