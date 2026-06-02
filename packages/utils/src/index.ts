// Tiny shared helpers. Keep ZERO runtime dependencies in this package -- it's
// imported by both backend (Node) and frontends (Next.js / browser).

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function asEnv(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v == null || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

export function asEnvOptional(key: string): string | undefined {
  const v = process.env[key];
  return v == null || v === "" ? undefined : v;
}

export function isoNow(): string {
  return new Date().toISOString();
}
