import { translateUi } from "@/i18n/legacy";
import type { BookAnalysisDetail } from "@ai-novel/shared/types/bookAnalysis";
import { Columns2, Pencil, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import OpenInCreativeHubButton from "@/components/creativeHub/OpenInCreativeHubButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatStatus, isBookAnalysisBudgetExceeded } from "../bookAnalysis.utils";

type ExportFormat = "markdown" | "json";

function formatTokenCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value)));
}

interface ToolbarPendingState {
  copy: boolean;
  rebuild: boolean;
  archive: boolean;
  publish: boolean;
  createStyleProfile: boolean;
  updateBudget: boolean;
  resumeWithBudget: boolean;
}

interface BookAnalysisWorkspaceToolbarProps {
  selectedAnalysis: BookAnalysisDetail;
  selectedNovelId: string;
  dualPaneAvailable: boolean;
  isDualPane: boolean;
  pending: ToolbarPendingState;
  onCopy: () => void;
  onRebuild: (analysisId: string) => void;
  onArchive: (analysisId: string) => void;
  onPublish: () => void;
  onCreateStyleProfile: () => void;
  onCreateFromReference: () => void;
  onDownload: (format: ExportFormat) => void;
  onDualPaneChange: (enabled: boolean) => void;
  onOpenBudgetAdjust: () => void;
  onOpenBudgetResume: () => void;
}

export default function BookAnalysisWorkspaceToolbar(props: BookAnalysisWorkspaceToolbarProps) {
  const {
    selectedAnalysis,
    selectedNovelId,
    dualPaneAvailable,
    isDualPane,
    pending,
    onCopy,
    onRebuild,
    onArchive,
    onPublish,
    onCreateStyleProfile,
    onCreateFromReference,
    onDownload,
    onDualPaneChange,
    onOpenBudgetAdjust,
    onOpenBudgetResume,
  } = props;

  const budgetTokens = selectedAnalysis.budgetTokens ?? null;
  const usedTokens = selectedAnalysis.usedTokens ?? 0;
  const budgetExceeded = isBookAnalysisBudgetExceeded(selectedAnalysis.lastError);
  const budgetResumeAvailable =
    budgetExceeded && (selectedAnalysis.status === "failed" || selectedAnalysis.status === "cancelled");
  const canAdjustBudget = selectedAnalysis.status !== "archived";

  return (
    <div className="overflow-hidden rounded-2xl border border-border/45 bg-card/70 shadow-[0_10px_32px_rgba(15,23,42,0.035)]">
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-normal text-foreground">{translateUi("结果工具")}</h2>
            <Badge variant="secondary" className="border-0 bg-muted/70 font-normal">
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${selectedAnalysis.status === "succeeded" ? "bg-success" : "bg-muted-foreground/50"}`} />
              {formatStatus(selectedAnalysis.status)}
            </Badge>
            {selectedAnalysis.publishedDocumentId ? <Badge variant="secondary" className="border-0 font-normal">{translateUi("已发布")}</Badge> : null}
            <Badge variant={budgetExceeded ? "destructive" : "secondary"} className="border-0 font-normal">

              {translateUi("预算")} {budgetTokens
                ? `${formatTokenCount(usedTokens)}/${formatTokenCount(budgetTokens)}`
                : translateUi("{{value0}}/不限", { value0: formatTokenCount(usedTokens) })}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">

            {translateUi("阅读结果是当前主任务；发布、导出和维护操作可按需使用。")}
          </p>
        </div>
        <div className="mobile-full-actions flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onCreateFromReference}
            disabled={selectedAnalysis.status !== "succeeded" || pending.createStyleProfile}
          >
            <WandSparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />

            {translateUi("照着这本书写")}
          </Button>
          {budgetResumeAvailable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenBudgetResume}
              disabled={pending.resumeWithBudget || selectedAnalysis.status === "archived"}
            >
              {pending.resumeWithBudget ? translateUi("提交中...") : translateUi("扩容预算并续跑")}
            </Button>
          ) : null}
          {dualPaneAvailable ? (
            <Button
              type="button"
              size="sm"
              variant={isDualPane ? "secondary" : "outline"}
              onClick={() => onDualPaneChange(!isDualPane)}
              title={isDualPane ? translateUi("关闭双栏对照") : translateUi("打开双栏对照")}
            >
              <Columns2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {isDualPane ? translateUi("关闭双栏") : translateUi("原文双栏")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={onPublish}
            disabled={!selectedNovelId || pending.publish || selectedAnalysis.status === "archived"}
            title={!selectedNovelId ? translateUi("请在下方「分析信息与发布」中选择目标小说") : translateUi("发布到小说知识库")}
          >
            {pending.publish ? translateUi("发布中...") : translateUi("发布到知识库")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/tasks?kind=book_analysis&id=${selectedAnalysis.id}`}>{translateUi("任务详情")}</Link>
          </Button>
          <OpenInCreativeHubButton
            bindings={{
              bookAnalysisId: selectedAnalysis.id,
              knowledgeDocumentIds: selectedAnalysis.documentId ? [selectedAnalysis.documentId] : [],
            }}
            label={translateUi("创作中枢引用")}
          />
        </div>
      </div>

      <details className="border-t border-border/35 px-5 py-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{translateUi("更多维护操作")}</summary>
        <div className="mobile-full-actions mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onCopy} disabled={pending.copy}>{translateUi("复制分析")}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRebuild(selectedAnalysis.id)}
            disabled={pending.rebuild || selectedAnalysis.status === "archived"}
          >

            {translateUi("重新生成")}
          </Button>
          {canAdjustBudget ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenBudgetAdjust}
              disabled={pending.updateBudget || pending.resumeWithBudget}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />

              {translateUi("调整预算")}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => onDownload("markdown")}>{translateUi("导出 MD")}</Button>
          <Button size="sm" variant="outline" onClick={() => onDownload("json")}>{translateUi("导出 JSON")}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCreateStyleProfile}
            disabled={pending.createStyleProfile || selectedAnalysis.status === "archived"}
          >
            {pending.createStyleProfile ? translateUi("生成写法中...") : translateUi("生成写法")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onArchive(selectedAnalysis.id)}
            disabled={pending.archive || selectedAnalysis.status === "archived"}
          >

            {translateUi("归档")}
          </Button>
        </div>
      </details>
    </div>
  );
}
