/**
 * 校验所有语言的翻译文件键是否一致 / Kiểm tra tính đồng bộ khóa giữa các ngôn ngữ / Locale key-parity checker.
 *
 * 用法 / Cách dùng / Usage:
 *   node scripts/i18n-check.mjs
 *
 * 以 FALLBACK（vi）为基准，报告其它语言缺失或多余的 key；缺少整个 namespace 时提示回退到 vi。
 * Lấy FALLBACK (vi) làm chuẩn, báo cáo các key thiếu / thừa ở những ngôn ngữ khác.
 * Uses FALLBACK (vi) as the source of truth; reports missing / extra keys in other languages.
 *
 * 退出码 1 表示已有语言文件存在 key 不一致（可用于 CI）/ Exit code 1 nếu key không đồng bộ.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(here, "../src/i18n/locales");
const FALLBACK = "vi";

function flatten(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flatten(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadNamespace(lang, ns) {
  const file = join(LOCALES_DIR, lang, `${ns}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

const languages = readdirSync(LOCALES_DIR).filter(
  (entry) =>
    statSync(join(LOCALES_DIR, entry)).isDirectory() &&
    readdirSync(join(LOCALES_DIR, entry)).some((f) => f.endsWith(".json")),
);

const namespaces = [
  ...new Set(
    languages.flatMap((lang) =>
      readdirSync(join(LOCALES_DIR, lang))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, "")),
    ),
  ),
].sort();

let hasError = false;
const CJK = /[\u3400-\u9fff]/;

for (const ns of namespaces) {
  const base = loadNamespace(FALLBACK, ns);
  if (!base) {
    console.error(`✖ [${ns}] 基准语言 ${FALLBACK} 缺少该命名空间 / thiếu namespace ở ngôn ngữ chuẩn / missing in base language`);
    hasError = true;
    continue;
  }
  const baseKeys = new Set(flatten(base));

  for (const lang of languages) {
    if (lang === FALLBACK) continue;
    const target = loadNamespace(lang, ns);
    if (!target) {
      console.warn(`⚠ [${ns}] ${lang}: 缺少命名空间文件，将回退到 ${FALLBACK} / thiếu namespace, sẽ fallback về ${FALLBACK} / namespace missing, falls back to ${FALLBACK}`);
      continue;
    }
    const targetKeys = new Set(flatten(target));
    const missing = [...baseKeys].filter((k) => !targetKeys.has(k));
    const extra = [...targetKeys].filter((k) => !baseKeys.has(k));
    if (missing.length) {
      console.warn(`⚠ [${ns}] ${lang}: 缺少 ${missing.length} 个 key，将逐项回退到 ${FALLBACK} / thiếu key, sẽ fallback về ${FALLBACK} / missing keys fall back to ${FALLBACK}`);
      missing.forEach((k) => console.error(`    - ${k}`));
    }
    if (extra.length) {
      console.warn(`⚠ [${ns}] ${lang}: 多出 ${extra.length} 个 key（基准无）/ thừa ${extra.length} key / ${extra.length} extra`);
      extra.forEach((k) => console.warn(`    + ${k}`));
    }
    if (!missing.length && !extra.length) {
      console.log(`✔ [${ns}] ${lang}`);
    }

    if ((lang === "vi" || lang === "en") && ns === "legacy") {
      const untranslated = Object.entries(target).filter(
        ([, value]) => typeof value === "string" && CJK.test(value),
      );
      if (untranslated.length) {
        console.error(`✖ [${ns}] ${lang}: còn ${untranslated.length} giá trị chứa chữ Hán / contains CJK values`);
        hasError = true;
      }
    }
  }
}

process.exit(hasError ? 1 : 0);
