import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";

/**
 * Chọn biến thể instruction theo ngôn ngữ đầu ra của novel.
 * `context.promptLanguage` được promptRunner suy ra từ `novelId` (xem
 * resolveEffectiveOutputLanguage), nên chỉ cần sửa text prompt ở đây.
 * Ngôn ngữ chưa có bộ prompt riêng ⇒ dùng tiếng Anh.
 */
export function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}
