// Helper for design-contract tests after the i18n migration.
//
// Historic contract tests assert that a specific Chinese UI string is present in a
// component's source. Post-migration the canonical Chinese copy can live in the source
// (still inline via translateUi / t default / a bare literal) OR in a locale JSON file
// under src/i18n/locales (a real namespace key, or the legacy compatibility bridge).
//
// assertCopy(source, chinese) passes if the copy is reachable through any of those, so
// the contract "this wording ships in the product" stays meaningful without pinning the
// delivery mechanism.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales");

function collectStringValues(node, out) {
  if (typeof node === "string") {
    out.add(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectStringValues(value, out);
  }
  return out;
}

let cachedValues = null;

function allLocaleValues() {
  if (cachedValues) return cachedValues;
  const values = new Set();
  if (existsSync(LOCALES_DIR)) {
    for (const lang of readdirSync(LOCALES_DIR)) {
      const langDir = join(LOCALES_DIR, lang);
      let files;
      try {
        files = readdirSync(langDir).filter((f) => f.endsWith(".json"));
      } catch {
        continue;
      }
      for (const file of files) {
        try {
          collectStringValues(JSON.parse(readFileSync(join(langDir, file), "utf8")), values);
        } catch {
          /* ignore unparseable locale file */
        }
      }
    }
  }
  cachedValues = values;
  return values;
}

/** True if `chinese` appears in `source` or as (part of) any shipped locale string. */
export function hasCopy(source, chinese) {
  if (typeof source === "string" && source.includes(chinese)) return true;
  for (const value of allLocaleValues()) {
    if (value.includes(chinese)) return true;
  }
  return false;
}

export function assertCopy(source, chinese, message) {
  assert.ok(
    hasCopy(source, chinese),
    message ?? `expected UI copy ${JSON.stringify(chinese)} in source or a locale file`,
  );
}
