-- Initial schema for sports-outlet-ai content brain.
-- Idempotent (CREATE IF NOT EXISTS) so re-running is safe.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- 1. videos: every YouTube video we've ingested
CREATE TABLE IF NOT EXISTS videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id   TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  channel      TEXT NOT NULL,
  sport        TEXT NOT NULL CHECK (sport IN ('tennis', 'pickleball', 'padel')),
  url          TEXT NOT NULL,
  duration_seconds INT,
  published_at TIMESTAMPTZ,
  ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_sport ON videos (sport);
CREATE INDEX IF NOT EXISTS idx_videos_ingested_at ON videos (ingested_at DESC);

-- 2. transcripts: Whisper output for each video
CREATE TABLE IF NOT EXISTS transcripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  word_count  INT NOT NULL DEFAULT 0,
  language    TEXT NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id)
);
CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts (video_id);

-- 3. insights: structured extraction from each transcript
CREATE TABLE IF NOT EXISTS insights (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id          UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  topics            TEXT[] NOT NULL DEFAULT '{}',
  tips              TEXT[] NOT NULL DEFAULT '{}',
  product_mentions  TEXT[] NOT NULL DEFAULT '{}',
  difficulty        TEXT NOT NULL DEFAULT 'unknown' CHECK (difficulty IN ('beginner','intermediate','advanced','unknown')),
  confidence        REAL NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  verified          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id)
);
CREATE INDEX IF NOT EXISTS idx_insights_video_id ON insights (video_id);

-- 4. articles: generated content ready for publishing
CREATE TABLE IF NOT EXISTS articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE NOT NULL,
  sport            TEXT NOT NULL CHECK (sport IN ('tennis', 'pickleball', 'padel')),
  title            TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  source_video_id  UUID REFERENCES videos(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published')),
  published_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_articles_sport_status ON articles (sport, status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);

-- 5. recommendations: precomputed article→article similarity links
CREATE TABLE IF NOT EXISTS recommendations (
  article_id          UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  related_article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  similarity          REAL NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
  PRIMARY KEY (article_id, related_article_id),
  CHECK (article_id <> related_article_id)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_article_id ON recommendations (article_id);

-- 6. llm_spend: rolling cost tracker for kill-switch
CREATE TABLE IF NOT EXISTS llm_spend (
  day        DATE PRIMARY KEY,
  usd_spent  NUMERIC(10, 4) NOT NULL DEFAULT 0
);
