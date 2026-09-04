import { translateUi } from "../../../i18n/legacy.ts";
import type {
  DirectorTaskSnapshot,
} from "@ai-novel/shared/types/directorRuntime";
import type {
  DirectorAutoExecutionPlan,
  DirectorRunMode,
  DirectorTakeoverEntryReadiness,
  DirectorTakeoverEntryStep,
  DirectorTakeoverPreview,
  DirectorTakeoverReadinessResponse,
  DirectorTakeoverStrategy,
} from "@ai-novel/shared/types/novelDirector";

type TakeoverScopeMode = "book" | "chapter_range" | "volume";

export interface TakeoverGuidanceViewModel {
  diagnosis: string;
  nextStep: string;
  protectionNotes: string[];
  riskLevel: "safe" | "caution";
  actionLabel: string;
}

export interface TakeoverProgressCard {
  title: string;
  status: string;
  detail: string;
}

export interface TakeoverProgressInspectionViewModel {
  cards: TakeoverProgressCard[];
  summary: string;
}

export interface TakeoverChapterTargetViewModel {
  startOrder: number;
  maxOrder: number;
  selectedOrder: number;
  plan: DirectorAutoExecutionPlan;
  actionLabel: string;
  summary: string;
}

export interface TakeoverContinuousTargetViewModel {
  startOrder: number;
  currentWindowEndOrder: number;
  targetOrder: number;
  selectedOrder: number;
  actionLabel: string;
  summary: string;
}

const ENTRY_STEP_USER_LABELS: Record<DirectorTakeoverEntryStep, string> = {
  basic: translateUi("项目设定"),
  story_macro: translateUi("故事宏观规划"),
  world: translateUi("世界观准备"),
  character: translateUi("角色准备"),
  outline: translateUi("卷规划"),
  structured: translateUi("节奏拆章"),
  chapter: translateUi("章节执行"),
  pipeline: translateUi("质量修复"),
};

const RUN_MODE_ACTION_LABELS: Record<DirectorRunMode, string> = {
  auto_to_ready: translateUi("继续推进到可开写"),
  auto_to_execution: translateUi("按范围继续推进"),
  full_book_autopilot: translateUi("接管整本书继续推进"),
  stage_review: translateUi("继续推进"),
};

export function isTakeoverEntryStepAllowedForScope(
  entryStep: DirectorTakeoverEntryStep,
  scopeMode: TakeoverScopeMode,
): boolean {
  if (scopeMode === "chapter_range") {
    return entryStep === "structured" || entryStep === "chapter" || entryStep === "pipeline";
  }
  if (scopeMode === "volume") {
    return entryStep === "outline" || entryStep === "structured" || entryStep === "chapter" || entryStep === "pipeline";
  }
  return true;
}

export function resolveRecommendedTakeoverEntryStep(
  readiness: DirectorTakeoverReadinessResponse | null,
  scopeMode: TakeoverScopeMode,
): DirectorTakeoverEntryStep | null {
  if (!readiness) {
    return null;
  }
  const allowed = (entry: DirectorTakeoverEntryReadiness) => (
    entry.available && isTakeoverEntryStepAllowedForScope(entry.step, scopeMode)
  );
  return (
    readiness.entrySteps.find((entry) => entry.recommended && allowed(entry))
    ?? readiness.entrySteps.find(allowed)
    ?? null
  )?.step ?? null;
}

export function findTakeoverPreview(
  readiness: DirectorTakeoverReadinessResponse | null,
  entryStep: DirectorTakeoverEntryStep,
  strategy: DirectorTakeoverStrategy,
): DirectorTakeoverPreview | null {
  return readiness?.entrySteps
    .find((entry) => entry.step === entryStep)
    ?.previews.find((preview) => preview.strategy === strategy) ?? null;
}

export function buildTakeoverGuidance(
  readiness: DirectorTakeoverReadinessResponse | null,
  entryStep: DirectorTakeoverEntryStep,
  strategy: DirectorTakeoverStrategy,
  runMode: DirectorRunMode,
  taskSnapshot?: DirectorTaskSnapshot | null,
): TakeoverGuidanceViewModel {
  const task = taskSnapshot?.task ?? null;
  const chapterProgress = taskSnapshot?.chapterProgress ?? taskSnapshot?.projection?.chapterExecutionProgress ?? null;
  if (task && (task.status === "queued" || task.status === "running" || task.status === "waiting_approval")) {
    const currentStage = task.currentStage?.trim() || taskSnapshot?.displayState.stageLabel || translateUi("当前任务");
    const currentLabel = task.currentItemLabel?.trim() || taskSnapshot?.displayState.currentAction || translateUi("等待继续");
    const nextChapterOrder = chapterProgress?.currentChapterOrder ?? chapterProgress?.activeChapterOrder ?? null;
    return {
      diagnosis: translateUi("当前已有导演任务停在「{{v0}}」。", { v0: currentStage }),
      nextStep: nextChapterOrder
        ? translateUi("系统检测到章节执行已推进到第 {{v0}} 章附近，建议先回到当前任务继续。", { v0: nextChapterOrder })
        : translateUi("当前任务状态：{{v0}}。", { v0: currentLabel }),
      protectionNotes: [
        translateUi("任务状态：{{v0}}", { v0: task.status }),
        currentLabel,
        translateUi("继续当前任务不会新开一条重复接管。"),
      ],
      riskLevel: "safe",
      actionLabel: translateUi("进入当前任务"),
    };
  }
  if (!readiness) {
    return {
      diagnosis: translateUi("正在读取项目进度，读取完成后会给出推荐接续位置。"),
      nextStep: translateUi("读取完成后即可继续推进。"),
      protectionNotes: [translateUi("默认保留已有写作资产。")],
      riskLevel: "safe",
      actionLabel: RUN_MODE_ACTION_LABELS[runMode] ?? translateUi("继续推进"),
    };
  }
  const preview = findTakeoverPreview(readiness, entryStep, strategy);
  const entryLabel = ENTRY_STEP_USER_LABELS[preview?.effectiveStep ?? entryStep] ?? translateUi("推荐位置");
  const hasCharacters = readiness.snapshot.characterCount > 0;
  const hasVolumes = readiness.snapshot.volumeCount > 0;
  const hasChapters = readiness.snapshot.chapterCount > 0;
  const protectionNotes = [
    hasCharacters ? translateUi("保留已创建的 {{v0}} 个角色资产。", { v0: readiness.snapshot.characterCount }) : translateUi("没有检测到已创建角色，AI 会补齐角色准备。"),
    hasVolumes ? translateUi("沿用已有卷规划资产，只补后续缺口。") : translateUi("没有检测到卷规划，AI 会继续生成卷规划。"),
    hasChapters ? translateUi("保留已有 {{v0}} 章正文或章节资产。", { v0: readiness.snapshot.chapterCount }) : translateUi("没有检测到已生成正文。"),
  ];
  const riskLevel = strategy === "restart_current_step" ? "caution" : "safe";
  return {
    diagnosis: translateUi("系统检测到项目可以从「{{v0}}」接上。", { v0: entryLabel }),
    nextStep: preview?.summary ?? translateUi("AI 会从「{{v0}}」继续推进。", { v0: entryLabel }),
    protectionNotes,
    riskLevel,
    actionLabel: buildPrimaryActionLabel({
      fallback: RUN_MODE_ACTION_LABELS[runMode] ?? translateUi("继续推进"),
      taskSnapshot,
      readiness,
    }),
  };
}

function formatRatio(done: number, total: number): string {
  if (total <= 0) {
    return done > 0 ? translateUi("{{v0}} 项", { v0: done }) : translateUi("暂无");
  }
  return `${done} / ${total}`;
}

function buildPrimaryActionLabel(input: {
  fallback: string;
  taskSnapshot?: DirectorTaskSnapshot | null;
  readiness?: DirectorTakeoverReadinessResponse | null;
}): string {
  const progress = input.taskSnapshot?.chapterProgress
    ?? input.taskSnapshot?.projection?.chapterExecutionProgress
    ?? null;
  if (progress?.currentChapterOrder) {
    return translateUi("继续写第 {{v0}} 章", { v0: progress.currentChapterOrder });
  }
  const drafted = progress?.draftedChapterCount ?? input.readiness?.snapshot.generatedChapterCount ?? 0;
  const approved = progress?.approvedChapterCount ?? input.readiness?.snapshot.approvedChapterCount ?? 0;
  if (drafted > approved) {
    return translateUi("处理待确认章节");
  }
  if ((input.readiness?.snapshot.chapterCount ?? 0) > 0) {
    return translateUi("继续章节执行");
  }
  return input.fallback;
}

function normalizePositiveOrder(value: number | null | undefined): number | null {
  if (!Number.isFinite(value ?? NaN) || !value || value < 1) {
    return null;
  }
  return Math.max(1, Math.round(value));
}

function maxNormalizedOrder(values: Array<number | null | undefined>): number | null {
  const normalized = values
    .map(normalizePositiveOrder)
    .filter((value): value is number => Boolean(value));
  if (normalized.length === 0) {
    return null;
  }
  return Math.max(...normalized);
}

export function buildTakeoverChapterTarget(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
  selectedOrder?: number | null,
): TakeoverChapterTargetViewModel | null {
  const progress = taskSnapshot?.chapterProgress
    ?? taskSnapshot?.projection?.chapterExecutionProgress
    ?? null;
  const snapshot = readiness?.snapshot ?? null;
  const writtenChapterCount = maxNormalizedOrder([
    progress?.draftedChapterCount,
    progress?.completedChapters,
    snapshot?.generatedChapterCount,
  ]);
  const startOrder = maxNormalizedOrder([
    progress?.currentChapterOrder
      ?? null,
    progress?.activeChapterOrder
      ?? null,
    readiness?.executableRange?.nextChapterOrder
      ?? null,
    writtenChapterCount ? writtenChapterCount + 1 : null,
    snapshot?.approvedChapterCount ? snapshot.approvedChapterCount + 1 : null,
  ]);
  const totalChapters = maxNormalizedOrder([
    progress?.totalChapters
      ?? null,
    snapshot?.plannedChapterCount
      ?? null,
    readiness?.executableRange?.endOrder
      ?? null,
    snapshot?.chapterCount
      ?? null,
    snapshot?.firstVolumeChapterCount
      ?? null,
  ]);
  if (!startOrder || !totalChapters || startOrder > totalChapters) {
    return null;
  }
  const normalizedSelected = normalizePositiveOrder(selectedOrder ?? null);
  const selected = normalizedSelected
    ? Math.min(Math.max(normalizedSelected, startOrder), totalChapters)
    : startOrder;
  const plan: DirectorAutoExecutionPlan = {
    mode: "chapter_range",
    startOrder,
    endOrder: selected,
    autoReview: true,
    autoRepair: true,
  };
  return {
    startOrder,
    maxOrder: totalChapters,
    selectedOrder: selected,
    plan,
    actionLabel: translateUi("推进至第 {{number}} 章", { number: selected }),
    summary: selected === startOrder
      ? translateUi("从第 {{start}} 章继续推进。", { start: startOrder })
      : translateUi("从第 {{start}} 章开始，连续推进到第 {{selected}} 章。", { start: startOrder, selected }),
  };
}

export function buildTakeoverContinuousTarget(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
  selectedOrder?: number | null,
): TakeoverContinuousTargetViewModel | null {
  const currentWindow = readiness
    ? buildTakeoverChapterTarget({
      ...readiness,
      snapshot: { ...readiness.snapshot, plannedChapterCount: null },
    }, taskSnapshot)
    : null;
  const targetOrder = normalizePositiveOrder(readiness?.snapshot.plannedChapterCount ?? null);
  if (!currentWindow || !targetOrder || targetOrder <= currentWindow.maxOrder) {
    return null;
  }
  const normalizedSelected = normalizePositiveOrder(selectedOrder ?? null);
  const resolvedSelected = normalizedSelected
    ? Math.min(Math.max(normalizedSelected, currentWindow.startOrder), targetOrder)
    : targetOrder;
  return {
    startOrder: currentWindow.startOrder,
    currentWindowEndOrder: currentWindow.maxOrder,
    targetOrder,
    selectedOrder: resolvedSelected,
    actionLabel: resolvedSelected === targetOrder ? translateUi("持续推进至第 {{value0}} 章", { value0: targetOrder }) : translateUi("推进至第 {{value0}} 章", { value0: resolvedSelected }),
    summary: resolvedSelected === targetOrder
      ? translateUi("先推进第 {{value0}}-{{value1}} 章；接近范围末尾时，AI 会补后续卷骨架和近期拆章，不会预先生成远期章节任务。", { value0: currentWindow.startOrder, value1: currentWindow.maxOrder })
      : translateUi("本次只推进第 {{value0}}-{{value1}} 章；之后仍可从当前进度继续，预计章节数为 {{value2}} 章。", { value0: currentWindow.startOrder, value1: resolvedSelected, value2: targetOrder }),
  };
}

export function buildTakeoverProgressInspection(
  readiness: DirectorTakeoverReadinessResponse | null,
  taskSnapshot?: DirectorTaskSnapshot | null,
): TakeoverProgressInspectionViewModel {
  const factSummary = taskSnapshot?.factSummary ?? taskSnapshot?.projection?.factSummary ?? null;
  const outline = factSummary?.outlineFacts ?? null;
  const chapterFacts = factSummary?.chapterExecutionFacts ?? null;
  const repairFacts = factSummary?.repairFacts ?? null;
  const chapterProgress = taskSnapshot?.chapterProgress ?? taskSnapshot?.projection?.chapterExecutionProgress ?? null;
  const snapshot = readiness?.snapshot ?? null;
  const volumeRanges = snapshot?.volumeChapterRanges ?? [];
  const syncedChapterCount = outline?.syncedChapterCount ?? snapshot?.chapterCount ?? 0;
  const plannedChapterCount = outline?.plannedChapterCount ?? snapshot?.chapterCount ?? chapterProgress?.totalChapters ?? 0;
  const selectedChapterCount = outline?.selectedChapterCount ?? readiness?.executableRange?.totalChapterCount ?? 0;
  const detailDone = outline?.completedDetailSteps ?? snapshot?.firstVolumePreparedChapterCount ?? 0;
  const detailTotal = outline?.totalDetailSteps ?? selectedChapterCount;
  const drafted = chapterProgress?.draftedChapterCount ?? chapterFacts?.draftedChapterCount ?? snapshot?.generatedChapterCount ?? 0;
  const approved = chapterProgress?.approvedChapterCount ?? chapterFacts?.approvedChapterCount ?? snapshot?.approvedChapterCount ?? 0;
  const reviewed = chapterFacts?.reviewedChapterCount ?? repairFacts?.reviewedChapterCount ?? 0;
  const pendingRepair = chapterProgress?.needsRepairChapters ?? chapterFacts?.needsRepairChapters ?? snapshot?.pendingRepairChapterCount ?? 0;
  const nextChapterOrder = chapterProgress?.currentChapterOrder ?? readiness?.executableRange?.nextChapterOrder ?? null;

  const cards: TakeoverProgressCard[] = [
    {
      title: translateUi("卷规划进度"),
      status: factSummary?.hasVolumeStrategy || (snapshot?.volumeCount ?? 0) > 0 ? translateUi("已具备卷战略") : translateUi("待补卷战略"),
      detail: snapshot
        ? `${snapshot.volumeCount} 卷；当前卷章节 ${snapshot.firstVolumeChapterCount} 章；已拆范围 ${volumeRanges.map((range) => `第${range.startOrder}-${range.endOrder}章`).join("、") || translateUi("暂无")}`
        : translateUi("正在读取卷规划。"),
    },
    {
      title: translateUi("拆章同步进度"),
      status: formatRatio(syncedChapterCount, plannedChapterCount),
      detail: selectedChapterCount > 0
        ? translateUi("当前可执行范围 {{v0}}-{{v1}} 章。", { v0: readiness?.executableRange?.startOrder ?? 1, v1: readiness?.executableRange?.endOrder ?? selectedChapterCount })
        : translateUi("尚未检测到可执行章节范围。"),
    },
    {
      title: translateUi("章节细化进度"),
      status: formatRatio(detailDone, detailTotal),
      detail: outline?.chapterDetailReady || detailDone > 0
        ? translateUi("已准备 {{v0}} 个章节任务单 / 执行资源。", { v0: detailDone })
        : translateUi("尚未检测到章节细化资源。"),
    },
    {
      title: translateUi("正文与质量进度"),
      status: formatRatio(drafted, chapterProgress?.totalChapters ?? chapterFacts?.totalChapters ?? plannedChapterCount),
      detail: [
        reviewed > 0 ? translateUi("已审校 {{v0}} 章", { v0: reviewed }) : "",
        approved > 0 ? translateUi("已通过 {{v0}} 章", { v0: approved }) : "",
        pendingRepair > 0 ? translateUi("待处理 {{v0}} 章", { v0: pendingRepair }) : "",
        nextChapterOrder ? translateUi("下一章第 {{v0}} 章", { v0: nextChapterOrder }) : "",
      ].filter(Boolean).join("；") || translateUi("尚未开始正文生产。"),
    },
  ];

  return {
    cards,
    summary: taskSnapshot?.task
      ? translateUi("当前任务：{{value0}} / {{value1}}", { value0: taskSnapshot.task.currentStage || taskSnapshot.displayState.stageLabel || translateUi("自动导演"), value1: taskSnapshot.task.currentItemLabel || taskSnapshot.displayState.currentAction || translateUi("等待继续") })
      : translateUi("以下为当前项目已检测到的资产进度。"),
  };
}

export function formatTakeoverStartError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("章节范围只能从节奏拆章、章节执行或质量修复开始")) {
    return translateUi("当前项目还没有进入章节生产阶段，不能直接从章节范围继续。建议使用系统推荐位置继续推进。");
  }
  if (message.includes("当前已有自动导演任务")) {
    return translateUi("当前已有自动导演任务在处理这本书，请先进入当前任务继续或取消后再接管。");
  }
  return message || translateUi("启动自动导演接管失败。");
}
