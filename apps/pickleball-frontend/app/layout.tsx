import * as React from "react";
import { Header, Footer } from "@sports-outlet-ai/shared-ui";
import { siteConfig } from "../lib/site-config";

export const metadata = {
  title: `${siteConfig.brand} — ${siteConfig.tagline}`,
  description: siteConfig.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Runtime sanity check: SPORT env var must match the compiled site-config.
  // If they drift (wrong env var on Render), fail loudly at request time so
  // ops sees it instead of customers.
  if (process.env.SPORT && process.env.SPORT !== siteConfig.sport) {
    console.error(
      `[layout] SPORT env=${process.env.SPORT} but siteConfig.sport=${siteConfig.sport}. ` +
      `One of them is wrong -- check Render env vars for this service.`
    );
  }
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif", margin: 0, background: "#f9fafb", color: "#1f2937" }}>
        <Header site={siteConfig} />
        <main style={{ minHeight: "60vh", maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
          {children}
        </main>
        <Footer site={siteConfig} />
      </body>
    </html>
  );
}
