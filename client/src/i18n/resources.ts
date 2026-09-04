/**
 * 自动汇总所有翻译资源 / Tự động gom toàn bộ tài nguyên dịch / Auto-assembles all translation resources.
 *
 * 通过 Vite 的 import.meta.glob 在构建期把 src/i18n/locales/<lang>/<namespace>.json
 * 全部静态导入，因此新增语言文件夹或命名空间文件都无需改动本文件。
 *
 * Dùng import.meta.glob của Vite để import tĩnh mọi file
 * src/i18n/locales/<lang>/<namespace>.json tại thời điểm build. Nhờ vậy, thêm thư mục
 * ngôn ngữ mới hoặc file namespace mới KHÔNG cần sửa file này.
 *
 * Uses Vite's import.meta.glob to statically import every
 * src/i18n/locales/<lang>/<namespace>.json at build time, so adding a new language
 * folder or namespace file requires NO change here.
 */
import type { Resource, ResourceLanguage } from "i18next";

import { SUPPORTED_LANGUAGE_CODES, isSupportedLanguage } from "./config";

type JsonModule = Record<string, unknown>;

const localeModules = import.meta.glob<JsonModule>("./locales/*/*.json", {
  eager: true,
  import: "default",
});

const LOCALE_PATH_PATTERN = /\.\/locales\/([^/]+)\/([^/]+)\.json$/;

function buildResources(): Resource {
  const resources: Record<string, ResourceLanguage> = {};
  const namespaces = new Set<string>();

  for (const [filePath, content] of Object.entries(localeModules)) {
    const match = LOCALE_PATH_PATTERN.exec(filePath);
    if (!match) {
      continue;
    }
    const [, language, namespace] = match;
    if (!isSupportedLanguage(language)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[i18n] 跳过未在 config.ts 中登记的语言目录 / Bỏ qua thư mục ngôn ngữ chưa khai báo trong config.ts / Skipping language folder not declared in config.ts: "${language}" (${filePath})`,
        );
      }
      continue;
    }
    resources[language] ??= {};
    resources[language][namespace] = content;
    namespaces.add(namespace);
  }

  // The legacy bridge uses source text as its key. Keep the Chinese locale
  // self-contained without maintaining a second 3,000+ line identity file.
  if (!resources.zh?.legacy && resources.zh && resources.vi?.legacy) {
    resources.zh.legacy = Object.fromEntries(
      Object.keys(resources.vi.legacy as Record<string, unknown>).map((key) => [key, key]),
    );
    namespaces.add("legacy");
  }

  if (import.meta.env.DEV) {
    for (const language of SUPPORTED_LANGUAGE_CODES) {
      const present = new Set(Object.keys(resources[language] ?? {}));
      const missing = [...namespaces].filter((namespace) => !present.has(namespace));
      if (missing.length > 0) {
        console.warn(
          `[i18n] 语言 "${language}" 缺少命名空间文件 / thiếu file namespace / missing namespace files: ${missing.join(", ")}`,
        );
      }
    }
  }

  return resources;
}

export const resources: Resource = buildResources();

/** 所有已发现的命名空间，供 i18next 预注册 / mọi namespace đã phát hiện / every discovered namespace */
export const namespaces: string[] = Array.from(
  new Set(
    Object.values(resources).flatMap((language) => Object.keys(language as ResourceLanguage)),
  ),
).sort();
