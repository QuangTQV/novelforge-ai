export type StoryModeConflictCeiling = "low" | "medium" | "high";

/** Điều gì đẩy truyện đi từ chương này sang chương kế. */
export type StoryModeMomentumSource =
  | "relationship_emotion"
  | "information_revelation"
  | "power_escalation"
  | "survival_pressure"
  | "worldbuilding_expansion"
  | "goal_pursuit"
  | "comedic_situation"
  | "management_growth";

/** Tần suất "cú lật" (reveal / reversal) trên mỗi arc. */
export type StoryModeTwistCadence = "none" | "rare" | "periodic" | "dense";

/** Seed cài cắm được giữ bao lâu trước khi trả. */
export type StoryModeForeshadowHold = "short" | "arc" | "cross_arc";

/** Kiểu móc câu cuối chương đặc trưng của mode. */
export type StoryModeEndingHookStyle =
  | "emotional_pull"
  | "cliffhanger"
  | "revelation"
  | "escalation"
  | "decision";

export const STORY_MODE_MOMENTUM_SOURCES: readonly StoryModeMomentumSource[] = [
  "relationship_emotion",
  "information_revelation",
  "power_escalation",
  "survival_pressure",
  "worldbuilding_expansion",
  "goal_pursuit",
  "comedic_situation",
  "management_growth",
] as const;

export const STORY_MODE_TWIST_CADENCES: readonly StoryModeTwistCadence[] = [
  "none",
  "rare",
  "periodic",
  "dense",
] as const;

export const STORY_MODE_FORESHADOW_HOLDS: readonly StoryModeForeshadowHold[] = [
  "short",
  "arc",
  "cross_arc",
] as const;

export const STORY_MODE_ENDING_HOOK_STYLES: readonly StoryModeEndingHookStyle[] = [
  "emotional_pull",
  "cliffhanger",
  "revelation",
  "escalation",
  "decision",
] as const;

export interface StoryModeProfile {
  coreDrive: string;
  readerReward: string;
  progressionUnits: string[];
  allowedConflictForms: string[];
  forbiddenConflictForms: string[];
  conflictCeiling: StoryModeConflictCeiling;
  resolutionStyle: string;
  chapterUnit: string;
  volumeReward: string;
  mandatorySignals: string[];
  antiSignals: string[];
  // ── Hồ sơ động cơ tự sự (calibrate toàn bộ pipeline phía sau) ──
  /** Cái gì đẩy truyện chương-qua-chương. */
  momentumSource: StoryModeMomentumSource;
  /** Danh sách "state change" hợp lệ cho mỗi chương của mode này. */
  perChapterChangeMenu: string[];
  /** Bao nhiêu cú lật mỗi arc: none/rare/periodic/dense. */
  twistCadence: StoryModeTwistCadence;
  /** Seed cài cắm giữ bao lâu: short/arc/cross_arc. */
  foreshadowHold: StoryModeForeshadowHold;
  /** Kiểu móc câu cuối chương. */
  endingHookStyle: StoryModeEndingHookStyle;
}

export interface NovelStoryMode {
  id: string;
  name: string;
  description?: string | null;
  template?: string | null;
  parentId?: string | null;
  profile: StoryModeProfile;
  createdAt: string;
  updatedAt: string;
}
