import * as React from "react";

// Embeds the legacy chatbot iframe. The chatbot URL is sport-aware via the
// ?sport= query param; the backend uses it to scope policy URLs and branding.
export function ChatWidget({ chatbotUrl, sport }: { chatbotUrl: string; sport: string }) {
  const [open, setOpen] = React.useState(false);
  const src = `${chatbotUrl}?sport=${encodeURIComponent(sport)}`;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
      {open && (
        <iframe
          src={src}
          title="Chat assistant"
          style={{
            width: 380,
            height: 560,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            background: "white",
            marginBottom: 12,
          }}
        />
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "#1a7a1a",
          color: "white",
          fontSize: 24,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
