import { translateUi } from "../../i18n/legacy.ts";
import i18n from "../../i18n";
import type { BookAnalysisSectionKey } from "@ai-novel/shared/types/bookAnalysis";
import { formatCommercialTagsInput, normalizeCommercialTags } from "@ai-novel/shared/types/novelFraming";
import type { WritingPlatformPreference } from "@ai-novel/shared/types/writingPlatform";
import { NOVEL_LANGUAGE_VALUES } from "@ai-novel/shared/utils/novelLanguage";
import { DEFAULT_NOVEL_STYLE_FLAVOR } from "@ai-novel/shared/utils/novelStyleFlavor";
import type { NovelLanguage, NovelStyleFlavor } from "@ai-novel/shared/types/novel";

/** Ngôn ngữ novel mặc định khi tạo mới = ngôn ngữ giao diện đang chọn (fallback tiếng Việt). */
export function defaultNovelLanguageFromUi(): NovelLanguage {
  const uiLang = i18n.language?.split("-")[0] ?? "vi";
  if ((NOVEL_LANGUAGE_VALUES as readonly string[]).includes(uiLang)) {
    return uiLang as NovelLanguage;
  }
  return "vi";
}

export interface NovelBasicFormState {
  title: string;
  description: string;
  targetAudience: string;
  bookSellingPoint: string;
  competingFeel: string;
  first30ChapterPromise: string;
  commercialTagsText: string;
  genreId: string;
  genreIds: string[];
  primaryStoryModeId: string;
  secondaryStoryModeId: string;
  worldId: string;
  status: "draft" | "published";
  writingMode: "original" | "continuation";
  projectMode: "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline";
  readerChannelPreference: "ai_judge" | "male_oriented" | "female_oriented" | "general";
  writingPlatformPreference: WritingPlatformPreference;
  narrativePov: "first_person" | "third_person" | "mixed";
  pacePreference: "slow" | "balanced" | "fast";
  styleTone: string;
  emotionIntensity: "low" | "medium" | "high";
  aiFreedom: "low" | "medium" | "high";
  novelLanguage: NovelLanguage;
  styleFlavor: NovelStyleFlavor;
  postGenerationStyleReviewEnabled: boolean;
  defaultChapterLength: number;
  estimatedChapterCount: number;
  projectStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  storylineStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  outlineStatus: "not_started" | "in_progress" | "completed" | "rework" | "blocked";
  resourceReadyScore: number;
  continuationSourceType: "novel" | "knowledge_document";
  sourceNovelId: string;
  sourceKnowledgeDocumentId: string;
  continuationBookAnalysisId: string;
  continuationBookAnalysisSections: BookAnalysisSectionKey[];
  referenceBookAnalysisId: string;
  referenceBookAnalysisSections: BookAnalysisSectionKey[];
}

export interface BasicInfoOption<T extends string> {
  value: T;
  label: string;
  summary: string;
  recommended?: boolean;
}

export const DEFAULT_ESTIMATED_CHAPTER_COUNT = 80;

export const WRITING_MODE_OPTIONS: BasicInfoOption<NovelBasicFormState["writingMode"]>[] = [
  {
    value: "original",
    label: translateUi("原创"),
    summary: translateUi("从零开始创建世界、角色和主线，适合大多数新项目。"),
    recommended: true,
  },
  {
    value: "continuation",
    label: translateUi("续写"),
    summary: translateUi("基于已有小说或知识文档继续创作，后续会优先注入既有设定和拆书内容。"),
  },
];

export const PROJECT_MODE_OPTIONS: BasicInfoOption<NovelBasicFormState["projectMode"]>[] = [
  {
    value: "co_pilot",
    label: translateUi("AI 副驾"),
    summary: translateUi("你定方向，AI 提方案和草稿，适合前期打磨和高频人工决策。"),
    recommended: true,
  },
  {
    value: "ai_led",
    label: translateUi("AI 接管"),
    summary: translateUi("AI 负责主推进，你在关键节点审核，适合已有明确目标的项目。"),
  },
  {
    value: "draft_mode",
    label: translateUi("草稿优先"),
    summary: translateUi("先快速产出文本和方向，结构约束较弱，适合试故事和找感觉。"),
  },
  {
    value: "auto_pipeline",
    label: translateUi("流水线优先"),
    summary: translateUi("适合设定较完整后按规划、生成、审计、修复连续推进。"),
  },
];

export const READER_CHANNEL_OPTIONS: BasicInfoOption<NovelBasicFormState["readerChannelPreference"]>[] = [
  {
    value: "ai_judge",
    label: translateUi("AI 判断"),
    summary: translateUi("让 AI 根据题材、卖点和起始想法判断默认读者频道倾向，适合作为默认选择。"),
    recommended: true,
  },
  {
    value: "male_oriented",
    label: translateUi("男频向"),
    summary: translateUi("更强调目标、升级、竞争、爽点兑现和外部事件推进。"),
  },
  {
    value: "female_oriented",
    label: translateUi("女频向"),
    summary: translateUi("更强调关系线、情绪牵引、人物选择和细腻的阶段性反馈。"),
  },
  {
    value: "general",
    label: translateUi("泛读者 / 不限定"),
    summary: translateUi("不限定频道倾向，让 AI 优先按故事本身和目标读者描述来规划。"),
  },
];

export const WRITING_PLATFORM_OPTIONS: BasicInfoOption<NovelBasicFormState["writingPlatformPreference"]>[] = [
  { value: "ai_recommend", label: translateUi("AI 推荐"), summary: translateUi("AI 根据故事体验、受众和长期推进方式推荐平台写法。"), recommended: true },
  { value: "fanqie_free", label: translateUi("番茄免费网文"), summary: translateUi("快速入戏、移动端短段落、高冲突和明确回报。") },
  { value: "qidian_male", label: translateUi("起点男频"), summary: translateUi("成长目标、资源能力变化、稳定升级和伏笔兑现。") },
  { value: "jinjiang_female", label: translateUi("晋江女频"), summary: translateUi("人物关系、情绪因果、角色声音和关系状态变化。") },
];

export const POV_OPTIONS: BasicInfoOption<NovelBasicFormState["narrativePov"]>[] = [
  {
    value: "third_person",
    label: translateUi("第三人称"),
    summary: translateUi("最稳，适合多角色和复杂主线。"),
    recommended: true,
  },
  {
    value: "first_person",
    label: translateUi("第一人称"),
    summary: translateUi("代入感强，但信息受限，适合强主角视角叙事。"),
  },
  {
    value: "mixed",
    label: translateUi("混合视角"),
    summary: translateUi("更灵活，但更容易失控，适合成熟项目。"),
  },
];

export const NOVEL_LANGUAGE_OPTIONS: BasicInfoOption<NovelLanguage>[] = [
  { value: "vi", label: translateUi("Tiếng Việt"), summary: translateUi("AI sẽ viết chính văn, tên và mô tả bằng tiếng Việt.") },
  { value: "zh", label: translateUi("Tiếng Trung (giản thể)"), summary: translateUi("Ngôn ngữ gốc của hệ thống prompt.") },
  { value: "en", label: translateUi("Tiếng Anh"), summary: translateUi("AI sẽ viết nội dung bằng tiếng Anh.") },
  { value: "ja", label: translateUi("Tiếng Nhật"), summary: translateUi("AI sẽ viết nội dung bằng tiếng Nhật.") },
  { value: "ko", label: translateUi("Tiếng Hàn"), summary: translateUi("AI sẽ viết nội dung bằng tiếng Hàn.") },
  { value: "fr", label: translateUi("Tiếng Pháp"), summary: translateUi("AI sẽ viết nội dung bằng tiếng Pháp.") },
  { value: "es", label: translateUi("Tiếng Tây Ban Nha"), summary: translateUi("AI sẽ viết nội dung bằng tiếng Tây Ban Nha.") },
];

export const NOVEL_STYLE_FLAVOR_OPTIONS: BasicInfoOption<NovelStyleFlavor>[] = [
  {
    value: "manga",
    label: translateUi("Manga (Nhật)"),
    summary: translateUi("Nhịp nhanh, đoạn ngắn, đậm nội tâm nhân vật, kết chương bằng chi tiết gây tò mò."),
    recommended: true,
  },
  {
    value: "manhwa",
    label: translateUi("Manhwa (Hàn)"),
    summary: translateUi("Nhịp rất nhanh, vào thẳng xung đột, kết chương bằng cao trào hoặc cliffhanger."),
  },
  {
    value: "manhua",
    label: translateUi("Manhua (Trung)"),
    summary: translateUi("Nhịp ổn định, giàu bối cảnh và tính toán nội tâm, văn phong trau chuốt vừa phải."),
  },
  {
    value: "none",
    label: translateUi("Không áp dụng"),
    summary: translateUi("Không ép theo phong cách nào, giữ nguyên văn phong mặc định của prompt."),
  },
];

export const PACE_OPTIONS: BasicInfoOption<NovelBasicFormState["pacePreference"]>[] = [
  {
    value: "fast",
    label: translateUi("Nhịp nhanh"),
    summary: translateUi("Vào xung đột sớm, ưu tiên cảnh có hành động, tương tác và điểm móc câu; phù hợp với manga."),
    recommended: true,
  },
  {
    value: "slow",
    label: translateUi("慢节奏"),
    summary: translateUi("更重铺垫、氛围和情绪发酵。"),
  },
  {
    value: "balanced",
    label: translateUi("Nhịp cân bằng"),
    summary: translateUi("Cân bằng cảnh hành động, tương tác nhân vật và phần chuẩn bị cần thiết."),
  },
];

export const EMOTION_OPTIONS: BasicInfoOption<NovelBasicFormState["emotionIntensity"]>[] = [
  {
    value: "medium",
    label: translateUi("中情绪浓度"),
    summary: translateUi("保留起伏但不过载，适合作为默认值。"),
    recommended: true,
  },
  {
    value: "low",
    label: translateUi("低情绪浓度"),
    summary: translateUi("更克制，适合冷静叙事或偏理性作品。"),
  },
  {
    value: "high",
    label: translateUi("高情绪浓度"),
    summary: translateUi("更强调爆发、冲突和强刺激场面。"),
  },
];

export const AI_FREEDOM_OPTIONS: BasicInfoOption<NovelBasicFormState["aiFreedom"]>[] = [
  {
    value: "medium",
    label: translateUi("中自由度"),
    summary: translateUi("允许 AI 在设定内补充细节和局部推进，适合作为默认值。"),
    recommended: true,
  },
  {
    value: "low",
    label: translateUi("低自由度"),
    summary: translateUi("严格按设定和规划执行，适合前期控盘。"),
  },
  {
    value: "high",
    label: translateUi("高自由度"),
    summary: translateUi("允许 AI 主动扩展剧情和细节，适合中后期稳定项目。"),
  },
];

export const PUBLICATION_STATUS_OPTIONS: BasicInfoOption<NovelBasicFormState["status"]>[] = [
  {
    value: "draft",
    label: translateUi("草稿"),
    summary: translateUi("仍在开发和打磨阶段，适合绝大多数项目。"),
    recommended: true,
  },
  {
    value: "published",
    label: translateUi("已发布"),
    summary: translateUi("用于标记已成型或已对外发布的作品。"),
  },
];

export const PROJECT_STATUS_OPTIONS: Array<{ value: NovelBasicFormState["projectStatus"]; label: string }> = [
  { value: "not_started", label: translateUi("未开始") },
  { value: "in_progress", label: translateUi("进行中") },
  { value: "completed", label: translateUi("已完成") },
  { value: "rework", label: translateUi("返工") },
  { value: "blocked", label: translateUi("阻塞") },
];

export const BASIC_INFO_FIELD_HINTS = {
  writingMode: translateUi("决定项目是从零开始，还是基于已有作品继续创作。它会直接影响后续优先使用哪些上下文来源。"),
  targetAudience: translateUi("说明这本书最主要写给谁看。不会写专业人群画像也没关系，按直觉描述即可。"),
  bookSellingPoint: translateUi("写清楚这本书最抓人的点，例如关系拉扯、逆袭爽点、悬念推进或设定新鲜感。"),
  competingFeel: translateUi("写成读者会联想到的阅读感，不是要求你模仿具体作品。"),
  first30ChapterPromise: translateUi("写清楚前 30 章一定要让读者看到什么、爽到什么、相信什么。"),
  commercialTagsText: translateUi("用逗号分隔 3-6 个标签即可，例如逆袭、强冲突、悬念拉满、职场博弈。"),
  projectMode: translateUi("决定你和 AI 的协作方式。会影响后续哪些步骤自动推进、哪些步骤更依赖人工确认。"),
  readerChannelPreference: translateUi("帮助 AI 判断默认爽点、情绪重心和关系线权重。不确定时保持 AI 判断。"),
  narrativePov: translateUi("决定章节生成默认采用哪种叙述视角，也会影响信息分发方式。"),
  novelLanguage: translateUi("Ngôn ngữ AI dùng để viết nội dung tiểu thuyết (chính văn, tên, mô tả). Độc lập với ngôn ngữ giao diện; mặc định lấy theo ngôn ngữ giao diện. Đổi về sau chỉ áp dụng cho nội dung sinh mới."),
  styleFlavor: translateUi("Phong cách kỹ thuật kể chuyện (nhịp độ, cách mở/kết chương) mà AI áp dụng khi viết. Độc lập với ngôn ngữ; đổi về sau chỉ áp dụng cho nội dung sinh mới."),
  pacePreference: translateUi("决定章节规划时是偏铺垫还是偏推进，会影响场景密度和钩子强度。"),
  emotionIntensity: translateUi("决定后续生成时情绪爆发和冲突的频率，不是越高越好。"),
  aiFreedom: translateUi("决定 AI 可以偏离既有规划和设定的程度。前期建议保持低或中。"),
  postGenerationStyleReviewEnabled: translateUi("控制正文生成后的去 AI 味检测与自动修正。生成前的写法和反 AI 提示仍按规则库执行。"),
  defaultChapterLength: translateUi("这是章节规划和生成时的参考字数，不是硬限制。常见推荐值是 2500 到 3500。"),
  estimatedChapterCount: translateUi("这是项目预估的总章节数，会作为结构化大纲、剧情拍点和流水线默认范围的参考，不是硬限制。"),
  resourceReadyScore: translateUi("用于标记设定、角色、主线资料是否充分。数值越高，越适合进入自动化生产阶段。"),
  styleTone: translateUi("写几个关键词即可，例如冷峻、克制、黑色幽默。它会影响生成的语言风格。"),
  genreId: translateUi("题材基底回答“这是什么书”，例如修仙、都市、历史架空。它会影响规划、标题和整体卖点倾向，建议尽量尽早确定。"),
  primaryStoryModeId: translateUi("主推进模式回答“这本书靠什么持续推进和兑现”，例如系统流、无敌流、种田流。后续规划和生成会优先服从它。"),
  secondaryStoryModeId: translateUi("副推进模式只负责补充风味，例如在治愈日常中叠加小店经营感，在无敌流中叠加马甲感，不能覆盖主模式的边界。"),
  worldId: translateUi("这里只记录一个参考样本，方便初始化本书世界。小说生成会优先读取页面上方“本书世界”卡片中的内容。"),
  status: translateUi("只是作品生命周期标记，不影响基础创作能力，但会影响列表和项目管理状态。"),
  continuationSourceType: translateUi("续写时选择是引用站内小说，还是知识库里的文档版本。"),
  continuationBookAnalysis: translateUi("拆书内容会作为高权重结构化上下文，适合续写项目保持风格和设定一致。"),
} satisfies Record<string, string>;

export function createDefaultNovelBasicFormState(): NovelBasicFormState {
  return {
    title: "",
    description: "",
    targetAudience: "",
    bookSellingPoint: "",
    competingFeel: "",
    first30ChapterPromise: "",
    commercialTagsText: "",
    genreId: "",
    genreIds: [],
    primaryStoryModeId: "",
    secondaryStoryModeId: "",
    worldId: "",
    status: "draft",
    writingMode: "original",
    projectMode: "co_pilot",
    readerChannelPreference: "ai_judge",
    writingPlatformPreference: "ai_recommend",
    narrativePov: "third_person",
    pacePreference: "fast",
    styleTone: "",
    emotionIntensity: "high",
    aiFreedom: "medium",
    novelLanguage: defaultNovelLanguageFromUi(),
    styleFlavor: DEFAULT_NOVEL_STYLE_FLAVOR,
    postGenerationStyleReviewEnabled: true,
    defaultChapterLength: 1800,
    estimatedChapterCount: DEFAULT_ESTIMATED_CHAPTER_COUNT,
    projectStatus: "not_started",
    storylineStatus: "not_started",
    outlineStatus: "not_started",
    resourceReadyScore: 0,
    continuationSourceType: "novel",
    sourceNovelId: "",
    sourceKnowledgeDocumentId: "",
    continuationBookAnalysisId: "",
    continuationBookAnalysisSections: [],
    referenceBookAnalysisId: "",
    referenceBookAnalysisSections: [],
  };
}

export function patchNovelBasicForm(
  previous: NovelBasicFormState,
  patch: Partial<NovelBasicFormState>,
): NovelBasicFormState {
  const next = { ...previous, ...patch };
  if (
    next.primaryStoryModeId
    && next.secondaryStoryModeId
    && next.primaryStoryModeId === next.secondaryStoryModeId
  ) {
    next.secondaryStoryModeId = "";
  }
  if (next.writingMode === "original") {
    next.sourceNovelId = "";
    next.sourceKnowledgeDocumentId = "";
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  } else {
    next.referenceBookAnalysisId = "";
    next.referenceBookAnalysisSections = [];
    if (next.continuationSourceType === "novel") {
      next.sourceKnowledgeDocumentId = "";
    } else if (next.continuationSourceType === "knowledge_document") {
      next.sourceNovelId = "";
    }
  }
  if (
    patch.continuationSourceType !== undefined
    && patch.continuationSourceType !== previous.continuationSourceType
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (
    next.continuationSourceType === "novel"
    && patch.sourceNovelId !== undefined
    && patch.sourceNovelId !== previous.sourceNovelId
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (
    next.continuationSourceType === "knowledge_document"
    && patch.sourceKnowledgeDocumentId !== undefined
    && patch.sourceKnowledgeDocumentId !== previous.sourceKnowledgeDocumentId
    && patch.continuationBookAnalysisId === undefined
  ) {
    next.continuationBookAnalysisId = "";
    next.continuationBookAnalysisSections = [];
  }
  if (patch.continuationBookAnalysisId !== undefined && !patch.continuationBookAnalysisId) {
    next.continuationBookAnalysisSections = [];
  }
  return next;
}

export function buildNovelCreatePayload(basicForm: NovelBasicFormState) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    title: basicForm.title.trim(),
    description: basicForm.description.trim() || undefined,
    targetAudience: basicForm.targetAudience.trim() || undefined,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || undefined,
    competingFeel: basicForm.competingFeel.trim() || undefined,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || undefined,
    commercialTags: commercialTags.length > 0 ? commercialTags : undefined,
    genreId: basicForm.genreId || undefined,
    genreIds: basicForm.genreIds.length > 0 ? basicForm.genreIds : undefined,
    primaryStoryModeId: basicForm.primaryStoryModeId || undefined,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || undefined,
    worldId: basicForm.worldId || undefined,
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone.trim() || undefined,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    novelLanguage: basicForm.novelLanguage,
    styleFlavor: basicForm.styleFlavor,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    estimatedChapterCount: basicForm.estimatedChapterCount,
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "novel"
      ? (basicForm.sourceNovelId || undefined)
      : undefined,
    sourceKnowledgeDocumentId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "knowledge_document"
      ? (basicForm.sourceKnowledgeDocumentId || undefined)
      : undefined,
    continuationBookAnalysisId: basicForm.writingMode === "continuation"
      && (
        (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
        || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
      )
      ? (basicForm.continuationBookAnalysisId || undefined)
      : undefined,
    continuationBookAnalysisSections:
      basicForm.writingMode === "continuation"
        && (
          (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
          || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
        )
        && basicForm.continuationBookAnalysisId
        ? (basicForm.continuationBookAnalysisSections.length > 0 ? basicForm.continuationBookAnalysisSections : undefined)
        : undefined,
    referenceBookAnalysisId:
      basicForm.writingMode === "original" ? (basicForm.referenceBookAnalysisId || undefined) : undefined,
    referenceBookAnalysisSections:
      basicForm.writingMode === "original" && basicForm.referenceBookAnalysisId
        ? (basicForm.referenceBookAnalysisSections.length > 0 ? basicForm.referenceBookAnalysisSections : undefined)
        : undefined,
  };
}

export function buildNovelUpdatePayload(basicForm: NovelBasicFormState) {
  const commercialTags = normalizeCommercialTags(basicForm.commercialTagsText);
  return {
    title: basicForm.title,
    description: basicForm.description,
    targetAudience: basicForm.targetAudience.trim() || null,
    bookSellingPoint: basicForm.bookSellingPoint.trim() || null,
    competingFeel: basicForm.competingFeel.trim() || null,
    first30ChapterPromise: basicForm.first30ChapterPromise.trim() || null,
    commercialTags: commercialTags.length > 0 ? commercialTags : null,
    genreId: basicForm.genreId || null,
    genreIds: basicForm.genreIds.length > 0 ? basicForm.genreIds : null,
    primaryStoryModeId: basicForm.primaryStoryModeId || null,
    secondaryStoryModeId: basicForm.secondaryStoryModeId || null,
    worldId: basicForm.worldId || null,
    status: basicForm.status,
    writingMode: basicForm.writingMode,
    projectMode: basicForm.projectMode,
    narrativePov: basicForm.narrativePov,
    pacePreference: basicForm.pacePreference,
    styleTone: basicForm.styleTone || null,
    emotionIntensity: basicForm.emotionIntensity,
    aiFreedom: basicForm.aiFreedom,
    novelLanguage: basicForm.novelLanguage,
    styleFlavor: basicForm.styleFlavor,
    postGenerationStyleReviewEnabled: basicForm.postGenerationStyleReviewEnabled,
    defaultChapterLength: basicForm.defaultChapterLength,
    estimatedChapterCount: basicForm.estimatedChapterCount,
    projectStatus: basicForm.projectStatus,
    storylineStatus: basicForm.storylineStatus,
    outlineStatus: basicForm.outlineStatus,
    resourceReadyScore: basicForm.resourceReadyScore,
    sourceNovelId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "novel"
      ? (basicForm.sourceNovelId || null)
      : null,
    sourceKnowledgeDocumentId: basicForm.writingMode === "continuation" && basicForm.continuationSourceType === "knowledge_document"
      ? (basicForm.sourceKnowledgeDocumentId || null)
      : null,
    continuationBookAnalysisId: basicForm.writingMode === "continuation"
      && (
        (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
        || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
      )
      ? (basicForm.continuationBookAnalysisId || null)
      : null,
    continuationBookAnalysisSections:
      basicForm.writingMode === "continuation"
        && (
          (basicForm.continuationSourceType === "novel" && Boolean(basicForm.sourceNovelId))
          || (basicForm.continuationSourceType === "knowledge_document" && Boolean(basicForm.sourceKnowledgeDocumentId))
        )
        && basicForm.continuationBookAnalysisId
        ? (basicForm.continuationBookAnalysisSections.length > 0 ? basicForm.continuationBookAnalysisSections : null)
        : null,
    referenceBookAnalysisId:
      basicForm.writingMode === "original" ? (basicForm.referenceBookAnalysisId || null) : null,
    referenceBookAnalysisSections:
      basicForm.writingMode === "original" && basicForm.referenceBookAnalysisId
        ? (basicForm.referenceBookAnalysisSections.length > 0 ? basicForm.referenceBookAnalysisSections : null)
        : null,
  };
}

export { formatCommercialTagsInput };
