import { translateUi } from "@/i18n/legacy";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BookPayoffLedgerCard from "./BookPayoffLedgerCard";
import CollapsibleSummary from "./CollapsibleSummary";
import WorldInjectionHint from "./WorldInjectionHint";
import type { OutlineTabViewProps } from "./NovelEditView.types";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import SelectControl from "@/components/common/SelectControl";
import OutlineCurrentVolumeWorkspace from "./outline/OutlineCurrentVolumeWorkspace";
import OutlineResourceCommitments from "./outline/OutlineResourceCommitments";
import type { VolumeBeatImpactItem } from "@ai-novel/shared/types/novel";

type OutlineWorkspaceTab = "current" | "strategy" | "assets";

function versionStatusLabel(status: "draft" | "active" | "frozen"): string {
  return `outline.versionStatus.${status}`;
}

function versionStatusVariant(status: "draft" | "active" | "frozen"): "secondary" | "outline" | "default" {
  if (status === "active") return "default";
  if (status === "frozen") return "outline";
  return "secondary";
}

const readinessSteps = [
  {
    key: "canGenerateStrategy",
    labelKey: "readiness.strategy.label",
    descriptionKey: "readiness.strategy.description",
  },
  {
    key: "canGenerateSkeleton",
    labelKey: "readiness.skeleton.label",
    descriptionKey: "readiness.skeleton.description",
  },
  {
    key: "canGenerateBeatSheet",
    labelKey: "readiness.beatSheet.label",
    descriptionKey: "readiness.beatSheet.description",
  },
  {
    key: "canGenerateChapterList",
    labelKey: "readiness.chapters.label",
    descriptionKey: "readiness.chapters.description",
  },
] as const;

function getNextOutlineAction(readiness: OutlineTabViewProps["readiness"]): string {
  if (!readiness.canGenerateStrategy) return "next.generateStrategy";
  if (!readiness.canGenerateSkeleton) return "next.generateSkeleton";
  if (!readiness.canGenerateBeatSheet) return "next.generateBeatSheet";
  if (!readiness.canGenerateChapterList) return "next.generateChapterList";
  return "next.ready";
}

function getVolumeScaleProfileLabel(profile: OutlineTabViewProps["volumeCountGuidance"]["volumeScaleProfile"]): string {
  const labels: Record<OutlineTabViewProps["volumeCountGuidance"]["volumeScaleProfile"], string> = {
    short: "short",
    compact: "compact",
    standard: "standard",
    long: "long",
    epic: "epic",
    mega: "mega",
  };
  return labels[profile] ?? "structure.default";
}

function getBeatImpactStatusLabel(status: VolumeBeatImpactItem["status"]): string {
  if (status === "locked_with_draft") return "impact.locked";
  if (status === "pending") return "impact.pending";
  return "impact.unwritten";
}

function getBeatImpactStatusVariant(status: VolumeBeatImpactItem["status"]): "secondary" | "outline" | "default" {
  if (status === "locked_with_draft") return "secondary";
  if (status === "pending") return "outline";
  return "default";
}

function formatBeatChapterOrders(chapterOrders: number[], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (chapterOrders.length === 0) {
    return t("outline.impact.pendingChapters");
  }
  const sorted = chapterOrders.slice().sort((left, right) => left - right);
  return sorted[0] === sorted[sorted.length - 1]
    ? t("outline.impact.singleChapter", { chapter: sorted[0] })
    : t("outline.impact.chapterRange", { start: sorted[0], end: sorted[sorted.length - 1] });
}

export default function OutlineTab(props: OutlineTabViewProps) {
  const { t } = useTranslation("novelOutline");
  const {
    worldInjectionSummary,
    hasCharacters,
    hasUnsavedVolumeDraft,
    generationNotice,
    readiness,
    volumeCountGuidance,
    customVolumeCountEnabled,
    customVolumeCountInput,
    onCustomVolumeCountEnabledChange,
    onCustomVolumeCountInputChange,
    onApplyCustomVolumeCount,
    onRestoreSystemRecommendedVolumeCount,
    strategyPlan,
    critiqueReport,
    isGeneratingStrategy,
    onGenerateStrategy,
    isCritiquingStrategy,
    onCritiqueStrategy,
    isGeneratingSkeleton,
    onGenerateSkeleton,
    onGoToCharacterTab,
    onGoToStructuredTab,
    latestStateSnapshot,
    payoffLedger,
    characterResources = [],
    draftText,
    volumes,
    onVolumeFieldChange,
    onOpenPayoffsChange,
    onAddVolume,
    onRemoveVolume,
    onMoveVolume,
    onSave,
    isSaving,
    volumeMessage,
    volumeVersions,
    selectedVersionId,
    onSelectedVersionChange,
    onCreateDraftVersion,
    isCreatingDraftVersion,
    onLoadSelectedVersionToDraft,
    onActivateVersion,
    isActivatingVersion,
    onFreezeVersion,
    isFreezingVersion,
    onLoadVersionDiff,
    isLoadingVersionDiff,
    diffResult,
    onAnalyzeDraftImpact,
    isAnalyzingDraftImpact,
    onAnalyzeVersionImpact,
    isAnalyzingVersionImpact,
    impactResult,
  } = props;

  const selectedVersion = volumeVersions.find((item) => item.id === selectedVersionId);
  const completedReadinessCount = readinessSteps.filter((item) => readiness[item.key]).length;
  const readinessProgress = Math.round((completedReadinessCount / Math.max(readinessSteps.length, 1)) * 100);
  const nextOutlineAction = t(`outline.${getNextOutlineAction(readiness)}`);
  const outlineStageReady = completedReadinessCount === readinessSteps.length;
  const [selectedVolumeId, setSelectedVolumeId] = useState(volumes[0]?.id ?? "");
  const [workspaceTab, setWorkspaceTab] = useState<OutlineWorkspaceTab>("current");
  const volumeCountModeLabel = volumeCountGuidance.userPreferredVolumeCount != null
    ? t("outline.volumeCount.fixed", { count: volumeCountGuidance.userPreferredVolumeCount })
    : volumeCountGuidance.respectedExistingVolumeCount != null
      ? t("outline.volumeCount.draft", { count: volumeCountGuidance.respectedExistingVolumeCount })
      : t("outline.volumeCount.system", { count: volumeCountGuidance.systemRecommendedVolumeCount });
  const volumeScaleProfileLabel = t(`outline.structure.${getVolumeScaleProfileLabel(volumeCountGuidance.volumeScaleProfile)}`);

  useEffect(() => {
    if (!volumes.some((volume) => volume.id === selectedVolumeId)) {
      setSelectedVolumeId(volumes[0]?.id ?? "");
    }
  }, [selectedVolumeId, volumes]);

  const selectedVolume = volumes.find((volume) => volume.id === selectedVolumeId) ?? volumes[0];

  return (
    <div className="space-y-5">
      <DirectorTakeoverEntryPanel
        title={t("outline.takeover.title")}
        description={t("outline.takeover.description")}
        entry={props.directorTakeoverEntry}
      />
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted)/0.38)_100%)] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{t("outline.title")}</h2>
              <Badge variant={outlineStageReady ? "default" : "outline"}>
                {t("outline.readyCount", { completed: completedReadinessCount, total: readinessSteps.length })}
              </Badge>
              {hasUnsavedVolumeDraft ? <Badge variant="secondary">{t("outline.unsaved")}</Badge> : null}
            </div>
            <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("outline.description")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiButton variant="outline" onClick={onGenerateStrategy} disabled={isGeneratingStrategy}>
              {isGeneratingStrategy ? t("outline.generating") : t("outline.actions.generateStrategy")}
            </AiButton>
            <AiButton variant="outline" onClick={onCritiqueStrategy} disabled={isCritiquingStrategy || !strategyPlan}>
              {isCritiquingStrategy ? t("outline.reviewing") : t("outline.actions.reviewStrategy")}
            </AiButton>
            <AiButton onClick={onGenerateSkeleton} disabled={isGeneratingSkeleton || !readiness.canGenerateSkeleton}>
              {isGeneratingSkeleton ? t("outline.generating") : volumes.length > 0 ? t("outline.actions.regenerateSkeleton") : t("outline.actions.generateSkeleton")}
            </AiButton>
            <Button variant="secondary" onClick={onSave} disabled={isSaving}>
              {isSaving ? t("outline.saving") : t("outline.actions.save")}
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <WorldInjectionHint worldInjectionSummary={worldInjectionSummary} />
        {!hasCharacters ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span>{t("outline.characterHint")}</span>
            <Button size="sm" variant="outline" onClick={onGoToCharacterTab}>{t("outline.goCharacters")}</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>{generationNotice}</span>
          {hasUnsavedVolumeDraft ? <Badge variant="secondary">{t("outline.unsaved")}</Badge> : null}
        </div>
        <div className="grid items-start gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <Card className="self-start border-0 bg-muted/15 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">{t("outline.readiness.title")}</CardTitle>
                  <Badge variant={outlineStageReady ? "default" : "outline"}>
                    {t("outline.readyCount", { completed: completedReadinessCount, total: readinessSteps.length })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">{t("outline.nextLabel")}</div>
                  <div className="mt-1 font-medium text-foreground">{nextOutlineAction}</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${readinessProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {outlineStageReady
                      ? t("outline.readiness.ready")
                      : readiness.blockingReasons.length > 0
                        ? t("outline.readiness.blocked", { count: readiness.blockingReasons.length })
                        : t("outline.readiness.canContinue")}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {readinessSteps.map((item) => (
                    <div key={item.key} className="rounded-xl bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-foreground">{t(`outline.${item.labelKey}`)}</div>
                        <Badge variant={readiness[item.key] ? "default" : "outline"}>
                          {readiness[item.key] ? t("outline.ready") : t("outline.notReady")}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{t(`outline.${item.descriptionKey}`)}</div>
                    </div>
                  ))}
                </div>

                {readiness.blockingReasons.length > 0 ? (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    {readiness.blockingReasons.map((reason) => <div key={reason}>{reason}</div>)}
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                    {t("outline.readiness.workspaceReady")}
                  </div>
                )}
                {volumeMessage ? <div className="text-xs text-muted-foreground">{volumeMessage}</div> : null}
              </CardContent>
            </Card>

            <details className="group border-t border-border/60 pt-4">
              <summary className="cursor-pointer list-none">
                <CollapsibleSummary
                  title={t("outline.volumeReview.title")}
                  description={t("outline.volumeReview.description")}
                  meta={<Badge variant="outline">{volumeCountModeLabel}</Badge>}
                />
              </summary>

              <div className="mt-4 space-y-3">
                <Card className="self-start border-0 bg-muted/15 shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-base">{t("outline.volumeReview.countTitle")}</CardTitle>
                      <Badge variant="outline">{volumeCountModeLabel}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">{t("outline.volumeReview.chapterBudget")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{t("outline.chapterCount", { count: volumeCountGuidance.chapterBudget })}</div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">{t("outline.volumeReview.range")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {t("outline.volumeRange", { min: volumeCountGuidance.decisionVolumeCountRange.min, max: volumeCountGuidance.decisionVolumeCountRange.max })}
                        </div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">{t("outline.volumeReview.recommended")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{t("outline.volumeCount", { count: volumeCountGuidance.systemRecommendedVolumeCount })}</div>
                      </div>
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="text-xs text-muted-foreground">{t("outline.volumeReview.hardRange")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {t("basicInfoTab.ui.allowedRange", { min: volumeCountGuidance.hardPlannedVolumeRange.min, max: volumeCountGuidance.hardPlannedVolumeRange.max }).split(translateUi("。"))[0]}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-background/70 p-3 text-xs leading-6 text-muted-foreground">
                      {t("basicInfoTab.ui.currentStructure", { profile: volumeScaleProfileLabel })}{volumeCountGuidance.volumeCountRationale}{t("basicInfoTab.ui.chapterBudget", { min: volumeCountGuidance.targetChapterRange.min, max: volumeCountGuidance.targetChapterRange.max })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={customVolumeCountEnabled ? "default" : "outline"}
                        onClick={() => onCustomVolumeCountEnabledChange(!customVolumeCountEnabled)}
                      >
                        {customVolumeCountEnabled ? t("basicInfoTab.ui.collapseCustom") : t("basicInfoTab.ui.customCount")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={onRestoreSystemRecommendedVolumeCount}>
                        {t("basicInfoTab.ui.restore")}
                      </Button>
                    </div>

                    {customVolumeCountEnabled ? (
                      <div className="rounded-xl bg-background/70 p-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_auto_auto] sm:items-end">
                          <label className="space-y-1 text-sm">
                            <span className="text-xs text-muted-foreground">{t("basicInfoTab.ui.fixedCount")}</span>
                            <input
                              type="number"
                              min={volumeCountGuidance.allowedVolumeCountRange.min}
                              max={volumeCountGuidance.allowedVolumeCountRange.max}
                              className="w-full rounded-md border bg-background p-2"
                              value={customVolumeCountInput}
                              onChange={(event) => onCustomVolumeCountInputChange(event.target.value)}
                            />
                          </label>
                          <Button size="sm" onClick={onApplyCustomVolumeCount}>{t("basicInfoTab.ui.applyCount")}</Button>
                          <div className="text-xs text-muted-foreground">
                            {t("basicInfoTab.ui.allowedRange", { min: volumeCountGuidance.allowedVolumeCountRange.min, max: volumeCountGuidance.allowedVolumeCountRange.max })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {critiqueReport ? (
                  <Card className="self-start border-0 bg-muted/15 shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{t("basicInfoTab.ui.critiqueTitle")}</CardTitle>
                        <Badge variant={critiqueReport.overallRisk === "high" ? "secondary" : critiqueReport.overallRisk === "medium" ? "outline" : "default"}>
                          {t("basicInfoTab.ui.risk", { risk: critiqueReport.overallRisk })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-md border p-3 text-xs text-muted-foreground">{critiqueReport.summary}</div>
                      {critiqueReport.issues.length > 0 ? (
                        <div className="space-y-2">
                          {critiqueReport.issues.map((issue) => (
                            <div key={`${issue.targetRef}-${issue.title}`} className="rounded-md border p-3 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{issue.targetRef}</Badge>
                                <Badge variant={issue.severity === "high" ? "secondary" : issue.severity === "medium" ? "outline" : "default"}>
                                  {issue.severity}
                                </Badge>
                              </div>
                              <div className="mt-2 font-medium">{issue.title}</div>
                              <div className="mt-1 text-muted-foreground">{issue.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </details>
          </div>

          <details className="group border-t border-border/60 pt-4">
            <summary className="cursor-pointer list-none">
              <CollapsibleSummary
                title={t("basicInfoTab.ui.derivedTitle")}
                description={t("basicInfoTab.ui.derivedDescription")}
              />
            </summary>

            <div className="mt-4 space-y-3">
              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{t("basicInfoTab.ui.preview")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea className="min-h-[220px] w-full rounded-md border bg-muted/20 p-3 text-sm" readOnly value={draftText} />
                </CardContent>
              </Card>

              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{t("basicInfoTab.ui.versions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {volumeVersions.length > 0 ? (
                    <>
                      <SelectControl className="w-full rounded-md border bg-background p-2 text-sm" value={selectedVersionId} onChange={(event) => onSelectedVersionChange(event.target.value)}>
                        {volumeVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            V{version.version} · {t(versionStatusLabel(version.status))}
                          </option>
                        ))}
                      </SelectControl>
                      {selectedVersion ? (
                        <div className="rounded-md border p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">V{selectedVersion.version}</span>
                            <Badge variant={versionStatusVariant(selectedVersion.status)}>
                              {t(versionStatusLabel(selectedVersion.status))}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.createdAt", { date: new Date(selectedVersion.createdAt).toLocaleString() })}</div>
                          <div className="mt-1 line-clamp-4 text-xs text-muted-foreground">{selectedVersion.diffSummary || t("basicInfoTab.ui.noDiff")}</div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.noVersions")}</div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={onCreateDraftVersion} disabled={isCreatingDraftVersion || volumes.length === 0}>
                      {isCreatingDraftVersion ? t("outline.saving") : t("basicInfoTab.ui.saveDraft")}
                    </Button>
                    <Button variant="outline" onClick={onLoadSelectedVersionToDraft} disabled={!selectedVersionId}>{t("basicInfoTab.ui.overwrite")}</Button>
                    <Button variant="secondary" onClick={onActivateVersion} disabled={isActivatingVersion || !selectedVersionId}>
                      {isActivatingVersion ? t("outline.saving") : t("basicInfoTab.ui.activate")}
                    </Button>
                    <Button variant="outline" onClick={onFreezeVersion} disabled={isFreezingVersion || !selectedVersionId}>
                      {isFreezingVersion ? t("outline.saving") : t("basicInfoTab.ui.freeze")}
                    </Button>
                    <Button variant="outline" onClick={onLoadVersionDiff} disabled={isLoadingVersionDiff || !selectedVersionId}>
                      {isLoadingVersionDiff ? t("basicInfoTab.ui.diffLoading") : t("basicInfoTab.ui.diff")}
                    </Button>
                  </div>
                  {diffResult ? (
                    <div className="rounded-md border p-2 text-xs">
                      <div className="font-medium">{t("basicInfoTab.ui.versionDiff", { version: diffResult.version })}</div>
                      <div className="text-muted-foreground">{t("basicInfoTab.ui.changed", { volumes: diffResult.changedVolumeCount, chapters: diffResult.changedChapterCount, lines: diffResult.changedLines })}</div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="self-start border-0 bg-muted/15 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{t("basicInfoTab.ui.impactTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <AiButton variant="outline" onClick={onAnalyzeDraftImpact} disabled={isAnalyzingDraftImpact || volumes.length === 0}>
                      {isAnalyzingDraftImpact ? t("basicInfoTab.ui.analyzing") : t("basicInfoTab.ui.analyzeDraft")}
                    </AiButton>
                    <AiButton variant="outline" onClick={onAnalyzeVersionImpact} disabled={isAnalyzingVersionImpact || !selectedVersionId}>
                      {isAnalyzingVersionImpact ? t("basicInfoTab.ui.analyzing") : t("basicInfoTab.ui.analyzeVersion")}
                    </AiButton>
                  </div>
                  {impactResult ? (
                    <div className="space-y-3 rounded-md border p-3 text-xs">
                      <div className="font-medium">{t("basicInfoTab.ui.impactPreview")}</div>
                      <div className="text-muted-foreground">{t("basicInfoTab.ui.affected", { volumes: impactResult.affectedVolumeCount, chapters: impactResult.affectedChapterCount, lines: impactResult.changedLines })}</div>
                      {impactResult.affectedBeats && impactResult.affectedBeats.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {impactResult.defaultImpactAction ? <Badge variant="default">{impactResult.defaultImpactAction}</Badge> : null}
                            {typeof impactResult.staleBeatCount === "number" ? <Badge variant="outline">{t("basicInfoTab.ui.unwritten", { count: impactResult.staleBeatCount })}</Badge> : null}
                            {typeof impactResult.lockedBeatCount === "number" && impactResult.lockedBeatCount > 0 ? (
                              <Badge variant="secondary">{t("basicInfoTab.ui.locked", { count: impactResult.lockedBeatCount })}</Badge>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            {impactResult.affectedBeats.slice(0, 8).map((beat) => (
                              <div key={`${beat.volumeId}-${beat.beatKey}`} className="rounded-md bg-background/70 p-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{t("basicInfoTab.ui.volumeLabel", { order: beat.volumeOrder, role: beat.beatLabel, reward: beat.beatTitle ?? "" })}</span>
                                  <Badge variant={getBeatImpactStatusVariant(beat.status)}>
                                    {t(`outline.${getBeatImpactStatusLabel(beat.status)}`)}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-muted-foreground">{formatBeatChapterOrders(beat.chapterOrders, t)}</div>
                              </div>
                            ))}
                          </div>
                          {impactResult.advancedImpactActions && impactResult.advancedImpactActions.length > 0 ? (
                            <div className="text-muted-foreground">
                              {t("basicInfoTab.ui.advancedActions", { actions: impactResult.advancedImpactActions.join(" / ") })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.impactAdvice")}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </div>

        <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as OutlineWorkspaceTab)} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start bg-muted/60 p-1">
            <TabsTrigger value="current">{t("basicInfoTab.ui.tabsCurrent")}</TabsTrigger>
            <TabsTrigger value="strategy">{t("basicInfoTab.ui.tabsStrategy")}</TabsTrigger>
            <TabsTrigger value="assets">{t("basicInfoTab.ui.tabsAssets")}</TabsTrigger>
          </TabsList>

        <TabsContent value="strategy" className="mt-0 space-y-4">
        <Card className="border-0 bg-muted/15 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">{t("basicInfoTab.ui.strategySummary")}</CardTitle>
                <div className="text-sm text-muted-foreground">{t("basicInfoTab.ui.strategyDescription")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {strategyPlan ? (
                  <>
                    <Badge variant="outline">{t("basicInfoTab.ui.recommendedVolumes", { count: strategyPlan.recommendedVolumeCount })}</Badge>
                    <Badge variant="secondary">{t("basicInfoTab.ui.plannedVolumes", { count: strategyPlan.hardPlannedVolumeCount })}</Badge>
                  </>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {strategyPlan ? (
              <>
                <div className="grid gap-3 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.rewardLadder")}</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.readerRewardLadder}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.escalationLadder")}</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.escalationLadder}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">{t("basicInfoTab.ui.midpoint")}</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{strategyPlan.midpointShift}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <div className="text-xs">{t("basicInfoTab.ui.volumeOverview")}</div>
                  <div className="mt-2 leading-6">
                    {strategyPlan.volumes
                      .map((volume) => t("basicInfoTab.ui.volumeLabel", { order: volume.sortOrder, role: volume.roleLabel, reward: volume.coreReward }))
                      .join(translateUi("；"))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                {t("basicInfoTab.ui.noStrategy")}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-0 space-y-4">
        <BookPayoffLedgerCard
          latestStateSnapshot={latestStateSnapshot}
          payoffLedger={payoffLedger}
        />

        <OutlineResourceCommitments
          selectedVolume={selectedVolume}
          resources={characterResources}
        />
        </TabsContent>

        <TabsContent value="current" className="mt-0">
          <OutlineCurrentVolumeWorkspace
            selectedVolume={selectedVolume}
            strategyPlan={strategyPlan}
            volumes={volumes}
            onSelectedVolumeChange={setSelectedVolumeId}
            onAddVolume={onAddVolume}
            onRemoveVolume={onRemoveVolume}
            onMoveVolume={onMoveVolume}
            onVolumeFieldChange={onVolumeFieldChange}
            onOpenPayoffsChange={onOpenPayoffsChange}
            onGoToStructuredTab={onGoToStructuredTab}
          />
        </TabsContent>
        </Tabs>
      </div>
      </section>
    </div>
  );
}
