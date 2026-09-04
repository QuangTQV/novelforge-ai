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

/** Nhãn đơn vị độ dài ("字" cho CJK, "词" cho ngôn ngữ tách từ). Dùng khi render prompt. */
export function narrativeLengthUnitLabel(lang: NovelLanguage): string {
  return isSpaceDelimitedLanguage(lang) ? "词" : "字";
}
