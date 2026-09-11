import { z } from "zod";
import {
  deriveTwistDefaultsFromCadence,
  STORY_MODE_ENDING_HOOK_STYLES,
  STORY_MODE_FORESHADOW_HOLDS,
  STORY_MODE_MOMENTUM_SOURCES,
  STORY_MODE_TWIST_CADENCES,
  STORY_MODE_TWIST_FAIRNESS_LEVELS,
  STORY_MODE_TWIST_INTENSITIES,
  STORY_MODE_TWIST_MECHANISMS,
  STORY_MODE_TWIST_SCOPES,
  type NovelStoryMode,
  type StoryModeConflictCeiling,
  type StoryModeEndingHookStyle,
  type StoryModeForeshadowHold,
  type StoryModeMomentumSource,
  type StoryModeProfile,
  type StoryModeTwistCadence,
  type StoryModeTwistFairness,
  type StoryModeTwistIntensity,
  type StoryModeTwistMechanism,
  type StoryModeTwistScope,
} from "@ai-novel/shared/types/storyMode";
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
  // Các field động cơ tự sự có default: consumer cũ (marketRadar, user input,
  // profileJson cũ) không cần nêu — sẽ được điền mặc định / suy ra ở sanitize.
  momentumSource: z.enum(STORY_MODE_MOMENTUM_SOURCES as unknown as [string, ...string[]]).default("goal_pursuit"),
  perChapterChangeMenu: z.array(z.string().trim().min(1).max(120)).min(1).max(10).default([
    "Đẩy một mục tiêu giai đoạn rõ ràng",
    "Quan hệ hoặc lập trường thay đổi thấy được",
    "Có thông tin mới hoặc sửa một phán đoán sai",
    "Mức rủi ro hoặc cái giá phải trả tăng lên",
  ]),
  twistCadence: z.enum(STORY_MODE_TWIST_CADENCES as unknown as [string, ...string[]]).default("periodic"),
  twistIntensity: z.enum(STORY_MODE_TWIST_INTENSITIES as unknown as [string, ...string[]]).default("moderate"),
  twistFairness: z.enum(STORY_MODE_TWIST_FAIRNESS_LEVELS as unknown as [string, ...string[]]).default("mixed"),
  twistScope: z.enum(STORY_MODE_TWIST_SCOPES as unknown as [string, ...string[]]).default("relationship_betrayal"),
  allowedTwistMechanisms: z.array(z.enum(STORY_MODE_TWIST_MECHANISMS as unknown as [string, ...string[]])).max(7).default(["hidden_motive", "betrayal"]),
  foreshadowHold: z.enum(STORY_MODE_FORESHADOW_HOLDS as unknown as [string, ...string[]]).default("arc"),
  endingHookStyle: z.enum(STORY_MODE_ENDING_HOOK_STYLES as unknown as [string, ...string[]]).default("cliffhanger"),
}).strict();

const DEFAULT_STORY_MODE_PROFILE: StoryModeProfile = {
    coreDrive: "Duy trì sức hút đường dài bằng cách liên tục đáp ứng điều người đọc mong đợi.",
  readerReward: "Cứ vài chương lại nhận được một cảm giác thoả mãn rõ ràng, cảm nhận được.",
  progressionUnits: ["Đẩy một quan hệ then chốt tiến lên", "Trả một mục tiêu theo giai đoạn"],
  allowedConflictForms: ["Xung đột cường độ vừa và thấp, ăn khớp với động lực chính"],
  forbiddenConflictForms: ["Xung đột cẩu huyết cao áp không liên quan"],
  conflictCeiling: "medium",
  resolutionStyle: "Ưu tiên hoá giải vấn đề theo cách hợp với mode này, không gượng ép leo thang.",
    chapterUnit: "Mỗi chương cần có một diễn biến chính rõ ràng.",
  volumeReward: "Cuối tập trả một kết quả theo giai đoạn, ăn khớp với mode.",
  mandatorySignals: ["Động lực chính xuất hiện liên tục", "Kỳ vọng của người đọc được xác nhận lặp lại"],
  antiSignals: ["Lệch khỏi động lực chính trong thời gian dài", "Cường độ xung đột vượt tầm kiểm soát"],
  momentumSource: "goal_pursuit",
  perChapterChangeMenu: [
    "Đẩy một mục tiêu giai đoạn rõ ràng",
    "Quan hệ hoặc lập trường thay đổi thấy được",
    "Có thông tin mới hoặc sửa một phán đoán sai",
    "Mức rủi ro hoặc cái giá phải trả tăng lên",
  ],
  twistCadence: "periodic",
  twistIntensity: "moderate",
  twistFairness: "mixed",
  twistScope: "relationship_betrayal",
  allowedTwistMechanisms: ["hidden_motive", "betrayal"],
  foreshadowHold: "arc",
  endingHookStyle: "cliffhanger",
};

/**
 * Suy ra 5 field động cơ tự sự từ `conflictCeiling` khi profile cũ (đã persist
 * trong DB trước khi có các field này) không có chúng.
 */
function inferEngineFieldsFromCeiling(ceiling: StoryModeConflictCeiling): {
  twistCadence: StoryModeTwistCadence;
  foreshadowHold: StoryModeForeshadowHold;
  endingHookStyle: StoryModeEndingHookStyle;
} {
  if (ceiling === "low") {
    return { twistCadence: "rare", foreshadowHold: "short", endingHookStyle: "emotional_pull" };
  }
  if (ceiling === "high") {
    return { twistCadence: "periodic", foreshadowHold: "arc", endingHookStyle: "escalation" };
  }
  return { twistCadence: "periodic", foreshadowHold: "arc", endingHookStyle: "cliffhanger" };
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

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

function normalizeEnumList<T extends string>(value: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = Array.from(new Set(
    value.filter((item): item is T => typeof item === "string" && (allowed as readonly string[]).includes(item)),
  )).slice(0, allowed.length);
  return normalized.length > 0 ? normalized : fallback;
}

export function sanitizeStoryModeProfile(value: unknown): StoryModeProfile {
  if (!value || typeof value !== "object") {
    return DEFAULT_STORY_MODE_PROFILE;
  }
  const record = value as Partial<StoryModeProfile>;
  const ceiling = normalizeConflictCeiling(record.conflictCeiling);
  const inferred = inferEngineFieldsFromCeiling(ceiling);
  const resolvedTwistCadence = normalizeEnum(record.twistCadence, STORY_MODE_TWIST_CADENCES, inferred.twistCadence);
  const twistDefaults = deriveTwistDefaultsFromCadence(resolvedTwistCadence);
  return storyModeProfileSchema.parse({
    coreDrive: normalizeText(record.coreDrive, DEFAULT_STORY_MODE_PROFILE.coreDrive),
    readerReward: normalizeText(record.readerReward, DEFAULT_STORY_MODE_PROFILE.readerReward),
    progressionUnits: normalizeList(record.progressionUnits, DEFAULT_STORY_MODE_PROFILE.progressionUnits),
    allowedConflictForms: normalizeList(record.allowedConflictForms, DEFAULT_STORY_MODE_PROFILE.allowedConflictForms),
    forbiddenConflictForms: normalizeList(record.forbiddenConflictForms, DEFAULT_STORY_MODE_PROFILE.forbiddenConflictForms),
    conflictCeiling: ceiling,
    resolutionStyle: normalizeText(record.resolutionStyle, DEFAULT_STORY_MODE_PROFILE.resolutionStyle),
    chapterUnit: normalizeText(record.chapterUnit, DEFAULT_STORY_MODE_PROFILE.chapterUnit),
    volumeReward: normalizeText(record.volumeReward, DEFAULT_STORY_MODE_PROFILE.volumeReward),
    mandatorySignals: normalizeList(record.mandatorySignals, DEFAULT_STORY_MODE_PROFILE.mandatorySignals),
    antiSignals: normalizeList(record.antiSignals, DEFAULT_STORY_MODE_PROFILE.antiSignals),
    momentumSource: normalizeEnum(record.momentumSource, STORY_MODE_MOMENTUM_SOURCES, DEFAULT_STORY_MODE_PROFILE.momentumSource),
    perChapterChangeMenu: normalizeList(record.perChapterChangeMenu, DEFAULT_STORY_MODE_PROFILE.perChapterChangeMenu).slice(0, 10),
    twistCadence: resolvedTwistCadence,
    twistIntensity: normalizeEnum(record.twistIntensity, STORY_MODE_TWIST_INTENSITIES, twistDefaults.twistIntensity),
    twistFairness: normalizeEnum(record.twistFairness, STORY_MODE_TWIST_FAIRNESS_LEVELS, twistDefaults.twistFairness),
    twistScope: normalizeEnum(record.twistScope, STORY_MODE_TWIST_SCOPES, twistDefaults.twistScope),
    allowedTwistMechanisms: normalizeEnumList(record.allowedTwistMechanisms, STORY_MODE_TWIST_MECHANISMS, twistDefaults.allowedTwistMechanisms),
    foreshadowHold: normalizeEnum(record.foreshadowHold, STORY_MODE_FORESHADOW_HOLDS, inferred.foreshadowHold),
    endingHookStyle: normalizeEnum(record.endingHookStyle, STORY_MODE_ENDING_HOOK_STYLES, inferred.endingHookStyle),
  }) as StoryModeProfile;
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
  momentumSource: string;
  perChapterChangeMenu: string;
  twistCadence: string;
  twistIntensity: string;
  twistFairness: string;
  twistScope: string;
  allowedTwistMechanisms: string;
  foreshadowHold: string;
  endingHookStyle: string;
  engineNote: string;
  primaryUsage: string;
  secondaryUsage: string;
  listSeparator: string;
  colon: string;
  ceiling: Record<StoryModeConflictCeiling, string>;
  momentum: Record<StoryModeMomentumSource, string>;
  cadence: Record<StoryModeTwistCadence, string>;
  intensity: Record<StoryModeTwistIntensity, string>;
  fairness: Record<StoryModeTwistFairness, string>;
  scope: Record<StoryModeTwistScope, string>;
  mechanism: Record<StoryModeTwistMechanism, string>;
  hold: Record<StoryModeForeshadowHold, string>;
  hook: Record<StoryModeEndingHookStyle, string>;
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
    momentumSource: "章节推进动力来源",
    perChapterChangeMenu: "每章可选的状态变化清单",
    twistCadence: "反转/揭示密度",
    twistIntensity: "反转力度",
    twistFairness: "反转公平度",
    twistScope: "反转波及层级",
    allowedTwistMechanisms: "允许的反转手法",
    foreshadowHold: "伏笔保留时长",
    endingHookStyle: "章末钩子类型",
    engineNote: "叙事引擎要求：本次规划与写作必须遵守下方九项叙事引擎字段（推进动力来源 / 状态变化清单 / 反转密度、力度、公平度、波及层级与手法 / 伏笔保留时长 / 章末钩子类型），其优先级高于泛化叙事习惯；具体执行规则由拆章与写章步骤给出。",
    primaryUsage: "使用要求：后续规划与生成必须优先服从这一模式。",
    secondaryUsage: "使用要求：只能作为补充风味，不得破坏主模式的边界。",
    listSeparator: "、",
    colon: "：",
    ceiling: { low: "低（low）", medium: "中（medium）", high: "高（high）" },
    momentum: {
      relationship_emotion: "关系与情绪",
      information_revelation: "信息揭示节奏",
      power_escalation: "实力/优势升级",
      survival_pressure: "生存压力",
      worldbuilding_expansion: "世界与格局扩展",
      goal_pursuit: "目标追逐",
      comedic_situation: "喜剧情境",
      management_growth: "经营与建设成长",
    },
    cadence: {
      none: "none（几乎无反转）",
      rare: "rare（每 arc 至多一次，主要靠情绪推进）",
      periodic: "periodic（每 arc 数次阶段性转折）",
      dense: "dense（高频真相分层与认知反转，至少一次重构旧信息）",
    },
    intensity: {
      mild: "mild（轻微意外，不改变大局判断）",
      moderate: "moderate（改写一条线索或一段关系的理解）",
      severe: "severe（颠覆核心认知，重构对整个故事的理解）",
    },
    fairness: {
      clued: "clued（必须提前埋下可回溯的线索，读者有机会猜到）",
      mixed: "mixed（部分提前埋线索，部分允许突然揭示）",
      blindside: "blindside（允许不提前铺垫，直接以突袭方式揭示）",
    },
    scope: {
      personal_secret: "personal_secret（个人隐藏的秘密或身份）",
      relationship_betrayal: "relationship_betrayal（人物关系中的背叛或错认）",
      faction_politics: "faction_politics（阵营/组织层面的立场或阴谋反转）",
      worldview_shattering: "worldview_shattering（颠覆对世界规则或整体格局的认知）",
    },
    mechanism: {
      identity_concealment: "identity_concealment（身份隐藏/伪装）",
      betrayal: "betrayal（背叛/倒戈）",
      hidden_motive: "hidden_motive（隐藏动机被揭穿）",
      unreliable_narrator: "unreliable_narrator（叙述视角本身不可靠）",
      false_death: "false_death（诈死/伪装死亡）",
      reality_break: "reality_break（时间线或现实规则被打破）",
      other: "other（放开限制，允许 AI 自由发挥列表之外的反转手法）",
    },
    hold: {
      short: "short（数章内兑现）",
      arc: "arc（本 arc 末兑现）",
      cross_arc: "cross_arc（跨多个 arc 长期保留）",
    },
    hook: {
      emotional_pull: "emotional_pull（情绪牵引 / 未完成的心动或抉择）",
      cliffhanger: "cliffhanger（悬置的危机或未解局面）",
      revelation: "revelation（结尾一句揭示 / 认知反转）",
      escalation: "escalation（压力或威胁升级）",
      decision: "decision（角色被迫做出关键选择）",
    },
  },
  vi: {
    header: "Ràng buộc mô thức: mô thức chính là nguyên tắc bắt buộc; mô thức phụ chỉ bổ sung màu sắc và không được phá vỡ giới hạn xung đột của mô thức chính.",
    primaryLabel: "Mode chính",
    secondaryLabel: "Mode phụ",
    description: "Mô tả",
    template: "Mẫu bổ sung",
    coreDrive: "Động lực chính",
    readerReward: "Điều người đọc nhận được",
    chapterUnit: "Diễn biến chính mỗi chương",
    volumeReward: "Kết quả đạt được cuối tập",
    allowedConflictForms: "Dạng xung đột cho phép",
    forbiddenConflictForms: "Dạng xung đột bị cấm",
    conflictCeiling: "Mức độ xung đột tối đa",
    resolutionStyle: "Cách hoá giải",
    mandatorySignals: "Tín hiệu bắt buộc lặp lại",
    antiSignals: "Điều cần tránh",
    progressionUnits: "Các chặng phát triển chính",
    momentumSource: "Động lực thúc đẩy mỗi chương",
    perChapterChangeMenu: "Những thay đổi được phép xảy ra trong mỗi chương",
    twistCadence: "Tần suất đảo chiều / hé lộ",
    twistIntensity: "Mức độ bất ngờ",
    twistFairness: "Mức độ có thể đoán trước",
    twistScope: "Phạm vi bị đảo chiều tác động",
    allowedTwistMechanisms: "Cơ chế lật được phép dùng",
    foreshadowHold: "Thời gian giữ manh mối",
    endingHookStyle: "Kiểu kết chương khiến người đọc muốn đọc tiếp",
    engineNote: "Khi lập kế hoạch và viết, hệ thống phải tuân theo 9 thiết lập kể chuyện bên dưới: động lực phát triển, thay đổi trong từng chương, tần suất và mức độ đảo chiều, phạm vi tác động, cách cài manh mối và kiểu kết chương. Các thiết lập này được ưu tiên hơn những thói quen kể chuyện chung chung.",
    primaryUsage: "Yêu cầu sử dụng: mọi bước lập kế hoạch và tạo sinh về sau phải ưu tiên tuân theo mode này.",
    secondaryUsage: "Yêu cầu sử dụng: chỉ dùng như phong vị bổ sung, không được phá vỡ ranh giới của mode chính.",
    listSeparator: ", ",
    colon: ": ",
    ceiling: { low: "thấp (low)", medium: "trung bình (medium)", high: "cao (high)" },
    momentum: {
      relationship_emotion: "quan hệ & cảm xúc",
      information_revelation: "nhịp hé lộ thông tin",
      power_escalation: "nâng cấp sức mạnh/ưu thế",
      survival_pressure: "áp lực sinh tồn",
      worldbuilding_expansion: "mở rộng thế giới và thế lực",
      goal_pursuit: "đuổi theo mục tiêu",
      comedic_situation: "tình huống hài",
      management_growth: "kinh doanh & xây dựng phát triển",
    },
    cadence: {
      none: "none (gần như không đảo chiều)",
      rare: "rare (tối đa 1 lần mỗi arc, chủ yếu đẩy bằng cảm xúc)",
      periodic: "periodic (vài lần chuyển hướng theo giai đoạn mỗi arc)",
      dense: "dense (hé lộ nhiều lớp và thường xuyên làm thay đổi cách hiểu về thông tin cũ)",
    },
    intensity: {
      mild: "mild (bất ngờ nhẹ, không đổi phán đoán tổng thể)",
      moderate: "moderate (viết lại cách hiểu một manh mối hoặc một mối quan hệ)",
      severe: "severe (lật đổ nhận thức cốt lõi, viết lại cách hiểu cả câu chuyện)",
    },
    fairness: {
      clued: "clued (bắt buộc cài mồi có thể truy lại trước, người đọc có cơ hội đoán được)",
      mixed: "mixed (một phần cài mồi trước, một phần được phép hé lộ đột ngột)",
      blindside: "blindside (được phép không cài mồi trước, hé lộ trực tiếp kiểu bất ngờ)",
    },
    scope: {
      personal_secret: "personal_secret (bí mật hoặc danh tính cá nhân bị giấu)",
      relationship_betrayal: "relationship_betrayal (phản bội hoặc nhận lầm trong quan hệ nhân vật)",
      faction_politics: "faction_politics (đảo chiều lập trường hoặc âm mưu cấp phe phái/tổ chức)",
      worldview_shattering: "worldview_shattering (lật đổ cách hiểu về luật lệ thế giới hoặc thế cờ chung)",
    },
    mechanism: {
      identity_concealment: "identity_concealment (giấu/ngụy trang danh tính)",
      betrayal: "betrayal (phản bội/trở mặt)",
      hidden_motive: "hidden_motive (động cơ ẩn bị vạch trần)",
      unreliable_narrator: "unreliable_narrator (bản thân góc kể không đáng tin)",
      false_death: "false_death (giả chết)",
      reality_break: "reality_break (dòng thời gian hoặc luật thực tại bị phá vỡ)",
      other: "other (mở giới hạn, cho phép AI tự sáng tạo cơ chế lật ngoài danh sách)",
    },
    hold: {
      short: "short (trả trong vài chương)",
      arc: "arc (trả ở cuối arc này)",
      cross_arc: "cross_arc (giữ lâu qua nhiều arc)",
    },
    hook: {
      emotional_pull: "emotional_pull (níu cảm xúc / khoảnh khắc rung động hoặc lựa chọn dang dở)",
      cliffhanger: "cliffhanger (nguy cơ còn bỏ ngỏ / vấn đề chưa được giải quyết)",
      revelation: "revelation (câu chốt hé lộ / đảo nhận thức)",
      escalation: "escalation (áp lực hoặc đe dọa leo thang)",
      decision: "decision (nhân vật buộc phải ra quyết định then chốt)",
    },
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
    momentumSource: "Per-chapter momentum source",
    perChapterChangeMenu: "Valid per-chapter state-change menu",
    twistCadence: "Reversal / reveal density",
    twistIntensity: "Twist intensity",
    twistFairness: "Twist fairness",
    twistScope: "Twist scope",
    allowedTwistMechanisms: "Allowed twist mechanisms",
    foreshadowHold: "Foreshadow hold duration",
    endingHookStyle: "Chapter-ending hook style",
    engineNote: "Narrative-engine requirement: this planning and writing pass must obey the nine narrative-engine fields below (momentum source / state-change menu / twist density, intensity, fairness, scope and mechanisms / foreshadow hold duration / chapter-ending hook style); they take priority over generic narrative habits. The concrete execution rules are given by the chapter-split and chapter-writing steps.",
    primaryUsage: "Usage requirement: all downstream planning and generation must obey this mode first.",
    secondaryUsage: "Usage requirement: use only as supplementary flavor — do not break the primary mode's boundaries.",
    listSeparator: ", ",
    colon: ": ",
    ceiling: { low: "low", medium: "medium", high: "high" },
    momentum: {
      relationship_emotion: "relationship & emotion",
      information_revelation: "information-revelation cadence",
      power_escalation: "power/advantage escalation",
      survival_pressure: "survival pressure",
      worldbuilding_expansion: "world & scale expansion",
      goal_pursuit: "goal pursuit",
      comedic_situation: "comedic situation",
      management_growth: "management & building growth",
    },
    cadence: {
      none: "none (almost no reversals)",
      rare: "rare (at most once per arc, mostly emotional progression)",
      periodic: "periodic (several phased turns per arc)",
      dense: "dense (high-frequency layered reveals & perception reversals, at least one that recontextualizes earlier info)",
    },
    intensity: {
      mild: "mild (a small surprise that doesn't change the big picture)",
      moderate: "moderate (rewrites the understanding of one thread or one relationship)",
      severe: "severe (overturns core understanding, rewrites how the whole story is read)",
    },
    fairness: {
      clued: "clued (must plant a traceable clue beforehand — the reader has a real chance to guess it)",
      mixed: "mixed (partly clued in advance, partly allowed to surface abruptly)",
      blindside: "blindside (allowed to reveal directly with no prior setup)",
    },
    scope: {
      personal_secret: "personal_secret (a hidden personal secret or identity)",
      relationship_betrayal: "relationship_betrayal (a betrayal or misrecognition within a relationship)",
      faction_politics: "faction_politics (a stance or scheme reversal at the faction/organization level)",
      worldview_shattering: "worldview_shattering (overturns the understanding of the world's rules or overall situation)",
    },
    mechanism: {
      identity_concealment: "identity_concealment (hidden/disguised identity)",
      betrayal: "betrayal (turncoat / switching sides)",
      hidden_motive: "hidden_motive (a concealed motive gets exposed)",
      unreliable_narrator: "unreliable_narrator (the narrating viewpoint itself is untrustworthy)",
      false_death: "false_death (faked death)",
      reality_break: "reality_break (the timeline or the rules of reality are broken)",
      other: "other (lift the restriction — let the AI freely invent twist mechanisms outside the list)",
    },
    hold: {
      short: "short (paid off within a few chapters)",
      arc: "arc (paid off at this arc's end)",
      cross_arc: "cross_arc (held long across multiple arcs)",
    },
    hook: {
      emotional_pull: "emotional_pull (an unresolved feeling or choice)",
      cliffhanger: "cliffhanger (a suspended crisis or unresolved situation)",
      revelation: "revelation (a last-line reveal / perception reversal)",
      escalation: "escalation (rising pressure or threat)",
      decision: "decision (the character is forced into a key choice)",
    },
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
    `${labels.momentumSource}${c}${labels.momentum[profile.momentumSource]}`,
    `${labels.perChapterChangeMenu}${c}${profile.perChapterChangeMenu.join(sep)}`,
    `${labels.twistCadence}${c}${labels.cadence[profile.twistCadence]}`,
    `${labels.twistIntensity}${c}${labels.intensity[profile.twistIntensity]}`,
    `${labels.twistFairness}${c}${labels.fairness[profile.twistFairness]}`,
    `${labels.twistScope}${c}${labels.scope[profile.twistScope]}`,
    profile.allowedTwistMechanisms.length > 0
      ? `${labels.allowedTwistMechanisms}${c}${profile.allowedTwistMechanisms.map((item) => labels.mechanism[item]).join(sep)}`
      : "",
    `${labels.foreshadowHold}${c}${labels.hold[profile.foreshadowHold]}`,
    `${labels.endingHookStyle}${c}${labels.hook[profile.endingHookStyle]}`,
    isPrimary ? labels.engineNote : "",
    isPrimary ? labels.primaryUsage : labels.secondaryUsage,
  ].filter(Boolean).join("\n");
}
