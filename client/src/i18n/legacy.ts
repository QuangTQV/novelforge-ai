import i18n from "i18next";

type LegacyTranslator = (source: string, variables?: Record<string, unknown>) => string;

let translator: LegacyTranslator = (source) => source;

/** Configure the bridge from the i18next bootstrap without creating an import cycle. */
export function configureLegacyTranslator(nextTranslator: LegacyTranslator): void {
  translator = nextTranslator;
}

/** Compatibility bridge for static UI copy during the full namespace migration. */
export function translateUi(source: string, variables?: Record<string, unknown>): string {
  if (!source.trim()) return source;
  return translator(source, variables);
}

/**
 * Dữ liệu tài nguyên hệ thống có thể được tạo từ seed cũ hoặc do người dùng
 * nhập bằng ngôn ngữ khác. Không để nguyên văn tiếng Trung lọt vào UI tiếng
 * Việt khi locale chưa có bản dịch cho chuỗi đó.
 */
export function translateResourceText(source: string | null | undefined, fallback = "Nội dung tiếng Việt đang được cập nhật."): string {
  const value = source?.trim() ?? "";
  if (!value) return "";
  const translated = translateUi(value);
  if ((i18n.resolvedLanguage ?? i18n.language ?? "vi").split("-")[0] === "zh") {
    return translated;
  }
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(translated) ? fallback : translated;
}
