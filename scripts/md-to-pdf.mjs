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
  @page { size: A4; margin: 20mm 18mm; }
  :root { --ink:#1a1d24; --muted:#5b6472; --line:#e3e6ea; --accent:#2f6df6; --soft:#f6f8fb; }
  * { box-sizing: border-box; }
  body {
    font-family: ${rtl
      ? '"Arial Hebrew","Heebo","Assistant",-apple-system,system-ui,sans-serif'
      : '-apple-system,"Segoe UI",system-ui,Helvetica,Arial,sans-serif'};
    color: var(--ink); line-height: 1.6; font-size: 11.5pt; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 26pt; line-height: 1.15; margin: 0 0 4px; letter-spacing: -0.01em; }
  h1 + p > strong { color: var(--accent); }
  h2 {
    font-size: 14.5pt; margin: 28px 0 10px; padding-${rtl ? "right" : "left"}: 10px;
    border-${rtl ? "right" : "left"}: 3px solid var(--accent);
    page-break-after: avoid;
  }
  p { margin: 8px 0; }
  em { color: var(--muted); }
  hr { border: none; border-top: 1px solid var(--line); margin: 22px 0; }
  ul { margin: 8px 0; padding-${rtl ? "right" : "left"}: 22px; }
  li { margin: 5px 0; }
  strong { color: var(--ink); }
  table {
    width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--line); padding: 8px 10px;
    text-align: ${rtl ? "right" : "left"}; vertical-align: top;
  }
  th { background: var(--soft); font-weight: 600; }
  tr:nth-child(even) td { background: #fafbfc; }
  blockquote { color: var(--muted); border-${rtl ? "right" : "left"}: 3px solid var(--line);
    margin: 12px 0; padding: 2px 14px; }
  code { background: var(--soft); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
</style>
</head>
<body><div class="doc">${body}</div></body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
