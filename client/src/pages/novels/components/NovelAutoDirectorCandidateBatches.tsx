import { translateUi } from "@/i18n/legacy";
import type { TitleFactorySuggestion } from "@ai-novel/shared/types/title";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, RefreshCw, Trash2, Wand2 } from "lucide-react";
import {
  DIRECTOR_CORRECTION_PRESETS,
  type DirectorCandidate,
  type DirectorCandidateBatch,
  type DirectorCorrectionPreset,
} from "@ai-novel/shared/types/novelDirector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

interface NovelAutoDirectorCandidateBatchesProps {
  batches: DirectorCandidateBatch[];
  selectedPresets: DirectorCorrectionPreset[];
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onTogglePreset: (preset: DirectorCorrectionPreset) => void;
  candidatePatchFeedbacks: Record<string, string>;
  onCandidatePatchFeedbackChange: (candidateId: string, value: string) => void;
  titlePatchFeedbacks: Record<string, string>;
  onTitlePatchFeedbackChange: (candidateId: string, value: string) => void;
  isGenerating: boolean;
  isPatchingCandidate: boolean;
  isRefiningTitle: boolean;
  isConfirming: boolean;
  onApplyCandidateTitleOption: (batchId: string, candidateId: string, option: TitleFactorySuggestion) => void;
  onPatchCandidate: (batchId: string, candidate: DirectorCandidate, feedback: string) => void;
  onRefineTitle: (batchId: string, candidate: DirectorCandidate, feedback: string) => void;
  onConfirmCandidate: (candidate: DirectorCandidate) => void | Promise<void>;
  onGenerateNext: () => void;
  isDeletingCandidate: boolean;
  onDeleteCandidate: (candidateId: string) => void;
  onDeleteAllCandidates: () => void;
}

function buildFallbackTitleOption(candidate: DirectorCandidate): TitleFactorySuggestion {
  return {
    title: candidate.workingTitle,
    clickRate: 60,
    style: "high_concept",
    angle: translateUi("当前方案书名"),
    reason: translateUi("当前沿用导演候选方案的书名。"),
  };
}

function resolveCandidateTitleOptions(candidate: DirectorCandidate): TitleFactorySuggestion[] {
  if (Array.isArray(candidate.titleOptions) && candidate.titleOptions.length > 0) {
    return candidate.titleOptions;
  }
  return [buildFallbackTitleOption(candidate)];
}

function renderPrimaryCandidateDetails(candidate: DirectorCandidate) {
  return [
    { label: translateUi("核心卖点"), value: candidate.sellingPoint },
    { label: translateUi("主线冲突"), value: candidate.coreConflict },
    { label: translateUi("主角路径"), value: candidate.protagonistPath },
  ];
}

function renderSecondaryCandidateDetails(candidate: DirectorCandidate) {
  return [
    { label: translateUi("作品定位"), value: candidate.positioning },
    { label: translateUi("主钩子"), value: candidate.hookStrategy },
    { label: translateUi("推进循环"), value: candidate.progressionLoop },
    { label: translateUi("结局方向"), value: candidate.endingDirection },
    { label: translateUi("章节规模"), value: translateUi("约 {{v0}} 章", { v0: candidate.targetChapterCount }) },
  ];
}

function formatToneKeywords(candidate: DirectorCandidate): string {
  return candidate.toneKeywords.filter(Boolean).slice(0, 4).join(" · ");
}

function translateTaxonomyPath(path: string): string {
  return path.split("/").map((part) => translateUi(part.trim())).join(" / ");
}

function translateBatchRoundLabel(label: string): string {
  const match = label.match(/^第\s*(\d+)\s*轮$/);
  return match ? translateUi("Vòng {{v0}}", { v0: match[1] }) : translateUi(label);
}

function foundationSourceLabel(source: "user_selected" | "ai_recommended" | "market_recommended" | undefined): string {
  if (source === "user_selected") return translateUi("你的选择");
  if (source === "ai_recommended") return translateUi("AI 补充");
  if (source === "market_recommended") return translateUi("雷达推荐");
  return translateUi("创作基础");
}

export default function NovelAutoDirectorCandidateBatches(props: NovelAutoDirectorCandidateBatchesProps) {
  const {
    batches,
    selectedPresets,
    feedback,
    onFeedbackChange,
    onTogglePreset,
    candidatePatchFeedbacks,
    onCandidatePatchFeedbackChange,
    titlePatchFeedbacks,
    onTitlePatchFeedbackChange,
    isGenerating,
    isPatchingCandidate,
    isRefiningTitle,
    isConfirming,
    onApplyCandidateTitleOption,
    onPatchCandidate,
    onRefineTitle,
    onConfirmCandidate,
    onGenerateNext,
    isDeletingCandidate,
    onDeleteCandidate,
    onDeleteAllCandidates,
  } = props;
  const reducedMotion = useReducedMotion();

  if (batches.length === 0) {
    return (
      <div className={`py-10 text-center text-sm text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>

        {translateUi("先给 AI 一句灵感，它会先产出第一批整本书方向候选。")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDeleteAllCandidates} disabled={isDeletingCandidate}>
          <Trash2 className="h-4 w-4" />
          {translateUi("Xoá toàn bộ candidate")}
        </Button>
      </div>
      {batches.map((batch, batchIndex) => (
        <motion.section
          key={batch.id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : batchIndex * 0.04 }}
          className="min-w-0"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="break-words text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]">{translateBatchRoundLabel(batch.roundLabel)}</div>
              <div className="mt-1 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                {batch.refinementSummary?.trim() || translateUi("初始方案")}
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {batch.presets.map((preset) => {
                const meta = DIRECTOR_CORRECTION_PRESETS.find((item) => item.value === preset);
                return meta ? <span key={preset}>{meta.label}</span> : null;
              })}
            </div>
          </div>

          <div className="mt-5 divide-y divide-border/45">
            {batch.candidates.map((candidate, candidateIndex) => {
              const titleOptions = resolveCandidateTitleOptions(candidate);
              const toneSummary = formatToneKeywords(candidate);
              return (
                <motion.article
                  key={candidate.id}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.18,
                    delay: reducedMotion ? 0 : candidateIndex * 0.06,
                  }}
                  className="group min-w-0 py-7 first:pt-2 last:pb-2"
                >
                  <div className="grid min-w-0 gap-5 lg:grid-cols-[3.25rem_minmax(0,1fr)_220px]">
                    <div className="hidden lg:block">
                      <div className="text-3xl font-semibold leading-none text-muted-foreground/45">
                        {String(candidateIndex + 1).padStart(2, "0")}
                      </div>
                      {candidateIndex === 0 ? (
                        <div className="mt-2 text-xs font-medium text-primary">{translateUi("推荐先看")}</div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                        <span className="lg:hidden">{translateUi("方案")} {candidateIndex + 1}</span>
                        {candidateIndex === 0 ? <span className="lg:hidden">{translateUi("· 推荐先看")}</span> : null}
                        <span className="lg:hidden">·</span>
                        <span>{translateUi("约")} {candidate.targetChapterCount}  {translateUi("章")}</span>
                        {toneSummary ? (
                          <>
                            <span>·</span>
                            <span className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>{toneSummary}</span>
                          </>
                        ) : null}
                      </div>

                      <h3 className="mt-2 max-w-3xl break-words text-2xl font-semibold leading-9 text-foreground [overflow-wrap:anywhere]">
                        <span>{candidate.workingTitle}</span>
                        <button type="button" className="ml-3 inline-flex align-middle text-muted-foreground hover:text-destructive" onClick={() => onDeleteCandidate(candidate.id)} disabled={isDeletingCandidate} aria-label={translateUi("Xoá candidate")}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </h3>

                      <p className="mt-3 max-w-3xl break-words text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                        {candidate.logline}
                      </p>

                      {candidate.productionFoundation ? (
                        <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="font-medium text-muted-foreground">{translateUi("创作基础")}</span>
                          <span className="text-foreground">
                            <span className="mr-1 text-muted-foreground">
                              {foundationSourceLabel(candidate.productionFoundation.genre.source)}
                            </span>
                            {translateTaxonomyPath(candidate.productionFoundation.genre.path)}
                          </span>
                          <span className="text-foreground">
                            <span className="mr-1 text-muted-foreground">
                              {foundationSourceLabel(candidate.productionFoundation.primaryStoryMode.source)}
                            </span>
                            {translateTaxonomyPath(candidate.productionFoundation.primaryStoryMode.path)}
                          </span>
                          {candidate.productionFoundation.secondaryStoryMode ? (
                            <span className="text-foreground">
                              <span className="mr-1 text-muted-foreground">
                                {foundationSourceLabel(candidate.productionFoundation.secondaryStoryMode.source)}
                              </span>
                                {translateTaxonomyPath(candidate.productionFoundation.secondaryStoryMode.path)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm md:grid-cols-3">
                        {renderPrimaryCandidateDetails(candidate).map((item) => (
                          <div key={item.label} className={`min-w-0 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                            <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                            <dd className="mt-1 break-words leading-6 text-foreground [overflow-wrap:anywhere]">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <aside className="flex min-w-0 flex-col gap-4 lg:pl-2">
                      <Button
                        type="button"
                        className={cn("h-11 justify-between", AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction)}
                        onClick={() => void onConfirmCandidate(candidate)}
                        disabled={isConfirming}
                      >
                        {isConfirming ? translateUi("创建中...") : translateUi("选用这套")}
                        <ArrowRight className="h-4 w-4" />
                      </Button>

                      <div className="space-y-4 text-sm">
                        <div className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
                          <div className="text-xs font-medium text-muted-foreground">{translateUi("为什么值得选")}</div>
                          <div className="mt-1 line-clamp-5 break-words leading-6 text-foreground/90 [overflow-wrap:anywhere]">{candidate.whyItFits}</div>
                          {candidate.writingPlatformReason ? (
                            <div className="mt-2 rounded-lg bg-muted/45 px-3 py-2 text-xs leading-5 text-muted-foreground">

                              {translateUi("平台建议：")}{candidate.recommendedWritingPlatform === "qidian_male" ? translateUi("起点男频") : candidate.recommendedWritingPlatform === "jinjiang_female" ? translateUi("晋江女频") : translateUi("番茄免费网文")} · {candidate.writingPlatformReason}
                            </div>
                          ) : null}
                        </div>
                        {toneSummary ? (
                          <div className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
                            <div className="text-xs font-medium text-muted-foreground">{translateUi("读感关键词")}</div>
                            <div className="mt-1 break-words leading-6 text-foreground [overflow-wrap:anywhere]">
                              {candidate.toneKeywords.join(" · ")}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </aside>
                  </div>

                  <details className="group mt-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">

                      {translateUi("展开完整设定")}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
                      {renderSecondaryCandidateDetails(candidate).map((item) => (
                        <div key={item.label} className={`min-w-0 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                          <dd className="mt-1 break-words leading-6 text-foreground [overflow-wrap:anywhere]">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>

                  <details className="group mt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">

                      {translateUi("调整书名与方向")}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 space-y-5">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">{translateUi("可选书名")}</div>
                        <div className="mt-2 divide-y divide-border/45">
                          {titleOptions.map((option) => {
                            const active = option.title === candidate.workingTitle;
                            return (
                              <button
                                key={`${candidate.id}-${option.title}`}
                                type="button"
                                className={cn(
                                  "flex w-full min-w-0 items-start justify-between gap-3 py-2 text-left text-sm transition",
                                  active ? "text-primary" : "text-foreground hover:text-primary",
                                )}
                                onClick={() => onApplyCandidateTitleOption(batch.id, candidate.id, option)}
                              >
                                <span className="block min-w-0">
                                  <span className="flex min-w-0 items-center gap-2">
                                    {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                    <span className={`break-words font-medium [overflow-wrap:anywhere] ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                                      {option.title}
                                    </span>
                                  </span>
                                  <span className={`mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>
                                    {option.reason?.trim() || option.angle || translateUi("可直接作为这套方向的书名。")}
                                  </span>
                                </span>
                                <span className={cn("shrink-0 text-xs tabular-nums", active ? "text-primary" : "text-muted-foreground")}>
                                  {option.clickRate}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />

                            {translateUi("重做标题组")}
                          </div>
                          <Input
                            className="mt-2 bg-background"
                            value={titlePatchFeedbacks[candidate.id] ?? ""}
                            onChange={(event) => onTitlePatchFeedbackChange(candidate.id, event.target.value)}
                            placeholder={translateUi("例如：更偏都市冷感，不要像旧式升级文。")}
                          />
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
                              disabled={isRefiningTitle || !titlePatchFeedbacks[candidate.id]?.trim()}
                              onClick={() => onRefineTitle(batch.id, candidate, titlePatchFeedbacks[candidate.id] ?? "")}
                            >
                              <Wand2 className="h-4 w-4" />
                              {isRefiningTitle ? translateUi("重做中...") : translateUi("AI 重做标题组")}
                            </Button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Wand2 className="h-4 w-4 text-muted-foreground" />

                            {translateUi("调整方向")}
                          </div>
                          <Input
                            className="mt-2 bg-background"
                            value={candidatePatchFeedbacks[candidate.id] ?? ""}
                            onChange={(event) => onCandidatePatchFeedbackChange(candidate.id, event.target.value)}
                            placeholder={translateUi("例如：保留这套，但主角更主动一点。")}
                          />
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
                              disabled={isPatchingCandidate || !candidatePatchFeedbacks[candidate.id]?.trim()}
                              onClick={() => onPatchCandidate(batch.id, candidate, candidatePatchFeedbacks[candidate.id] ?? "")}
                            >
                              <Wand2 className="h-4 w-4" />
                              {isPatchingCandidate ? translateUi("修正中...") : translateUi("AI 调整方向")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </motion.article>
              );
            })}
          </div>
        </motion.section>
      ))}

      <section className="min-w-0 pt-4">
        <div className="break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">{translateUi("没有合适的方向")}</div>
        <div className="mt-1 max-w-3xl break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">

          {translateUi("点几个修正方向，再补一句你想要的感觉。系统会保留上一轮，再生成一批新的方案。")}
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          {DIRECTOR_CORRECTION_PRESETS.map((preset) => {
            const active = selectedPresets.includes(preset.value);
            return (
              <button
                key={preset.value}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/45 text-foreground hover:bg-muted"
                }`}
                onClick={() => onTogglePreset(preset.value)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          <label htmlFor="director-refine-feedback" className="text-sm font-medium text-foreground">

            {translateUi("再补一句修正建议")}
          </label>
          <Input
            id="director-refine-feedback"
            value={feedback}
            onChange={(event) => onFeedbackChange(event.target.value)}
            placeholder={translateUi("例如：我想要女频成长感更强一点，别太像纯爱文，也不要太黑。")}
          />
        </div>

        <div className={AUTO_DIRECTOR_MOBILE_CLASSES.actionRow}>
          <Button
            type="button"
            className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}
            onClick={onGenerateNext}
            disabled={isGenerating}
          >
            <RefreshCw className="h-4 w-4" />
            {isGenerating ? translateUi("生成中...") : translateUi("带修正建议继续生成")}
          </Button>
        </div>
      </section>
    </div>
  );
}
