import type { NovelLanguage } from "../types/novel";

/** Ngôn ngữ dùng khoảng trắng để tách từ (đếm độ dài theo "từ" thay vì theo ký tự). */
const SPACE_DELIMITED_LANGUAGES: readonly NovelLanguage[] = ["vi", "en", "fr", "es", "ko"];

export function isSpaceDelimitedLanguage(lang: NovelLanguage): boolean {
  return SPACE_DELIMITED_LANGUAGES.includes(lang);
}

/**
 * Đo "độ dài" nội dung theo quy ước của từng ngôn ngữ:
 * - Ngôn ngữ CJK (zh, ja): đếm ký tự sau khi bỏ mọi khoảng trắng — quy ước 字数.
 * - Ngôn ngữ tách từ bằng khoảng trắng (vi, en, fr, es, ko): đếm số từ.
 *
 * Nhờ vậy `targetWordCount` (VD 3000) mang đúng nghĩa cho từng ngôn ngữ và vòng
 * kiểm soát độ dài chương không cắt nhầm nội dung tiếng Việt/Anh.
 */
export function countNarrativeLength(text: string, lang: NovelLanguage): number {
  if (!text) {
    return 0;
  }
  if (isSpaceDelimitedLanguage(lang)) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  return text.replace(/\s+/g, "").trim().length;
}

/**
 * Nhãn đơn vị độ dài dùng khi render prompt, theo đúng ngôn ngữ đầu ra:
 * - CJK (zh, ja): "字" (đếm theo ký tự).
 * - Ngôn ngữ tách từ: nhãn "từ" bản địa (vi/en/fr/es/ko).
 */
export function narrativeLengthUnitLabel(lang: NovelLanguage): string {
  switch (lang) {
    case "vi":
      return "từ";
    case "en":
      return "words";
    case "fr":
      return "mots";
    case "es":
      return "palabras";
    case "ko":
      return "단어";
    default:
      return "字";
  }
}
