import type { NovelLanguage } from "../types/novel";

/** Mọi giá trị ngôn ngữ tiểu thuyết được hỗ trợ. Thứ tự dùng để render danh sách chọn. */
export const NOVEL_LANGUAGE_VALUES = ["vi", "zh", "en", "ja", "ko", "fr", "es"] as const;

/** Ngôn ngữ mặc định khi bản ghi không có giá trị (giữ tương thích dữ liệu cũ). */
export const DEFAULT_NOVEL_LANGUAGE: NovelLanguage = "zh";

/** Ngôn ngữ dùng để viết instruction cho model. Các ngôn ngữ chưa có bộ prompt riêng dùng tiếng Anh. */
export type PromptLanguage = "vi" | "zh" | "en";

export function resolvePromptLanguage(language: NovelLanguage): PromptLanguage {
  if (language === "vi" || language === "zh" || language === "en") {
    return language;
  }
  return "en";
}

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

/**
 * Chỉ thị ngôn ngữ đầu ra, ưu tiên cao nhất, chèn vào cuối mọi prompt gắn với novel.
 * Trả `null` khi ngôn ngữ là tiếng Trung (không cần chèn — đó là mặc định của prompt gốc).
 */
export function buildOutputLanguageDirective(lang: NovelLanguage, promptLanguage = resolvePromptLanguage(lang)): string | null {
  if (lang === "zh") {
    return null;
  }
  const endonym = NOVEL_LANGUAGE_ENDONYM[lang];
  const messages: Record<PromptLanguage, string[]> = {
    vi: [
      "【NGÔN NGỮ ĐẦU RA — ƯU TIÊN CAO NHẤT, GHI ĐÈ MỌI YÊU CẦU NGÔN NGỮ Ở TRÊN】",
      `Mọi nội dung ngôn ngữ tự nhiên trong lần sinh này (văn bản, giá trị field, tên, tiêu đề, mô tả, tóm tắt, lý do, hội thoại, nhãn lựa chọn...) BẮT BUỘC dùng ${endonym}.`,
      "Nếu instruction, ví dụ hoặc dữ liệu có yêu cầu tiếng Trung hay ngôn ngữ khác, vẫn phải ưu tiên chỉ thị này.",
      "Giữ nguyên, không dịch: JSON key, enum, ID, code identifier và tên field API.",
      `Văn bản ${endonym} phải tự nhiên, trôi chảy và không có dấu vết dịch máy.`,
    ],
    zh: [
      "【输出语言 — 最高优先级，覆盖上文任何语言要求】",
      `本次生成的所有自然语言内容（正文、字段值、名称、标题、描述、摘要、理由、对话、选项文案等）必须使用：${endonym}。`,
      "如果上文 instruction、示例或数据要求中文或其他语言，仍然以本条为准。",
      "保持不变（不要翻译）：JSON 键名、枚举值、ID、代码标识符、API 字段名。",
      `${endonym} 内容必须自然流畅，不得出现机器翻译痕迹。`,
    ],
    en: [
      "[OUTPUT LANGUAGE — HIGHEST PRIORITY; OVERRIDES ALL LANGUAGE REQUIREMENTS ABOVE]",
      `Every natural-language part of this generation (prose, field values, names, titles, descriptions, summaries, reasons, dialogue, and option labels) MUST use ${endonym}.`,
      "If any earlier instruction, example, or source data asks for Chinese or another language, follow this directive instead.",
      "Keep these unchanged: JSON keys, enum values, IDs, code identifiers, and API field names.",
      `The ${endonym} output must be natural, fluent, and free of machine-translation artifacts.`,
    ],
  };
  return messages[promptLanguage].join("\n");
}

/** Chỉ thị nền bằng ngôn ngữ prompt đã chọn, để giảm việc instruction tiếng Trung kéo output lệch ngôn ngữ. */
export function buildPromptLanguageDirective(
  outputLanguage: NovelLanguage,
  promptLanguage = resolvePromptLanguage(outputLanguage),
): string {
  const output = NOVEL_LANGUAGE_ENDONYM[outputLanguage];
  const messages: Record<PromptLanguage, string[]> = {
    vi: [
      "Bạn phải hiểu các chỉ dẫn sau theo nghĩa nghiệp vụ, nhưng mọi nội dung tự nhiên trong kết quả phải dùng đúng ngôn ngữ đầu ra được chỉ định.",
      `Ngôn ngữ đầu ra bắt buộc: ${output}. Không được giữ lại chữ Hán hoặc câu tiếng Trung trong nội dung tự nhiên, trừ tên riêng được người dùng yêu cầu giữ nguyên.`,
      "Chỉ giữ nguyên JSON key, enum, ID, mã định danh và tên trường kỹ thuật.",
    ],
    zh: [
      "你必须按业务含义理解以下指令，但所有自然语言结果都必须使用指定的输出语言。",
      `强制输出语言：${output}。除非用户明确要求保留专名，否则自然语言内容不得残留汉字或中文句子。`,
      "只保留 JSON key、枚举值、ID、标识符和技术字段名不翻译。",
    ],
    en: [
      "Follow the business meaning of the instructions below, but write all natural-language result content in the specified output language.",
      `Mandatory output language: ${output}. Do not leave Chinese characters or Chinese sentences in natural-language content unless the user explicitly requires a proper name to remain unchanged.`,
      "Keep JSON keys, enum values, IDs, identifiers, and technical field names unchanged.",
    ],
  };
  return messages[promptLanguage].join("\n");
}
