/**
 * 初始语言检测 / Nhận diện ngôn ngữ ban đầu / Initial language detection.
 *
 * 优先级 / Thứ tự ưu tiên / Priority:
 *   1. 用户此前手动选择（localStorage）/ lựa chọn thủ công trước đó / previous manual choice
 *   2. 浏览器语言（navigator.languages）/ ngôn ngữ trình duyệt / browser languages
 *   3. 兜底语言（始终为越南语）/ ngôn ngữ dự phòng (luôn là tiếng Việt) / fallback (always Vietnamese)
 */
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  type LanguageCode,
} from "./config";

function readStoredLanguage(): LanguageCode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function readBrowserLanguage(): LanguageCode | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

export function resolveInitialLanguage(): LanguageCode {
  return readStoredLanguage() ?? readBrowserLanguage() ?? FALLBACK_LANGUAGE;
}

export function persistLanguage(code: LanguageCode): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // 忽略隐私模式下的写入失败 / bỏ qua lỗi ghi ở chế độ riêng tư / ignore write failures in private mode
  }
}
