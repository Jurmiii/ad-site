import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RE = /\r?\n    <meta\r?\n      property="og:description"\r?\n      content="[^"]*"\r?\n    \/>\r?\n\r?\n    <meta\r?\n      name="twitter:description"\r?\n      content="[^"]*"\r?\n    \/>/g;

function walk(dir, acc) {
  for (const n of fs.readdirSync(dir)) {
    if (n === "node_modules" || n === ".git") continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      if (n === "components") continue;
      walk(p, acc);
    } else if (n.endsWith(".html")) {
      acc.push(p);
    }
  }
}
const acc = [];
walk(ROOT, acc);
let n = 0;
for (const fp of acc) {
  if (fp.includes(`${path.sep}components${path.sep}`) || fp.includes("scripts" + path.sep)) continue;
  let html = fs.readFileSync(fp, "utf8");
  const out = html.replace(RE, "");
  if (out !== html) {
    fs.writeFileSync(fp, out, "utf8");
    console.log("dedup", path.relative(ROOT, fp).replace(/\\/g, "/"));
    n++;
  }
}
console.log("done", n);
