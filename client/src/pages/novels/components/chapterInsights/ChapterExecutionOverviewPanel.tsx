import { translateUi } from "@/i18n/legacy";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { Chapter, StoryPlan } from "@ai-novel/shared/types/novel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chapterStatusLabel, generationStateLabel, resolveDisplayedChapterStatus } from "../chapterExecution.shared";

interface ChapterExecutionOverviewPanelProps {
  selectedChapter?: Chapter;
  chapterPlan?: StoryPlan | null;
  chapterQualityReport?: {
    coherence: number;
    repetition: number;
    pacing: number;
    voice: number;
    engagement: number;
    overall: number;
    issues?: string | null;
  } | null;
  chapterRuntimePackage?: ChapterRuntimePackage | null;
  reviewResult?: {
    issues?: Array<{ category: string; fixSuggestion: string }>;
  } | null;
  openAuditIssues?: Array<{ id: string; auditType: string; fixSuggestion: string }>;
}

function getQualityBadgeVariant(quality: number): "default" | "outline" | "secondary" {
  if (quality >= 85) {
    return "default";
  }
  if (quality >= 70) {
    return "outline";
  }
  return "secondary";
}

function OverviewStat(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">{props.label}</div>
        <div className="shrink-0 text-right text-sm font-semibold text-foreground">{props.value}</div>
      </div>
      {props.hint ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

export default function ChapterExecutionOverviewPanel(props: ChapterExecutionOverviewPanelProps) {
  const { t } = useTranslation("novelChapters");
  const {
    selectedChapter,
    chapterPlan,
    chapterQualityReport,
    chapterRuntimePackage,
    reviewResult,
    openAuditIssues = [],
  } = props;

  if (!selectedChapter) {
    return (
      <section className="rounded-2xl border border-dashed border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">

        {translateUi("选中章节后，这里显示本章状态、目标、字数、质量和待处理问题。")}
      </section>
    );
  }

  const chapterLabel = translateUi("第{{v0}}章", { v0: selectedChapter.order });
  const chapterTitle = selectedChapter.title || translateUi("未命名章节");
  const chapterObjective = chapterPlan?.objective ?? selectedChapter.expectation ?? translateUi("这一章还没有明确目标，建议先补章节计划。");
  const runtimePackage = chapterRuntimePackage?.chapterId === selectedChapter.id ? chapterRuntimePackage : null;
  const lengthControl = runtimePackage?.lengthControl ?? null;
  const qualityOverall = chapterQualityReport?.overall ?? selectedChapter.qualityScore ?? null;
  const displayedStatus = resolveDisplayedChapterStatus(selectedChapter);
  const statusLabel = t(chapterStatusLabel(displayedStatus));
  const generationLabel = t(generationStateLabel(selectedChapter.generationState));
  const currentWordCount = runtimePackage?.draft.wordCount ?? selectedChapter.content?.trim().length ?? 0;
  const targetWordCount = selectedChapter.targetWordCount ?? null;
  const issueCount = openAuditIssues.length || reviewResult?.issues?.length || 0;
  const updatedAt = selectedChapter.updatedAt ? new Date(selectedChapter.updatedAt).toLocaleString("zh-CN") : translateUi("暂无");

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-background/95 p-4">
      <div className="flex flex-col gap-3">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{chapterLabel}</Badge>
            <Badge variant={displayedStatus === "needs_repair" ? "destructive" : displayedStatus === "pending_review" ? "secondary" : "default"}>
              {statusLabel}
            </Badge>
            {generationLabel ? <Badge variant="outline">{generationLabel}</Badge> : null}
            {typeof qualityOverall === "number" ? (
              <Badge variant={getQualityBadgeVariant(qualityOverall)}>{translateUi("质量")} {qualityOverall}</Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{translateUi("章节概览")}</div>
            <div className="text-base font-semibold text-foreground">{chapterTitle}</div>
            <p className="line-clamp-6 text-sm leading-6 text-muted-foreground">
              {chapterObjective}
            </p>
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="w-full justify-center">
          <Link to={`/novels/${selectedChapter.novelId}/chapters/${selectedChapter.id}`}>{translateUi("打开章节编辑器")}</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <OverviewStat label={translateUi("当前字数")} value={String(currentWordCount)} hint={translateUi("主面板正在显示的正文长度。")} />
        <OverviewStat label={translateUi("章节目标")} value={targetWordCount ? translateUi("{{value0}} 字", { value0: targetWordCount }) : translateUi("未设定")} hint={translateUi("用于判断当前篇幅是否足够。")} />
        <OverviewStat label={translateUi("待处理问题")} value={String(issueCount)} hint={translateUi("问题越少，越适合继续推进。")} />
        <OverviewStat label={translateUi("最近更新")} value={updatedAt} hint={translateUi("用于判断这一章是否需要重新检查。")} />
      </div>

      {lengthControl ? (
        <div className="space-y-2">
          <OverviewStat
            label={translateUi("预算区间")}
            value={`${lengthControl.softMinWordCount}-${lengthControl.softMaxWordCount}`}
            hint={translateUi("硬上限 {{value0}} 字", { value0: lengthControl.hardMaxWordCount })}
          />
          <OverviewStat
            label={translateUi("控字模式")}
            value={lengthControl.wordControlMode === "prompt_only" ? translateUi("自然优先") : lengthControl.wordControlMode === "balanced" ? translateUi("标准控字") : translateUi("混合控字")}
            hint={translateUi("偏差 {{value0}}%", { value0: Math.round(lengthControl.variance * 100) })}
          />
        </div>
      ) : null}
    </section>
  );
}
