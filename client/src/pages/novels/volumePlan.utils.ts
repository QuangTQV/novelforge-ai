import { translateUi } from "../../i18n/legacy.ts";
import type {
  VolumeBeatSheet,
  VolumeChapterPlan,
  VolumeCritiqueReport,
  VolumePlan,
  VolumePlanningReadiness,
  VolumeStrategyPlan,
  VolumeSyncPreview,
} from "@ai-novel/shared/types/novel";

export interface ExistingOutlineChapter {
  id: string;
  order: number;
  title: string;
  content?: string | null;
  expectation?: string | null;
  targetWordCount?: number | null;
  conflictLevel?: number | null;
  revealLevel?: number | null;
  mustAvoid?: string | null;
  taskSheet?: string | null;
}

export interface VolumeSyncOptions {
  preserveContent: boolean;
  applyDeletes: boolean;
}

export function buildVolumePlanningReadiness(params: {
  volumes: VolumePlan[];
  strategyPlan: VolumeStrategyPlan | null;
  critiqueReport?: VolumeCritiqueReport | null;
  beatSheets: VolumeBeatSheet[];
}): VolumePlanningReadiness {
  const { volumes, strategyPlan, critiqueReport, beatSheets } = params;
  const blockingReasons: string[] = [];
  if (!strategyPlan) {
    blockingReasons.push(translateUi("请先生成卷战略建议，再确认卷骨架。"));
  }
  const hasHighRiskCritique = critiqueReport?.overallRisk === "high";
  if (hasHighRiskCritique) {
    blockingReasons.push(translateUi("当前卷战略审查为高风险，请先重新生成或修订卷战略。"));
  }
  if (volumes.length === 0) {
    blockingReasons.push(translateUi("当前还没有卷骨架。"));
  }
  if (!beatSheets.some((sheet) => sheet.beats.length > 0)) {
    blockingReasons.push(translateUi("当前卷还没有节奏板，默认不能直接拆章节列表。"));
  }
  return {
    canGenerateStrategy: true,
    canGenerateSkeleton: Boolean(strategyPlan) && !hasHighRiskCritique,
    canGenerateBeatSheet: Boolean(strategyPlan) && volumes.length > 0,
    canGenerateChapterList: Boolean(strategyPlan) && beatSheets.some((sheet) => sheet.beats.length > 0),
    blockingReasons,
  };
}

export function findBeatSheet(beatSheets: VolumeBeatSheet[], volumeId: string): VolumeBeatSheet | null {
  return beatSheets.find((sheet) => sheet.volumeId === volumeId && sheet.beats.length > 0) ?? null;
}

function createLocalId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function createEmptyVolume(sortOrder: number): VolumePlan {
  return {
    id: createLocalId("volume"),
    novelId: "",
    sortOrder,
    title: translateUi("第{{sortOrder}}卷", { sortOrder }),
    summary: "",
    openingHook: "",
    mainPromise: "",
    primaryPressureSource: "",
    coreSellingPoint: "",
    escalationMode: "",
    protagonistChange: "",
    midVolumeRisk: "",
    climax: "",
    payoffType: "",
    nextVolumeHook: "",
    resetPoint: "",
    openPayoffs: [],
    status: "active",
    sourceVersionId: null,
    chapters: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function createEmptyChapter(chapterOrder: number): VolumeChapterPlan {
  return {
    id: createLocalId("chapter"),
    volumeId: "",
    chapterOrder,
    beatKey: null,
    title: translateUi("第{{chapterOrder}}章", { chapterOrder }),
    summary: "",
    purpose: "",
    conflictLevel: null,
    conflictLevelSource: null,
    revealLevel: null,
    targetWordCount: null,
    mustAvoid: "",
    taskSheet: "",
    payoffRefs: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function buildTaskSheetFromVolumeChapter(chapter: VolumeChapterPlan): string {
  const lines = [
    translateUi("Mục tiêu chương: {{goal}}", { goal: chapter.purpose || chapter.summary || translateUi("推进主线") }),
    typeof chapter.conflictLevel === "number" ? translateUi("冲突等级：{{v0}}", { v0: chapter.conflictLevel }) : "",
    typeof chapter.revealLevel === "number" ? translateUi("揭露等级：{{v0}}", { v0: chapter.revealLevel }) : "",
    typeof chapter.targetWordCount === "number" ? translateUi("目标字数：{{v0}}", { v0: chapter.targetWordCount }) : "",
    chapter.mustAvoid?.trim() ? translateUi("禁止事项：{{v0}}", { v0: chapter.mustAvoid.trim() }) : "",
    chapter.payoffRefs.length > 0 ? translateUi("兑现关联：{{v0}}", { v0: chapter.payoffRefs.join("、") }) : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function normalizeVolumeDraft(volumes: VolumePlan[]): VolumePlan[] {
  let chapterOrder = 1;
  return volumes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((volume, volumeIndex) => {
      const volumeId = volume.id || createLocalId("volume");
      const chapters = (volume.chapters ?? [])
        .slice()
        .sort((a, b) => a.chapterOrder - b.chapterOrder)
        .map((chapter) => {
          const normalizedChapter = {
            ...chapter,
            id: chapter.id || createLocalId("chapter"),
            volumeId,
            chapterOrder,
          };
          chapterOrder += 1;
          return normalizedChapter;
        });
      return {
        ...volume,
        id: volumeId,
        sortOrder: volumeIndex + 1,
        openPayoffs: (volume.openPayoffs ?? []).filter((item) => item.trim()),
        openingHook: volume.openingHook ?? "",
        primaryPressureSource: volume.primaryPressureSource ?? "",
        coreSellingPoint: volume.coreSellingPoint ?? "",
        midVolumeRisk: volume.midVolumeRisk ?? "",
        payoffType: volume.payoffType ?? "",
        chapters,
      };
    });
}

export function buildOutlinePreviewFromVolumes(volumes: VolumePlan[]): string {
  return normalizeVolumeDraft(volumes)
    .map((volume) => {
      const chapterSpan = volume.chapters.length > 0
        ? `${volume.chapters[0]?.chapterOrder ?? "-"}-${volume.chapters[volume.chapters.length - 1]?.chapterOrder ?? "-"}`
        : translateUi("未拆章");
      return [
        translateUi("【第{{v0}}卷】{{v1}}", { v0: volume.sortOrder, v1: volume.title }),
        volume.summary?.trim() ? translateUi("卷摘要：{{v0}}", { v0: volume.summary.trim() }) : "",
        volume.openingHook?.trim() ? translateUi("开卷抓手：{{v0}}", { v0: volume.openingHook.trim() }) : "",
        volume.mainPromise?.trim() ? translateUi("主承诺：{{v0}}", { v0: volume.mainPromise.trim() }) : "",
        volume.primaryPressureSource?.trim() ? translateUi("主压迫源：{{v0}}", { v0: volume.primaryPressureSource.trim() }) : "",
        volume.coreSellingPoint?.trim() ? translateUi("核心卖点：{{v0}}", { v0: volume.coreSellingPoint.trim() }) : "",
        volume.escalationMode?.trim() ? translateUi("升级方式：{{v0}}", { v0: volume.escalationMode.trim() }) : "",
        volume.protagonistChange?.trim() ? translateUi("主角变化：{{v0}}", { v0: volume.protagonistChange.trim() }) : "",
        volume.midVolumeRisk?.trim() ? translateUi("中段风险：{{v0}}", { v0: volume.midVolumeRisk.trim() }) : "",
        volume.climax?.trim() ? translateUi("卷末高潮：{{v0}}", { v0: volume.climax.trim() }) : "",
        volume.payoffType?.trim() ? translateUi("兑现类型：{{v0}}", { v0: volume.payoffType.trim() }) : "",
        volume.nextVolumeHook?.trim() ? translateUi("下卷钩子：{{v0}}", { v0: volume.nextVolumeHook.trim() }) : "",
        volume.resetPoint?.trim() ? translateUi("重置点：{{v0}}", { v0: volume.resetPoint.trim() }) : "",
        volume.openPayoffs.length > 0 ? translateUi("未兑现事项：{{v0}}", { v0: volume.openPayoffs.join("；") }) : "",
        translateUi("章节范围：{{v0}}", { v0: chapterSpan }),
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function buildStructuredPreviewFromVolumes(volumes: VolumePlan[]): string {
  return JSON.stringify({
    volumes: normalizeVolumeDraft(volumes).map((volume) => ({
      volumeTitle: volume.title,
      summary: volume.summary || undefined,
      openingHook: volume.openingHook || undefined,
      mainPromise: volume.mainPromise || undefined,
      primaryPressureSource: volume.primaryPressureSource || undefined,
      coreSellingPoint: volume.coreSellingPoint || undefined,
      escalationMode: volume.escalationMode || undefined,
      protagonistChange: volume.protagonistChange || undefined,
      midVolumeRisk: volume.midVolumeRisk || undefined,
      climax: volume.climax || undefined,
      payoffType: volume.payoffType || undefined,
      nextVolumeHook: volume.nextVolumeHook || undefined,
      resetPoint: volume.resetPoint || undefined,
      openPayoffs: volume.openPayoffs,
      chapters: volume.chapters.map((chapter) => ({
        chapter_id: chapter.chapterId ?? undefined,
        order: chapter.chapterOrder,
        beat_key: chapter.beatKey ?? undefined,
        title: chapter.title,
        summary: chapter.summary,
        purpose: chapter.purpose || undefined,
        conflict_level: chapter.conflictLevel ?? undefined,
        reveal_level: chapter.revealLevel ?? undefined,
        target_word_count: chapter.targetWordCount ?? undefined,
        must_avoid: chapter.mustAvoid || undefined,
        task_sheet: chapter.taskSheet || undefined,
        payoff_refs: chapter.payoffRefs,
      })),
    })),
  }, null, 2);
}

export function applyVolumeChapterBatch(
  volumes: VolumePlan[],
  patch: {
    conflictLevel?: number;
    targetWordCount?: number;
    generateTaskSheet?: boolean;
  },
): VolumePlan[] {
  return normalizeVolumeDraft(volumes).map((volume) => ({
    ...volume,
    chapters: volume.chapters.map((chapter) => {
      const nextChapter: VolumeChapterPlan = { ...chapter };
      if (typeof patch.conflictLevel === "number") {
        nextChapter.conflictLevel = Math.max(0, Math.min(100, Math.round(patch.conflictLevel)));
      }
      if (typeof patch.targetWordCount === "number") {
        nextChapter.targetWordCount = Math.max(200, Math.round(patch.targetWordCount));
      }
      if (patch.generateTaskSheet) {
        nextChapter.taskSheet = buildTaskSheetFromVolumeChapter(nextChapter);
      }
      return nextChapter;
    }),
  }));
}

function compareText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

function compareNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  return (typeof a === "number" ? a : null) === (typeof b === "number" ? b : null);
}

function getChangedFields(existing: ExistingOutlineChapter, chapter: VolumeChapterPlan, action: "update" | "move"): string[] {
  const changed: string[] = action === "move" ? [translateUi("章节顺序")] : [];
  if (!compareText(existing.title, chapter.title)) changed.push(translateUi("标题"));
  if (!compareText(existing.expectation, chapter.summary)) changed.push(translateUi("摘要"));
  if (!compareNumber(existing.targetWordCount, chapter.targetWordCount)) changed.push(translateUi("目标字数"));
  if (!compareNumber(existing.conflictLevel, chapter.conflictLevel)) changed.push(translateUi("冲突等级"));
  if (!compareNumber(existing.revealLevel, chapter.revealLevel)) changed.push(translateUi("揭露等级"));
  if (!compareText(existing.mustAvoid, chapter.mustAvoid)) changed.push(translateUi("禁止事项"));
  if (!compareText(existing.taskSheet, chapter.taskSheet)) changed.push(translateUi("任务单"));
  return changed;
}

export function buildVolumeSyncPreview(
  volumes: VolumePlan[],
  existingChapters: ExistingOutlineChapter[],
  options: VolumeSyncOptions,
): VolumeSyncPreview {
  const normalizedVolumes = normalizeVolumeDraft(volumes);
  const flattened = normalizedVolumes.flatMap((volume) => volume.chapters.map((chapter) => ({ volume, chapter })));
  const existingById = new Map(existingChapters.map((chapter) => [chapter.id, chapter]));
  const existingByOrder = new Map(existingChapters.map((chapter) => [chapter.order, chapter]));
  const existingByTitle = new Map(existingChapters.map((chapter) => [chapter.title.trim().toLowerCase(), chapter]));
  const matchedChapterIds = new Set<string>();
  const items: VolumeSyncPreview["items"] = [];
  let createCount = 0;
  let updateCount = 0;
  let keepCount = 0;
  let moveCount = 0;
  let deleteCount = 0;
  let deleteCandidateCount = 0;
  let affectedGeneratedCount = 0;
  let clearContentCount = 0;

  for (const entry of flattened) {
    const linkedChapterId = entry.chapter.chapterId?.trim();
    const matchedById = linkedChapterId ? existingById.get(linkedChapterId) : undefined;
    const existing = matchedById && !matchedChapterIds.has(matchedById.id)
      ? matchedById
      : (() => {
        if (linkedChapterId) {
          return undefined;
        }
        const existingBySameOrder = existingByOrder.get(entry.chapter.chapterOrder);
        const matchedByOrder = existingBySameOrder && !matchedChapterIds.has(existingBySameOrder.id)
          ? existingBySameOrder
          : undefined;
        const matchedByTitle = existingByTitle.get(entry.chapter.title.trim().toLowerCase());
        return matchedByOrder ?? (
          matchedByTitle && !matchedChapterIds.has(matchedByTitle.id)
            ? matchedByTitle
            : undefined
        );
      })();

    if (!existing) {
      createCount += 1;
      items.push({
        action: "create",
        volumeTitle: entry.volume.title,
        chapterOrder: entry.chapter.chapterOrder,
        nextTitle: entry.chapter.title,
        hasContent: false,
        changedFields: [translateUi("新章节")],
      });
      continue;
    }

    matchedChapterIds.add(existing.id);
    const action = existing.order === entry.chapter.chapterOrder ? "update" : "move";
    const changedFields = getChangedFields(existing, entry.chapter, action);
    const hasContent = Boolean(existing.content?.trim());
    if (changedFields.length === 0) {
      keepCount += 1;
      items.push({
        action: "keep",
        volumeTitle: entry.volume.title,
        chapterOrder: entry.chapter.chapterOrder,
        nextTitle: entry.chapter.title,
        previousTitle: existing.title,
        hasContent,
        changedFields: [],
      });
      continue;
    }

    if (action === "move") {
      moveCount += 1;
    } else {
      updateCount += 1;
    }
    if (hasContent) {
      affectedGeneratedCount += 1;
      if (!options.preserveContent) {
        clearContentCount += 1;
      }
    }
    items.push({
      action,
      volumeTitle: entry.volume.title,
      chapterOrder: entry.chapter.chapterOrder,
      nextTitle: entry.chapter.title,
      previousTitle: existing.title,
      hasContent,
      changedFields,
    });
  }

  for (const chapter of existingChapters.slice().sort((a, b) => a.order - b.order)) {
    if (matchedChapterIds.has(chapter.id)) {
      continue;
    }
    const hasContent = Boolean(chapter.content?.trim());
    if (options.applyDeletes) {
      deleteCount += 1;
      items.push({
        action: "delete",
        volumeTitle: translateUi("未匹配"),
        chapterOrder: chapter.order,
        nextTitle: chapter.title,
        previousTitle: chapter.title,
        hasContent,
        changedFields: [translateUi("从卷纲移除")],
      });
    } else {
      deleteCandidateCount += 1;
      items.push({
        action: "delete_candidate",
        volumeTitle: translateUi("未匹配"),
        chapterOrder: chapter.order,
        nextTitle: chapter.title,
        previousTitle: chapter.title,
        hasContent,
        changedFields: [translateUi("待确认删除")],
      });
    }
  }

  return {
    createCount,
    updateCount,
    keepCount,
    moveCount,
    deleteCount,
    deleteCandidateCount,
    affectedGeneratedCount,
    clearContentCount,
    affectedVolumeCount: new Set(items.filter((item) => item.action !== "keep").map((item) => item.volumeTitle)).size,
    items,
  };
}
