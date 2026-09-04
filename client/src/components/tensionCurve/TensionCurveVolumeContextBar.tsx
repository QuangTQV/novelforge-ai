import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export interface TensionCurveVolumeContext {
  roleLabel?: string | null;
  coreReward?: string | null;
  escalationFocus?: string | null;
  planningMode?: "hard" | "soft" | null;
}

interface TensionCurveVolumeContextBarProps {
  volume?: TensionCurveVolumeContext | null;
}

function contextText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function TensionCurveVolumeContextBar({ volume }: TensionCurveVolumeContextBarProps) {
  const { t } = useTranslation("creativeHub");
  return (
    <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm lg:grid-cols-[auto_1fr_1fr_1fr] lg:items-start">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={volume?.planningMode === "hard" ? "secondary" : "outline"}>
          {volume?.planningMode === "hard" ? t("tensionCurve.volumeBar.hardPlanning") : t("tensionCurve.volumeBar.volumePositioning")}
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("tensionCurve.volumeBar.roleLabel")}</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.roleLabel, t("tensionCurve.volumeBar.roleFallback"))}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("tensionCurve.volumeBar.rewardLabel")}</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.coreReward, t("tensionCurve.volumeBar.rewardFallback"))}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("tensionCurve.volumeBar.escalationLabel")}</div>
        <div className="mt-1 line-clamp-2 text-foreground">{contextText(volume?.escalationFocus, t("tensionCurve.volumeBar.escalationFallback"))}</div>
      </div>
    </div>
  );
}
