import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { LanguageCode } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  /** 紧凑模式：只显示图标 + 短代码，适合放在顶栏 / chế độ gọn: chỉ icon + mã ngắn, hợp cho thanh trên cùng */
  compact?: boolean;
  className?: string;
}

/**
 * 界面语言切换器 / Bộ chuyển ngôn ngữ giao diện / Interface language switcher.
 * 语言清单来自 src/i18n/config.ts，无需在此维护。
 * Danh sách ngôn ngữ lấy từ src/i18n/config.ts, không cần khai báo lại ở đây.
 */
export default function LanguageSelector({ compact = false, className }: LanguageSelectorProps) {
  const { t } = useTranslation("settings");
  const { language, languages, setLanguage } = useLanguage();

  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
      <SelectTrigger
        aria-label={t("language.label")}
        className={cn(compact ? "h-9 w-auto gap-1.5 px-2.5" : "w-full", className)}
      >
        {compact ? (
          <span className="flex items-center gap-1.5">
            <Languages className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">{language}</span>
          </span>
        ) : (
          <SelectValue placeholder={t("language.selectPlaceholder")} />
        )}
      </SelectTrigger>
      <SelectContent>
        {languages.map((item) => (
          <SelectItem key={item.code} value={item.code}>
            {item.nativeLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
