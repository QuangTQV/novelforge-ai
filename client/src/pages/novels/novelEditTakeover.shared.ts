import { translateUi } from "@/i18n/legacy";
﻿import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import type { DirectorLockScope } from "@ai-novel/shared/types/novelDirector";
import type { NovelEditTakeoverState } from "./components/NovelEditView.types";

export function resolveAutoExecutionScopeLabel(task: UnifiedTaskDetail | null): string {
  const seedPayload = (task?.meta.seedPayload ?? null) as {
    autoExecution?: {
      scopeLabel?: string | null;
      totalChapterCount?: number | null;
    } | null;
  } | null;
  const scopeLabel = seedPayload?.autoExecution?.scopeLabel?.trim();
  if (scopeLabel) {
    return scopeLabel;
  }
  const fallbackCount = Math.max(1, Math.round(seedPayload?.autoExecution?.totalChapterCount ?? 10));
  return translateUi("第 1-{{v0}} 章", { v0: fallbackCount });
}

export function formatTakeoverCheckpoint(
  checkpoint: string | null | undefined,
  task: UnifiedTaskDetail | null,
): string {
  if (checkpoint === "candidate_selection_required") {
    return translateUi("等待确认书级方向");
  }
  if (checkpoint === "book_contract_ready") {
    return translateUi("Book Contract 待确认");
  }
  if (checkpoint === "character_setup_required") {
    return translateUi("角色准备待审核");
  }
  if (checkpoint === "volume_strategy_ready") {
    return translateUi("卷战略 / 卷骨架待审核");
  }
  if (checkpoint === "chapter_batch_ready") {
    return translateUi("{{v0}}自动执行已暂停", { v0: resolveAutoExecutionScopeLabel(task) });
  }
  if (checkpoint === "replan_required") {
    return translateUi("等待处理重规划建议");
  }
  if (checkpoint === "workflow_completed") {
    return translateUi("主流程已完成");
  }
  return translateUi("导演流程进行中");
}

export function buildTakeoverTitle(input: {
  mode: NovelEditTakeoverState["mode"];
  novelTitle: string;
  checkpointType: string | null | undefined;
  scopeLabel: string;
}): string {
  if (
    input.mode === "running"
    && input.checkpointType === "chapter_batch_ready"
  ) {
    return translateUi("《{{v0}}》正在自动执行{{v1}}", { v0: input.novelTitle, v1: input.scopeLabel });
  }
  if (input.mode === "waiting" || input.mode === "action_required") {
    if (input.checkpointType === "candidate_selection_required") {
      return translateUi("《{{v0}}》等待确认书级方向", { v0: input.novelTitle });
    }
    if (input.checkpointType === "character_setup_required") {
      return translateUi("《{{v0}}》等待审核角色准备", { v0: input.novelTitle });
    }
    if (input.checkpointType === "volume_strategy_ready") {
      return translateUi("《{{v0}}》等待审核卷战略 / 卷骨架", { v0: input.novelTitle });
    }
    if (input.checkpointType === "workflow_completed") {
      return translateUi("《{{v0}}》本轮自动导演已完成", { v0: input.novelTitle });
    }
    if (input.checkpointType === "replan_required") {
      return translateUi("《{{v0}}》需要处理重规划", { v0: input.novelTitle });
    }
  }
  if (input.mode === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return translateUi("《{{v0}}》{{v1}}自动执行已暂停", { v0: input.novelTitle, v1: input.scopeLabel });
    }
    return translateUi("《{{v0}}》自动导演已中断", { v0: input.novelTitle });
  }
  if (input.mode === "loading") {
    return translateUi("《{{v0}}》自动导演状态同步中", { v0: input.novelTitle });
  }
  return translateUi("《{{v0}}》正在自动导演", { v0: input.novelTitle });
}

export function buildTakeoverDescription(input: {
  mode: NovelEditTakeoverState["mode"];
  checkpointType: string | null | undefined;
  reviewScope: DirectorLockScope | null | undefined;
  scopeLabel: string;
}): string {
  if (
    input.mode === "running"
    && input.checkpointType === "chapter_batch_ready"
  ) {
    return translateUi("AI 正在后台自动执行{{v0}}，并会继续完成审核与修复。你仍可继续手动查看和编辑；如果同时修改当前章节，后续自动结果可能覆盖这部分内容。", { v0: input.scopeLabel });
  }
  if (input.mode === "waiting" || input.mode === "action_required") {
    if (input.checkpointType === "candidate_selection_required") {
      return translateUi("书级方向候选已经生成。请先回到书级方向确认页选定或修正方案，自动导演才能继续推进后续主链。");
    }
    if (input.checkpointType === "character_setup_required") {
      return translateUi("角色准备已经生成。你可以先检查核心角色、关系和当前目标，确认后再继续自动导演。");
    }
    if (input.checkpointType === "volume_strategy_ready") {
      return translateUi("当前可以审核并微调卷战略 / 卷骨架。确认后再继续自动生成节奏板、拆章和已选章节批次的细化资源。");
    }
    if (input.checkpointType === "workflow_completed") {
      return translateUi("自动导演已经完成{{v0}}的章节执行、审核与修复。你可以直接进入章节执行继续写作，也可以完成并退出导演模式。", { v0: input.scopeLabel });
    }
    if (input.checkpointType === "replan_required") {
      return translateUi("AI 判断当前章节与相邻章节的安排需要调整。继续后会保留已有正文，先重规划附近章节，再从未生成的章节接着创作。");
    }
    if (input.reviewScope) {
      return translateUi("自动导演已到达审核点。请先检查当前阶段产物，再决定是否继续推进。");
    }
  }
  if (input.mode === "failed") {
    if (input.checkpointType === "chapter_batch_ready") {
      return translateUi("{{v0}}自动执行已暂停。可以先查看执行详情或质量修复区，再决定是否继续自动执行。", { v0: input.scopeLabel });
    }
    return translateUi("后台导演流程已中断。可以先查看执行详情，再决定是否从最近进度点恢复。");
  }
  if (input.mode === "loading") {
    return translateUi("正在同步当前自动导演状态。");
  }
  return translateUi("AI 正在后台接管这本书的开书流程。你可以继续手动操作当前项目；如果与自动导演同时改同一块内容，以最新写入结果为准。");
}

export function buildContinueAutoExecutionActionLabel(scopeLabel: string, isPending: boolean): string {
  return isPending ? translateUi("继续执行中...") : translateUi("继续自动执行{{v0}}", { v0: scopeLabel });
}

export function buildReplanAndContinueActionLabel(isPending: boolean): string {
  return isPending ? translateUi("正在重规划...") : translateUi("重规划后继续");
}

export function buildContinueAutoExecutionToast(scopeLabel: string): string {
  return translateUi("自动导演已继续执行{{v0}}，并会在后台自动审核与修复。", { v0: scopeLabel });
}
