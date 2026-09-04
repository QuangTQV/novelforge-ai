/**
 * Module resolve hook: map the Vite-style `@/` alias to `client/src/`, with the
 * extension probing (`Bundler` moduleResolution) that `node --test` otherwise lacks.
 * Registered by `tests/alias-hook.mjs`.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC_URL = pathToFileURL(
  resolvePath(dirname(fileURLToPath(import.meta.url)), "../src"),
).href;

const CANDIDATES = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@" || specifier.startsWith("@/")) {
    const rest = specifier === "@" ? "" : specifier.slice(1);
    const base = SRC_URL + rest;
    for (const ext of CANDIDATES) {
      const candidate = base + ext;
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context);
      }
    }
    return nextResolve(base, context);
  }
  return nextResolve(specifier, context);
}
