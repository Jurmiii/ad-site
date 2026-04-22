/**
 * Set og:url, og:image, twitter, canonical for all HTML.
 * Skips: assets/components/**, scripts/**
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://money-calender.netlify.app";
const OG_IMAGE = `${BASE}/images/og.img.webp`;

function fileToCanonicalUrl(relPath) {
  const rel = relPath.replace(/\\/g, "/");
  if (rel === "privacy-policy.html") return `${BASE}/privacy-policy.html`;
  if (rel === "assets/index.html") return `${BASE}/`;
  if (rel.startsWith("assets/")) return `${BASE}/${rel.slice("assets/".length)}`;
  return `${BASE}/`;
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "Money Calendar";
}

function getDescription(html) {
  let m = html.match(/name="description"[^>]*content="([^"]*)"/i);
  if (m) return m[1];
  m = html.match(/name="description"[\s\S]*?content="([^"]*)"/i);
  if (m) return m[1];
  m = html.match(/content="([^"]*)"[^>]*name="description"/i);
  if (m) return m[1];
  return "Money Calendar — 건설적인 재정 생활";
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildBlock(url, title, description) {
  return (
    `    <meta property="og:type" content="website" />\n` +
    `    <meta property="og:url" content="${url}" />\n` +
    `    <meta property="og:title" content="${escapeAttr(title)}" />\n` +
    `    <meta property="og:description" content="${escapeAttr(description)}" />\n` +
    `    <meta property="og:image" content="${OG_IMAGE}" />\n` +
    `    <meta property="og:image:type" content="image/webp" />\n` +
    `    <meta property="og:locale" content="ko_KR" />\n` +
    `    <meta property="og:site_name" content="Money Calendar" />\n` +
    `    <meta name="twitter:card" content="summary_large_image" />\n` +
    `    <meta name="twitter:title" content="${escapeAttr(title)}" />\n` +
    `    <meta name="twitter:description" content="${escapeAttr(description)}" />\n` +
    `    <meta name="twitter:image" content="${OG_IMAGE}" />\n` +
    `    <link rel="canonical" href="${url}" />\n`
  );
}

function stripSocialLines(html) {
  const lines = html.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*<meta\s+property="og:/i.test(line)) continue;
    if (/^\s*<meta\s+name="twitter:/i.test(line)) continue;
    if (/^\s*<link\s+rel="canonical"/i.test(line)) continue;
    if (/<!--\s*=+.*Open Graph/i.test(line)) continue;
    if (/<!--\s*=+.*Twitter 카드/i.test(line)) continue;
    if (/<!--\s*=+.*Twitter /i.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

function insertAfterFirstDescriptionMeta(html, block) {
  const key = 'name="description"';
  const k = html.indexOf(key);
  if (k !== -1) {
    const start = html.lastIndexOf("<meta", k);
    if (start !== -1) {
      const end = html.indexOf("/>", k);
      if (end !== -1) {
        const after = end + 2;
        return html.slice(0, after) + "\n" + block + html.slice(after);
      }
    }
  }
  const t = html.indexOf("</title>");
  if (t === -1) return html;
  const end = t + "</title>".length;
  return html.slice(0, end) + "\n" + block + html.slice(end);
}

function walkHtmlFiles(dir, baseRel, acc) {
  for (const n of fs.readdirSync(dir)) {
    if (n === "node_modules" || n === ".git") continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === "components" && (baseRel === "assets" || baseRel.endsWith("/assets"))) continue;
      walkHtmlFiles(p, baseRel ? baseRel + "/" + n : n, acc);
    } else if (n.endsWith(".html")) {
      if (n.startsWith(".")) continue;
      acc.push(baseRel ? baseRel + "/" + n : n);
    }
  }
}

function processFile(relPath) {
  const full = path.join(ROOT, relPath.replace(/\//g, path.sep));
  let html = fs.readFileSync(full, "utf8");
  const url = fileToCanonicalUrl(relPath);
  const title = getTitle(html);
  const description = getDescription(html);
  const block = buildBlock(url, title, description);
  html = stripSocialLines(html);
  html = insertAfterFirstDescriptionMeta(html, block);
  fs.writeFileSync(full, html, "utf8");
}

const acc = [];
walkHtmlFiles(ROOT, "", acc);
for (const rel of acc.sort()) {
  const relFs = rel.replace(/\\/g, "/");
  if (relFs.startsWith("scripts/")) continue;
  if (relFs.includes("assets/components/")) continue;
  processFile(relFs);
  console.log("OK " + relFs);
}
