import i18n from "i18next";
import type {
  StoryModeEndingHookStyle,
  StoryModeForeshadowHold,
  StoryModeMomentumSource,
  StoryModeTwistCadence,
} from "@ai-novel/shared/types/storyMode";

type Lang = "zh" | "vi" | "en";

export interface StoryModeEngineLabels {
  sectionTitle: string;
  sectionHint: string;
  momentumSource: string;
  twistCadence: string;
  foreshadowHold: string;
  endingHookStyle: string;
  perChapterChangeMenu: string;
  perChapterChangeMenuEmpty: string;
  perChapterChangeMenuPlaceholder: string;
  momentum: Record<StoryModeMomentumSource, string>;
  cadence: Record<StoryModeTwistCadence, string>;
  hold: Record<StoryModeForeshadowHold, string>;
  hook: Record<StoryModeEndingHookStyle, string>;
}

const LABELS: Record<Lang, StoryModeEngineLabels> = {
  zh: {
    sectionTitle: "叙事引擎",
    sectionHint: "决定这种模式如何逐章推进：靠什么驱动、反转多密、伏笔留多久、章末怎样收尾。",
    momentumSource: "章节推进动力来源",
    twistCadence: "反转/揭示密度",
    foreshadowHold: "伏笔保留时长",
    endingHookStyle: "章末钩子类型",
    perChapterChangeMenu: "每章可选的状态变化",
    perChapterChangeMenuEmpty: "尚未定义每章状态变化",
    perChapterChangeMenuPlaceholder: "每行一种本模式下每章允许发生的状态变化，例如：\n推进一个明确的阶段目标\n关系或立场发生可见变化\n获得新信息或修正误判",
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
      dense: "dense（高频真相分层与认知反转）",
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
    sectionTitle: "Động cơ tự sự",
    sectionHint: "Quy định mode này đẩy truyện qua từng chương thế nào: đẩy bằng gì, đảo chiều dày ra sao, giữ foreshadow bao lâu, cuối chương chốt kiểu gì.",
    momentumSource: "Nguồn lực đẩy truyện mỗi chương",
    twistCadence: "Mật độ đảo chiều / hé lộ",
    foreshadowHold: "Thời gian giữ foreshadow",
    endingHookStyle: "Kiểu móc câu cuối chương",
    perChapterChangeMenu: "State change hợp lệ mỗi chương",
    perChapterChangeMenuEmpty: "Chưa định nghĩa state change mỗi chương",
    perChapterChangeMenuPlaceholder: "Mỗi dòng một loại thay đổi trạng thái được phép xảy ra mỗi chương trong mode này, ví dụ:\nĐẩy một mục tiêu giai đoạn rõ ràng\nQuan hệ hoặc lập trường thay đổi thấy được\nCó thông tin mới hoặc sửa một phán đoán sai",
    momentum: {
      relationship_emotion: "quan hệ & cảm xúc",
      information_revelation: "nhịp hé lộ thông tin",
      power_escalation: "nâng cấp sức mạnh/ưu thế",
      survival_pressure: "áp lực sinh tồn",
      worldbuilding_expansion: "mở rộng thế giới & cục diện",
      goal_pursuit: "đuổi theo mục tiêu",
      comedic_situation: "tình huống hài",
      management_growth: "kinh doanh & xây dựng phát triển",
    },
    cadence: {
      none: "none (gần như không đảo chiều)",
      rare: "rare (tối đa 1 lần mỗi arc, chủ yếu đẩy bằng cảm xúc)",
      periodic: "periodic (vài lần chuyển hướng theo giai đoạn mỗi arc)",
      dense: "dense (hé lộ phân tầng & đảo nhận thức tần suất cao)",
    },
    hold: {
      short: "short (trả trong vài chương)",
      arc: "arc (trả ở cuối arc này)",
      cross_arc: "cross_arc (giữ lâu qua nhiều arc)",
    },
    hook: {
      emotional_pull: "emotional_pull (níu cảm xúc / rung động hoặc lựa chọn dang dở)",
      cliffhanger: "cliffhanger (nguy cơ treo lơ lửng / cục diện chưa giải)",
      revelation: "revelation (câu chốt hé lộ / đảo nhận thức)",
      escalation: "escalation (áp lực hoặc đe dọa leo thang)",
      decision: "decision (nhân vật buộc phải ra quyết định then chốt)",
    },
  },
  en: {
    sectionTitle: "Narrative engine",
    sectionHint: "Defines how this mode advances chapter by chapter: what drives it, how dense the reversals are, how long foreshadowing is held, and how chapters close.",
    momentumSource: "Per-chapter momentum source",
    twistCadence: "Reversal / reveal density",
    foreshadowHold: "Foreshadow hold duration",
    endingHookStyle: "Chapter-ending hook style",
    perChapterChangeMenu: "Valid per-chapter state changes",
    perChapterChangeMenuEmpty: "No per-chapter state changes defined yet",
    perChapterChangeMenuPlaceholder: "One state change allowed per chapter in this mode per line, e.g.:\nAdvance a clear stage goal\nA visible shift in a relationship or stance\nGain new information or correct a misjudgment",
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
      dense: "dense (high-frequency layered reveals & perception reversals)",
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

export function getStoryModeEngineLabels(): StoryModeEngineLabels {
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? "vi").split("-")[0];
  if (lang === "zh") return LABELS.zh;
  if (lang === "en") return LABELS.en;
  return LABELS.vi;
}
