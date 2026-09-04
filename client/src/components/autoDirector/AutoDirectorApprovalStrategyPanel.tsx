import type {
  DirectorAutoApprovalGroup,
  DirectorAutoApprovalPoint,
} from "@ai-novel/shared/types/autoDirectorApproval";
import { useTranslation } from "react-i18next";
import AutoDirectorApprovalPointMultiSelect, {
  summarizeDirectorAutoApprovalPoints,
} from "./AutoDirectorApprovalPointMultiSelect";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

interface AutoDirectorApprovalStrategyPanelProps {
  enabled: boolean;
  approvalPointCodes: string[];
  groups?: DirectorAutoApprovalGroup[];
  approvalPoints?: DirectorAutoApprovalPoint[];
  onEnabledChange: (enabled: boolean) => void;
  onApprovalPointCodesChange: (next: string[]) => void;
}

export default function AutoDirectorApprovalStrategyPanel({
  enabled,
  approvalPointCodes,
  groups,
  approvalPoints,
  onEnabledChange,
  onApprovalPointCodesChange,
}: AutoDirectorApprovalStrategyPanelProps) {
  const { t } = useTranslation("novelAutoDirector");
  return (
    <div className="mt-3 min-w-0 rounded-md border border-primary/15 bg-primary/5 p-3">
      <div className="text-xs font-medium text-foreground">{t("approvalStrategy.heading")}</div>
      <div className={AUTO_DIRECTOR_MOBILE_CLASSES.approvalStrategyGrid}>
        <button
          type="button"
          className={`rounded-xl border px-3 py-3 text-left transition ${
            enabled ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-background hover:border-primary/40"
          }`}
          onClick={() => onEnabledChange(true)}
        >
          <div className="text-sm font-medium text-foreground">{t("approvalStrategy.auto.title")}</div>
          <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {t("approvalStrategy.auto.description")}
          </div>
        </button>
        <button
          type="button"
          className={`rounded-xl border px-3 py-3 text-left transition ${
            !enabled ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-background hover:border-primary/40"
          }`}
          onClick={() => onEnabledChange(false)}
        >
          <div className="text-sm font-medium text-foreground">{t("approvalStrategy.copilot.title")}</div>
          <div className={`mt-1 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
            {t("approvalStrategy.copilot.description")}
          </div>
        </button>
      </div>

      <div className={`mt-3 rounded-md border bg-background/80 p-3 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
        {enabled
          ? t("approvalStrategy.note.auto")
          : t("approvalStrategy.note.copilot", {
              summary: summarizeDirectorAutoApprovalPoints(approvalPointCodes, t),
            })}
      </div>

      {!enabled ? (
        <details className="mt-3 rounded-md border bg-background">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
            {t("approvalStrategy.advanced")}
          </summary>
          <div className="border-t p-3">
            <AutoDirectorApprovalPointMultiSelect
              value={approvalPointCodes}
              onChange={onApprovalPointCodesChange}
              groups={groups}
              approvalPoints={approvalPoints}
              compact
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
