import { translateUi } from "@/i18n/legacy";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Chapter, NovelBible, PipelineJob, PlotBeat, QualityScore, ReviewIssue } from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import LLMSelector from "@/components/common/LLMSelector";
import StreamOutput from "@/components/common/StreamOutput";
import CollapsibleSummary from "./CollapsibleSummary";
import WorldInjectionHint from "./WorldInjectionHint";
import { getLowScoreChapterRange, getPipelineStageState, PIPELINE_STAGE_ITEMS } from "./pipelineTab.utils";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import SelectControl from "@/components/common/SelectControl";
import NovelDirectorIssuePolicyCard from "./NovelDirectorIssuePolicyCard";

interface PipelineTabProps {
  novelId: string;
  worldInjectionSummary: string | null;
  hasCharacters: boolean;
  directorTakeoverEntry?: ReactNode;
  onGoToCharacterTab: () => void;
  pipelineForm: {
    startOrder: number;
    endOrder: number;
    maxRetries: number;
    runMode: "fast" | "polish";
    autoReview: boolean;
    autoRepair: boolean;
    skipCompleted: boolean;
    qualityThreshold: number;
    repairMode: "detect_only" | "light_repair" | "heavy_repair" | "continuity_only" | "character_only" | "ending_only";
  };
  onPipelineFormChange: (
    field: "startOrder" | "endOrder" | "maxRetries" | "runMode" | "autoReview" | "autoRepair" | "skipCompleted" | "qualityThreshold" | "repairMode",
    value: number | boolean | string,
  ) => void;
  maxOrder: number;
  onGenerateBible: () => void;
  onAbortBible: () => void;
  isBibleStreaming: boolean;
  bibleStreamContent: string;
  onGenerateBeats: () => void;
  onAbortBeats: () => void;
  isBeatsStreaming: boolean;
  beatsStreamContent: string;
  onRunPipeline: (patch?: Partial<PipelineTabProps["pipelineForm"]>) => void;
  isRunningPipeline: boolean;
  pipelineMessage: string;
  pipelineJob?: PipelineJob;
  chapters: Chapter[];
  selectedChapterId: string;
  onSelectedChapterChange: (chapterId: string) => void;
  onReviewChapter: () => void;
  isReviewing: boolean;
  onRepairChapter: () => void;
  isRepairing: boolean;
  onGenerateHook: () => void;
  isGeneratingHook: boolean;
  reviewResult: {
    score: QualityScore;
    issues: ReviewIssue[];
  } | null;
  repairBeforeContent: string;
  repairAfterContent: string;
  repairStreamContent: string;
  isRepairStreaming: boolean;
  onAbortRepair: () => void;
  qualitySummary?: QualityScore;
  chapterReports: Array<{
    chapterId?: string | null;
    coherence: number;
    repetition: number;
    pacing: number;
    voice: number;
    engagement: number;
    overall: number;
    issues?: string | null;
  }>;
  bible?: NovelBible | null;
  plotBeats: PlotBeat[];
}

function repairModeLabel(mode: PipelineTabProps["pipelineForm"]["repairMode"]): string {
  const mapping: Record<PipelineTabProps["pipelineForm"]["repairMode"], string> = {
    detect_only: "repairMode.detectOnly",
    light_repair: "repairMode.light",
    heavy_repair: "repairMode.heavy",
    continuity_only: "repairMode.continuity",
    character_only: "repairMode.character",
    ending_only: "repairMode.ending",
  };
  return mapping[mode];
}

function stageStatusLabel(state: "pending" | "active" | "completed" | "failed"): string {
  if (state === "active") return "stage.active";
  if (state === "completed") return "stage.completed";
  if (state === "failed") return "stage.failed";
  return "stage.pending";
}

export default function PipelineTab(props: PipelineTabProps) {
  const { t } = useTranslation("novelOutline");
  const {
    novelId,
    worldInjectionSummary,
    hasCharacters,
    onGoToCharacterTab,
    pipelineForm,
    onPipelineFormChange,
    maxOrder,
    onGenerateBible,
    onAbortBible,
    isBibleStreaming,
    bibleStreamContent,
    onGenerateBeats,
    onAbortBeats,
    isBeatsStreaming,
    beatsStreamContent,
    onRunPipeline,
    isRunningPipeline,
    pipelineMessage,
    pipelineJob,
    chapters,
    selectedChapterId,
    onSelectedChapterChange,
    onReviewChapter,
    isReviewing,
    onRepairChapter,
    isRepairing,
    onGenerateHook,
    isGeneratingHook,
    reviewResult,
    repairBeforeContent,
    repairAfterContent,
    repairStreamContent,
    isRepairStreaming,
    onAbortRepair,
    qualitySummary,
    chapterReports,
    bible,
    plotBeats,
    directorTakeoverEntry,
  } = props;

  const lowScoreRange = getLowScoreChapterRange(chapters, chapterReports, pipelineForm.qualityThreshold);
  const lowScoreReports = chapterReports
    .filter((item) => item.chapterId && item.overall < pipelineForm.qualityThreshold)
    .slice(0, 12);
  const pendingRepairCount = chapterReports.filter((item) => item.chapterId && item.overall < pipelineForm.qualityThreshold).length;

  const exportPipelineReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      pipelineForm,
      pipelineJob,
      qualitySummary,
      chapterReports,
      lowScoreThreshold: pipelineForm.qualityThreshold,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pipeline-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <DirectorTakeoverEntryPanel
        title={t("outline.pipeline.takeover.title")}
        description={t("outline.pipeline.takeover.description")}
        entry={directorTakeoverEntry}
      />
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="rounded-2xl bg-muted/20 px-5 py-4">
          <CardTitle>{t("outline.pipeline.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-0 pt-5">
          <WorldInjectionHint worldInjectionSummary={worldInjectionSummary} />
          {!hasCharacters ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span>{t("outline.pipeline.characterHint")}</span>
              <Button size="sm" variant="outline" onClick={onGoToCharacterTab}>{t("outline.pipeline.goCharacters")}</Button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">{t("outline.pipeline.focus")}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {pendingRepairCount > 0 ? t("outline.pipeline.lowScoreFocus", { count: pendingRepairCount }) : t("outline.pipeline.noLowScore")}
              </div>
            </div>
            <div className="rounded-xl bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">{t("outline.pipeline.qualityThreshold")}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{pipelineForm.qualityThreshold}</div>
            </div>
            <div className="rounded-xl bg-muted/15 p-3">
              <div className="text-xs text-muted-foreground">{t("outline.pipeline.runMode")}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{t(`outline.pipeline.modes.${pipelineForm.runMode}`)}</div>
            </div>
          </div>
          {pipelineMessage ? <div className="text-sm text-muted-foreground">{pipelineMessage}</div> : null}
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/15 shadow-none">
        <CardHeader>
          <CardTitle>{t("outline.pipeline.riskQueue")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SelectControl
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={selectedChapterId}
            onChange={(event) => onSelectedChapterChange(event.target.value)}
          >
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{t("outline.pipeline.chapterOption", { order: chapter.order, title: chapter.title })}</option>
            ))}
          </SelectControl>
          <div className="flex flex-wrap gap-2">
            <AiButton onClick={onReviewChapter} disabled={isReviewing || !selectedChapterId}>{t("outline.pipeline.actions.review")}</AiButton>
            <AiButton variant="secondary" onClick={onRepairChapter} disabled={isRepairing || !selectedChapterId}>{t("outline.pipeline.actions.repair")}</AiButton>
            <AiButton variant="outline" onClick={onGenerateHook} disabled={isGeneratingHook || !selectedChapterId}>{t("outline.pipeline.actions.hook")}</AiButton>
          </div>
          {reviewResult ? (
            <div className="rounded-xl bg-background/70 p-3 text-sm">
              <div className="mb-2 font-medium">{t("outline.pipeline.reviewScore")}</div>
              <div className="grid gap-1 md:grid-cols-2">
                <div>{t("outline.pipeline.coherence")}: {reviewResult.score.coherence}</div>
                <div>{t("outline.pipeline.repetition")}: {reviewResult.score.repetition}</div>
                <div>{t("outline.pipeline.pacing")}: {reviewResult.score.pacing}</div>
                <div>{t("outline.pipeline.voice")}: {reviewResult.score.voice}</div>
                <div>{t("outline.pipeline.engagement")}: {reviewResult.score.engagement}</div>
                <div>{t("outline.pipeline.overall")}: {reviewResult.score.overall}</div>
              </div>
            </div>
          ) : null}
          <StreamOutput content={repairStreamContent} isStreaming={isRepairStreaming} onAbort={onAbortRepair} />
          {(repairBeforeContent || repairAfterContent) ? (
            <div className="grid gap-3 md:grid-cols-2">
              <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-xs">{repairBeforeContent || t("outline.pipeline.empty")}</pre>
              <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-xs">{repairAfterContent || t("outline.pipeline.repairAfterHint")}</pre>
            </div>
          ) : null}
          {lowScoreReports.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-background/70 p-3 text-xs">
              <div className="font-medium">{t("outline.pipeline.lowScoreFilter", { threshold: pipelineForm.qualityThreshold })}</div>
              {lowScoreReports.map((item, index) => (
                <div key={`${item.chapterId}-${index}`} className="flex items-center justify-between">
                  <span>{item.chapterId}</span>
                  <Badge variant="secondary">overall {item.overall}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <details className="group border-t border-border/60 pt-4">
        <summary className="cursor-pointer list-none">
          <CollapsibleSummary
            title={t("outline.pipeline.configTitle")}
            description={t("outline.pipeline.configDescription")}
          />
        </summary>

        <div className="mt-4 space-y-4">
          <NovelDirectorIssuePolicyCard novelId={novelId} />
          <Card>
            <CardHeader>
              <CardTitle>{t("outline.pipeline.configTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <LLMSelector />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.startChapter")}</div>
                  <Input
                    type="number"
                    min={1}
                    max={maxOrder}
                    value={pipelineForm.startOrder}
                    onChange={(event) => onPipelineFormChange("startOrder", Number(event.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.endChapter")}</div>
                  <Input
                    type="number"
                    min={1}
                    max={maxOrder}
                    value={pipelineForm.endOrder}
                    onChange={(event) => onPipelineFormChange("endOrder", Number(event.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.maxRetries")}</div>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={pipelineForm.maxRetries}
                    onChange={(event) => onPipelineFormChange("maxRetries", Number(event.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.runMode")}</div>
                  <SelectControl
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    value={pipelineForm.runMode}
                    onChange={(event) => onPipelineFormChange("runMode", event.target.value)}
                  >
                    <option value="fast">{t("outline.pipeline.modes.fast")}</option>
                    <option value="polish">{t("outline.pipeline.modes.polish")}</option>
                  </SelectControl>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.qualityThreshold")}</div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={pipelineForm.qualityThreshold}
                    onChange={(event) => onPipelineFormChange("qualityThreshold", Number(event.target.value) || 75)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t("outline.pipeline.repairModeTitle")}</div>
                  <SelectControl
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    value={pipelineForm.repairMode}
                    onChange={(event) => onPipelineFormChange("repairMode", event.target.value)}
                  >
                    <option value="detect_only">{t("outline.pipeline.repairMode.detectOnly")}</option>
                    <option value="light_repair">{t("outline.pipeline.repairMode.light")}</option>
                    <option value="heavy_repair">{t("outline.pipeline.repairMode.heavy")}</option>
                    <option value="continuity_only">{t("outline.pipeline.repairMode.continuity")}</option>
                    <option value="character_only">{t("outline.pipeline.repairMode.character")}</option>
                    <option value="ending_only">{t("outline.pipeline.repairMode.ending")}</option>
                  </SelectControl>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={pipelineForm.autoReview}
                    onChange={(event) => onPipelineFormChange("autoReview", event.target.checked)}
                  />
                  {t("outline.pipeline.autoReview")}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={pipelineForm.autoRepair}
                    onChange={(event) => onPipelineFormChange("autoRepair", event.target.checked)}
                  />
                  {t("outline.pipeline.autoRepair")}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={pipelineForm.skipCompleted}
                    onChange={(event) => onPipelineFormChange("skipCompleted", event.target.checked)}
                  />
                  {t("outline.pipeline.skipCompleted")}
                </label>
              </div>
              <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                {t("outline.pipeline.currentSettings", { mode: t(`outline.pipeline.modes.${pipelineForm.runMode}`), threshold: pipelineForm.qualityThreshold, repairMode: t(`outline.pipeline.${repairModeLabel(pipelineForm.repairMode)}`) })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("outline.pipeline.stageVisualization")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PIPELINE_STAGE_ITEMS.map((stage) => {
                  const state = getPipelineStageState(stage.key, pipelineJob, PIPELINE_STAGE_ITEMS);
                  return (
                    <div
                      key={stage.key}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        state === "active"
                          ? "border-primary bg-primary/10"
                          : state === "completed"
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : state === "failed"
                              ? "border-red-400/40 bg-red-500/10"
                              : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{stage.label}</span>
                        <span className="text-xs text-muted-foreground">{t(`outline.pipeline.${stageStatusLabel(state)}`)}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("outline.pipeline.runPanel")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <AiButton onClick={() => onRunPipeline()} disabled={isRunningPipeline || !hasCharacters}>{t("outline.pipeline.startBatch")}</AiButton>
                  <AiButton
                    variant="outline"
                    onClick={() => {
                      if (!lowScoreRange) {
                        return;
                      }
                      onRunPipeline({
                        startOrder: lowScoreRange.startOrder,
                        endOrder: lowScoreRange.endOrder,
                        skipCompleted: true,
                      });
                    }}
                    disabled={isRunningPipeline || !lowScoreRange}
                  >
                    {t("outline.pipeline.rerunLowScore")}
                  </AiButton>
                  <Button variant="outline" onClick={exportPipelineReport}>{t("outline.pipeline.exportReport")}</Button>
                  <AiButton onClick={onGenerateBible} disabled={isBibleStreaming || !hasCharacters}>{t("outline.pipeline.generateBible")}</AiButton>
                  <Button variant="secondary" onClick={onAbortBible} disabled={!isBibleStreaming}>{t("outline.pipeline.stopBible")}</Button>
                  <AiButton onClick={onGenerateBeats} disabled={isBeatsStreaming || !hasCharacters}>{t("outline.pipeline.generateBeats")}</AiButton>
                  <Button variant="secondary" onClick={onAbortBeats} disabled={!isBeatsStreaming}>{t("outline.pipeline.stopBeats")}</Button>
                </div>
                {lowScoreRange ? (
                  <div className="text-xs text-muted-foreground">
                    {t("outline.pipeline.lowScoreSummary", { count: lowScoreRange.count, start: lowScoreRange.startOrder, end: lowScoreRange.endOrder })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{t("outline.pipeline.noLowScore")}</div>
                )}
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 font-medium">{t("outline.pipeline.taskStatus")}</div>
                  {pipelineJob ? (
                    <div className="space-y-1">
                      <div>{t("outline.pipeline.jobId")}: {pipelineJob.id}</div>
                      <div>{t("outline.pipeline.status")}: {pipelineJob.status}</div>
                      <div>{t("outline.pipeline.currentStage")}: {pipelineJob.currentStage || "-"}</div>
                      <div>{t("outline.pipeline.currentChapter")}: {pipelineJob.currentItemLabel || "-"}</div>
                      <div>{t("outline.pipeline.progress")}: {Math.round((pipelineJob.progress ?? 0) * 100)}%</div>
                      <div>{t("outline.pipeline.completed")}: {pipelineJob.completedCount}/{pipelineJob.totalCount}</div>
                      <div>{t("outline.pipeline.retries")}: {pipelineJob.retryCount}/{pipelineJob.maxRetries}</div>
                      {pipelineJob.lastErrorType ? <div>{t("outline.pipeline.failureType")}: {pipelineJob.lastErrorType}</div> : null}
                      {pipelineJob.error ? <div className="text-red-600">{t("outline.pipeline.error")}: {pipelineJob.error}</div> : null}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{t("outline.pipeline.noRunningTask")}</div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <StreamOutput content={bibleStreamContent} isStreaming={isBibleStreaming} onAbort={onAbortBible} />
                  <StreamOutput content={beatsStreamContent} isStreaming={isBeatsStreaming} onAbort={onAbortBeats} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </details>

      <details className="group rounded-2xl border border-border/70 bg-background/95 p-4">
        <summary className="cursor-pointer list-none">
          <CollapsibleSummary
            title={t("outline.pipeline.reportsTitle")}
            description={t("outline.pipeline.reportsDescription")}
          />
        </summary>

        <div className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{translateUi("质量报告总览")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {qualitySummary ? (
                <div className="grid gap-2 md:grid-cols-3">
                  <Badge variant="outline">{translateUi("连贯性：")}{qualitySummary.coherence}</Badge>
                  <Badge variant="outline">{translateUi("重复率：")}{qualitySummary.repetition}</Badge>
                  <Badge variant="outline">{translateUi("节奏：")}{qualitySummary.pacing}</Badge>
                  <Badge variant="outline">{translateUi("口吻：")}{qualitySummary.voice}</Badge>
                  <Badge variant="outline">{translateUi("追更感：")}{qualitySummary.engagement}</Badge>
                  <Badge variant="default">{translateUi("综合：")}{qualitySummary.overall}</Badge>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{translateUi("暂无质量报告。")}</div>
              )}
              <div className="space-y-2 text-sm">
                {chapterReports.slice(0, 10).map((item, index) => (
                  <div key={`${item.chapterId ?? "novel"}-${index}`} className="rounded-md border p-2">
                    <div>{t("outline.pipeline.chapterLabel", { chapter: item.chapterId ?? t("outline.pipeline.book") })}</div>
                    <div className="text-muted-foreground">

                      {translateUi("综合：")}{item.overall}{translateUi("，连贯性：")}{item.coherence}{translateUi("，重复率：")}{item.repetition}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{translateUi("已保存圣经")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {bible ? (
                  <>
                    <div className="rounded-md border p-2"><div className="font-medium">{translateUi("主线承诺")}</div><div className="text-muted-foreground">{bible.mainPromise ?? translateUi("暂无")}</div></div>
                    <div className="rounded-md border p-2"><div className="font-medium">{translateUi("核心设定")}</div><div className="text-muted-foreground">{bible.coreSetting ?? translateUi("暂无")}</div></div>
                    <div className="rounded-md border p-2">
                      <div className="font-medium">{translateUi("Bible 世界记录")}</div>
                      <div className="text-xs leading-5 text-muted-foreground">

                        {translateUi("这里是作品圣经里的文字记录；章节生成优先读取“本书世界”里的世界手册和使用范围。")}
                      </div>
                      <div className="mt-2 text-muted-foreground">{bible.worldRules ?? translateUi("暂无")}</div>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">{translateUi("暂无作品圣经。")}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{translateUi("已保存拍点")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {plotBeats.length > 0 ? (
                  plotBeats.slice(0, 20).map((beat) => (
                    <div key={beat.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{translateUi("第")} {beat.chapterOrder ?? "-"}  {translateUi("章 ·")} {beat.title}</div>
                        <Badge variant="outline">{beat.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{translateUi("类型：")}{beat.beatType}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">{translateUi("暂无剧情拍点。")}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </details>
    </div>
  );
}
