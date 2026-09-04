/**
 * Node test bootstrap: register the `@/` → `client/src/` resolve hook.
 *
 * `pnpm test` runs sources directly through `node --experimental-strip-types`, which has
 * no bundler and no knowledge of `tsconfig`/`vite.config` path aliases. Modules under
 * test that import `@/…` (e.g. `@/i18n/legacy`) would fail to resolve without this.
 */
import { register } from "node:module";

register("./alias-resolve-hook.mjs", import.meta.url);
