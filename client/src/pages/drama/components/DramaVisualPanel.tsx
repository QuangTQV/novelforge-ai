import { translateUi } from "@/i18n/legacy";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Film, ImageIcon, RefreshCw, Sparkles, Video } from "lucide-react";
import {
  estimateDramaEpisodeBatchJob,
  prepareDramaShotKeyframe,
  type DramaBatchCostBreakdown,
  type DramaBatchJob,
  type DramaBatchJobType,
  type DramaBatchProgress,
  type DramaEpisode,
  type DramaProjectDetail,
  type DramaShot,
  type DramaShotKeyframeData,
  type DramaStoryboard,
  type DramaVideoPrompt,
  type DramaVideoProvider,
} from "@/api/drama";
import type { ImageGenerationOverrides } from "@/api/comic";
import { getAPIKeySettings } from "@/api/settings";
import { ImageGenerationConfirmDialog } from "@/components/image/ImageGenerationConfirmDialog";
import { useImageGenerationFlow } from "@/components/image/useImageGenerationFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SelectControl from "@/components/common/SelectControl";
import i18n from "@/i18n";

export function DramaVisualPanel(props: {
  project: DramaProjectDetail;
  selectedOrder: number | null;
  onSelectOrder: (order: number) => void;
  onStoryboard: (order: number) => void;
  onBatchJob: (order: number, input: { type: DramaBatchJobType; provider?: string; failedShotIds?: string[]; useCharacterRefImages?: boolean }) => void;
  onKeyframe: (shot: DramaShot, provider?: string, useCharacterRefImages?: boolean, overrides?: ImageGenerationOverrides) => Promise<unknown>;
  onVideoPrompt: (shot: DramaShot) => void;
  videoProviders: DramaVideoProvider[];
  selectedProvider: string;
  onSelectProvider: (provider: string) => void;
  onProviderTask: (prompt: DramaVideoPrompt, provider: string) => void;
  onRefreshProviderTask: (prompt: DramaVideoPrompt) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("dramaVisual");
  const episodes = props.project.episodes ?? [];
  const selectedEpisode: DramaEpisode | undefined = episodes.find((episode) => episode.order === props.selectedOrder) ?? episodes[0];
  const storyboards = selectedEpisode?.storyboards ?? [];
  const storyboard = storyboards[0] as DramaStoryboard | undefined;
  const videoPrompts = props.project.videoPrompts ?? [];
  const activeVideoPrompts = videoPrompts.filter(isActiveVideoPrompt);
  const promptsByShot = buildLatestPromptsByShot(activeVideoPrompts);
  const selectedBatchJobs = (props.project.batchJobs ?? []).filter((job) => job.episodeId === selectedEpisode?.id);
  const latestKeyframeBatch = selectedBatchJobs.find((job) => job.type === "keyframes");
  const latestVideoBatch = selectedBatchJobs.find((job) => job.type === "videos");
  const [selectedImageProvider, setSelectedImageProvider] = useState("");
  const [useCharacterRefImages, setUseCharacterRefImages] = useState(false);
  const keyframeFlow = useImageGenerationFlow();
  const apiKeyQuery = useQuery({
    queryKey: ["api-key-settings"],
    queryFn: getAPIKeySettings,
    staleTime: 60_000,
  });
  const imageProviders = useMemo(
    () =>
      (apiKeyQuery.data?.data ?? []).filter(
        (item) => item.isActive && item.isConfigured && item.supportsImageGeneration && item.currentImageModel,
      ),
    [apiKeyQuery.data?.data],
  );
  useEffect(() => {
    if (imageProviders.length > 0 && !selectedImageProvider) {
      setSelectedImageProvider(imageProviders[0]!.provider);
    }
  }, [imageProviders, selectedImageProvider]);
  const activeImageProvider = imageProviders.some((provider) => provider.provider === selectedImageProvider)
    ? selectedImageProvider
    : imageProviders[0]?.provider ?? "";
  const promptStats = {
    prompted: activeVideoPrompts.length,
    withTask: activeVideoPrompts.filter((prompt) => Boolean(prompt.providerTaskId)).length,
    queued: activeVideoPrompts.filter((prompt) => prompt.status === "queued" || prompt.status === "running").length,
    succeeded: activeVideoPrompts.filter((prompt) => prompt.status === "succeeded").length,
    failed: activeVideoPrompts.filter((prompt) => prompt.status === "failed").length,
    history: videoPrompts.length - activeVideoPrompts.length,
  };

  const startKeyframeGeneration = (shot: DramaShot) => {
    keyframeFlow.start({
      prepare: async () => {
        const result = await prepareDramaShotKeyframe(
          props.project.id,
          shot.id,
          activeImageProvider || undefined,
          useCharacterRefImages,
        );
        return result.data!;
      },
      generate: (overrides) => props.onKeyframe(shot, activeImageProvider || undefined, useCharacterRefImages, overrides),
    });
  };
  const hasStoryboardShots = Boolean(storyboard?.shots?.length);
  const keyframeBatchActive = isActiveBatch(latestKeyframeBatch);
  const videoBatchActive = isActiveBatch(latestVideoBatch);
  const keyframeEstimateQuery = useQuery({
    queryKey: [
      "drama",
      "batch-estimate",
      props.project.id,
      selectedEpisode?.order,
      "keyframes",
      activeImageProvider,
      useCharacterRefImages,
    ],
    queryFn: () => estimateDramaEpisodeBatchJob(props.project.id, selectedEpisode!.order, {
      type: "keyframes",
      provider: activeImageProvider || undefined,
      useCharacterRefImages,
    }),
    enabled: Boolean(selectedEpisode && hasStoryboardShots && activeImageProvider),
    staleTime: 30_000,
  });
  const videoEstimateQuery = useQuery({
    queryKey: [
      "drama",
      "batch-estimate",
      props.project.id,
      selectedEpisode?.order,
      "videos",
      props.selectedProvider,
    ],
    queryFn: () => estimateDramaEpisodeBatchJob(props.project.id, selectedEpisode!.order, {
      type: "videos",
      provider: props.selectedProvider,
    }),
    enabled: Boolean(selectedEpisode && hasStoryboardShots),
    staleTime: 30_000,
  });

  if (!selectedEpisode) {
    return <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">{t("emptyProject")}</div>;
  }

  return (
    <div className="space-y-4">
      <ImageGenerationConfirmDialog {...keyframeFlow.dialogProps} />
      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.currentPrompt")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.prompted}</div>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.createdTasks")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.withTask}</div>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.generating")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.queued}</div>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.completed")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.succeeded}</div>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.failed")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.failed}</div>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{t("metrics.history")}</div>
          <div className="mt-1 text-lg font-semibold">{promptStats.history}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <SelectControl
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={selectedEpisode.order}
            onChange={(event) => props.onSelectOrder(Number(event.target.value))}
          >
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.order}>{t("ui.episode", { order: episode.order })} {episode.title}</option>
            ))}
          </SelectControl>
          <SelectControl
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={props.selectedProvider}
            onChange={(event) => props.onSelectProvider(event.target.value)}
            aria-label={t("fields.videoProvider")}
          >
            {props.videoProviders.length > 0 ? props.videoProviders.map((provider) => (
              <option key={provider.provider} value={provider.provider}>{provider.label}</option>
            )) : (
              <option value={props.selectedProvider}>{props.selectedProvider}</option>
            )}
          </SelectControl>
          <SelectControl
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={activeImageProvider}
            disabled={imageProviders.length === 0}
            onChange={(event) => setSelectedImageProvider(event.target.value)}
            aria-label={t("fields.imageProvider")}
          >
            {imageProviders.length > 0 ? imageProviders.map((provider) => (
              <option key={provider.provider} value={provider.provider}>
                {provider.name} · {provider.currentImageModel}
              </option>
            )) : (
            <option value="">{t("fields.imageProviderUnset")}</option>
            )}
          </SelectControl>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm">
            <input
              type="checkbox"
              checked={useCharacterRefImages}
              onChange={(event) => setUseCharacterRefImages(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span>{t("fields.characterReference")}</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={props.busy || !selectedEpisode.content?.trim()} onClick={() => props.onStoryboard(selectedEpisode.order)}>
            <Film className="h-4 w-4" />
            {t("actions.createStoryboard")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.busy || !hasStoryboardShots || imageProviders.length === 0 || keyframeBatchActive}
            onClick={() => props.onBatchJob(selectedEpisode.order, { type: "keyframes", provider: activeImageProvider || undefined, useCharacterRefImages })}
          >
            <ImageIcon className="h-4 w-4" />
            {t("actions.createEpisodeKeyframe")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.busy || !hasStoryboardShots || videoBatchActive}
            onClick={() => props.onBatchJob(selectedEpisode.order, { type: "videos", provider: props.selectedProvider })}
          >
            <Sparkles className="h-4 w-4" />
            {t("actions.createEpisodeVideo")}
          </Button>
        </div>
      </div>
      {hasStoryboardShots ? (
        <div className="grid gap-3 md:grid-cols-2">
          <CostEstimate
            title={t("ui.keyframeEstimate")}
            cost={keyframeEstimateQuery.data?.data?.cost}
            loading={keyframeEstimateQuery.isFetching}
          />
          <CostEstimate
            title={t("ui.videoEstimate")}
            cost={videoEstimateQuery.data?.data?.cost}
            loading={videoEstimateQuery.isFetching}
          />
        </div>
      ) : null}
      {latestKeyframeBatch || latestVideoBatch ? (
        <div className="grid gap-3 md:grid-cols-2">
          {latestKeyframeBatch ? (
            <BatchJobStatus
              job={latestKeyframeBatch}
              title={t("ui.keyframeBatch")}
              disabled={props.busy || imageProviders.length === 0}
              onRetry={(failedShotIds) => props.onBatchJob(selectedEpisode.order, {
                type: "keyframes",
                provider: activeImageProvider || undefined,
                failedShotIds,
              })}
            />
          ) : null}
          {latestVideoBatch ? (
            <BatchJobStatus
              job={latestVideoBatch}
              title={t("ui.videoBatch")}
              disabled={props.busy}
              onRetry={(failedShotIds) => props.onBatchJob(selectedEpisode.order, {
                type: "videos",
                provider: props.selectedProvider,
                failedShotIds,
              })}
            />
          ) : null}
        </div>
      ) : null}
      {props.videoProviders.length > 0 ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {t("ui.currentVideoChannel", { value: props.videoProviders.find((provider) => provider.provider === props.selectedProvider)?.description || props.selectedProvider })}
        </div>
      ) : null}
      {!storyboard ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">{t("ui.noStoryboard")}</div>
      ) : (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg">{t("storyboard.title")}</CardTitle>
            <CardDescription>{storyboard.summary || t("storyboard.generated")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(storyboard.shots ?? []).map((shot) => {
              const prompt = promptsByShot.get(shot.id);
              const keyframe = parseKeyframe(shot.keyframeData);
              return (
                <div key={shot.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{t("ui.shot", { order: shot.order, size: shot.shotSize || t("ui.sizeUnset") })}</div>
                      <div className="text-sm text-muted-foreground">{shot.action}</div>
                      <div className="flex flex-wrap gap-2">
                        {keyframe.status === "done" ? <Badge variant="outline">{t("ui.keyframe", { version: keyframe.version ?? 1 })}</Badge> : null}
                        {keyframe.history?.length ? <Badge variant="secondary">{t("ui.keyframeHistory", { count: keyframe.history.length })}</Badge> : null}
                        {prompt ? <Badge variant="outline">{t("ui.videoPrompt", { version: prompt.version ?? 1 })}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="button"
                        variant={keyframe.status === "done" ? "outline" : "default"}
                        disabled={props.busy || keyframeFlow.dialogProps.loading || keyframeFlow.dialogProps.submitting || imageProviders.length === 0 || keyframe.status === "generating"}
                        onClick={() => startKeyframeGeneration(shot)}
                      >
                        <ImageIcon className="h-4 w-4" />
                        {keyframe.status === "done" ? translateUi("重生成首帧") : translateUi("生成首帧")}
                      </Button>
                      <Button size="sm" type="button" variant="outline" disabled={props.busy} onClick={() => props.onVideoPrompt(shot)}>
                        <Video className="h-4 w-4" />

                        {translateUi("视频提示词")}
                      </Button>
                      {prompt ? (
                        <>
                          <Button size="sm" type="button" disabled={props.busy || Boolean(prompt.providerTaskId)} onClick={() => props.onProviderTask(prompt, props.selectedProvider)}>
                            <Sparkles className="h-4 w-4" />
                        {prompt.providerTaskId ? t("ui.task", { value: t("ui.createTask") }) : t("ui.createTask")}
                          </Button>
                          {prompt.providerTaskId ? (
                            <Button size="sm" type="button" variant="outline" disabled={props.busy} onClick={() => props.onRefreshProviderTask(prompt)}>
                              <RefreshCw className="h-4 w-4" />
                              {t("ui.refresh")}
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <KeyframePreview shot={shot} keyframe={keyframe} />
                  {prompt ? (
                    <VideoPromptDetails prompt={prompt} />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {videoPrompts.length > 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg">{t("ui.videoTasks")}</CardTitle>
            <CardDescription>{t("ui.videoTasksDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {videoPrompts.map((prompt) => (
              <div key={prompt.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">{prompt.provider}</Badge>
                      <Badge variant="outline">v{prompt.version ?? 1}</Badge>
                      <Badge variant={prompt.status === "failed" ? "destructive" : "outline"}>{prompt.status}</Badge>
                      {!isActiveVideoPrompt(prompt) ? <Badge variant="secondary">{t("ui.history")}</Badge> : null}
                      {prompt.providerTaskId ? <span className="text-muted-foreground">{t("ui.task", { value: prompt.providerTaskId })}</span> : null}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{prompt.prompt}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!prompt.providerTaskId ? (
                      <Button size="sm" type="button" disabled={props.busy || !isActiveVideoPrompt(prompt)} onClick={() => props.onProviderTask(prompt, props.selectedProvider)}>
                        <Sparkles className="h-4 w-4" />

                        {translateUi("创建任务")}
                      </Button>
                    ) : (
                      <Button size="sm" type="button" variant="outline" disabled={props.busy} onClick={() => props.onRefreshProviderTask(prompt)}>
                        <RefreshCw className="h-4 w-4" />
                        {t("ui.refresh")}
                      </Button>
                    )}
                  </div>
                </div>
                <VideoPromptDetails prompt={prompt} compact />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function safeJson<T>(input: string | null | undefined, fallback: T): T {
  if (!input) {
    return fallback;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function parseKeyframe(raw: string | null | undefined): DramaShotKeyframeData {
  return safeJson<DramaShotKeyframeData>(raw, { status: "idle" });
}

function parseBatchProgress(raw: string | null | undefined): DramaBatchProgress {
  return safeJson<DramaBatchProgress>(raw, {
    total: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    failedShotIds: [],
    errors: [],
  });
}

function isActiveVideoPrompt(prompt: DramaVideoPrompt): boolean {
  return prompt.status !== "superseded";
}

function buildLatestPromptsByShot(prompts: DramaVideoPrompt[]): Map<string, DramaVideoPrompt> {
  const result = new Map<string, DramaVideoPrompt>();
  for (const prompt of prompts) {
    if (prompt.shotId && !result.has(prompt.shotId)) {
      result.set(prompt.shotId, prompt);
    }
  }
  return result;
}

function isActiveBatch(job: DramaBatchJob | undefined): boolean {
  return job?.status === "pending" || job?.status === "running";
}

function batchStatusLabel(status: DramaBatchJob["status"]): string {
  const labels: Record<DramaBatchJob["status"], string> = {
    pending: translateUi("等待中"),
    running: translateUi("执行中"),
    paused: translateUi("已暂停"),
    done: translateUi("已完成"),
    failed: translateUi("有失败项"),
  };
  return labels[status] ?? status;
}

function BatchJobStatus(props: {
  job: DramaBatchJob;
  title: string;
  disabled: boolean;
  onRetry: (failedShotIds: string[]) => void;
}) {
  const progress = parseBatchProgress(props.job.progress);
  const total = Math.max(0, progress.total ?? 0);
  const done = Math.max(0, progress.done ?? 0);
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const failedShotIds = progress.failedShotIds ?? [];
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{props.title}</div>
        <Badge variant={props.job.status === "failed" ? "destructive" : "outline"}>{batchStatusLabel(props.job.status)}</Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{done}/{total}</span>
        {progress.skipped ? <span>{i18n.t("dramaVisual:ui.skipped", { count: progress.skipped })}</span> : null}
        {progress.failed ? <span>{i18n.t("dramaVisual:ui.failed", { count: progress.failed })}</span> : null}
        {progress.provider ? <span>{i18n.t("dramaVisual:ui.channel", { value: progress.provider })}</span> : null}
        {progress.cost ? <span>{i18n.t("dramaVisual:ui.estimated", { value: formatCost(progress.cost, progress.cost.estimated) })}</span> : null}
        {progress.cost ? <span>{i18n.t("dramaVisual:ui.actual", { value: formatCost(progress.cost, progress.cost.actual) })}</span> : null}
      </div>
      {failedShotIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-destructive">{i18n.t("dramaVisual:ui.failedShots", { value: failedShotIds.join("、") })}</span>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={props.disabled || isActiveBatch(props.job)}
            onClick={() => props.onRetry(failedShotIds)}
          >
            <RefreshCw className="h-4 w-4" />
            {i18n.t("dramaVisual:ui.retryFailed")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function KeyframePreview({ shot, keyframe }: { shot: DramaShot; keyframe: DramaShotKeyframeData }) {
  const hasImage = keyframe.status === "done" && keyframe.url;
  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        {hasImage ? (
          <a href={keyframe.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={keyframe.url}
            alt={i18n.t("dramaVisual:ui.shotFrame")}
              className="h-56 w-full rounded-md border object-cover md:h-40"
            />
          </a>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground">
            {keyframe.status === "generating" ? i18n.t("dramaVisual:ui.keyframeGenerating") : keyframe.status === "error" ? i18n.t("dramaVisual:ui.keyframeError") : i18n.t("dramaVisual:ui.keyframePending")}
          </div>
        )}
        <div className="rounded-md border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-medium text-foreground">
            <span>{i18n.t("dramaVisual:ui.shotFrame")}</span>
            {keyframe.status === "done" ? <Badge variant="outline">v{keyframe.version ?? 1}</Badge> : null}
          </div>
          <div>{shot.visualPrompt || shot.action}</div>
          {shot.location ? <div className="mt-1">{i18n.t("dramaVisual:ui.location", { value: shot.location })}</div> : null}
          {keyframe.provider ? <div className="mt-1">{i18n.t("dramaVisual:ui.keyframeChannel", { value: keyframe.provider })}</div> : null}
          {keyframe.status === "error" && keyframe.error ? (
            <div className="mt-2 text-destructive">{keyframe.error}</div>
          ) : null}
        </div>
      </div>
      <KeyframeHistory history={keyframe.history ?? []} />
    </div>
  );
}

function formatLocalTime(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function KeyframeHistory({ history }: { history: NonNullable<DramaShotKeyframeData["history"]> }) {
  if (!history.length) {
    return null;
  }
  const items = [...history].sort((left, right) => right.version - left.version);
  return (
    <div className="rounded-md border border-dashed p-3 text-xs">
      <div className="mb-2 font-medium">{i18n.t("dramaVisual:ui.keyframeHistoryTitle")}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const label = `v${item.version}${item.provider ? ` · ${item.provider}` : ""}`;
          return item.url ? (
            <a
              key={`${item.version}-${item.url}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-2 py-1 text-primary underline-offset-4 hover:underline"
              title={formatLocalTime(item.generatedAt)}
            >
              {label}
            </a>
          ) : (
            <span key={item.version} className="rounded-md border px-2 py-1 text-muted-foreground" title={formatLocalTime(item.generatedAt)}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function formatCost(cost: DramaBatchCostBreakdown, amount: number): string {
  return `${cost.currency} ${amount.toFixed(2)}`;
}

function costUnitLabel(cost: DramaBatchCostBreakdown): string {
  const parts = [];
  if (cost.unit.costPerImage) {
    parts.push(translateUi("图片 {{v0}}/张", { v0: formatCost(cost, cost.unit.costPerImage) }));
  }
  if (cost.unit.costPerSecond) {
    parts.push(translateUi("时长 {{v0}}/秒", { v0: formatCost(cost, cost.unit.costPerSecond) }));
  }
  return parts.length ? parts.join("，") : translateUi("未配置单价");
}

function CostEstimate(props: { title: string; cost?: DramaBatchCostBreakdown; loading: boolean }) {
  return (
    <div className="rounded-md border border-dashed p-3 text-sm">
      <div className="text-xs text-muted-foreground">{props.title}</div>
      <div className="mt-1 font-medium">
        {props.loading ? translateUi("计算中") : props.cost ? formatCost(props.cost, props.cost.estimated) : translateUi("待计算")}
      </div>
      {props.cost ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {costUnitLabel(props.cost)}
          {props.cost.estimatedUnits.shots ? translateUi(" · {{value0}} 个镜头", { value0: props.cost.estimatedUnits.shots }) : ""}
        </div>
      ) : null}
    </div>
  );
}

function VideoPromptDetails({ prompt, compact = false }: { prompt: DramaVideoPrompt; compact?: boolean }) {
  const providerResult = safeJson<{
    resultUrl?: string;
    failureReason?: string;
    status?: string;
    raw?: unknown;
  }>(prompt.providerResult, {});
  const resultUrl = prompt.resultUrl || providerResult.resultUrl;
  const failureReason = prompt.failureReason || providerResult.failureReason;

  return (
    <div className="mt-3 space-y-2">
      {!compact ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{prompt.provider}</Badge>
            <Badge variant="outline">v{prompt.version ?? 1}</Badge>
            <Badge variant={prompt.status === "failed" ? "destructive" : "outline"}>{prompt.status}</Badge>
            {!isActiveVideoPrompt(prompt) ? <Badge variant="secondary">{translateUi("历史版本")}</Badge> : null}
            {prompt.providerTaskId ? <span className="text-muted-foreground">{translateUi("任务：")}{prompt.providerTaskId}</span> : null}
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs leading-5">{prompt.prompt}</pre>
        </>
      ) : null}
      {prompt.negativePrompt ? (
        <div className="rounded-md border p-3 text-xs leading-5 text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">{i18n.t("dramaVisual:ui.negativePrompt")}</div>
          {prompt.negativePrompt}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{i18n.t("dramaVisual:ui.version", { value: prompt.version ?? 1 })}</span>
        <span>{i18n.t("dramaVisual:ui.aspect", { value: prompt.aspectRatio })}</span>
        {prompt.durationSec ? <span>{i18n.t("dramaVisual:ui.duration", { value: prompt.durationSec })}</span> : null}
        {providerResult.status ? <span>{i18n.t("dramaVisual:ui.videoStatus", { value: providerResult.status })}</span> : null}
      </div>
      {resultUrl ? (
        <a
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          href={resultUrl}
          target="_blank"
          rel="noreferrer"
        >
          {i18n.t("dramaVisual:ui.viewResult")}
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      {prompt.status === "failed" ? (
        <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {failureReason ? `${i18n.t("dramaVisual:ui.videoFailed")} ${failureReason}` : i18n.t("dramaVisual:ui.videoFailed")}
        </div>
      ) : null}
    </div>
  );
}
