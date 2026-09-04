import type { NovelLanguage } from "../types/novel";
import { isSpaceDelimitedLanguage } from "./novelLanguage";

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
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }
  return text.replace(/\s+/g, "").trim().length;
}

/** Nhãn đơn vị độ dài ("字" cho CJK, "từ" cho ngôn ngữ tách từ). Dùng khi render prompt. */
export function narrativeLengthUnitLabel(lang: NovelLanguage): string {
  return isSpaceDelimitedLanguage(lang) ? "词" : "字";
}
