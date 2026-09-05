import { translateUi } from "../../../../i18n/legacy.ts";
import { translateTaskProgressLabel } from "../../../../i18n/taskProgressLabel.ts";
import type {
  NovelAutoDirectorTaskSummary,
  ProjectProgressStatus,
} from "@ai-novel/shared/types/novel";
import type { NovelListResponse } from "@/api/novel/shared";
import {
  canContinueChapterBatchAutoExecution,
  canContinueDirector,
  canEnterChapterExecution,
  getWorkflowDescription,
  isWorkflowRunningInBackground,
  requiresCandidateSelection,
} from "@/lib/novelWorkflowTaskUi";
import { featureFlags } from "@/config/featureFlags";

export type NovelListItem = NovelListResponse["items"][number];
export type StatusFilter = "all" | "draft" | "published";
export type WritingModeFilter = "all" | "original" | "continuation";
export type NovelListTone = "neutral" | "info" | "success" | "warning" | "danger";

export const DIRECTOR_CREATE_LINK = "/novels/auto-director";
export const REFERENCE_CREATE_LINK = "/novels/auto-director?start=reference";
export const SHORT_STORY_CREATE_LINK = featureFlags.creationStudioEnabled
  ? "/create?form=short_story"
  : null;
export const PRIMARY_CREATE_LABEL = translateUi("AI 自动导演开书");
export const REFERENCE_CREATE_LABEL = translateUi("照着一本书写");
export const MANUAL_CREATE_LINK = "/novels/create";
export const NOVEL_LIST_PAGE_SIZE = 24;

export interface NovelListSummaryItem {
  id: string;
  label: string;
  value: number;
  tone: NovelListTone;
}

export interface WorkflowDisplay {
  tone: NovelListTone;
  label: string;
  description: string;
  progress: number;
  currentStage: string;
  currentAction: string;
  lastHealthyStage: string;
  running: boolean;
}

export function getNovelWorkflowTask(novel: NovelListItem): NovelAutoDirectorTaskSummary | null {
  return novel.narrativeForm === "short_story"
    ? novel.latestCreationStudioTask ?? null
    : novel.latestAutoDirectorTask ?? null;
}

export function getNovelWorkspaceHref(novel: NovelListItem): string {
  if (novel.narrativeForm === "short_story") {
    return `/novels/${novel.id}/story`;
  }
  if (novel.creationExperience === "simple") {
    return `/novels/${novel.id}/simple`;
  }
  const task = novel.latestAutoDirectorTask;
  return task?.id
    ? `/novels/${novel.id}/edit?directorTaskId=${encodeURIComponent(task.id)}`
    : `/novels/${novel.id}/edit`;
}

export function filterNovelList(input: {
  novels: NovelListItem[];
  status: StatusFilter;
  writingMode: WritingModeFilter;
}): NovelListItem[] {
  return input.novels.filter((item) => {
    if (input.status !== "all" && item.status !== input.status) {
      return false;
    }
    if (input.writingMode !== "all" && item.writingMode !== input.writingMode) {
      return false;
    }
    return true;
  });
}

export function formatProgressStatus(status?: ProjectProgressStatus | null): string {
  if (status === "completed") {
    return translateUi("已完成");
  }
  if (status === "in_progress") {
    return translateUi("进行中");
  }
  if (status === "rework") {
    return translateUi("待返工");
  }
  if (status === "blocked") {
    return translateUi("受阻");
  }
  return translateUi("未开始");
}

export function formatTokenCount(value?: number | null): string {
  const normalized = typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
  return new Intl.NumberFormat("zh-CN").format(normalized);
}

export function buildNovelListSummary(novels: NovelListItem[]): NovelListSummaryItem[] {
  const running = novels.filter((novel) => {
    const task = getNovelWorkflowTask(novel);
    return task?.status === "queued" || task?.status === "running";
  }).length;
  const waiting = novels.filter((novel) => getNovelWorkflowTask(novel)?.status === "waiting_approval").length;
  const ready = novels.filter((novel) => (
    novel.narrativeForm === "short_story"
      ? getNovelWorkflowTask(novel)?.status === "succeeded"
      : canEnterChapterExecution(getNovelWorkflowTask(novel))
  )).length;
  const issue = novels.filter((novel) => {
    const status = getNovelWorkflowTask(novel)?.status;
    return status === "failed" || status === "cancelled";
  }).length;

  return [
    { id: "running", label: translateUi("推进中"), value: running, tone: running > 0 ? "info" : "neutral" },
    { id: "waiting", label: translateUi("待确认"), value: waiting, tone: waiting > 0 ? "warning" : "neutral" },
    { id: "ready", label: translateUi("可继续"), value: ready, tone: ready > 0 ? "success" : "neutral" },
    { id: "issue", label: translateUi("暂停/失败"), value: issue, tone: issue > 0 ? "danger" : "neutral" },
  ];
}

export function getWorkflowTone(task?: NovelAutoDirectorTaskSummary | null): NovelListTone {
  if (!task) {
    return "neutral";
  }
  if (task.status === "failed" || task.status === "cancelled") {
    return "danger";
  }
  if (task.status === "waiting_approval") {
    return "warning";
  }
  if (canEnterChapterExecution(task)) {
    return "success";
  }
  if (task.status === "running" || task.status === "queued") {
    return "info";
  }
  return "neutral";
}

export function buildWorkflowDisplay(novel: NovelListItem): WorkflowDisplay {
  const task = getNovelWorkflowTask(novel);
  if (novel.narrativeForm === "short_story") {
    return {
      tone: task?.status === "failed" ? "danger" : task?.status === "succeeded" ? "success" : "info",
      label: task?.status === "succeeded" ? translateUi("完整短篇") : translateUi("短篇创作中"),
      description: task?.checkpointSummary?.trim()
        || translateTaskProgressLabel(task?.currentItemLabel?.trim())
        || novel.description?.trim()
        || translateUi("AI 正在把已确认的方向写成一篇连续作品。"),
      progress: Math.round((task?.progress ?? 0) * 100),
      currentStage: translateUi("连续作品"),
      currentAction: translateTaskProgressLabel(task?.currentItemLabel?.trim()) || "",
      lastHealthyStage: "",
      running: task?.status === "queued" || task?.status === "running",
    };
  }
  const description = getWorkflowDescription(task);
  if (!task) {
    return {
      tone: "neutral",
      label: translateUi("资料项目"),
      description: novel.description?.trim() || translateUi("没有自动导演任务，可以进入项目继续完善资料或章节。"),
      progress: 0,
      currentStage: translateUi("未进入自动导演"),
      currentAction: "",
      lastHealthyStage: "",
      running: false,
    };
  }
  const currentAction = translateTaskProgressLabel(task.currentItemLabel?.trim()) || "";
  const currentStage = translateTaskProgressLabel(task.currentStage?.trim()) || translateUi("自动导演");
  return {
    tone: getWorkflowTone(task),
    label: translateTaskProgressLabel(task.displayStatus?.trim()) || translateTaskProgressLabel(task.resumeAction?.trim()) || translateTaskProgressLabel(task.nextActionLabel?.trim()) || translateUi("自动导演"),
    description: description || translateUi("系统保留推进状态，可以继续查看或恢复。"),
    progress: Math.round(task.progress * 100),
    currentStage,
    currentAction,
    lastHealthyStage: translateTaskProgressLabel(task.lastHealthyStage?.trim()) || "",
    running: isWorkflowRunningInBackground(task),
  };
}

export function getPrimaryActionLabel(novel: NovelListItem): string {
  if (novel.narrativeForm === "short_story") {
    return translateUi("打开作品");
  }
  const task = getNovelWorkflowTask(novel);
  if (canContinueChapterBatchAutoExecution(task)) {
    return translateTaskProgressLabel(task?.resumeAction?.trim()) || translateUi("Tiếp tục tự động chạy {{scope}}", { scope: task?.executionScopeLabel ?? translateUi("当前章节范围") });
  }
  if (canContinueDirector(task)) {
    return translateTaskProgressLabel(task?.resumeAction?.trim()) || translateUi("继续导演");
  }
  if (requiresCandidateSelection(task)) {
    return translateTaskProgressLabel(task?.resumeAction?.trim()) || translateUi("继续确认方向");
  }
  if (canEnterChapterExecution(task)) {
    return translateUi("进入章节执行");
  }
  if (task) {
    return translateUi("查看推进状态");
  }
  return translateUi("编辑小说");
}

export function getProjectAssetRows(novel: NovelListItem): Array<{
  label: string;
  value: string;
  tone?: NovelListTone;
}> {
  if (novel.narrativeForm === "short_story") {
    return [
      { label: translateUi("形式"), value: translateUi("短篇") },
      { label: translateUi("目标"), value: translateUi("{{v0}} 字", { v0: (novel.targetWordCount ?? 0).toLocaleString() }) },
      { label: translateUi("正文"), value: getNovelWorkflowTask(novel)?.status === "succeeded" ? translateUi("已完成") : translateUi("生成中"), tone: "info" },
      { label: translateUi("来源"), value: novel.derivedFromNovelId ? translateUi("派生作品") : translateUi("原创") },
    ];
  }
  return [
    { label: translateUi("章节"), value: String(novel._count.chapters) },
    { label: translateUi("角色"), value: String(novel._count.characters) },
    {
      label: translateUi("世界观"),
      value: novel.world?.name ?? translateUi("未绑定"),
      tone: novel.world?.name ? "neutral" : "warning",
    },
    {
      label: translateUi("资源"),
      value: `${novel.resourceReadyScore ?? 0}/100`,
      tone: (novel.resourceReadyScore ?? 0) >= 60 ? "success" : "warning",
    },
  ];
}
