/**
 * Backfill zh/en locale files from a combined patch.
 *
 * Usage: node scripts/i18n-fill.mjs <patch.json>
 * Patch shape: { "<namespace>": { "<flat.key>": { "zh": "…", "en": "…" }, … }, … }
 * Writes/merges src/i18n/locales/zh/<ns>.json and src/i18n/locales/en/<ns>.json,
 * mirroring the nested structure of the vi file.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = resolve(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");
const patch = JSON.parse(readFileSync(process.argv[2], "utf8"));

function setDeep(obj, path, val) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
function flatKeys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flatKeys(v, p));
    else out.push(p);
  }
  return out;
}

for (const [ns, entries] of Object.entries(patch)) {
  for (const lang of ["zh", "en"]) {
    const file = `${LOCALES}/${lang}/${ns}.json`;
    const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    for (const [key, pair] of Object.entries(entries)) {
      if (pair[lang] != null) setDeep(current, key, pair[lang]);
    }
    writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
  }
  // report coverage vs vi
  const viFile = `${LOCALES}/vi/${ns}.json`;
  if (existsSync(viFile)) {
    const viKeys = new Set(flatKeys(JSON.parse(readFileSync(viFile, "utf8"))));
    const patchKeys = new Set(Object.keys(entries));
    const missing = [...viKeys].filter((k) => !patchKeys.has(k));
    console.log(`${ns}: ${patchKeys.size}/${viKeys.size} filled` + (missing.length ? `  MISSING: ${missing.join(", ")}` : "  ✓"));
  }
}
