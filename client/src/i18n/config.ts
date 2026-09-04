/**
 * 语言配置中心 / Trung tâm cấu hình ngôn ngữ / Language configuration hub.
 *
 * 这是唯一需要修改的地方，用于新增或调整受支持的语言。
 * Đây là NƠI DUY NHẤT cần sửa khi muốn thêm hoặc điều chỉnh ngôn ngữ được hỗ trợ.
 * This is the ONLY file to edit when adding or adjusting a supported language.
 *
 * 新增一门语言的步骤 / Các bước thêm một ngôn ngữ / Steps to add a language:
 *   1. 在 SUPPORTED_LANGUAGES 里加一项 / Thêm một mục vào SUPPORTED_LANGUAGES / Add an entry to SUPPORTED_LANGUAGES.
 *   2. 在 src/i18n/locales/<code>/ 下创建同名命名空间 JSON 文件
 *      Tạo các file JSON namespace tương ứng trong src/i18n/locales/<code>/
 *      Create the matching namespace JSON files under src/i18n/locales/<code>/.
 *   3. 无需改动其它代码，resources.ts 会自动加载。
 *      Không cần sửa code khác — resources.ts sẽ tự nạp.
 *      Nothing else to touch — resources.ts picks them up automatically.
 */

export interface LanguageDescriptor {
  /** BCP-47 语言代码，同时是 locales/ 下的文件夹名 / mã ngôn ngữ, cũng là tên thư mục trong locales/ */
  code: string;
  /** 该语言自身的名称，用于语言切换器 / tên hiển thị bằng chính ngôn ngữ đó */
  nativeLabel: string;
  /** 英文名称，用于日志和无障碍标签 / tên tiếng Anh, dùng cho log và nhãn trợ năng */
  englishLabel: string;
  /** 书写方向 / hướng viết / writing direction */
  dir?: "ltr" | "rtl";
}

/**
 * 受支持的语言清单。列表顺序即语言切换器中的显示顺序。
 * Danh sách ngôn ngữ được hỗ trợ. Thứ tự ở đây là thứ tự hiển thị trong bộ chuyển ngôn ngữ.
 * The supported languages. List order = display order in the language switcher.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "vi", nativeLabel: "Tiếng Việt", englishLabel: "Vietnamese" },
  { code: "zh", nativeLabel: "简体中文", englishLabel: "Chinese (Simplified)" },
  { code: "en", nativeLabel: "English", englishLabel: "English" },
] as const satisfies readonly LanguageDescriptor[];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/**
 * 兜底语言：当检测失败、或某个 key 缺失翻译时使用。按要求始终为越南语。
 * Ngôn ngữ dự phòng: dùng khi không nhận diện được, hoặc khi thiếu bản dịch cho một key. Theo yêu cầu, luôn là tiếng Việt.
 * Fallback language: used when detection fails or a key is missing a translation. Always Vietnamese, by requirement.
 */
export const FALLBACK_LANGUAGE: LanguageCode = "vi";

/** localStorage 键：保存用户手动选择的语言 / khóa localStorage lưu lựa chọn ngôn ngữ của người dùng */
export const LANGUAGE_STORAGE_KEY = "ai-novel.language";

/** 默认命名空间 / namespace mặc định / default namespace */
export const DEFAULT_NAMESPACE = "common";

export const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = SUPPORTED_LANGUAGES.map(
  (language) => language.code,
);

export function isSupportedLanguage(value: string | null | undefined): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value);
}

export function getLanguageDescriptor(code: string): LanguageDescriptor | undefined {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code);
}

/**
 * 将任意 BCP-47 标签（如 "vi-VN"、"zh-Hans-CN"、"en-US"）归一化为受支持的语言代码。
 * Chuẩn hóa một thẻ BCP-47 bất kỳ ("vi-VN", "zh-Hans-CN", "en-US") về mã ngôn ngữ được hỗ trợ.
 * Normalize any BCP-47 tag ("vi-VN", "zh-Hans-CN", "en-US") to a supported language code.
 */
export function normalizeLanguage(value: string | null | undefined): LanguageCode | undefined {
  if (!value) {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (isSupportedLanguage(lower)) {
    return lower;
  }
  const base = lower.split("-")[0];
  return isSupportedLanguage(base) ? base : undefined;
}
