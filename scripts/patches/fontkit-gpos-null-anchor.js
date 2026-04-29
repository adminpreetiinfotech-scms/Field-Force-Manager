#!/usr/bin/env node
/**
 * Patches fontkit@2.0.4 GPOSProcessor.getAnchor to handle null anchor records.
 * fontkit crashes with "Cannot read properties of null (reading 'xCoordinate')"
 * when processing complex Devanagari fonts with null GPOS anchor entries.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FIND = `    getAnchor(anchor) {
        // TODO: contour point`;
const REPLACE = `    getAnchor(anchor) {
        if (!anchor) return { x: 0, y: 0 };  // null-safety: fontkit@2.0.4 bug
        // TODO: contour point`;

const base = resolve(
  import.meta.dirname,
  "../../node_modules/.pnpm/fontkit@2.0.4/node_modules/fontkit/dist"
);

let patched = 0;
for (const file of ["main.cjs", "browser.cjs"]) {
  const fpath = `${base}/${file}`;
  try {
    const content = readFileSync(fpath, "utf8");
    if (content.includes("null-safety: fontkit@2.0.4 bug")) {
      console.log(`Already patched: ${file}`);
      patched++;
      continue;
    }
    if (content.includes(FIND)) {
      writeFileSync(fpath, content.replace(FIND, REPLACE));
      console.log(`Patched: ${file}`);
      patched++;
    } else {
      console.warn(`Pattern not found in ${file} — skipping`);
    }
  } catch (e) {
    console.warn(`Could not patch ${file}: ${e.message}`);
  }
}
if (patched > 0) console.log("fontkit GPOS patch applied.");
