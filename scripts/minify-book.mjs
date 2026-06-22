// Reads the pretty + sorted opening book from `data/opening-book.json`
// (the git-tracked source) and writes a minified single-line version to
// `public/opening-book.json` for the AI Web Worker to fetch.
//
// Wired into `predev` and `prebuild` so the public copy is always
// up-to-date relative to the source.
import fs from "node:fs";
import path from "node:path";
import { stringifyMinified } from "./book-format.mjs";

const sourcePath = path.join("data", "opening-book.json");
const distPath = path.join("public", "opening-book.json");

if (!fs.existsSync(sourcePath)) {
  console.warn(`[book:minify] source missing: ${sourcePath} — skipping`);
  process.exit(0);
}

const sourceText = fs.readFileSync(sourcePath, "utf-8");
const parsed = JSON.parse(sourceText);
const minified = stringifyMinified(parsed);

fs.mkdirSync(path.dirname(distPath), { recursive: true });
fs.writeFileSync(distPath, minified);

const srcKB = (fs.statSync(sourcePath).size / 1024).toFixed(1);
const dstKB = (fs.statSync(distPath).size / 1024).toFixed(1);
console.log(
  `[book:minify] ${sourcePath} (${srcKB} KB) → ${distPath} (${dstKB} KB)`,
);
