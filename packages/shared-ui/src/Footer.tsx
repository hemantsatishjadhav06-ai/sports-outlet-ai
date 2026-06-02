import * as React from "react";
import type { SiteConfig } from "@sports-outlet-ai/types";

export function Footer({ site }: { site: SiteConfig }) {
  return (
    <footer
      style={{
        padding: "24px",
        textAlign: "center",
        fontSize: 13,
        color: "#6b7280",
        borderTop: "1px solid #e5e7eb",
        marginTop: 48,
      }}
    >
      <p>
        © {new Date().getFullYear()} {site.brand} — Powered by Sports Outlet AI
      </p>
      <p style={{ fontSize: 11, marginTop: 4 }}>
        <a href="https://tennisoutlet.in">Tennis</a> ·{" "}
        <a href="https://pickleballoutlet.in">Pickleball</a> ·{" "}
        <a href="https://padeloutlet.in">Padel</a>
      </p>
    </footer>
  );
}
