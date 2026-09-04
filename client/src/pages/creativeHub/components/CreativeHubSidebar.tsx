import { translateUi } from "@/i18n/legacy";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FailureDiagnostic } from "@ai-novel/shared/types/agent";
import type {
  CreativeHubInterrupt,
  CreativeHubNovelSetupStatus,
  CreativeHubProductionStatus,
  CreativeHubResourceBinding,
  CreativeHubThread,
  CreativeHubTurnSummary,
} from "@ai-novel/shared/types/creativeHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import SelectControl from "@/components/common/SelectControl";
import { Link } from "react-router-dom";

interface CreativeHubSidebarProps {
  thread?: CreativeHubThread;
  bindings: CreativeHubResourceBinding;
  novels: Array<{ id: string; title: string }>;
  interrupt?: CreativeHubInterrupt;
  diagnostics?: FailureDiagnostic;
  productionStatus?: CreativeHubProductionStatus | null;
  novelSetup?: CreativeHubNovelSetupStatus | null;
  latestTurnSummary?: CreativeHubTurnSummary | null;
  currentCheckpointId?: string | null;
  modelSummary: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens?: number;
  };
  defaultRuntimeDetailsCollapsed: boolean;
  actionDisabled?: boolean;
  novelsLoading?: boolean;
  novelsErrorMessage?: string;
  novelsRetrying?: boolean;
  onToggleRuntimeDetailsDefault: () => void;
  onRetryNovels?: () => void;
  onNovelChange: (novelId: string) => void | Promise<void>;
  onQuickAction?: (prompt: string) => void;
}

function bindingStatusLabel(value: string | null | undefined): string {
  return value?.trim() ? "binding.bound" : "binding.unbound";
}

function pipelineStatusLabel(status: string | null | undefined): string {
  if (status === "queued") return "pipeline.queued";
  if (status === "running") return "pipeline.running";
  if (status === "succeeded") return "pipeline.succeeded";
  if (status === "failed") return "pipeline.failed";
  if (status === "cancelled") return "pipeline.cancelled";
  return "pipeline.notStarted";
}

function turnStatusLabel(status: CreativeHubTurnSummary["status"]): string {
  switch (status) {
    case "succeeded":
      return "turn.succeeded";
    case "interrupted":
      return "turn.interrupted";
    case "failed":
      return "turn.failed";
    case "cancelled":
      return "turn.cancelled";
    case "running":
      return "turn.running";
    default:
      return status;
  }
}

function threadStatusLabel(status: CreativeHubThread["status"] | undefined): string {
  switch (status) {
    case "busy":
      return "thread.busy";
    case "interrupted":
      return "thread.interrupted";
    case "error":
      return "thread.error";
    case "idle":
      return "thread.idle";
    default:
      return "thread.uninitialized";
  }
}

function metricTone(status: "pending" | "completed" | "running" | "blocked"): string {
  switch (status) {
    case "completed":
      return "border-success/30 bg-success/5 text-success";
    case "running":
      return "border-info/30 bg-info/5 text-info";
    case "blocked":
      return "border-warning/30 bg-warning/5 text-warning";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function buildBlockerCardData(input: {
  interrupt?: CreativeHubInterrupt;
  diagnostics?: FailureDiagnostic;
  productionStatus?: CreativeHubProductionStatus | null;
  latestTurnSummary?: CreativeHubTurnSummary | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { t } = input;
  if (input.interrupt) {
    return {
      title: t("sidebar.blocker.blocked"),
      summary: input.interrupt.summary,
      details: [
        t("sidebar.blocker.waitingConfirmation", { title: input.interrupt.title }),
        input.interrupt.targetType ? t("sidebar.blocker.targetType", { type: input.interrupt.targetType }) : "",
      ].filter(Boolean),
      tone: "border-warning/30 bg-warning/5 text-foreground",
      actionLabel: t("sidebar.blocker.viewConfirmation"),
      actionPrompt: "总结当前待确认的创作决策，并说明推荐处理方式",
    };
  }

  if (input.diagnostics?.failureSummary) {
    return {
      title: t("sidebar.blocker.risk"),
      summary: input.diagnostics.failureSummary,
      details: [
        input.diagnostics.failureCode ? t("sidebar.blocker.errorCode", { code: input.diagnostics.failureCode }) : "",
        input.diagnostics.recoveryHint ? t("sidebar.blocker.recoveryHint", { hint: input.diagnostics.recoveryHint }) : "",
      ].filter(Boolean),
      tone: "border-destructive/30 bg-destructive/5 text-foreground",
      actionLabel: t("sidebar.blocker.createRecovery"),
      actionPrompt: input.diagnostics.recoveryHint || "分析当前失败原因并给出恢复步骤",
    };
  }

  if (input.productionStatus?.failureSummary) {
    return {
      title: t("sidebar.blocker.blocked"),
      summary: input.productionStatus.failureSummary,
      details: [
        input.productionStatus.recoveryHint ? t("sidebar.blocker.recoveryHint", { hint: input.productionStatus.recoveryHint }) : "",
        t("sidebar.blocker.currentStage", { stage: input.productionStatus.currentStage }),
      ].filter(Boolean),
      tone: "border-destructive/30 bg-destructive/5 text-foreground",
      actionLabel: t("sidebar.blocker.viewBlocked"),
      actionPrompt: input.productionStatus.recoveryHint || "分析当前生产阻塞和正式处理入口",
    };
  }

  if (input.latestTurnSummary?.status === "interrupted") {
    return {
      title: t("sidebar.blocker.focus"),
      summary: input.latestTurnSummary.nextSuggestion,
      details: [
        t("sidebar.blocker.stage", { stage: input.latestTurnSummary.currentStage }),
        t("sidebar.blocker.status", { status: t(`sidebar.${turnStatusLabel(input.latestTurnSummary.status)}`) }),
      ],
      tone: "border-info/30 bg-info/5 text-foreground",
      actionLabel: t("sidebar.blocker.viewSuggestion"),
      actionPrompt: `解释当前建议和正式入口：${input.latestTurnSummary.nextSuggestion}`,
    };
  }

  return {
    title: t("sidebar.blocker.currentStatus"),
    summary: t("sidebar.blocker.noIssue"),
    details: input.latestTurnSummary?.nextSuggestion
      ? [t("sidebar.blocker.nextSuggestion", { suggestion: input.latestTurnSummary.nextSuggestion })]
      : [],
    tone: "border-border bg-muted/20 text-foreground",
    actionLabel: input.latestTurnSummary?.nextSuggestion ? t("sidebar.blocker.viewSuggestion") : undefined,
    actionPrompt: input.latestTurnSummary?.nextSuggestion
      ? `解释当前建议和正式入口：${input.latestTurnSummary.nextSuggestion}`
      : undefined,
  };
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="max-w-[60%] break-all text-right text-foreground">{value}</span>
    </div>
  );
}

export default function CreativeHubSidebar({
  thread,
  bindings,
  novels,
  interrupt,
  diagnostics,
  productionStatus,
  novelSetup,
  latestTurnSummary,
  currentCheckpointId,
  modelSummary,
  defaultRuntimeDetailsCollapsed,
  actionDisabled = false,
  novelsLoading = false,
  novelsErrorMessage = "",
  novelsRetrying = false,
  onToggleRuntimeDetailsDefault,
  onRetryNovels,
  onNovelChange,
  onQuickAction,
}: CreativeHubSidebarProps) {
  const { t } = useTranslation("creativeHub");
  const [isBindingNovel, setIsBindingNovel] = useState(false);
  const selectedNovel = novels.find((item) => item.id === bindings.novelId);
  const currentNovelTitle = selectedNovel?.title
    ?? productionStatus?.title
    ?? novelSetup?.title
    ?? null;
  const blocker = useMemo(
    () => buildBlockerCardData({
      interrupt,
      diagnostics,
      productionStatus,
      latestTurnSummary,
      t,
    }),
    [diagnostics, interrupt, latestTurnSummary, productionStatus],
  );
  const completedAssets = productionStatus?.assetStages.filter((item) => item.status === "completed").length ?? 0;
  const latestRunId = latestTurnSummary?.runId ?? thread?.latestRunId ?? null;
  const blockerActionPrompt = blocker.actionPrompt ?? "";
  const resourceActionDisabled = actionDisabled || isBindingNovel;

  return (
    <Card
      className="flex h-full min-h-0 flex-col rounded-lg shadow-none"
      aria-busy={isBindingNovel || novelsRetrying}
    >
      <CardHeader className="pb-4">
      <CardTitle className="text-base">{t("sidebar.title")}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t("sidebar.resourcesTitle")}</div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <label htmlFor="creative-hub-novel" className="text-xs font-medium text-muted-foreground">{t("sidebar.currentNovel")}</label>
              <SelectControl
                id="creative-hub-novel"
                className="w-full rounded-md border border-input bg-background p-2 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                value={bindings.novelId ?? ""}
                disabled={resourceActionDisabled || novelsLoading || Boolean(novelsErrorMessage)}
                onChange={(event) => {
                  const novelId = event.target.value;
                  setIsBindingNovel(true);
                  void Promise.resolve(onNovelChange(novelId))
                    .catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : t("sidebar.switchFailed"));
                    })
                    .finally(() => setIsBindingNovel(false));
                }}
              >
                <option value="">{t("sidebar.unboundNovel")}</option>
                {bindings.novelId && !selectedNovel ? (
                  <option value={bindings.novelId}>{currentNovelTitle ?? t("sidebar.boundNovel")}</option>
                ) : null}
                {novels.map((novel) => (
                  <option key={novel.id} value={novel.id}>
                    {novel.title}
                  </option>
                ))}
              </SelectControl>
              {novelsLoading ? (
                <div className="text-xs leading-5 text-muted-foreground" role="status">
                  {t("sidebar.loadingNovels")}
                </div>
              ) : novelsErrorMessage ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs leading-5 text-foreground">
                  <div>{t("sidebar.novelsLoadFailed")}</div>
                  {onRetryNovels ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={novelsRetrying}
                      onClick={onRetryNovels}
                    >
                      {novelsRetrying ? t("sidebar.retrying") : t("sidebar.reloadNovels")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/novels/create">{t("sidebar.createNovel")}</Link></Button>
                {bindings.novelId ? <Button asChild size="sm" variant="outline"><Link to={`/novels/${bindings.novelId}/edit`}>{t("sidebar.openWorkspace")}</Link></Button> : null}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>{t("sidebar.binding.chapter")}: {t(`sidebar.${bindingStatusLabel(bindings.chapterId)}`)}</div>
              <div>{t("sidebar.binding.world")}: {t(`sidebar.${bindingStatusLabel(bindings.worldId)}`)}</div>
              <div>{t("sidebar.binding.task")}: {t(`sidebar.${bindingStatusLabel(bindings.taskId)}`)}</div>
              <div>{t("sidebar.binding.analysis")}: {t(`sidebar.${bindingStatusLabel(bindings.bookAnalysisId)}`)}</div>
              <div>{t("sidebar.binding.formula")}: {t(`sidebar.${bindingStatusLabel(bindings.formulaId)}`)}</div>
              <div>{t("sidebar.binding.character")}: {t(`sidebar.${bindingStatusLabel(bindings.baseCharacterId)}`)}</div>
            </div>
            <div>{t("sidebar.binding.knowledge")}: {bindings.knowledgeDocumentIds?.length ?? 0}</div>
          </div>
        </div>

        <div className="rounded-md border border-info/30 bg-info/5 p-3">
          <div className="text-xs font-medium text-info">{t("sidebar.officialEntry")}</div>
          <div className="mt-2 text-sm leading-6 text-foreground">{t("sidebar.officialEntryDescription")}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/novels/auto-director">{t("sidebar.openDirector")}</Link></Button>
          </div>
        </div>

        <div className={cn("rounded-md border p-3", blocker.tone)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium">{blocker.title}</div>
            {interrupt ? <Badge variant="secondary">{t("sidebar.needsConfirmation")}</Badge> : null}
          </div>
          <div className="text-sm leading-6">{blocker.summary}</div>
          {blocker.details.length > 0 ? (
            <div className="mt-3 space-y-2 text-xs">
              {blocker.details.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {blocker.actionLabel && blockerActionPrompt ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-current bg-background/80"
                disabled={actionDisabled}
                onClick={() => onQuickAction?.(blockerActionPrompt)}
              >
                {blocker.actionLabel}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-3 text-xs font-medium text-muted-foreground">{t("sidebar.productionStage")}</div>
          {productionStatus ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">{t("sidebar.currentStage")}</div>
                  <div className="mt-2 text-sm font-medium text-foreground">{productionStatus.currentStage}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">{t("sidebar.chapterProgress")}</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {productionStatus.chapterCount}/{productionStatus.targetChapterCount}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">{t("sidebar.assetsComplete")}</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {completedAssets}/{productionStatus.assetStages.length}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">{t("sidebar.pipeline")}</div>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {pipelineStatusLabel(productionStatus.pipelineStatus)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {productionStatus.assetStages.map((item) => (
                  <span
                    key={item.key}
                    className={cn("rounded-full border px-2 py-1 text-[11px]", metricTone(item.status))}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t("sidebar.emptyProduction")}
            </div>
          )}
        </div>

        <details className="rounded-md border border-border bg-background p-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
            {t("sidebar.debugTitle")}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {t("sidebar.runtimeDetails")}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>

                  {translateUi("当前默认")}
                  {defaultRuntimeDetailsCollapsed ? translateUi("折叠") : translateUi("展开")}

                  {translateUi("消息内的运行细节")}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={onToggleRuntimeDetailsDefault}>

                  {translateUi("切换为")}{defaultRuntimeDetailsCollapsed ? translateUi("默认展开") : translateUi("默认折叠")}
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">{translateUi("线程状态")}</div>
              <DebugRow label={translateUi("线程 ID")} value={thread?.id ?? "-"} />
              <DebugRow label={translateUi("线程状态")} value={threadStatusLabel(thread?.status)} />
              <DebugRow label={translateUi("最新 Run")} value={latestRunId ?? "-"} />
              <DebugRow label={translateUi("当前 Checkpoint")} value={currentCheckpointId ?? "-"} />
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">{translateUi("资源绑定 ID")}</div>
              <DebugRow label={translateUi("小说")} value={bindings.novelId ?? "-"} />
              <DebugRow label={translateUi("章节")} value={bindings.chapterId ?? "-"} />
              <DebugRow label={translateUi("世界观")} value={bindings.worldId ?? "-"} />
              <DebugRow label={translateUi("任务")} value={bindings.taskId ?? "-"} />
              <DebugRow label={translateUi("拆书分析")} value={bindings.bookAnalysisId ?? "-"} />
              <DebugRow label={translateUi("写作公式")} value={bindings.formulaId ?? "-"} />
              <DebugRow label={translateUi("写法档案")} value={bindings.styleProfileId ?? "-"} />
              <DebugRow label={translateUi("基础角色")} value={bindings.baseCharacterId ?? "-"} />
              <DebugRow label={translateUi("知识文档")} value={bindings.knowledgeDocumentIds?.join(", ") || "-"} />
              {interrupt ? <DebugRow label={translateUi("待确认目标")} value={interrupt.targetId ?? "-"} /> : null}
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">{translateUi("模型路由")}</div>
              <DebugRow label="Provider" value={modelSummary.provider} />
              <DebugRow label="Model" value={modelSummary.model} />
              <DebugRow label="Temperature" value={String(modelSummary.temperature)} />
              <DebugRow label="Max tokens" value={modelSummary.maxTokens != null ? String(modelSummary.maxTokens) : translateUi("默认")} />
            </div>

            {latestTurnSummary ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">{translateUi("最近回合")}</div>
                <DebugRow label={translateUi("回合状态")} value={turnStatusLabel(latestTurnSummary.status)} />
                <DebugRow label={translateUi("回合阶段")} value={latestTurnSummary.currentStage} />
                <DebugRow label={translateUi("摘要 Checkpoint")} value={latestTurnSummary.checkpointId ?? "-"} />
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
