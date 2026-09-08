import { z } from "zod";
import type { NovelStoryMode, StoryModeConflictCeiling, StoryModeProfile } from "@ai-novel/shared/types/storyMode";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";

export const storyModeConflictCeilingSchema = z.enum(["low", "medium", "high"]);

export const storyModeProfileSchema = z.object({
  coreDrive: z.string().trim().min(1).max(300),
  readerReward: z.string().trim().min(1).max(300),
  progressionUnits: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  allowedConflictForms: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  forbiddenConflictForms: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  conflictCeiling: storyModeConflictCeilingSchema,
  resolutionStyle: z.string().trim().min(1).max(300),
  chapterUnit: z.string().trim().min(1).max(300),
  volumeReward: z.string().trim().min(1).max(300),
  mandatorySignals: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  antiSignals: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
}).strict();

const DEFAULT_STORY_MODE_PROFILE: StoryModeProfile = {
  coreDrive: "通过稳定兑现核心阅读期待来推动连载体验。",
  readerReward: "每隔数章都获得清晰、可感知的满足感。",
  progressionUnits: ["关键关系推进", "阶段性目标兑现"],
  allowedConflictForms: ["与主驱动一致的中低烈度冲突"],
  forbiddenConflictForms: ["无关的高压狗血冲突"],
  conflictCeiling: "medium",
  resolutionStyle: "优先使用符合该模式的方式化解问题，而不是强行升级。",
  chapterUnit: "每章围绕一个清晰的推进单位展开。",
  volumeReward: "卷末给出与模式一致的阶段性兑现。",
  mandatorySignals: ["主驱动持续出现", "读者期待被重复确认"],
  antiSignals: ["长期偏离主驱动", "冲突烈度失控"],
};

function normalizeText(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeConflictCeiling(value: unknown): StoryModeConflictCeiling {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : DEFAULT_STORY_MODE_PROFILE.conflictCeiling;
}

export function sanitizeStoryModeProfile(value: unknown): StoryModeProfile {
  if (!value || typeof value !== "object") {
    return DEFAULT_STORY_MODE_PROFILE;
  }
  const record = value as Partial<StoryModeProfile>;
  return storyModeProfileSchema.parse({
    coreDrive: normalizeText(record.coreDrive, DEFAULT_STORY_MODE_PROFILE.coreDrive),
    readerReward: normalizeText(record.readerReward, DEFAULT_STORY_MODE_PROFILE.readerReward),
    progressionUnits: normalizeList(record.progressionUnits, DEFAULT_STORY_MODE_PROFILE.progressionUnits),
    allowedConflictForms: normalizeList(record.allowedConflictForms, DEFAULT_STORY_MODE_PROFILE.allowedConflictForms),
    forbiddenConflictForms: normalizeList(record.forbiddenConflictForms, DEFAULT_STORY_MODE_PROFILE.forbiddenConflictForms),
    conflictCeiling: normalizeConflictCeiling(record.conflictCeiling),
    resolutionStyle: normalizeText(record.resolutionStyle, DEFAULT_STORY_MODE_PROFILE.resolutionStyle),
    chapterUnit: normalizeText(record.chapterUnit, DEFAULT_STORY_MODE_PROFILE.chapterUnit),
    volumeReward: normalizeText(record.volumeReward, DEFAULT_STORY_MODE_PROFILE.volumeReward),
    mandatorySignals: normalizeList(record.mandatorySignals, DEFAULT_STORY_MODE_PROFILE.mandatorySignals),
    antiSignals: normalizeList(record.antiSignals, DEFAULT_STORY_MODE_PROFILE.antiSignals),
  });
}

export function parseStoryModeProfileJson(profileJson: string | null | undefined): StoryModeProfile {
  if (!profileJson?.trim()) {
    return DEFAULT_STORY_MODE_PROFILE;
  }
  try {
    return sanitizeStoryModeProfile(JSON.parse(profileJson));
  } catch {
    return DEFAULT_STORY_MODE_PROFILE;
  }
}

export function serializeStoryModeProfile(profile: unknown): string {
  return JSON.stringify(sanitizeStoryModeProfile(profile));
}

type StoryModeRow = {
  id: string;
  name: string;
  description?: string | null;
  template?: string | null;
  parentId?: string | null;
  profileJson?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function normalizeStoryModeOutput<T extends StoryModeRow>(
  storyMode: T,
): Omit<T, "profileJson" | "createdAt" | "updatedAt"> & NovelStoryMode {
  const { profileJson, createdAt, updatedAt, ...rest } = storyMode;
  return {
    ...rest,
    profile: parseStoryModeProfileJson(profileJson),
    createdAt: typeof createdAt === "string" ? createdAt : createdAt.toISOString(),
    updatedAt: typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString(),
  };
}

interface StoryModeBlockLabels {
  header: string;
  primaryLabel: string;
  secondaryLabel: string;
  description: string;
  template: string;
  coreDrive: string;
  readerReward: string;
  chapterUnit: string;
  volumeReward: string;
  allowedConflictForms: string;
  forbiddenConflictForms: string;
  conflictCeiling: string;
  resolutionStyle: string;
  mandatorySignals: string;
  antiSignals: string;
  progressionUnits: string;
  primaryUsage: string;
  secondaryUsage: string;
  listSeparator: string;
  colon: string;
  ceiling: Record<StoryModeConflictCeiling, string>;
}

const STORY_MODE_BLOCK_LABELS: Record<PromptLanguage, StoryModeBlockLabels> = {
  zh: {
    header: "流派模式约束：主流派模式是硬约束，副流派模式只能补充风味，不能覆盖主模式的冲突上限和禁止信号。",
    primaryLabel: "主流派模式",
    secondaryLabel: "副流派模式",
    description: "说明",
    template: "补充模板",
    coreDrive: "核心驱动",
    readerReward: "读者奖励",
    chapterUnit: "章节推进单位",
    volumeReward: "卷末兑现",
    allowedConflictForms: "允许的冲突形式",
    forbiddenConflictForms: "禁止的冲突形式",
    conflictCeiling: "冲突上限",
    resolutionStyle: "化解方式",
    mandatorySignals: "必须反复出现的信号",
    antiSignals: "必须避免的跑偏信号",
    progressionUnits: "剧情主要推进单位",
    primaryUsage: "使用要求：后续规划与生成必须优先服从这一模式。",
    secondaryUsage: "使用要求：只能作为补充风味，不得破坏主模式的边界。",
    listSeparator: "、",
    colon: "：",
    ceiling: { low: "低（low）", medium: "中（medium）", high: "高（high）" },
  },
  vi: {
    header: "Ràng buộc Story Mode: mode chính là ràng buộc cứng; mode phụ chỉ bổ sung phong vị, không được ghi đè trần xung đột và các tín hiệu cấm của mode chính.",
    primaryLabel: "Mode chính",
    secondaryLabel: "Mode phụ",
    description: "Mô tả",
    template: "Mẫu bổ sung",
    coreDrive: "Động lực cốt lõi",
    readerReward: "Phần thưởng cho người đọc",
    chapterUnit: "Đơn vị đẩy truyện mỗi chương",
    volumeReward: "Phần thưởng cuối tập",
    allowedConflictForms: "Dạng xung đột cho phép",
    forbiddenConflictForms: "Dạng xung đột bị cấm",
    conflictCeiling: "Trần xung đột",
    resolutionStyle: "Cách hoá giải",
    mandatorySignals: "Tín hiệu bắt buộc lặp lại",
    antiSignals: "Tín hiệu lạc đề phải tránh",
    progressionUnits: "Đơn vị đẩy cốt truyện chính",
    primaryUsage: "Yêu cầu sử dụng: mọi bước lập kế hoạch và tạo sinh về sau phải ưu tiên tuân theo mode này.",
    secondaryUsage: "Yêu cầu sử dụng: chỉ dùng như phong vị bổ sung, không được phá vỡ ranh giới của mode chính.",
    listSeparator: ", ",
    colon: ": ",
    ceiling: { low: "thấp (low)", medium: "trung bình (medium)", high: "cao (high)" },
  },
  en: {
    header: "Story-mode constraints: the primary mode is a hard constraint; the secondary mode only adds flavor and must not override the primary mode's conflict ceiling or forbidden signals.",
    primaryLabel: "Primary mode",
    secondaryLabel: "Secondary mode",
    description: "Description",
    template: "Supplementary template",
    coreDrive: "Core drive",
    readerReward: "Reader reward",
    chapterUnit: "Per-chapter unit of advance",
    volumeReward: "Volume-end payoff",
    allowedConflictForms: "Allowed conflict forms",
    forbiddenConflictForms: "Forbidden conflict forms",
    conflictCeiling: "Conflict ceiling",
    resolutionStyle: "Resolution style",
    mandatorySignals: "Mandatory recurring signals",
    antiSignals: "Drift signals to avoid",
    progressionUnits: "Primary plot progression units",
    primaryUsage: "Usage requirement: all downstream planning and generation must obey this mode first.",
    secondaryUsage: "Usage requirement: use only as supplementary flavor — do not break the primary mode's boundaries.",
    listSeparator: ", ",
    colon: ": ",
    ceiling: { low: "low", medium: "medium", high: "high" },
  },
};

export function buildStoryModePromptBlock(input: {
  primary?: (Pick<NovelStoryMode, "id" | "name" | "description" | "template" | "profile">) | null;
  secondary?: (Pick<NovelStoryMode, "id" | "name" | "description" | "template" | "profile">) | null;
  /** Ngôn ngữ nhãn của khối. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  lang?: PromptLanguage;
}): string {
  const labels = STORY_MODE_BLOCK_LABELS[input.lang ?? "zh"];
  const sections: string[] = [];
  if (input.primary) {
    sections.push(formatSingleStoryModeBlock(labels.primaryLabel, input.primary, true, labels));
  }
  if (input.secondary) {
    sections.push(formatSingleStoryModeBlock(labels.secondaryLabel, input.secondary, false, labels));
  }
  if (sections.length === 0) {
    return "";
  }
  return [labels.header, ...sections].join("\n\n");
}

function formatSingleStoryModeBlock(
  label: string,
  storyMode: Pick<NovelStoryMode, "name" | "description" | "template" | "profile">,
  isPrimary: boolean,
  labels: StoryModeBlockLabels,
): string {
  const profile = storyMode.profile;
  const sep = labels.listSeparator;
  const c = labels.colon;
  return [
    `${label}${c}${storyMode.name}`,
    storyMode.description ? `${labels.description}${c}${storyMode.description}` : "",
    storyMode.template ? `${labels.template}${c}${storyMode.template}` : "",
    `${labels.coreDrive}${c}${profile.coreDrive}`,
    `${labels.readerReward}${c}${profile.readerReward}`,
    `${labels.chapterUnit}${c}${profile.chapterUnit}`,
    `${labels.volumeReward}${c}${profile.volumeReward}`,
    `${labels.allowedConflictForms}${c}${profile.allowedConflictForms.join(sep)}`,
    `${labels.forbiddenConflictForms}${c}${profile.forbiddenConflictForms.join(sep)}`,
    `${labels.conflictCeiling}${c}${labels.ceiling[profile.conflictCeiling]}`,
    `${labels.resolutionStyle}${c}${profile.resolutionStyle}`,
    `${labels.mandatorySignals}${c}${profile.mandatorySignals.join(sep)}`,
    `${labels.antiSignals}${c}${profile.antiSignals.join(sep)}`,
    `${labels.progressionUnits}${c}${profile.progressionUnits.join(sep)}`,
    isPrimary ? labels.primaryUsage : labels.secondaryUsage,
  ].filter(Boolean).join("\n");
}
