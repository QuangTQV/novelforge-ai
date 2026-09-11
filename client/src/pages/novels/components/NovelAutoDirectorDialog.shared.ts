import { translateUi } from "../../../i18n/legacy.ts";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { normalizeCommercialTags } from "@ai-novel/shared/types/novelFraming";
import type { DirectorRunMode, DirectorWorldSetupMode } from "@ai-novel/shared/types/novelDirector";
import type { NovelBasicFormState } from "../novelBasicInfo.shared";

const MAX_REFERENCE_WORK_TITLES = 5;
const REFERENCE_WORK_TITLE_MAX_LENGTH = 120;

export function normalizeReferenceWorkTitles(input: string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of input.split(/[\n,，]/)) {
    const title = raw.replace(/\s+/g, " ").trim().slice(0, REFERENCE_WORK_TITLE_MAX_LENGTH);
    if (!title || seen.has(title.toLowerCase())) {
      continue;
    }
    seen.add(title.toLowerCase());
    normalized.push(title);
    if (normalized.length >= MAX_REFERENCE_WORK_TITLES) {
      break;
    }
  }
  return normalized;
}

export interface DirectorRunModeOption {
  value: DirectorRunMode;
  label: string;
  description: string;
  recommended?: boolean;
  recommendation?: string;
}

export const RUN_MODE_OPTIONS: DirectorRunModeOption[] = [
  {
    value: "auto_to_execution",
    label: translateUi("先试写前几章"),
    description: translateUi("AI 完成书级规划后，只生成开头设定的前几章正文就停下，方便你先检查质量。"),
    recommended: true,
    recommendation: translateUi("质量满意后，可在小说页用「继续」或流水线功能接着往下写。"),
  },
  {
    value: "full_book_autopilot",
    label: translateUi("直接写完整本书"),
    description: translateUi("AI 完成规划后自动连续生成全书章节，直到写完或遇到需要人工处理的问题。"),
  },
  {
    value: "auto_to_ready",
    label: translateUi("只做规划，不写章节"),
    description: translateUi("AI 只准备书级规划、角色、卷章安排和章节执行资源，正文一章都不生成，之后由你决定如何生产。"),
  },
];

export const DEFAULT_VISIBLE_RUN_MODE: DirectorRunMode = "auto_to_execution";

export interface AutoDirectorRequestLlmOptions {
  provider: LLMProvider;
  model: string;
  temperature?: number;
}

export function buildInitialIdea(basicForm: NovelBasicFormState): string {
  const lines = [
    basicForm.description.trim(),
    basicForm.title.trim() ? translateUi("我想写一本暂名为《{{v0}}》的小说。", { v0: basicForm.title.trim() }) : "",
    basicForm.styleTone.trim() ? translateUi("文风希望偏 {{v0}}。", { v0: basicForm.styleTone.trim() }) : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildAutoDirectorRequestPayload(
  basicForm: NovelBasicFormState,
  idea: string,
  llm: AutoDirectorRequestLlmOptions,
  runMode: DirectorRunMode,
  workflowTaskId?: string,
  options?: {
    styleProfileId?: string;
    worldSetupMode?: DirectorWorldSetupMode;
    marketBriefId?: string;
    referenceWorkTitles?: string[];
  },
) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    idea: idea.trim(),
    workflowTaskId: workflowTaskId || undefined,
    marketBriefId: options?.marketBriefId?.trim() || undefined,
    referenceWorkTitles: options?.referenceWorkTitles && options.referenceWorkTitles.length > 0
      ? options.referenceWorkTitles
      : undefined,
    title: basicForm.title.trim() || undefined,
    description: basicForm.description.trim() || undefined,
    targetAudience: basicForm.targetAudience.trim() || undefined,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || undefined,
    competingFeel: basicForm.competingFeel.trim() || undefined,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || undefined,
    commercialTags: commercialTags.length > 0 ? commercialTags : undefined,
    genreId: basicForm.genreId || undefined,
    primaryStoryModeId: basicForm.primaryStoryModeId || undefined,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || undefined,
    worldId: basicForm.worldId || undefined,
    worldSetupMode: basicForm.worldId ? undefined : options?.worldSetupMode ?? "auto_generate",
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    readerChannelPreference: basicForm.readerChannelPreference,
    writingPlatformPreference: basicForm.writingPlatformPreference,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    novelLanguage: basicForm.novelLanguage,
    styleFlavor: basicForm.styleFlavor,
    styleTone: basicForm.styleTone.trim() || undefined,
    styleProfileId: options?.styleProfileId?.trim() || undefined,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    estimatedChapterCount: basicForm.estimatedChapterCount,
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.sourceNovelId || undefined,
    sourceKnowledgeDocumentId: basicForm.sourceKnowledgeDocumentId || undefined,
    continuationBookAnalysisId: basicForm.continuationBookAnalysisId || undefined,
    continuationBookAnalysisSections: basicForm.continuationBookAnalysisSections.length > 0
      ? basicForm.continuationBookAnalysisSections
      : undefined,
    referenceBookAnalysisId: basicForm.referenceBookAnalysisId || undefined,
    referenceBookAnalysisSections: basicForm.referenceBookAnalysisSections.length > 0
      ? basicForm.referenceBookAnalysisSections
      : undefined,
    provider: llm.provider,
    model: llm.model,
    temperature: llm.temperature,
    runMode,
  };
}
