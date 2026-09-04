import { translateUi } from "@/i18n/legacy";
import type { DirectorCommandAcceptedResponse } from "@ai-novel/shared/types/directorRuntime";
import type { DirectorContinuationMode } from "@ai-novel/shared/types/novelDirector";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";

export function resolveWorkflowContinuationFeedback(
  task: UnifiedTaskDetail | DirectorCommandAcceptedResponse | null | undefined,
  options?: {
    mode?: DirectorContinuationMode;
    scopeLabel?: string | null;
  },
): {
  tone: "success" | "error";
  message: string;
} {
  const requestedScopeLabel = options?.scopeLabel?.trim();
  const taskScopeLabel = task && "executionScopeLabel" in task ? task.executionScopeLabel?.trim() : undefined;
  const scopeLabel = requestedScopeLabel || taskScopeLabel || translateUi("当前章节范围");

  if (task && "kind" in task && task.status === "failed") {
    return {
      tone: "error",
      message: task.failureSummary?.trim()
        || task.blockingReason?.trim()
        || task.lastError?.trim()
        || (options?.mode === "auto_execute_range"
          ? translateUi("继续自动执行{{value0}}失败。", { value0: scopeLabel })
          : translateUi("继续自动导演失败。")),
    };
  }

  return {
    tone: "success",
    message: options?.mode === "skip_quality_repair"
      ? translateUi("已跳过本次质量建议，自动导演会继续执行{{value0}}。", { value0: scopeLabel })
      : options?.mode === "auto_execute_range"
          ? translateUi("已继续自动执行{{value0}}。", { value0: scopeLabel })
          : translateUi("自动导演已继续推进。"),
  };
}

export function resolveDirectorContinueMode(task: Pick<
  UnifiedTaskDetail,
  "checkpointType" | "currentItemKey" | "currentStage" | "pendingManualRecovery"
> | null | undefined): DirectorContinuationMode {
  if (task?.pendingManualRecovery) {
    return "resume";
  }
  if (task?.checkpointType === "replan_required") {
    return "auto_execute_range";
  }
  if (
    task?.currentItemKey === "quality_repair"
    || task?.currentStage?.includes("质量")
  ) {
    return "skip_quality_repair";
  }
  if (task?.checkpointType === "chapter_batch_ready") {
    return "auto_execute_range";
  }
  return "resume";
}
