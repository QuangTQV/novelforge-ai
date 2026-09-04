import { translateUi } from "@/i18n/legacy";
export interface StorylineStructuredView {
  coreTheme: string;
  mainGoal: string;
  earlyPhase: string;
  middlePhase: string;
  latePhase: string;
  growthCurve: string;
  emotionTrend: string;
  coreConflicts: string;
  endingDirection: string;
  forbiddenItems: string;
}

function normalizeLines(draftText: string): string[] {
  return draftText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stripLabel(line: string): string {
  return line.replace(/^[^:：]{1,16}[:：]\s*/, "").trim();
}

function findByKeywords(lines: string[], keywords: string[]): string {
  const matched = lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
  if (!matched) {
    return "";
  }
  const stripped = stripLabel(matched);
  return stripped || matched;
}

function buildFallbackPhases(lines: string[]): { early: string; middle: string; late: string } {
  if (lines.length === 0) {
    return { early: "", middle: "", late: "" };
  }
  const blockSize = Math.max(1, Math.ceil(lines.length / 3));
  return {
    early: lines.slice(0, blockSize).join("；"),
    middle: lines.slice(blockSize, blockSize * 2).join("；"),
    late: lines.slice(blockSize * 2).join("；"),
  };
}

export function parseStorylineStructuredView(draftText: string): StorylineStructuredView {
  const lines = normalizeLines(draftText);
  const fallbackPhases = buildFallbackPhases(lines);
  const coreTheme = findByKeywords(lines, [translateUi("核心主题"), translateUi("主题")]);
  const mainGoal = findByKeywords(lines, [translateUi("主线目标"), translateUi("目标"), translateUi("核心任务")]);
  const earlyPhase = findByKeywords(lines, [translateUi("前期"), translateUi("开篇"), translateUi("第一阶段")]) || fallbackPhases.early;
  const middlePhase = findByKeywords(lines, [translateUi("中期"), translateUi("第二阶段"), translateUi("转折")]) || fallbackPhases.middle;
  const latePhase = findByKeywords(lines, [translateUi("后期"), translateUi("第三阶段"), translateUi("收束"), translateUi("结局阶段")]) || fallbackPhases.late;
  const growthCurve = findByKeywords(lines, [translateUi("成长"), translateUi("成长路径"), translateUi("成长弧")]);
  const emotionTrend = findByKeywords(lines, [translateUi("情感"), translateUi("情绪"), translateUi("情感线")]);
  const coreConflicts = findByKeywords(lines, [translateUi("冲突"), translateUi("矛盾"), translateUi("对抗")]);
  const endingDirection = findByKeywords(lines, [translateUi("结局"), translateUi("终局"), translateUi("收尾")]);
  const forbiddenItems = findByKeywords(lines, [translateUi("禁止"), translateUi("避免"), translateUi("禁忌")]);

  return {
    coreTheme: coreTheme || translateUi("未标注"),
    mainGoal: mainGoal || translateUi("未标注"),
    earlyPhase: earlyPhase || translateUi("未标注"),
    middlePhase: middlePhase || translateUi("未标注"),
    latePhase: latePhase || translateUi("未标注"),
    growthCurve: growthCurve || translateUi("未标注"),
    emotionTrend: emotionTrend || translateUi("未标注"),
    coreConflicts: coreConflicts || translateUi("未标注"),
    endingDirection: endingDirection || translateUi("未标注"),
    forbiddenItems: forbiddenItems || translateUi("未标注"),
  };
}
