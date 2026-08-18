#!/usr/bin/env node
// One-off: render a Markdown proposal to a styled, print-ready HTML file.
// Usage: node scripts/md-to-pdf.mjs <input.md> <output.html> [--rtl]
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const [, , inPath, outPath, ...flags] = process.argv;
const rtl = flags.includes("--rtl");
const md = readFileSync(inPath, "utf8");

marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(md);

const html = `<!doctype html>
<html lang="${rtl ? "he" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<title>TradeLog Proposal</title>
<style>
  @page { size: A4; margin: 15mm 16mm; }
  :root { --ink:#1a1d24; --muted:#5b6472; --line:#e3e6ea; --accent:#2f6df6; --soft:#f6f8fb; }
  * { box-sizing: border-box; }
  body {
    font-family: ${
      rtl
        ? '"Arial Hebrew","Heebo","Assistant",-apple-system,system-ui,sans-serif'
        : '-apple-system,"Segoe UI",system-ui,Helvetica,Arial,sans-serif'
    };
    color: var(--ink); line-height: 1.5; font-size: 11.5pt; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 26pt; line-height: 1.15; margin: 0 0 4px; letter-spacing: -0.01em; }
  h1 + p > strong { color: var(--accent); }
  h2 {
    font-size: 14.5pt; margin: 20px 0 8px; padding-${rtl ? "right" : "left"}: 10px;
    border-${rtl ? "right" : "left"}: 3px solid var(--accent);
    page-break-after: avoid;
  }
  p { margin: 7px 0; }
  em { color: var(--muted); }
  hr { border: none; border-top: 1px solid var(--line); margin: 14px 0; }
  ul { margin: 8px 0; padding-${rtl ? "right" : "left"}: 22px; }
  li { margin: 3px 0; }
  strong { color: var(--ink); }
  table {
    width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--line); padding: 6px 9px;
    text-align: ${rtl ? "right" : "left"}; vertical-align: top;
  }
  th { background: var(--soft); font-weight: 600; }
  tr:nth-child(even) td { background: #fafbfc; }
  blockquote { color: var(--muted); border-${rtl ? "right" : "left"}: 3px solid var(--line);
    margin: 12px 0; padding: 2px 14px; }
  code { background: var(--soft); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
  /* Fenced blocks hold the architecture diagram: ~92 monospace columns, which
     overflows the 760px text column at the default size and gets clipped at
     the page edge in print. 8.5pt keeps it inside. Always LTR — an RTL page
     would otherwise reorder the arrows and break the alignment. */
  pre {
    background: var(--soft); border: 1px solid var(--line); border-radius: 6px;
    padding: 10px 12px; margin: 14px 0; direction: ltr; text-align: left;
  }
  pre code {
    background: none; padding: 0; font-size: 8.5pt; line-height: 1.35;
    white-space: pre; display: block;
  }
</style>
</head>
<body><div class="doc">${body}</div></body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
