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

/** Sức nặng / cường độ của mỗi cú lật khi nó xảy ra (độc lập với tần suất). */
export type StoryModeTwistIntensity = "mild" | "moderate" | "severe";

/**
 * Cú lật có bắt buộc được cài mồi công bằng trước (người đọc có cơ hội đoán)
 * hay được phép úp mở thuần tuý rồi mới lật (blindside).
 */
export type StoryModeTwistFairness = "clued" | "mixed" | "blindside";

/** Cú lật chính đánh vào tầng nào của câu chuyện. */
export type StoryModeTwistScope =
  | "personal_secret"
  | "relationship_betrayal"
  | "faction_politics"
  | "worldview_shattering";

/** Cơ chế lật được phép dùng cho mode này. */
export type StoryModeTwistMechanism =
  | "identity_concealment"
  | "betrayal"
  | "hidden_motive"
  | "unreliable_narrator"
  | "false_death"
  | "reality_break";

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

export const STORY_MODE_TWIST_INTENSITIES: readonly StoryModeTwistIntensity[] = [
  "mild",
  "moderate",
  "severe",
] as const;

export const STORY_MODE_TWIST_FAIRNESS_LEVELS: readonly StoryModeTwistFairness[] = [
  "clued",
  "mixed",
  "blindside",
] as const;

export const STORY_MODE_TWIST_SCOPES: readonly StoryModeTwistScope[] = [
  "personal_secret",
  "relationship_betrayal",
  "faction_politics",
  "worldview_shattering",
] as const;

export const STORY_MODE_TWIST_MECHANISMS: readonly StoryModeTwistMechanism[] = [
  "identity_concealment",
  "betrayal",
  "hidden_motive",
  "unreliable_narrator",
  "false_death",
  "reality_break",
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
  /** Sức nặng mỗi cú lật khi nó xảy ra: mild/moderate/severe. */
  twistIntensity: StoryModeTwistIntensity;
  /** Có bắt buộc cài mồi công bằng trước hay được úp mở thuần tuý: clued/mixed/blindside. */
  twistFairness: StoryModeTwistFairness;
  /** Cú lật đánh vào tầng nào: bí mật cá nhân/quan hệ/phe phái/thế giới quan. */
  twistScope: StoryModeTwistScope;
  /** Danh sách cơ chế lật được phép dùng cho mode này. */
  allowedTwistMechanisms: StoryModeTwistMechanism[];
  /** Seed cài cắm giữ bao lâu: short/arc/cross_arc. */
  foreshadowHold: StoryModeForeshadowHold;
  /** Kiểu móc câu cuối chương. */
  endingHookStyle: StoryModeEndingHookStyle;
}

/**
 * Suy ra 4 field kiểm soát plot-twist còn lại từ `twistCadence` khi mode
 * không nêu rõ. Dùng chung bởi seed catalog và bước sanitize/repair profile
 * cũ, để mọi story mode luôn có một bộ giá trị twist nhất quán, hợp lý.
 */
export function deriveTwistDefaultsFromCadence(cadence: StoryModeTwistCadence): {
  twistIntensity: StoryModeTwistIntensity;
  twistFairness: StoryModeTwistFairness;
  twistScope: StoryModeTwistScope;
  allowedTwistMechanisms: StoryModeTwistMechanism[];
} {
  switch (cadence) {
    case "none":
      return {
        twistIntensity: "mild",
        twistFairness: "clued",
        twistScope: "personal_secret",
        allowedTwistMechanisms: [],
      };
    case "rare":
      return {
        twistIntensity: "mild",
        twistFairness: "clued",
        twistScope: "personal_secret",
        allowedTwistMechanisms: ["hidden_motive"],
      };
    case "dense":
      return {
        twistIntensity: "severe",
        twistFairness: "mixed",
        twistScope: "worldview_shattering",
        allowedTwistMechanisms: ["identity_concealment", "betrayal", "hidden_motive", "unreliable_narrator", "reality_break"],
      };
    case "periodic":
    default:
      return {
        twistIntensity: "moderate",
        twistFairness: "mixed",
        twistScope: "relationship_betrayal",
        allowedTwistMechanisms: ["hidden_motive", "betrayal"],
      };
  }
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
