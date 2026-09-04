import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE, normalizeLanguage } from "./config.ts";

const root = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(root, "locales");

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

const localeDirs = readdirSync(LOCALES_DIR).filter((entry) =>
  statSync(join(LOCALES_DIR, entry)).isDirectory(),
);

test("每门在 config 中登记的语言都有对应的 locale 目录 / every configured language has a locale folder", () => {
  for (const language of SUPPORTED_LANGUAGES) {
    assert.ok(
      localeDirs.includes(language.code),
      `缺少 locale 目录 / missing locale folder: ${language.code}`,
    );
  }
});

test("兜底语言始终是越南语 / fallback language is always Vietnamese", () => {
  assert.equal(FALLBACK_LANGUAGE, "vi");
});

test("normalizeLanguage 能归一化 BCP-47 标签 / normalizeLanguage handles BCP-47 tags", () => {
  assert.equal(normalizeLanguage("vi-VN"), "vi");
  assert.equal(normalizeLanguage("zh-Hans-CN"), "zh");
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("fr"), undefined);
  assert.equal(normalizeLanguage(null), undefined);
});

test("所有语言的翻译 key 与兜底语言完全一致 / all languages match the fallback's keys", () => {
  const namespaces = [
    ...new Set(
      localeDirs.flatMap((lang) =>
        readdirSync(join(LOCALES_DIR, lang))
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, "")),
      ),
    ),
  ];

  for (const ns of namespaces) {
    const basePath = join(LOCALES_DIR, FALLBACK_LANGUAGE, `${ns}.json`);
    const baseKeys = new Set(flatten(JSON.parse(readFileSync(basePath, "utf8"))));

    for (const lang of localeDirs) {
      const targetPath = join(LOCALES_DIR, lang, `${ns}.json`);
      let target;
      if (!localeDirs.includes(lang) || !existsSync(targetPath)) {
        continue;
      }
      assert.doesNotThrow(() => {
        target = JSON.parse(readFileSync(targetPath, "utf8"));
      }, `${lang}/${ns}.json 无法解析或缺失 / cannot parse or missing`);
      const targetKeys = new Set(flatten(target));
      const missing = [...baseKeys].filter((k) => !targetKeys.has(k));
      const extra = [...targetKeys].filter((k) => !baseKeys.has(k));
      assert.equal(extra.length, 0, `[${ns}] ${lang} 多余 key / extra keys: ${extra.join(", ")}`);
    }
  }
});
