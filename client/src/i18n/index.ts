/**
 * i18next 初始化入口 / Điểm khởi tạo i18next / i18next initialization entry point.
 *
 * 在 main.tsx 中最先导入本模块（在渲染之前），即可同步完成初始化。
 * Import module này SỚM NHẤT trong main.tsx (trước khi render) để khởi tạo đồng bộ.
 * Import this module FIRST in main.tsx (before rendering) for synchronous init.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { configureLegacyTranslator } from "./legacy";

import {
  DEFAULT_NAMESPACE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGE_CODES,
} from "./config";
import { resolveInitialLanguage } from "./detect";
import { namespaces, resources } from "./resources";

const initialLanguage = resolveInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
  ns: namespaces.length > 0 ? namespaces : [DEFAULT_NAMESPACE],
  defaultNS: DEFAULT_NAMESPACE,
  fallbackNS: DEFAULT_NAMESPACE,
  interpolation: {
    // React 已对输出转义 / React đã tự escape / React already escapes output
    escapeValue: false,
  },
  returnNull: false,
  // 开发期把缺失的 key 打到控制台，方便补翻译
  // Ở chế độ dev, log ra console các key thiếu bản dịch để bổ sung
  // In dev, log missing keys to the console so translations can be filled in
  saveMissing: false,
  missingKeyHandler: import.meta.env.DEV
    ? (lngs, ns, key) => {
        console.warn(`[i18n] 缺少翻译 / thiếu bản dịch / missing translation: [${lngs.join(",")}] ${ns}:${key}`);
      }
    : undefined,
  react: {
    useSuspense: false,
  },
});

configureLegacyTranslator((source, variables) => i18n.t(source, {
  ns: "legacy",
  keySeparator: false,
  defaultValue: source,
  ...variables,
}));

// 同步 <html lang> / đồng bộ <html lang> / keep <html lang> in sync
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.resolvedLanguage ?? initialLanguage;
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng;
  });
}

export default i18n;
