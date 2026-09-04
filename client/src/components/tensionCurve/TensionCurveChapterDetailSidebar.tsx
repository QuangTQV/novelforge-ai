import { ArrowRight, BookOpenText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TensionCurveChapterContext {
  id: string;
  chapterId?: string | null;
  chapterOrder: number;
  beatKey?: string | null;
  title: string;
  summary?: string | null;
  purpose?: string | null;
  exclusiveEvent?: string | null;
  conflictLevel?: number | null;
  conflictLevelSource?: "ai" | "user" | null;
}

interface TensionCurveChapterDetailSidebarProps {
  chapter: TensionCurveChapterContext | null;
  beatLabel?: string | null;
  onOpenChapterDetail?: () => void;
}

function FieldBlock({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation("creativeHub");
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value?.trim() || t("tensionCurve.chapterSidebar.emptyField")}</div>
    </div>
  );
}

export function TensionCurveChapterDetailSidebar(props: TensionCurveChapterDetailSidebarProps) {
  const { chapter, beatLabel, onOpenChapterDetail } = props;
  const { t } = useTranslation("creativeHub");

  if (!chapter) {
    return (
      <aside className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {t("tensionCurve.chapterSidebar.emptyState")}
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("tensionCurve.chapterSidebar.chapterBadge", { order: chapter.chapterOrder })}</Badge>
          {beatLabel ? <Badge variant="outline">{beatLabel}</Badge> : null}
          {chapter.conflictLevelSource === "user" ? <Badge variant="secondary">{t("tensionCurve.chapterSidebar.manualAnchor")}</Badge> : <Badge variant="outline">{t("tensionCurve.chapterSidebar.aiManaged")}</Badge>}
        </div>
        <div className="text-base font-semibold leading-6 text-foreground">{chapter.title || t("tensionCurve.chapterSidebar.chapterBadge", { order: chapter.chapterOrder })}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
          {t("tensionCurve.chapterSidebar.conflictLevel", { value: typeof chapter.conflictLevel === "number" ? chapter.conflictLevel : t("tensionCurve.chapterSidebar.conflictPending") })}
        </div>
      </div>

      <FieldBlock label={t("tensionCurve.chapterSidebar.summaryLabel")} value={chapter.summary} />
      <FieldBlock label={t("tensionCurve.chapterSidebar.purposeLabel")} value={chapter.purpose} />
      <FieldBlock label={t("tensionCurve.chapterSidebar.exclusiveEventLabel")} value={chapter.exclusiveEvent} />

      {onOpenChapterDetail ? (
        <Button type="button" className="w-full justify-between" variant="outline" onClick={onOpenChapterDetail}>
          {t("tensionCurve.chapterSidebar.openFullDetail")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </aside>
  );
}
