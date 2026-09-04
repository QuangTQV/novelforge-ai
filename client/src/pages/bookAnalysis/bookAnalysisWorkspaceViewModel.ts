import { translateUi } from "../../i18n/legacy.ts";
import type {
  BookAnalysisDetail,
  BookAnalysisSection,
  BookAnalysisStatus,
} from "@ai-novel/shared/types/bookAnalysis";
import { isBookAnalysisBudgetExceeded } from "./bookAnalysis.utils.ts";

export type BookAnalysisWorkspaceTone = "neutral" | "info" | "success" | "warning" | "danger";

export type BookAnalysisPrimaryAction =
  | "create"
  | "select"
  | "view_results"
  | "resume_budget"
  | "rebuild"
  | "copy";

export interface BookAnalysisSectionSummary {
  total: number;
  expected: number;
  frozen: number;
  unselected: number;
  frozenReadable: number;
  readable: number;
  readableExpected: number;
  missingExpected: number;
  failedExpected: number;
  succeeded: number;
  running: number;
  failed: number;
}

export interface BookAnalysisNextAction {
  tone: BookAnalysisWorkspaceTone;
  title: string;
  description: string;
  action: BookAnalysisPrimaryAction | null;
  actionLabel?: string;
}

function hasStructuredContent(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

export function isReadableBookAnalysisSection(section: BookAnalysisSection): boolean {
  return Boolean(
    section.editedContent?.trim()
      || section.aiContent?.trim()
      || hasStructuredContent(section.structuredData),
  );
}

export function isUnselectedBookAnalysisSection(section: BookAnalysisSection): boolean {
  return section.frozen && !isReadableBookAnalysisSection(section);
}

export function summarizeBookAnalysisSections(
  analysis: Pick<BookAnalysisDetail, "sections"> | null | undefined,
): BookAnalysisSectionSummary {
  const summary: BookAnalysisSectionSummary = {
    total: 0,
    expected: 0,
    frozen: 0,
    unselected: 0,
    frozenReadable: 0,
    readable: 0,
    readableExpected: 0,
    missingExpected: 0,
    failedExpected: 0,
    succeeded: 0,
    running: 0,
    failed: 0,
  };
  for (const section of analysis?.sections ?? []) {
    summary.total += 1;
    if (section.frozen) {
      summary.frozen += 1;
    } else {
      summary.expected += 1;
    }
    const readable = isReadableBookAnalysisSection(section);
    if (section.frozen) {
      if (readable) {
        summary.frozenReadable += 1;
      } else {
        summary.unselected += 1;
      }
    }
    if (readable) {
      summary.readable += 1;
    }
    if (!section.frozen && readable) {
      summary.readableExpected += 1;
    }
    if (!section.frozen && !readable) {
      summary.missingExpected += 1;
    }
    if (section.status === "succeeded") {
      summary.succeeded += 1;
    } else if (section.status === "running") {
      summary.running += 1;
    } else if (section.status === "failed") {
      summary.failed += 1;
      if (!section.frozen) {
        summary.failedExpected += 1;
      }
    }
  }
  return summary;
}

export function getPreferredBookAnalysisSection(
  sections: BookAnalysisSection[],
): BookAnalysisSection | null {
  return sections.find(isReadableBookAnalysisSection)
    ?? sections.find((section) => section.status === "succeeded")
    ?? sections[0]
    ?? null;
}

function describeMissingExpectedSections(sections: BookAnalysisSectionSummary): string {
  return sections.missingExpected > 0
    ? `仍有 ${sections.missingExpected} 个计划小节缺少可读结果。`
    : "计划范围内没有缺失小节。";
}

export function resolveBookAnalysisNextAction(input: {
  analysis?: BookAnalysisDetail | null;
  analysesCount: number;
  status?: BookAnalysisStatus | null;
}): BookAnalysisNextAction {
  const analysis = input.analysis ?? null;
  if (!analysis) {
    if (input.analysesCount > 0) {
      return {
        tone: "info",
        title: translateUi("选择一份拆书分析"),
        description: translateUi("从分析列表选择记录后，这里会显示来源、生成阶段和可阅读结果。"),
        action: "select",
      };
    }
    return {
      tone: "info",
      title: translateUi("创建第一份拆书分析"),
      description: translateUi("选择一份知识文档和分析范围，AI 会把结果整理为可阅读、可引用的小节。"),
      action: "create",
      actionLabel: translateUi("新建拆书"),
    };
  }

  const status = input.status ?? analysis.status;
  const sections = summarizeBookAnalysisSections(analysis);
  if (status === "queued" || status === "running") {
    const hasReadableResults = sections.readable > 0;
    return {
      tone: "info",
      title: status === "queued" ? translateUi("拆书分析正在排队") : translateUi("拆书分析正在生成"),
      description: hasReadableResults
        ? translateUi("当前进度 {{progress}}%，已有 {{readable}} 个小节可阅读；其余计划小节继续生成。", { progress: Math.round(analysis.progress * 100), readable: sections.readable })
        : translateUi("当前进度 {{progress}}%。已完成的小节会直接保留，全部完成后可在“拆书内容”中阅读。", { progress: Math.round(analysis.progress * 100) }),
      action: hasReadableResults ? "view_results" : null,
      actionLabel: hasReadableResults ? translateUi("查看已有结果") : undefined,
    };
  }

  if ((status === "failed" || status === "cancelled") && isBookAnalysisBudgetExceeded(analysis.lastError)) {
    return {
      tone: "warning",
      title: translateUi("扩容预算后继续生成"),
      description: translateUi("已有 {{readable}} 个可阅读小节会保留。{{missing}}扩容续跑只处理尚未成功的部分。", { readable: sections.readable, missing: describeMissingExpectedSections(sections) }),
      action: "resume_budget",
      actionLabel: translateUi("扩容预算并续跑"),
    };
  }

  if (status === "succeeded") {
    if (sections.readable === 0) {
      return {
        tone: "danger",
        title: translateUi("任务完成，但没有可展示的拆书内容"),
        description: translateUi("源文档不会受影响。请重新生成分析，或打开任务中心查看这次任务的详细记录。"),
        action: "rebuild",
        actionLabel: translateUi("重新生成分析"),
      };
    }
    if (sections.missingExpected > 0) {
      return {
        tone: "warning",
        title: translateUi("先查看已有拆书结果"),
        description: translateUi("已有 {{readable}}/{{expected}} 个计划生成的小节可阅读，仍有 {{missing}} 个小节可通过重新生成补齐。", { readable: sections.readableExpected, expected: sections.expected, missing: sections.missingExpected }),
        action: "view_results",
        actionLabel: translateUi("查看已有结果"),
      };
    }
    if (sections.failedExpected > 0) {
      return {
        tone: "warning",
        title: translateUi("结果可阅读，部分小节需要复核"),
        description: translateUi("{{readable}}/{{expected}} 个计划小节均有可读内容，其中 {{failed}} 个小节最近一次生成失败。先检查保留内容，再决定是否重新生成。", { readable: sections.readableExpected, expected: sections.expected, failed: sections.failedExpected }),
        action: "view_results",
        actionLabel: translateUi("查看已有结果"),
      };
    }
    return {
      tone: "success",
      title: translateUi("拆书结果可以阅读"),
      description: translateUi("共 {{count}} 个小节已生成，可继续查看证据、整理角色，或发布到小说知识库。", { count: sections.readable }),
      action: "view_results",
      actionLabel: translateUi("查看拆书结果"),
    };
  }

  if (status === "failed" || status === "cancelled") {
    if (sections.readable > 0) {
      return {
        tone: "warning",
        title: translateUi("分析已停止，已有结果仍可阅读"),
        description: translateUi("已保留 {{readable}} 个可阅读小节。{{missing}}先检查已有结果，再决定是否重新生成。", { readable: sections.readable, missing: describeMissingExpectedSections(sections) }),
        action: "view_results",
        actionLabel: translateUi("查看已有结果"),
      };
    }
    return {
      tone: "danger",
      title: translateUi("拆书分析需要重新生成"),
      description: analysis.lastError?.trim() || translateUi("本次分析没有生成可阅读结果，源文档不会受影响。"),
      action: "rebuild",
      actionLabel: translateUi("重新生成分析"),
    };
  }

  if (status === "archived") {
    return {
      tone: "neutral",
      title: sections.readable > 0 ? translateUi("查看归档结果") : translateUi("复制归档分析后继续"),
      description: sections.readable > 0
        ? translateUi("归档分析保持只读，已有结果、证据和角色档案仍可查看。")
        : translateUi("这份归档分析没有可阅读结果，可复制为新分析后重新生成。"),
      action: sections.readable > 0 ? "view_results" : "copy",
      actionLabel: sections.readable > 0 ? translateUi("查看归档结果") : translateUi("复制为新分析"),
    };
  }

  return {
    tone: "info",
    title: translateUi("开始生成拆书结果"),
    description: translateUi("AI 会按选定范围逐项生成结构、人物、世界和写法结论，并保留每个已完成小节。"),
    action: "rebuild",
    actionLabel: translateUi("开始生成"),
  };
}
