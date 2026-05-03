"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something broke.</h1>
        <p style={{ opacity: 0.7 }}>The error has been logged.</p>
        {error.digest && <p style={{ opacity: 0.5, fontFamily: "monospace", marginTop: "0.5rem" }}>ref: {error.digest}</p>}
        <a href="/" style={{ display: "inline-block", marginTop: "1.5rem", color: "#60a5fa" }}>
          Reload
        </a>
      </body>
    </html>
  );
}
