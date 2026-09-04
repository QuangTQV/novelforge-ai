import { useTranslation } from "react-i18next";

interface WorldInjectionHintProps {
  worldInjectionSummary: string | null;
}

export default function WorldInjectionHint({ worldInjectionSummary }: WorldInjectionHintProps) {
  const { t } = useTranslation("novelWorld");
  if (!worldInjectionSummary) {
    return (
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t("worldInjectionHint.missing")}
      </div>
    );
  }

  return (
    <details className="group rounded-md bg-muted/40 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        <span>{t("worldInjectionHint.used")}</span>
        <span className="text-muted-foreground group-open:hidden">{t("worldInjectionHint.viewDetails")}</span>
        <span className="hidden text-muted-foreground group-open:inline">{t("worldInjectionHint.hideDetails")}</span>
      </summary>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-t pt-3 text-muted-foreground">
        {worldInjectionSummary}
      </pre>
    </details>
  );
}
