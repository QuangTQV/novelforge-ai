import type { NovelLanguage } from "../types/novel";

/** Mọi giá trị ngôn ngữ tiểu thuyết được hỗ trợ. Thứ tự dùng để render danh sách chọn. */
export const NOVEL_LANGUAGE_VALUES = ["vi", "zh", "en", "ja", "ko", "fr", "es"] as const;

/** Ngôn ngữ mặc định khi bản ghi không có giá trị (giữ tương thích dữ liệu cũ). */
export const DEFAULT_NOVEL_LANGUAGE: NovelLanguage = "zh";

/** Ngôn ngữ dùng khoảng trắng để tách từ (đếm độ dài theo "từ" thay vì theo ký tự). */
const SPACE_DELIMITED_LANGUAGES = new Set<NovelLanguage>(["vi", "en", "fr", "es", "ko"]);

/** Tên gọi bản ngữ của từng ngôn ngữ — nhét trực tiếp vào chỉ thị gửi cho model. */
export const NOVEL_LANGUAGE_ENDONYM: Record<NovelLanguage, string> = {
  zh: "简体中文 (Simplified Chinese)",
  vi: "Tiếng Việt (Vietnamese)",
  en: "English",
  ja: "日本語 (Japanese)",
  ko: "한국어 (Korean)",
  fr: "Français (French)",
  es: "Español (Spanish)",
};

const NOVEL_LANGUAGE_VALUE_SET = new Set<string>(NOVEL_LANGUAGE_VALUES);

/** Chuẩn hóa giá trị tùy ý về một `NovelLanguage` hợp lệ (rỗng/không hợp lệ ⇒ mặc định). */
export function resolveNovelLanguage(value: string | null | undefined): NovelLanguage {
  if (value && NOVEL_LANGUAGE_VALUE_SET.has(value)) {
    return value as NovelLanguage;
  }
  return DEFAULT_NOVEL_LANGUAGE;
}

export function isSpaceDelimitedLanguage(lang: NovelLanguage): boolean {
  return SPACE_DELIMITED_LANGUAGES.has(lang);
}

/**
 * Chỉ thị ngôn ngữ đầu ra, ưu tiên cao nhất, chèn vào cuối mọi prompt gắn với novel.
 * Trả `null` khi ngôn ngữ là tiếng Trung (không cần chèn — đó là mặc định của prompt gốc).
 */
export function buildOutputLanguageDirective(lang: NovelLanguage): string | null {
  if (lang === "zh") {
    return null;
  }
  const endonym = NOVEL_LANGUAGE_ENDONYM[lang];
  return [
    "【输出语言 / OUTPUT LANGUAGE — 最高优先级，覆盖上文任何语言要求】",
    `本次生成的所有自然语言内容（正文、字段值、名称、标题、描述、摘要、理由、对话、选项文案等）必须使用：${endonym}。`,
    "即使上文任何指令、示例或出厂设定要求“使用简体中文”或其他语言，一律以本条为准。",
    "保持不变（不要翻译）：JSON 键名、枚举值、ID、代码标识符、API 字段名。",
    `The target language (${endonym}) must read naturally and be free of machine-translation artifacts.`,
  ].join("\n");
}
