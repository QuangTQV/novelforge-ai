import { translateUi } from "../../i18n/legacy.ts";
import type {
  CharacterRules,
  LanguageRules,
  NarrativeRules,
  RhythmRules,
} from "@ai-novel/shared/types/styleEngine";
import i18n from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`writingFormulaRules:${key}`, options);

export type RuleSection = "narrativeRules" | "characterRules" | "languageRules" | "rhythmRules";
type RuleObject = NarrativeRules | CharacterRules | LanguageRules | RhythmRules;

export interface RuleEntry {
  key: string;
  label: string;
  value: string;
}

const FIELD_ORDER: Record<RuleSection, string[]> = {
  narrativeRules: [
    "summary",
    "progressionMode",
    "sceneUnitPattern",
    "multiPov",
    "looping",
    "endingStyle",
    "povSwitchStyle",
  ],
  characterRules: [
    "summary",
    "dialogueStyle",
    "emotionExpression",
    "defenseMechanisms",
    "allowSelfReflection",
    "facePriority",
  ],
  languageRules: [
    "summary",
    "register",
    "roughness",
    "sentenceVariation",
    "allowIncompleteSentences",
    "allowSwearing",
    "allowUselessDetails",
  ],
  rhythmRules: [
    "summary",
    "pace",
    "paragraphDensity",
    "allowFragmentedFlow",
    "actionOverExplanation",
  ],
};

const FIELD_LABELS: Record<RuleSection, Record<string, string>> = {
  narrativeRules: {
    summary: translateUi("整体推进感"),
    progressionMode: translateUi("推进方式"),
    sceneUnitPattern: translateUi("场景单位"),
    multiPov: translateUi("多视角"),
    looping: translateUi("循环回钩"),
    endingStyle: translateUi("收尾方式"),
    povSwitchStyle: translateUi("视角切换"),
  },
  characterRules: {
    summary: translateUi("人物表达总述"),
    dialogueStyle: translateUi("对白风格"),
    emotionExpression: translateUi("情绪外显"),
    defenseMechanisms: translateUi("防御机制"),
    allowSelfReflection: translateUi("自省表达"),
    facePriority: translateUi("体面优先"),
  },
  languageRules: {
    summary: translateUi("语言质感总述"),
    register: translateUi("语言基调"),
    roughness: translateUi("粗粝度"),
    sentenceVariation: translateUi("句式变化"),
    allowIncompleteSentences: translateUi("不完整句"),
    allowSwearing: translateUi("粗口口语"),
    allowUselessDetails: translateUi("生活杂音"),
  },
  rhythmRules: {
    summary: translateUi("节奏控制总述"),
    pace: translateUi("推进速度"),
    paragraphDensity: translateUi("段落密度"),
    allowFragmentedFlow: translateUi("碎片化推进"),
    actionOverExplanation: translateUi("动作优先"),
  },
};

const FIELD_VALUE_MAPS: Record<string, Record<string, string>> = {
  progressionMode: {
    time_sequence: translateUi("按时间顺推"),
    goal_driven: translateUi("目标驱动推进"),
    mystery_escalation: translateUi("悬疑逐层加压"),
    relationship_push_pull: translateUi("关系拉扯推进"),
    multi_thread: translateUi("多线交织推进"),
    scene_immersion: translateUi("场景沉浸推进"),
    fact_driven: translateUi("事实驱动推进"),
    contrast_driven: translateUi("反差驱动推进"),
  },
  endingStyle: {
    unresolved: translateUi("不收束核心困境"),
    hook: translateUi("结尾抛钩子"),
    suspense: translateUi("悬念式收尾"),
    emotional_hook: translateUi("情绪钩子收尾"),
    cross_hook: translateUi("交叉线钩子收尾"),
    soft_open: translateUi("柔开放收尾"),
    pressure_continue: translateUi("压力延续式收尾"),
    bitter_aftertaste: translateUi("苦涩余味收尾"),
  },
  povSwitchStyle: {
    controlled: translateUi("受控切换"),
  },
  emotionExpression: {
    behavior_only: translateUi("只通过动作外露"),
    dialogue_and_action: translateUi("对白和动作共同外露"),
    reaction_only: translateUi("主要通过反应外露"),
    subtext: translateUi("通过言外之意外露"),
    mixed: translateUi("对白、动作和反应混合外露"),
    light_behavior: translateUi("以轻动作轻反应外露"),
    suppressed: translateUi("压住不直说"),
    deadpan: translateUi("冷反应式外露"),
  },
  dialogueStyle: {
    short_colloquial: translateUi("短句口语式"),
    direct: translateUi("直接硬朗"),
    restrained: translateUi("克制收着说"),
    subtext_heavy: translateUi("言外之意重"),
    distinct_by_role: translateUi("按角色明显拉开口吻差异"),
    daily_natural: translateUi("日常自然口吻"),
    informational: translateUi("信息型克制对白"),
    deadpan_colloquial: translateUi("冷面口语式"),
  },
  register: {
    colloquial: translateUi("口语化"),
    direct: translateUi("直接明快"),
    restrained: translateUi("克制收束"),
    natural: translateUi("自然日常"),
    flexible: translateUi("随角色灵活变化"),
    professional: translateUi("专业克制"),
  },
  sentenceVariation: {
    high: translateUi("变化大"),
    medium: translateUi("变化适中"),
    medium_high: translateUi("变化偏大"),
  },
  pace: {
    medium_fast: translateUi("中快"),
    fast: translateUi("快"),
    medium: translateUi("中速"),
    medium_slow: translateUi("中慢"),
    balanced: translateUi("均衡"),
    slow: translateUi("慢"),
  },
  paragraphDensity: {
    high: translateUi("高密度"),
    medium: translateUi("中密度"),
    medium_high: translateUi("中高密度"),
  },
};

function compactText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function humanizeUnknownToken(value: string): string {
  return value.replace(/_/g, " ").trim();
}

function formatBooleanValue(key: string, value: boolean): string {
  if (key === "multiPov") {
    return t(value ? "boolean.multiPov.yes" : "boolean.multiPov.no");
  }
  if (key === "looping") {
    return t(value ? "boolean.looping.yes" : "boolean.looping.no");
  }
  if (key === "allowSelfReflection") {
    return t(value ? "boolean.selfReflection.yes" : "boolean.selfReflection.no");
  }
  if (key === "facePriority") {
    return t(value ? "boolean.facePriority.yes" : "boolean.facePriority.no");
  }
  if (key === "allowIncompleteSentences") {
    return t(value ? "boolean.incompleteSentences.yes" : "boolean.incompleteSentences.no");
  }
  if (key === "allowSwearing") {
    return t(value ? "boolean.swearing.yes" : "boolean.swearing.no");
  }
  if (key === "allowUselessDetails") {
    return t(value ? "boolean.uselessDetails.yes" : "boolean.uselessDetails.no");
  }
  if (key === "allowFragmentedFlow") {
    return t(value ? "boolean.fragmentedFlow.yes" : "boolean.fragmentedFlow.no");
  }
  if (key === "actionOverExplanation") {
    return t(value ? "boolean.actionOverExplanation.yes" : "boolean.actionOverExplanation.no");
  }
  return t(value ? "boolean.yes" : "boolean.no");
}

function formatArrayValue(value: unknown[]): string {
  return value
    .map((item) => {
      if (typeof item === "string") {
        return humanizeUnknownToken(item);
      }
      return String(item);
    })
    .filter(Boolean)
    .join(" / ");
}

export function formatRuleFieldLabel(section: RuleSection, key: string): string {
  return FIELD_LABELS[section][key] ?? humanizeUnknownToken(key);
}

export function formatRuleFieldValue(section: RuleSection, key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return formatBooleanValue(key, value);
  }

  if (typeof value === "number") {
    if (key === "roughness") {
      return `${Math.round(value * 100)} / 100`;
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    return formatArrayValue(value);
  }

  if (typeof value === "string") {
    const normalized = compactText(value);
    if (!normalized) {
      return "";
    }
    return FIELD_VALUE_MAPS[key]?.[normalized] ?? normalized;
  }

  return "";
}

export function buildReadableRuleEntries(section: RuleSection, rules: RuleObject | Record<string, unknown>): RuleEntry[] {
  const record = rules as Record<string, unknown>;
  const keySet = new Set<string>([
    ...FIELD_ORDER[section],
    ...Object.keys(record),
  ]);

  return Array.from(keySet)
    .map((key) => ({
      key,
      label: formatRuleFieldLabel(section, key),
      value: formatRuleFieldValue(section, key, record[key]),
    }))
    .filter((entry) => Boolean(entry.value))
    .sort((left, right) => {
      const leftIndex = FIELD_ORDER[section].indexOf(left.key);
      const rightIndex = FIELD_ORDER[section].indexOf(right.key);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight;
    });
}

export function buildReadableRuleSummary(
  section: RuleSection,
  rules: RuleObject | Record<string, unknown>,
  fallback: string,
): string {
  const entries = buildReadableRuleEntries(section, rules);
  if (entries.length === 0) {
    return fallback;
  }

  return entries
    .slice(0, 3)
    .map((entry) => (entry.key === "summary" ? entry.value : `${entry.label}：${entry.value}`))
    .join("；");
}
