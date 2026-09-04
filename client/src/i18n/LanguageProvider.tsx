/**
 * 语言上下文 / Context ngôn ngữ / Language context.
 *
 * 提供 useLanguage() 钩子：读取当前语言、切换语言、拿到受支持语言清单。
 * Cung cấp hook useLanguage(): đọc ngôn ngữ hiện tại, đổi ngôn ngữ, lấy danh sách ngôn ngữ hỗ trợ.
 * Provides the useLanguage() hook: read the current language, switch it, get the supported list.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageDescriptor,
  isSupportedLanguage,
  type LanguageCode,
  type LanguageDescriptor,
} from "./config";
import { persistLanguage } from "./detect";
import i18n from "./index";

interface LanguageContextValue {
  language: LanguageCode;
  descriptor: LanguageDescriptor;
  languages: readonly LanguageDescriptor[];
  setLanguage: (code: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n: instance } = useTranslation();

  const language: LanguageCode = isSupportedLanguage(instance.resolvedLanguage)
    ? instance.resolvedLanguage
    : FALLBACK_LANGUAGE;

  const setLanguage = useCallback((code: LanguageCode) => {
    if (!isSupportedLanguage(code)) {
      return;
    }
    persistLanguage(code);
    void i18n.changeLanguage(code);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      descriptor: getLanguageDescriptor(language) ?? SUPPORTED_LANGUAGES[0],
      languages: SUPPORTED_LANGUAGES,
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error(
      "useLanguage 必须在 LanguageProvider 内使用 / useLanguage phải nằm trong LanguageProvider / useLanguage must be used within LanguageProvider.",
    );
  }
  return value;
}
