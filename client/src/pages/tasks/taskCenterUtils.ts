import { translateUi } from "@/i18n/legacy";
﻿import type {
  AutoDirectorAction,
} from "@ai-novel/shared/types/autoDirectorFollowUp";
import type { TaskKind, TaskStatus, UnifiedTaskSummary } from "@ai-novel/shared/types/task";
import type {
  NovelWorkflowMilestoneType,
  NovelWorkflowResumeTarget,
} from "@ai-novel/shared/types/novelWorkflow";
import type { WorkspaceTone } from "@/components/workspace";
import type { TaskQueueSeverity } from "@/components/taskQueue";

export const ACTIVE_STATUSES = new Set<TaskStatus>(["queued", "running", "waiting_approval"]);

export type TaskSortMode = "default" | "updated_desc" | "updated_asc" | "heartbeat_desc" | "heartbeat_asc";

type TaskQueuePresentationInput = Pick<
  UnifiedTaskSummary,
  | "status"
  | "pendingManualRecovery"
  | "checkpointType"
  | "noticeCode"
  | "noticeSummary"
  | "failureCode"
  | "failureSummary"
  | "lastError"
>;

const PIPELINE_QUALITY_REVIEW_CODE = "PIPELINE_QUALITY_REVIEW";
const PIPELINE_REPLAN_REQUIRED_CODE = "PIPELINE_REPLAN_REQUIRED";
const CHAPTER_TITLE_DIVERSITY_CODE = "CHAPTER_TITLE_DIVERSITY";

export function isTaskReplanRequired(task: TaskQueuePresentationInput): boolean {
  return task.checkpointType === "replan_required"
    || task.noticeCode === PIPELINE_REPLAN_REQUIRED_CODE
    || task.failureCode === PIPELINE_REPLAN_REQUIRED_CODE;
}

export function isTaskFailureQualityReminder(task: TaskQueuePresentationInput): boolean {
  return task.failureCode === PIPELINE_QUALITY_REVIEW_CODE
    || task.failureCode === CHAPTER_TITLE_DIVERSITY_CODE;
}

export function isTaskQueueQualityReminder(task: TaskQueuePresentationInput): boolean {
  return task.noticeCode === PIPELINE_QUALITY_REVIEW_CODE
    || task.noticeCode === CHAPTER_TITLE_DIVERSITY_CODE
    || isTaskFailureQualityReminder(task);
}

export function getTaskNoticeSeverity(task: TaskQueuePresentationInput): TaskQueueSeverity {
  if (isTaskReplanRequired(task)) return "blocking";
  if (isTaskQueueQualityReminder(task)) return "quality";
  return "normal";
}

export function getTaskNoticeTitle(task: TaskQueuePresentationInput): string {
  if (isTaskReplanRequired(task)) return translateUi("需要重规划");
  if (isTaskQueueQualityReminder(task)) return translateUi("质量提醒");
  return translateUi("任务提醒");
}

export function getTaskListPriority(task: TaskQueuePresentationInput): number {
  const tone = getTaskQueueTone(task);
  if (tone === "danger") return 0;
  if (tone === "warning") return 1;
  if (tone === "info") return 2;
  return 3;
}

export function isTaskMustHandle(task: TaskQueuePresentationInput): boolean {
  return getTaskQueueTone(task) === "danger";
}

export function getTaskQueueTone(task: TaskQueuePresentationInput): WorkspaceTone {
  if (task.pendingManualRecovery || isTaskReplanRequired(task)) {
    return "danger";
  }
  if (task.status === "failed" && !isTaskFailureQualityReminder(task)) {
    return "danger";
  }
  if (isTaskQueueQualityReminder(task)) {
    return "warning";
  }
  if (task.status === "failed") {
    return "danger";
  }
  if (task.failureCode || task.failureSummary) {
    return "warning";
  }
  if (task.status === "waiting_approval" || task.status === "running" || task.noticeCode || task.noticeSummary) {
    return "info";
  }
  if (task.status === "succeeded") {
    return "success";
  }
  return "neutral";
}

export function getTaskQueueLevelLabel(task: TaskQueuePresentationInput): string {
  const tone = getTaskQueueTone(task);
  if (isTaskReplanRequired(task)) return translateUi("需要重规划");
  if (task.pendingManualRecovery) return translateUi("需要恢复");
  if (tone === "danger") return task.status === "failed" ? translateUi("任务失败") : translateUi("阻塞");
  if (tone === "warning" && isTaskQueueQualityReminder(task)) return translateUi("质量提醒");
  if (tone === "warning") return translateUi("待操作");
  if (tone === "info") return task.status === "waiting_approval" ? translateUi("待操作") : translateUi("进行中");
  if (tone === "success") return translateUi("已完成");
  return translateUi("普通任务");
}

export function getTaskQueueSeverity(task: TaskQueuePresentationInput): TaskQueueSeverity {
  const tone = getTaskQueueTone(task);
  if (tone === "danger") return "blocking";
  if (isTaskQueueQualityReminder(task)) return "quality";
  return "normal";
}

export function getTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  return new Date(value).getTime();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return translateUi("暂无");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return translateUi("暂无");
  }
  return date.toLocaleString();
}

export function formatTokenCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

export function formatKind(kind: TaskKind): string {
  if (kind === "book_analysis") {
    return translateUi("拆书分析");
  }
  if (kind === "novel_workflow") {
    return translateUi("小说创作");
  }
  if (kind === "novel_pipeline") {
    return translateUi("小说流水线");
  }
  if (kind === "knowledge_document") {
    return translateUi("知识库索引");
  }
  if (kind === "style_extraction") {
    return translateUi("写法提取");
  }
  if (kind === "agent_run") {
    return translateUi("Agent 运行");
  }
  return translateUi("图片生成");
}

export function formatCheckpoint(checkpoint: NovelWorkflowMilestoneType | null | undefined, scopeLabel?: string | null): string {
  const resolvedScopeLabel = scopeLabel?.trim() || translateUi("前 10 章");
  if (checkpoint === "rewrite_snapshot_created") {
    return translateUi("重写前备份已创建");
  }
  if (checkpoint === "candidate_selection_required") {
    return translateUi("等待确认书级方向");
  }
  if (checkpoint === "book_contract_ready") {
    return translateUi("Book Contract 已就绪");
  }
  if (checkpoint === "character_setup_required") {
    return translateUi("角色准备待审核");
  }
  if (checkpoint === "volume_strategy_ready") {
    return translateUi("卷战略已就绪");
  }
  if (checkpoint === "chapter_batch_ready") {
    return translateUi("{{v0}}自动执行已暂停", { v0: resolvedScopeLabel });
  }
  if (checkpoint === "step_review_required") {
    return translateUi("当前步骤待检查");
  }
  if (checkpoint === "replan_required") {
    return translateUi("需要重规划");
  }
  if (checkpoint === "workflow_completed") {
    return translateUi("主流程完成");
  }
  return translateUi("暂无");
}

export function formatResumeTarget(target: NovelWorkflowResumeTarget | null | undefined): string {
  if (!target) {
    return translateUi("暂无");
  }
  if (target.route === "/novels/create") {
    return target.mode === "director" ? translateUi("创建页 / AI 自动导演") : translateUi("创建页");
  }
  if (target.stage === "story_macro") {
    return translateUi("小说编辑页 / 故事宏观规划");
  }
  if (target.stage === "character") {
    return translateUi("小说编辑页 / 角色准备");
  }
  if (target.stage === "outline") {
    return translateUi("小说编辑页 / 卷战略");
  }
  if (target.stage === "structured") {
    return translateUi("小说编辑页 / 节奏拆章");
  }
  if (target.stage === "chapter") {
    return translateUi("小说编辑页 / 章节执行");
  }
  if (target.stage === "pipeline") {
    return translateUi("小说编辑页 / 质量修复");
  }
  return translateUi("小说编辑页 / 项目设定");
}

export function formatStatus(status: TaskStatus): string {
  if (status === "queued") {
    return translateUi("排队中");
  }
  if (status === "running") {
    return translateUi("运行中");
  }
  if (status === "waiting_approval") {
    return translateUi("等待审批");
  }
  if (status === "succeeded") {
    return translateUi("已完成");
  }
  if (status === "failed") {
    return translateUi("失败");
  }
  return translateUi("已取消");
}

export function toStatusVariant(status: TaskStatus): "default" | "outline" | "secondary" | "destructive" {
  if (status === "running") {
    return "default";
  }
  if (status === "waiting_approval") {
    return "secondary";
  }
  if (status === "queued") {
    return "secondary";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "outline";
}

export function serializeListParams(input: {
  kind: TaskKind | "";
  status: TaskStatus | "";
  keyword: string;
}): string {
  return JSON.stringify({
    kind: input.kind || null,
    status: input.status || null,
    keyword: input.keyword.trim() || null,
  });
}

export function createIdempotencyKey(taskId: string, actionCode: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${taskId}:${actionCode}:${globalThis.crypto.randomUUID()}`;
  }
  return `${taskId}:${actionCode}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function formatFollowUpPriority(priority: "P0" | "P1" | "P2"): string {
  if (priority === "P0") {
    return translateUi("P0 立即处理");
  }
  if (priority === "P1") {
    return translateUi("P1 尽快处理");
  }
  return translateUi("P2 可稍后处理");
}

export function followUpActionVariant(action: AutoDirectorAction): "default" | "outline" {
  return action.kind === "navigation" || action.riskLevel !== "low" ? "outline" : "default";
}
