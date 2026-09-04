import { translateUi } from "@/i18n/legacy";
﻿import type {
  NovelWorkflowMilestone,
  NovelWorkflowMilestoneType,
} from "@ai-novel/shared/types/novelWorkflow";
import type { DirectorBookAutomationAction } from "@ai-novel/shared/types/directorRuntime";
import type { TaskStatus } from "@ai-novel/shared/types/task";
import type { CharacterResourceProposalSummary } from "@ai-novel/shared/types/characterResource";
import type { AutoDirectorAction } from "@ai-novel/shared/types/autoDirectorFollowUp";
import AICockpit from "@/components/autoDirector/AICockpit";
import i18n from "@/i18n";
import LLMSelector from "@/components/common/LLMSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import TaskCenterManualEditImpactCard from "@/pages/tasks/components/TaskCenterManualEditImpactCard";
import TaskCenterRuntimePolicyCard from "@/pages/tasks/components/TaskCenterRuntimePolicyCard";
import type { NovelTaskDrawerState } from "./NovelEditView.types";

type DrawerTask = NonNullable<NovelTaskDrawerState["task"]>;

function formatStatus(status: TaskStatus): string {
  if (status === "queued") {
    return i18n.t("novelTaskDrawer:status.queued");
  }
  if (status === "running") {
    return i18n.t("novelTaskDrawer:status.running");
  }
  if (status === "waiting_approval") {
    return i18n.t("novelTaskDrawer:status.waitingApproval");
  }
  if (status === "succeeded") {
    return i18n.t("novelTaskDrawer:status.succeeded");
  }
  if (status === "failed") {
    return i18n.t("novelTaskDrawer:status.failed");
  }
  return i18n.t("novelTaskDrawer:status.cancelled");
}

function formatTaskStatus(task: DrawerTask): string {
  if (task.pendingManualRecovery) {
    return i18n.t("novelTaskDrawer:status.recovery");
  }
  return formatStatus(task.status);
}

function toStatusVariant(status: TaskStatus): "default" | "outline" | "secondary" | "destructive" {
  if (status === "running") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "queued" || status === "waiting_approval") {
    return "secondary";
  }
  return "outline";
}

function toTaskStatusVariant(task: DrawerTask): "default" | "outline" | "secondary" | "destructive" {
  if (task.pendingManualRecovery) {
    return "secondary";
  }
  return toStatusVariant(task.status);
}

function formatCheckpoint(checkpoint: NovelWorkflowMilestoneType | null | undefined, scopeLabel?: string | null): string {
  const resolvedScopeLabel = scopeLabel?.trim() || i18n.t("novelTaskDrawer:defaultScope");
  if (checkpoint === "rewrite_snapshot_created") {
    return i18n.t("novelTaskDrawer:checkpoint.rewriteSnapshot");
  }
  if (checkpoint === "candidate_selection_required") {
    return i18n.t("novelTaskDrawer:checkpoint.candidateSelection");
  }
  if (checkpoint === "book_contract_ready") {
    return i18n.t("novelTaskDrawer:checkpoint.bookContract");
  }
  if (checkpoint === "character_setup_required") {
    return i18n.t("novelTaskDrawer:checkpoint.characterSetup");
  }
  if (checkpoint === "volume_strategy_ready") {
    return i18n.t("novelTaskDrawer:checkpoint.volumeStrategy");
  }
  if (checkpoint === "production_experience_required") {
    return i18n.t("novelTaskDrawer:checkpoint.productionExperience");
  }
  if (checkpoint === "chapter_batch_ready") {
    return i18n.t("novelTaskDrawer:checkpoint.chapterBatch", { scope: resolvedScopeLabel });
  }
  if (checkpoint === "step_review_required") {
    return i18n.t("novelTaskDrawer:checkpoint.stepReview");
  }
  if (checkpoint === "workflow_completed") {
    return i18n.t("novelTaskDrawer:checkpoint.completed");
  }
  return i18n.t("novelTaskDrawer:empty");
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return i18n.t("novelTaskDrawer:empty");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return i18n.t("novelTaskDrawer:empty");
  }
  return date.toLocaleString();
}

function formatTokenCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

function formatStepStatus(status: "idle" | "running" | "succeeded" | "failed" | "cancelled"): string {
  if (status === "running") {
    return i18n.t("novelTaskDrawer:step.running");
  }
  if (status === "succeeded") {
    return i18n.t("novelTaskDrawer:step.succeeded");
  }
  if (status === "failed") {
    return i18n.t("novelTaskDrawer:step.failed");
  }
  if (status === "cancelled") {
    return i18n.t("novelTaskDrawer:step.cancelled");
  }
  return i18n.t("novelTaskDrawer:step.pending");
}

function formatRiskLevel(riskLevel: CharacterResourceProposalSummary["riskLevel"]): string {
  if (riskLevel === "high") {
    return i18n.t("novelTaskDrawer:risk.high");
  }
  if (riskLevel === "medium") {
    return i18n.t("novelTaskDrawer:risk.medium");
  }
  return i18n.t("novelTaskDrawer:risk.low");
}

function formatProposalSource(proposal: CharacterResourceProposalSummary): string {
  return proposal.sourceType === "chapter_background_sync" ? i18n.t("novelTaskDrawer:source.auto") : i18n.t("novelTaskDrawer:source.manual");
}

function followUpActionVariant(action: AutoDirectorAction): "default" | "outline" {
  return action.kind === "mutation" && action.riskLevel !== "high" ? "default" : "outline";
}

function formatFollowUpPriority(priority: "P0" | "P1" | "P2"): string {
  if (priority === "P0") {
    return i18n.t("novelTaskDrawer:priority.p0");
  }
  if (priority === "P1") {
    return i18n.t("novelTaskDrawer:priority.p1");
  }
  return i18n.t("novelTaskDrawer:priority.p2");
}

function readProposalPayloadText(
  proposal: CharacterResourceProposalSummary,
  key: string,
): string {
  const value = proposal.payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function ResourceProposalCard(props: {
  proposal: CharacterResourceProposalSummary;
  onOpenSource?: (proposal: CharacterResourceProposalSummary) => void;
  onConfirm?: (proposalId: string) => void;
  onReject?: (proposalId: string) => void;
  confirmingProposalId?: string;
  rejectingProposalId?: string;
}) {
  const {
    proposal,
    onOpenSource,
    onConfirm,
    onReject,
    confirmingProposalId = "",
    rejectingProposalId = "",
  } = props;
  const resourceName = readProposalPayloadText(proposal, "resourceName") || translateUi("关键资源");
  const holderName = readProposalPayloadText(proposal, "holderCharacterName");
  const narrativeImpact = readProposalPayloadText(proposal, "narrativeImpact");
  const isConfirming = confirmingProposalId === proposal.id;
  const isRejecting = rejectingProposalId === proposal.id;

  return (
    <div className="space-y-3 rounded-xl border bg-background/80 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{resourceName}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {holderName ? `${holderName} · ${i18n.t("novelTaskDrawer:ui.resourceDescription")}` : i18n.t("novelTaskDrawer:ui.resourcePending")}
          </div>
        </div>
        <Badge variant={proposal.riskLevel === "high" ? "destructive" : "secondary"}>
          {formatRiskLevel(proposal.riskLevel)}
        </Badge>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{proposal.summary}</div>
      {narrativeImpact ? (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {i18n.t("novelTaskDrawer:ui.impact", { value: narrativeImpact })}
        </div>
      ) : null}
      {proposal.evidence[0] ? (
        <div className="text-xs leading-5 text-muted-foreground">{i18n.t("novelTaskDrawer:ui.evidence", { value: proposal.evidence[0] })}</div>
      ) : null}
      {proposal.validationNotes[0] ? (
        <div className="text-xs leading-5 text-muted-foreground">{i18n.t("novelTaskDrawer:ui.reason", { value: proposal.validationNotes[0] })}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatProposalSource(proposal)}</Badge>
        {proposal.chapterId ? <Badge variant="outline">{i18n.t("novelTaskDrawer:ui.sourceChapter")}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {proposal.chapterId ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenSource?.(proposal)}>
            {i18n.t("novelTaskDrawer:ui.viewSource")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirm?.(proposal.id)}
          disabled={isConfirming || !onConfirm}
        >
          {isConfirming ? translateUi("确认中...") : translateUi("确认并用于后续写作")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onReject?.(proposal.id)}
          disabled={isRejecting || !onReject}
        >
          {isRejecting ? translateUi("处理中...") : translateUi("忽略这条变化")}
        </Button>
      </div>
    </div>
  );
}

export default function NovelTaskDrawer({
  open,
  onOpenChange,
  task,
  snapshot,
  runtimeSnapshot,
  projection,
  currentUiModel,
  actions,
  onProjectionAction,
  resourceProposals = [],
  onOpenResourceProposalSource,
  onConfirmResourceProposal,
  onRejectResourceProposal,
  confirmingResourceProposalId = "",
  rejectingResourceProposalId = "",
  followUp,
  onFollowUpAction,
  executingFollowUpAction = false,
  runtimeHardBlocked = false,
  runtimeBlockedReason = null,
  overrideModel,
  onOverrideModelChange,
  onRetryWithOverrideModel,
  retryWithOverrideModelPending = false,
  canRetryWithOverrideModel = false,
  onRetryWithTaskModel,
  retryWithTaskModelPending = false,
  capabilities,
  onOpenFullTaskCenter,
}: NovelTaskDrawerState) {
  const milestones = Array.isArray(task?.meta.milestones)
    ? task.meta.milestones as NovelWorkflowMilestone[]
    : [];
  const displayState = snapshot?.displayState ?? null;
  const dashboardView = snapshot?.dashboardView ?? null;
  const projectedProgressPercent = dashboardView?.progressPercent
    ?? displayState?.progressPercent
    ?? projection?.runtimeProjection?.progressBreakdown?.totalPercent;
  const workflowProgressFraction = typeof task?.progress === "number" && Number.isFinite(task.progress)
    ? task.progress
    : null;
  const progressPercent = Math.max(0, Math.min(100, Math.round(
    workflowProgressFraction !== null
      ? workflowProgressFraction * 100
      : typeof projectedProgressPercent === "number"
        ? projectedProgressPercent
        : 0,
  )));
  const tokenUsage = task?.tokenUsage ?? null;
  const primaryAction = projection?.primaryAction ?? null;
  const primaryActionLabel = (
    (primaryAction?.type === "continue" || primaryAction?.type === "auto_execute_range")
    && projection?.displayState === "needs_confirmation"
    && projection.latestTask?.checkpointType !== "replan_required"
  )
    ? translateUi("确认并继续")
    : primaryAction?.label;
  const runProjectedAction = (action: DirectorBookAutomationAction) => {
    const matchedAction = actions.find((item) => {
      if (item.label === action.label) {
        return true;
      }
      if (action.type === "continue") {
        return item.label.includes("继续");
      }
      if (action.type === "auto_execute_range") {
        return item.label.includes("自动执行");
      }
      if (action.type === "confirm_candidate") {
        return item.label.includes("书级方向");
      }
      if (action.type === "open_quality_repair") {
        return item.label.includes("质量修复");
      }
      if (action.type === "open_chapter") {
        return item.label.includes("章节执行");
      }
      return false;
    });
    matchedAction?.onClick();
  };
  const handleProjectionAction = (action: DirectorBookAutomationAction) => {
    if (onProjectionAction) {
      onProjectionAction(action);
      return;
    }
    runProjectedAction(action);
  };
  const canShowRuntimePolicy = capabilities?.canAdjustRuntimePolicy !== false && Boolean(task?.id && runtimeSnapshot);
  const canShowManualImpact = capabilities?.canInspectManualEditImpact !== false && Boolean(task);
  const canShowRetryWithOverrideModel = capabilities?.canRetryWithOverrideModel === true;
  const canShowFollowUp = capabilities?.availableFollowUps !== false && Boolean(followUp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[520px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-r-0 border-l bg-background p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>{i18n.t("novelTaskDrawer:ui.detailsTitle")}</DialogTitle>
          <DialogDescription>
            {i18n.t("novelTaskDrawer:ui.detailsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {task || projection ? (
            <AICockpit
              projection={projection}
              mode="focusedNovel"
              fallbackSummary={dashboardView?.currentAction || displayState?.currentAction || task?.blockingReason || task?.currentItemLabel || translateUi("当前没有需要处理的 AI 推进动作。")}
              fallbackStatusLabel={dashboardView?.statusLabel ?? (task ? formatTaskStatus(task) : translateUi("未开启"))}
              showDetailsAction={false}
              onAction={(_projection, action) => handleProjectionAction(action)}
            />
          ) : null}

          {resourceProposals.length > 0 ? (
            <section className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-700/50 dark:bg-amber-950/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.resourcePending")}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {i18n.t("novelTaskDrawer:ui.resourceDescription")}
                  </div>
                </div>
                <Badge variant="secondary">{i18n.t("novelTaskDrawer:ui.count", { count: resourceProposals.length })}</Badge>
              </div>
              <div className="space-y-2">
                {resourceProposals.slice(0, 4).map((proposal) => (
                  <ResourceProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onOpenSource={onOpenResourceProposalSource}
                    onConfirm={onConfirmResourceProposal}
                    onReject={onRejectResourceProposal}
                    confirmingProposalId={confirmingResourceProposalId}
                    rejectingProposalId={rejectingResourceProposalId}
                  />
                ))}
              </div>
              {resourceProposals.length > 4 ? (
                <div className="text-xs text-muted-foreground">
                  {i18n.t("novelTaskDrawer:ui.moreResources", { count: resourceProposals.length - 4 })}
                </div>
              ) : null}
            </section>
          ) : null}

          {task ? (
            <>
              <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-foreground">{task.title}</div>
                  <Badge variant={toTaskStatusVariant(task)}>{formatTaskStatus(task)}</Badge>
                  <Badge variant="outline">{i18n.t("novelTaskDrawer:ui.progress", { value: `${progressPercent}%` })}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.currentStage")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{dashboardView?.stageLabel ?? displayState?.stageLabel ?? task.currentStage ?? translateUi("暂无")}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.currentAction")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{dashboardView?.currentAction ?? displayState?.currentAction ?? task.currentItemLabel ?? translateUi("暂无")}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.checkpoint")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{displayState?.checkpointLabel ?? formatCheckpoint(task.checkpointType, task.executionScopeLabel)}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.heartbeat")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatDate(task.heartbeatAt)}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                {task.checkpointSummary ? (
                  <div className="rounded-xl border bg-background/80 p-3 text-sm text-muted-foreground">
                    {task.checkpointSummary}
                  </div>
                ) : null}
                {task.lastError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <div className="font-medium">{i18n.t("novelTaskDrawer:ui.latestError")}</div>
                    <div className="mt-1">{task.lastError}</div>
                    {task.recoveryHint ? (
                      <div className="mt-2 text-xs text-destructive/80">{i18n.t("novelTaskDrawer:ui.recovery", { value: task.recoveryHint })}</div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {canShowFollowUp && followUp ? (
                <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.actions")}</div>
                    <Badge variant="outline">{followUp.reasonLabel}</Badge>
                    <Badge variant={followUp.priority === "P0" ? "destructive" : "secondary"}>
                      {formatFollowUpPriority(followUp.priority)}
                    </Badge>
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">{followUp.followUpSummary}</div>
                  {followUp.blockingReason ? (
                    <div className="text-sm text-muted-foreground">{i18n.t("novelTaskDrawer:ui.blockedReason")}{followUp.blockingReason}</div>
                  ) : null}
                  {followUp.currentModel ? (
                    <div className="text-sm text-muted-foreground">{i18n.t("novelTaskDrawer:ui.taskModel")}: {followUp.currentModel}</div>
                  ) : null}
                  {runtimeHardBlocked && runtimeBlockedReason ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {runtimeBlockedReason}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {followUp.availableActions.map((action) => (
                      <Button
                        key={action.code}
                        type="button"
                        size="sm"
                        variant={followUpActionVariant(action)}
                        onClick={() => onFollowUpAction?.(action)}
                        disabled={executingFollowUpAction || (runtimeHardBlocked && action.kind !== "navigation")}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </section>
              ) : null}

              {canShowRuntimePolicy && task ? (
                <section className="space-y-3">
                  <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.advanceMode")}</div>
                  <TaskCenterRuntimePolicyCard taskId={task.id} snapshot={runtimeSnapshot} />
                </section>
              ) : null}

              {canShowManualImpact && task ? (
                <section className="space-y-3">
                  <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.riskImpact")}</div>
                  <TaskCenterManualEditImpactCard task={task} />
                </section>
              ) : null}

              {canShowRetryWithOverrideModel && overrideModel && onOverrideModelChange ? (
                <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                  <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.retryOtherModel")}</div>
                  <LLMSelector
                    value={overrideModel}
                    onChange={onOverrideModelChange}
                    compact
                    showParameters
                    showBadge={false}
                    showHelperText={false}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={onRetryWithOverrideModel}
                      disabled={retryWithOverrideModelPending || !canRetryWithOverrideModel}
                    >
                        {retryWithOverrideModelPending ? i18n.t("novelTaskDrawer:status.running") : i18n.t("novelTaskDrawer:ui.retryOtherModel")}
                    </Button>
                    {onRetryWithTaskModel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onRetryWithTaskModel}
                        disabled={retryWithTaskModelPending}
                      >
                        {retryWithTaskModelPending ? i18n.t("novelTaskDrawer:status.running") : i18n.t("novelTaskDrawer:ui.boundModel")}
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.quickActions")}</div>
                {actions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <Button
                        key={action.label}
                        type="button"
                        size="sm"
                        variant={action.variant ?? "default"}
                        disabled={action.disabled}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    {i18n.t("novelTaskDrawer:ui.noQuickActions")}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.modelInfo")}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.boundModel")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {task.provider ?? translateUi("暂无")} / {task.model ?? translateUi("暂无")}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.uiModel")}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {currentUiModel.provider} / {currentUiModel.model}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {i18n.t("novelTaskDrawer:ui.temperature", { value: currentUiModel.temperature })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.tokenStats")}</div>
                {tokenUsage ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.callCount")}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.llmCallCount)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.totalTokens")}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.totalTokens)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.inputTokens")}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.promptTokens)}</div>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <div className="text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.outputTokens")}</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatTokenCount(tokenUsage.completionTokens)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {i18n.t("novelTaskDrawer:ui.recentRecord")}{formatDate(tokenUsage.lastRecordedAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    {i18n.t("novelTaskDrawer:ui.noTokenUsage")}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.stepStatus")}</div>
                <div className="space-y-2">
                  {(displayState?.steps ?? task.steps).map((step) => (
                    <div key={step.key} className="flex items-center justify-between rounded-xl border bg-background/80 px-3 py-2">
                      <div className="text-sm text-foreground">{step.label}</div>
                      <Badge variant="outline">{"isCurrent" in step
                        ? (step.status === "attention"
                          ? translateUi("需处理")
                          : step.status === "running"
                            ? translateUi("进行中")
                            : step.status === "completed"
                              ? translateUi("已完成")
                              : translateUi("待推进"))
                        : formatStepStatus(step.status)}</Badge>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-sm font-medium text-foreground">{i18n.t("novelTaskDrawer:ui.milestones")}</div>
                {milestones.length > 0 ? (
                  <div className="space-y-2">
                    {milestones
                      .slice()
                      .reverse()
                      .map((milestone) => (
                        <div key={`${milestone.checkpointType}:${milestone.createdAt}`} className="rounded-xl border bg-background/80 p-3">
                          <div className="font-medium text-foreground">{formatCheckpoint(milestone.checkpointType)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{milestone.summary}</div>
                          <div className="mt-2 text-xs text-muted-foreground">{i18n.t("novelTaskDrawer:ui.recordedAt", { value: formatDate(milestone.createdAt) })}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    {i18n.t("novelTaskDrawer:ui.noMilestones")}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-dashed px-5 py-8 text-sm text-muted-foreground">
              {i18n.t("novelTaskDrawer:ui.noTasks")}
            </section>
          )}
        </div>

        <div className="space-y-2 border-t border-border/70 px-5 py-4">
          {primaryAction ? (
            <Button type="button" className="w-full" onClick={() => handleProjectionAction(primaryAction)}>
              {primaryActionLabel || i18n.t("novelTaskDrawer:ui.actions")}
            </Button>
          ) : null}
          {task?.sourceRoute ? (
            <Button asChild type="button" variant="outline" className="w-full">
              <Link to={task.sourceRoute}>{i18n.t("novelTaskDrawer:ui.openSource")}</Link>
            </Button>
          ) : null}
          <Button type="button" variant={primaryAction ? "ghost" : "outline"} className="w-full" onClick={onOpenFullTaskCenter}>
            {i18n.t("novelTaskDrawer:ui.openTaskCenter")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
