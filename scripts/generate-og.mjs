/**
 * Generate Open Graph / Twitter Card images at 1200×630.
 *
 * The script is a one-off: run `npm run og` after editing the layout
 * here to regenerate every PNG into `public/`. We use pure SVG strings
 * + @resvg/resvg-js (no satori, no JSX) so there's no font asset to
 * commit and the script stays small.
 *
 * Each card is a dark gradient with a left-edge accent stripe in the
 * portfolio's agent-500 green, the page title in large white type,
 * a short tagline underneath, and the domain in mono-style at the
 * bottom. Same template, parameterised per showcase.
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const cards = [
  {
    file: 'og-default.png',
    title: 'Thomas Abraham',
    tagline: 'Full-Stack Product Engineer & Agentic AI Builder',
  },
  {
    file: 'og-rag.png',
    title: 'Recursive Portfolio Chatbot',
    tagline: 'Self-correcting RAG over a personal knowledge base',
  },
  {
    file: 'og-research.png',
    title: 'Deep Research Agent',
    tagline: 'Plan → search → fact-check → cite. Real Tavily, real Claude.',
  },
  {
    file: 'og-crew.png',
    title: 'Software Architect Crew',
    tagline: 'Three Claude agents collaborating on production code',
  },
  {
    file: 'og-playground.png',
    title: 'Agent Skills Dashboard',
    tagline: 'Live ReAct trace + tool-use playground',
  },
];

/** Escape XML-special chars so titles can include `&`, `<`, `>` safely. */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgFor({ title, tagline }) {
  // Tailwind agent-500 = #22c55e; gray-950 = #030712; gray-700 = #374151
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#030712"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>

    <!-- Accent stripe -->
    <rect x="0" y="0" width="14" height="630" fill="#22c55e"/>

    <!-- Eyebrow -->
    <text x="100" y="200" font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
          font-size="28" fill="#22c55e" font-weight="600">tvabraham.dev</text>

    <!-- Title -->
    <text x="100" y="300" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="72" fill="#ffffff" font-weight="700">${xmlEscape(title)}</text>

    <!-- Tagline (manually wrapped: split at ~60 chars) -->
    ${wrappedTagline(tagline, 100, 380, 60)}

    <!-- Footer chip -->
    <rect x="100" y="500" width="280" height="44" rx="8" ry="8" fill="#0a1f17" stroke="#14532d" stroke-width="1"/>
    <text x="118" y="528" font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
          font-size="18" fill="#86efac">agentic ai · production</text>
  </svg>`;
}

/** Naive word-wrap into <text> tspans at the given y-offset. */
function wrappedTagline(text, x, y, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines
    .slice(0, 3)
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * 44}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="32" fill="#cbd5e1" font-weight="400">${xmlEscape(l)}</text>`,
    )
    .join('\n    ');
}

mkdirSync(publicDir, { recursive: true });

for (const card of cards) {
  const svg = svgFor(card);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#030712',
  })
    .render()
    .asPng();
  const out = resolve(publicDir, card.file);
  writeFileSync(out, png);
  console.log(`✓ ${card.file} (${(png.length / 1024).toFixed(1)} KiB)`);
}

console.log(`\nGenerated ${cards.length} OG images in ${publicDir}.`);
