import { translateUi } from "../../i18n/legacy.ts";
import type { WorldConsistencyIssue, WorldConsistencyReport } from "@ai-novel/shared/types/world";

const ISSUE_CODE_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: translateUi("主题框架不一致"),
  REDUNDANT_AXIOM_APPLICATION: translateUi("世界公理重复套用"),
  AXIOM_VIOLATION: translateUi("世界公理冲突"),
  GENRE_MISMATCH: translateUi("题材信号冲突"),
  AXIOM_MAGIC_CONFLICT: translateUi("公理与力量体系冲突"),
  TECH_ERA_MISMATCH: translateUi("技术时代混杂"),
  CONFLICT_WEAK: translateUi("核心冲突偏弱"),
  BASELINE_PASS: translateUi("规则检查通过"),
};

const ISSUE_MESSAGE_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: translateUi("检索补充内容引入了与核心设定不一致的主题框架。"),
  REDUNDANT_AXIOM_APPLICATION: translateUi("补充内容重复复述了既有公理，没有增加新的有效约束。"),
  AXIOM_VIOLATION: translateUi("世界名或核心概念与既有公理、背景存在冲突。"),
  GENRE_MISMATCH: translateUi("题材信号与世界手册约束不一致。"),
  AXIOM_MAGIC_CONFLICT: translateUi("世界公理与力量体系设定发生冲突。"),
  TECH_ERA_MISMATCH: translateUi("技术时代感混杂，缺少足够解释。"),
  CONFLICT_WEAK: translateUi("核心冲突信息过薄，支撑力不足。"),
  BASELINE_PASS: translateUi("规则层面未发现明显硬冲突。"),
};

const ISSUE_DETAIL_LABELS: Record<string, string> = {
  THEMATIC_INCOHERENCE: translateUi("辅助上下文引入了原始设定里没有明确建立的主题表达，容易让世界主轴发生漂移。"),
  REDUNDANT_AXIOM_APPLICATION: translateUi("补充内容主要在重复已有规则，建议删去冗余复述，只保留真正新增的约束。"),
  AXIOM_VIOLATION: translateUi("命名、题材承诺或核心概念与既有世界底层规则不一致，需要统一主设定。"),
  GENRE_MISMATCH: translateUi("命名或关键词传递出了另一种题材预期，和世界手册强调的风格与规则不匹配。"),
  AXIOM_MAGIC_CONFLICT: translateUi("你在世界公理里限制了超自然/魔法内容，但力量体系或相关文本又重新引入了它。"),
  TECH_ERA_MISMATCH: translateUi("技术描述同时出现了不同时代层级的元素，但没有交代来源、限制或过渡逻辑。"),
  CONFLICT_WEAK: translateUi("建议补充冲突双方、触发事件、升级路径和失败代价，让世界主矛盾更清晰。"),
};

const FIELD_LABELS: Record<string, string> = {
  description: translateUi("世界概述"),
  background: translateUi("背景设定"),
  geography: translateUi("地理环境"),
  cultures: translateUi("文化习俗"),
  magicSystem: translateUi("力量体系"),
  politics: translateUi("政治结构"),
  races: translateUi("种族设定"),
  religions: translateUi("宗教信仰"),
  technology: translateUi("技术体系"),
  conflicts: translateUi("核心冲突"),
  history: translateUi("历史脉络"),
  economy: translateUi("经济系统"),
  factions: translateUi("势力关系"),
};

function hasChinese(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

function localizeSummary(summary: string, status: WorldConsistencyReport["status"], issues: WorldConsistencyIssue[]): string {
  if (hasChinese(summary)) {
    return summary;
  }
  if (/Consistency check passed/i.test(summary)) {
    return translateUi("世界手册体检通过，未发现明显硬冲突。");
  }
  const errorCount = issues.filter((item) => item.severity === "error").length;
  const warnCount = issues.filter((item) => item.severity === "warn").length;
  if (status === "error") {
    return translateUi("检测到 {{v0}} 个严重冲突，{{v1}} 个警告项。", { v0: errorCount, v1: warnCount });
  }
  if (status === "warn") {
    return translateUi("检测到 {{v0}} 个警告项，建议继续修正。", { v0: warnCount });
  }
  return translateUi("世界手册体检已完成。");
}

export function parseConsistencyReport(raw: string | null | undefined, issues: WorldConsistencyIssue[]): WorldConsistencyReport | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WorldConsistencyReport>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const status = parsed.status === "error" || parsed.status === "warn" || parsed.status === "pass"
      ? parsed.status
      : "pass";
    return {
      worldId: typeof parsed.worldId === "string" ? parsed.worldId : "",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      summary: localizeSummary(typeof parsed.summary === "string" ? parsed.summary : "", status, issues),
      status,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      issues,
    };
  } catch {
    return null;
  }
}

export function localizeConsistencySeverity(severity: WorldConsistencyIssue["severity"]): string {
  switch (severity) {
    case "error":
      return translateUi("严重冲突");
    case "warn":
      return translateUi("警告");
    case "pass":
      return translateUi("通过");
    default:
      return severity;
  }
}

export function localizeConsistencyStatus(status: WorldConsistencyIssue["status"] | WorldConsistencyReport["status"]): string {
  switch (status) {
    case "open":
      return translateUi("待处理");
    case "resolved":
      return translateUi("已解决");
    case "ignored":
      return translateUi("已忽略");
    case "error":
      return translateUi("存在严重冲突");
    case "warn":
      return translateUi("存在警告");
    case "pass":
      return translateUi("检查通过");
    default:
      return status;
  }
}

export function localizeConsistencySource(source: WorldConsistencyIssue["source"]): string {
  return source === "llm" ? translateUi("模型审校") : translateUi("规则检查");
}

export function localizeConsistencyField(targetField?: string | null): string {
  if (!targetField) {
    return translateUi("未指定");
  }
  return FIELD_LABELS[targetField] ?? targetField;
}

export function localizeConsistencyIssueTitle(code: string): string {
  return ISSUE_CODE_LABELS[code] ?? code;
}

export function localizeConsistencyIssueMessage(issue: WorldConsistencyIssue): string {
  if (hasChinese(issue.message)) {
    return issue.message;
  }
  return ISSUE_MESSAGE_LABELS[issue.code]
    ?? translateUi("{{v0}}存在一致性风险。", { v0: localizeConsistencyField(issue.targetField) });
}

export function localizeConsistencyIssueDetail(issue: WorldConsistencyIssue): string | null {
  if (issue.detail && hasChinese(issue.detail)) {
    return issue.detail;
  }
  if (ISSUE_DETAIL_LABELS[issue.code]) {
    return ISSUE_DETAIL_LABELS[issue.code];
  }
  if (issue.detail) {
    return translateUi("系统检测到一条{{v0}}相关问题，请结合世界手册复核这项风险。", { v0: localizeConsistencyField(issue.targetField) });
  }
  return null;
}
