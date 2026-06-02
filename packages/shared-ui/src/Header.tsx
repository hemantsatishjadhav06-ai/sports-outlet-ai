import * as React from "react";
import type { SiteConfig } from "@sports-outlet-ai/types";

export function Header({ site }: { site: SiteConfig }) {
  return (
    <header
      style={{
        background: site.primaryColor,
        color: "white",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ fontSize: 28 }}>{site.emoji}</span>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{site.brand}</h1>
        <p style={{ fontSize: 12, opacity: 0.9, margin: 0 }}>{site.tagline}</p>
      </div>
      <nav style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 14 }}>
        <a href="/" style={{ color: "white", textDecoration: "none" }}>Home</a>
        <a href="/articles" style={{ color: "white", textDecoration: "none" }}>Articles</a>
        <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" style={{ color: "white", textDecoration: "none" }}>
          Shop ↗
        </a>
      </nav>
    </header>
  );
}
