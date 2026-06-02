import * as React from "react";
import { ChatWidget } from "@sports-outlet-ai/shared-ui";
import { siteConfig } from "../lib/site-config";
import type { Article } from "@sports-outlet-ai/types";

async function fetchArticles(): Promise<Article[]> {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${api}/articles?sport=${siteConfig.sport}&limit=6`, {
      // Revalidate every 5 minutes -- balance freshness vs backend load
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles: Article[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const articles = await fetchArticles();
  return (
    <div>
      <section style={{ padding: "48px 0 32px", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, margin: "0 0 12px" }}>
          {siteConfig.emoji} Welcome to {siteConfig.brand}
        </h2>
        <p style={{ fontSize: 18, color: "#4b5563" }}>{siteConfig.tagline}</p>
      </section>

      <section>
        <h3 style={{ fontSize: 22, marginBottom: 16 }}>Latest articles</h3>
        {articles.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No articles yet. The content engine will populate this once a YouTube
            channel is ingested.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
            {articles.map((a) => (
              <li key={a.id} style={{ background: "white", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" }}>
                <h4 style={{ margin: "0 0 6px" }}>
                  <a href={`/articles/${a.slug}`} style={{ color: siteConfig.primaryColor, textDecoration: "none" }}>
                    {a.title}
                  </a>
                </h4>
                <small style={{ color: "#6b7280" }}>
                  {a.published_at ? new Date(a.published_at).toLocaleDateString() : "Draft"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChatWidget
        chatbotUrl={process.env.NEXT_PUBLIC_CHATBOT_URL || "http://localhost:3001/chatbot"}
        sport={siteConfig.sport}
      />
    </div>
  );
}
