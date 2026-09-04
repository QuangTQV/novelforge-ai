import { translateUi } from "@/i18n/legacy";
import type {
  VolumeBeatSheet,
  VolumeChapterListGenerationMode,
  VolumeGenerationScopeInput,
  VolumePlan,
  VolumePlanDocument,
} from "@ai-novel/shared/types/novel";
import { findBeatSheet } from "../volumePlan.utils";
import type { ChapterDetailMode } from "../chapterDetailPlanning.shared";

export interface ChapterListGenerationRequest {
  generationMode?: VolumeChapterListGenerationMode;
  targetBeatKey?: string;
}

export interface VolumeGenerationPayload {
  scope: VolumeGenerationScopeInput;
  generationMode?: VolumeChapterListGenerationMode;
  targetVolumeId?: string;
  targetBeatKey?: string;
  targetChapterId?: string;
  detailMode?: ChapterDetailMode;
  draftVolumesOverride?: VolumePlan[];
  suppressSuccessMessage?: boolean;
}

export function startStrategyGenerationAction(params: {
  ensureCharacterGuard: () => boolean;
  userPreferredVolumeCount: number | null;
  forceSystemRecommendedVolumeCount: boolean;
  volumeCountGuidance: {
    systemRecommendedVolumeCount: number;
    allowedVolumeCountRange: { min: number; max: number };
    decisionVolumeCountRange: { min: number; max: number };
    respectedExistingVolumeCount?: number | null;
  };
  hasUnsavedVolumeDraft: boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const confirmed = window.confirm([
    translateUi("将生成卷战略建议，帮助决定推荐卷数、硬规划卷数和各卷角色定位。"),
    translateUi("这一步不会直接生成卷骨架，也不会拆章节。"),
    params.userPreferredVolumeCount != null
      ? translateUi("本次将固定为 {{value0}} 卷生成分卷策略。", { value0: params.userPreferredVolumeCount })
      : params.forceSystemRecommendedVolumeCount
        ? translateUi("本次将按系统建议卷数生成（当前建议 {{value0}} 卷），不沿用现有草稿卷数。", { value0: params.volumeCountGuidance.systemRecommendedVolumeCount })
        : params.volumeCountGuidance.respectedExistingVolumeCount != null
          ? translateUi("本次会优先沿用当前草稿的 {{value0}} 卷结构，同时保持在允许区间 {{value1}}-{{value2}} 内。", { value0: params.volumeCountGuidance.respectedExistingVolumeCount, value1: params.volumeCountGuidance.allowedVolumeCountRange.min, value2: params.volumeCountGuidance.allowedVolumeCountRange.max })
          : translateUi("当前系统建议 {{value0}} 卷，结构建议区间 {{value1}}-{{value2}} 卷。", { value0: params.volumeCountGuidance.systemRecommendedVolumeCount, value1: params.volumeCountGuidance.decisionVolumeCountRange.min, value2: params.volumeCountGuidance.decisionVolumeCountRange.max }),
    params.hasUnsavedVolumeDraft ? translateUi("本次会直接使用当前页面未保存草稿作为参考。") : translateUi("本次会基于当前工作区状态生成建议。"),
  ].join("\n\n"));
  if (!confirmed) {
    return;
  }
  params.generate({ scope: "strategy" });
}

export function startStrategyCritiqueAction(params: {
  ensureCharacterGuard: () => boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  params.generate({ scope: "strategy_critique" });
}

export function startSkeletonGenerationAction(params: {
  ensureCharacterGuard: () => boolean;
  hasUnsavedVolumeDraft: boolean;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const confirmed = window.confirm([
    translateUi("将根据当前卷战略建议生成或重生成全书卷骨架。"),
    translateUi("这一步会清空已有节奏板和相邻卷再平衡建议，但不会直接删除章节正文。"),
    params.hasUnsavedVolumeDraft ? translateUi("本次会直接使用当前页面草稿作为卷骨架上下文。") : translateUi("本次会基于当前卷工作区继续推进。"),
  ].join("\n\n"));
  if (!confirmed) {
    return;
  }
  params.generate({ scope: "skeleton" });
}

export function startBeatSheetGenerationAction(params: {
  volumeId: string;
  normalizedVolumeDraft: VolumePlan[];
  strategyPlan: object | null;
  beatSheets: VolumeBeatSheet[];
  ensureCharacterGuard: () => boolean;
  setStructuredMessage: (value: string) => void;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  const targetVolume = params.normalizedVolumeDraft.find((volume) => volume.id === params.volumeId);
  if (!targetVolume) {
    params.setStructuredMessage(translateUi("当前卷不存在，无法生成节奏板。"));
    return;
  }
  if (!params.strategyPlan) {
    params.setStructuredMessage(translateUi("请先生成卷战略建议，再生成当前卷节奏板。"));
    return;
  }
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const existingBeatSheet = findBeatSheet(params.beatSheets, params.volumeId);
  if (existingBeatSheet) {
    const confirmed = window.confirm([
      translateUi("将重新生成「{{value0}}」的节奏板。", { value0: targetVolume.title?.trim() || translateUi("第{{value0}}卷", { value0: targetVolume.sortOrder }) }),
      translateUi("这一步会覆盖当前卷现有节奏段与交付项。"),
      translateUi("已有章节列表和章节细化资产不会被直接删除，但如果新节奏区间发生变化，建议随后检查章节列表是否仍然匹配。"),
    ].join("\n\n"));
    if (!confirmed) {
      return;
    }
  }
  params.generate({
    scope: "beat_sheet",
    targetVolumeId: params.volumeId,
  });
}

export function startChapterListGenerationAction(params: {
  volumeId: string;
  request?: ChapterListGenerationRequest;
  normalizedVolumeDraft: VolumePlan[];
  beatSheets: VolumeBeatSheet[];
  ensureCharacterGuard: () => boolean;
  setStructuredMessage: (value: string) => void;
  generate: (payload: VolumeGenerationPayload) => void;
}): void {
  const targetVolume = params.normalizedVolumeDraft.find((volume) => volume.id === params.volumeId);
  if (!targetVolume) {
    params.setStructuredMessage(translateUi("当前卷不存在，无法生成章节列表。"));
    return;
  }
  if (!findBeatSheet(params.beatSheets, params.volumeId)) {
    params.setStructuredMessage(translateUi("当前卷还没有节奏板，默认不能直接拆章节列表。"));
    return;
  }
  if (!params.ensureCharacterGuard()) {
    return;
  }
  const generationMode = params.request?.generationMode ?? "full_volume";
  const targetBeatKey = params.request?.targetBeatKey?.trim();
  if (generationMode === "single_beat" && !targetBeatKey) {
    params.setStructuredMessage(translateUi("当前节奏段不存在，无法重生该段章节标题。"));
    return;
  }
  params.generate({
    scope: "chapter_list",
    generationMode,
    targetVolumeId: params.volumeId,
    targetBeatKey,
  });
}

export function buildChapterListSuccessMessage(params: {
  document: VolumePlanDocument;
  targetVolumeId?: string;
  generationMode?: VolumeChapterListGenerationMode;
  targetBeatKey?: string;
  autoSyncedToChapterExecution?: boolean;
}): string {
  const updatedVolume = params.targetVolumeId
    ? params.document.volumes.find((volume) => volume.id === params.targetVolumeId)
    : undefined;
  const updatedChapterCount = updatedVolume?.chapters.length ?? 0;
  const syncSuffix = params.autoSyncedToChapterExecution ? translateUi("，并连接到章节执行区") : "";
  if (params.generationMode === "single_beat" && params.targetVolumeId && params.targetBeatKey) {
    const targetBeat = findBeatSheet(params.document.beatSheets, params.targetVolumeId)?.beats
      .find((beat) => beat.key === params.targetBeatKey);
    const targetBeatLabel = targetBeat ? `${targetBeat.label}${targetBeat.title ? ` · ${targetBeat.title}` : ""}` : params.targetBeatKey;
    return updatedChapterCount > 0
      ? translateUi("当前卷节奏段「{{value0}}」已生成并自动保存{{value1}}，本卷现有 {{value2}} 章。", { value0: targetBeatLabel, value1: syncSuffix, value2: updatedChapterCount })
      : translateUi("当前卷节奏段「{{value0}}」已生成并自动保存{{value1}}。", { value0: targetBeatLabel, value1: syncSuffix });
  }
  return updatedChapterCount > 0
    ? translateUi("当前卷章节列表已生成并自动保存{{value0}}，现已更新为 {{value1}} 章，相邻卷再平衡建议也已同步更新。", { value0: syncSuffix, value1: updatedChapterCount })
    : translateUi("当前卷章节列表已生成并自动保存{{value0}}，相邻卷再平衡建议也已同步更新。", { value0: syncSuffix });
}
