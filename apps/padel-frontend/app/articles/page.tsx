import * as React from "react";
import { siteConfig } from "../../lib/site-config";
import type { Article } from "@sports-outlet-ai/types";

async function fetchArticles(): Promise<Article[]> {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${api}/articles?sport=${siteConfig.sport}&limit=50`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles: Article[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export default async function ArticlesPage() {
  const articles = await fetchArticles();
  return (
    <div>
      <h2 style={{ fontSize: 28, margin: "0 0 16px" }}>All {siteConfig.sport} articles</h2>
      {articles.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No articles yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {articles.map((a) => (
            <li key={a.id}>
              <a href={`/articles/${a.slug}`} style={{ color: siteConfig.primaryColor }}>
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
