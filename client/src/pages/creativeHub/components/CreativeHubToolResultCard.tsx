import { translateUi } from "@/i18n/legacy";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreativeHubToolResultCardProps {
  toolName: string;
  summary: string;
  success: boolean;
  output?: Record<string, unknown>;
  errorCode?: string;
  onQuickAction?: (prompt: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0)
    : [];
}

function itemLabel(item: Record<string, unknown>): string {
  const candidates = ["title", "name", "label", "summary", "content"];
  for (const key of candidates) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if (typeof item.id === "string" && item.id.trim()) {
    return item.id.trim();
  }
  return i18n.t("creativeHub:toolResult.unnamedItem");
}

function compactText(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function formatNovelProjectStatus(value: unknown): string | null {
  switch (value) {
    case "in_progress":
      return i18n.t("creativeHub:toolResult.status.inProgress");
    case "not_started":
      return i18n.t("creativeHub:toolResult.status.notStarted");
    case "completed":
      return i18n.t("creativeHub:toolResult.status.completed");
    case "rework":
      return i18n.t("creativeHub:toolResult.status.rework");
    case "blocked":
      return i18n.t("creativeHub:toolResult.status.blocked");
    default:
      return null;
  }
}

function renderActionButtons(actions: Array<{ label: string; prompt: string }>, onQuickAction?: (prompt: string) => void) {
  if (!onQuickAction || actions.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={`${action.label}-${action.prompt}`}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onQuickAction(action.prompt)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function renderNovelList(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const total = typeof output.total === "number" ? output.total : null;
  const items = asRecordArray(output.items).slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {i18n.t("creativeHub:toolResult.novelCount", { count: total ?? items.length })}
        {total != null && total > items.length ? i18n.t("creativeHub:toolResult.showingFirst", { count: items.length }) : ""}
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const title = itemLabel(item);
          const chapterCount = typeof item.chapterCount === "number" ? item.chapterCount : null;
          const projectStatus = formatNovelProjectStatus(item.projectStatus);
          return (
            <div key={`${item.id ?? title}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-sm font-medium text-foreground">{translateUi("《")}{title}{translateUi("》")}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {chapterCount != null ? i18n.t("creativeHub:toolResult.chapterCount", { count: chapterCount }) : i18n.t("creativeHub:toolResult.unknownChapters")}
                {projectStatus ? ` · ${projectStatus}` : ""}
              </div>
              {onQuickAction ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAction(translateUi("把《{{value0}}》设为当前工作区", { value0: title }))}
                  >
                    {i18n.t("creativeHub:toolResult.setCurrentWorkspace")}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderWorkspaceCard(
  output: Record<string, unknown>,
  variant: "created" | "selected",
  onQuickAction?: (prompt: string) => void,
) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : i18n.t("creativeHub:toolResult.unnamedNovel");
  const chapterCount = typeof output.chapterCount === "number" ? output.chapterCount : 0;
  const actions = variant === "created"
    ? [
      { label: i18n.t("creativeHub:toolResult.viewProgress"), prompt: translateUi("这本书当前写到哪一章") },
      { label: i18n.t("creativeHub:toolResult.designFirstChapter"), prompt: translateUi("为这本书规划第一章") },
    ]
    : [
      { label: i18n.t("creativeHub:toolResult.viewProgress"), prompt: translateUi("这本书当前写到哪一章") },
      { label: i18n.t("creativeHub:toolResult.viewFirstTwo"), prompt: translateUi("前两章都写了什么") },
    ];
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-success/30 bg-success/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{translateUi("《")}{title}{translateUi("》")}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {variant === "created" ? i18n.t("creativeHub:toolResult.novelCreated") : i18n.t("creativeHub:toolResult.workspaceSelected")}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResult.currentChapterCount", { count: chapterCount })}</div>
      </div>
      {renderActionButtons(actions, onQuickAction)}
    </div>
  );
}

function renderWorldBindingCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const novelTitle = typeof output.novelTitle === "string" && output.novelTitle.trim()
    ? output.novelTitle.trim()
    : i18n.t("creativeHub:toolResult.currentNovel");
  const worldName = typeof output.worldName === "string" && output.worldName.trim()
    ? output.worldName.trim()
    : i18n.t("creativeHub:toolResult.unnamedWorld");
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-info/30 bg-info/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{translateUi("《")}{novelTitle}{translateUi("》")}</div>
        <div className="mt-1 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResult.worldBound", { world: worldName })}</div>
      </div>
      {renderActionButtons([
        { label: i18n.t("creativeHub:toolResult.actions.viewWorldRules"), prompt: translateUi("查看当前小说的世界观规则") },
        { label: i18n.t("creativeHub:toolResult.actions.checkWorldConflict"), prompt: translateUi("检查当前小说和世界观是否存在冲突") },
      ], onQuickAction)}
    </div>
  );
}

function renderProductionAssetCard(
  title: string,
  description: string,
  actions: Array<{ label: string; prompt: string }>,
  onQuickAction?: (prompt: string) => void,
) {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      {renderActionButtons(actions, onQuickAction)}
    </div>
  );
}

function renderProductionStatusCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : i18n.t("creativeHub:toolResult.currentNovel");
  const currentStage = typeof output.currentStage === "string" ? output.currentStage.trim() : i18n.t("creativeHub:toolResult.unknownStage");
  const chapterCount = typeof output.chapterCount === "number" ? output.chapterCount : 0;
  const targetChapterCount = typeof output.targetChapterCount === "number" ? output.targetChapterCount : null;
  const pipelineStatus = typeof output.pipelineStatus === "string" && output.pipelineStatus.trim()
    ? output.pipelineStatus.trim()
    : i18n.t("creativeHub:toolResult.notStarted");
  const assetStages = asRecordArray(output.assetStages);
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-info/30 bg-info/5 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{translateUi("《")}{title}{translateUi("》")}</div>
        <div className="mt-1 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResult.currentStage", { value: currentStage })}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {i18n.t("creativeHub:toolResult.chapterCatalog", { value: targetChapterCount != null ? `${chapterCount}/${targetChapterCount}` : chapterCount })}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResult.fullBookWriting", { value: pipelineStatus })}</div>
        {typeof output.failureSummary === "string" && output.failureSummary.trim() ? (
          <div className="mt-2 text-xs leading-5 text-muted-foreground">{i18n.t("creativeHub:toolResult.failureSummary", { value: output.failureSummary.trim() })}</div>
        ) : null}
      </div>
      {assetStages.length > 0 ? (
        <div className="grid gap-2">
          {assetStages.slice(0, 8).map((stage) => (
            <div key={`${stage.key ?? stage.label}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-sm font-medium text-foreground">{String(stage.label ?? stage.key ?? i18n.t("creativeHub:toolResult.stage"))}</div>
              <div className="mt-1 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResult.statusLabel", { value: String(stage.status ?? "unknown") })}</div>
              {typeof stage.detail === "string" && stage.detail.trim() ? (
                <div className="mt-1 text-xs text-muted-foreground">{stage.detail.trim()}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {renderActionButtons([
        { label: i18n.t("creativeHub:toolResult.actions.viewFullProgress"), prompt: translateUi("整本生成到哪一步了") },
      ], onQuickAction)}
    </div>
  );
}

function renderPipelineRunCard(
  toolName: "preview_pipeline_run" | "queue_pipeline_run",
  output: Record<string, unknown>,
  onQuickAction?: (prompt: string) => void,
) {
  const startOrder = typeof output.startOrder === "number" ? output.startOrder : null;
  const endOrder = typeof output.endOrder === "number" ? output.endOrder : null;
  const jobId = typeof output.jobId === "string" && output.jobId.trim() ? output.jobId.trim() : null;
  const scope = startOrder != null && endOrder != null
    ? startOrder === endOrder
      ? translateUi("第 {{v0}} 章", { v0: startOrder })
      : translateUi("第 {{v0}} 到第 {{v1}} 章", { v0: startOrder, v1: endOrder })
    : translateUi("当前章节范围");
  const title = toolName === "preview_pipeline_run" ? translateUi("整本写作预览") : translateUi("整本写作任务");
  const description = toolName === "preview_pipeline_run"
    ? translateUi("{{v0}} 的整本写作预览已完成，当前可进入审批或继续诊断。", { v0: scope })
    : translateUi("Đã khởi động tác vụ viết cả cuốn của {{scope}}.", { scope }) + (jobId ? ` (${jobId})` : "");
  const actions = toolName === "preview_pipeline_run"
    ? [
      { label: i18n.t("creativeHub:toolResult.actions.viewFullProgress"), prompt: translateUi("整本生成到哪一步了") },
      { label: i18n.t("creativeHub:toolResult.actions.viewBlockers"), prompt: translateUi("为什么整本生成没有启动") },
    ]
    : [
      { label: translateUi("查看整本进度"), prompt: translateUi("整本生成到哪一步了") },
      { label: translateUi("查看任务状态"), prompt: translateUi("列出当前系统任务状态") },
    ];
  return renderProductionAssetCard(title, description, actions, onQuickAction);
}

function renderDiagnosticCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const failureSummary = typeof output.failureSummary === "string" ? output.failureSummary : "";
  const failureDetails = typeof output.failureDetails === "string" ? output.failureDetails : "";
  const recoveryHint = typeof output.recoveryHint === "string" ? output.recoveryHint : "";
  return (
    <div className="space-y-2">
      {failureSummary ? <div className="text-sm font-medium text-foreground">{failureSummary}</div> : null}
      {failureDetails ? <div className="text-xs leading-5 text-muted-foreground">{i18n.t("creativeHub:toolResultUi.details", { value: failureDetails })}</div> : null}
      {recoveryHint ? <div className="text-xs leading-5 text-muted-foreground">{i18n.t("creativeHub:toolResultUi.suggestion", { value: recoveryHint })}</div> : null}
      {renderActionButtons([
        { label: translateUi("继续诊断"), prompt: translateUi("继续解释失败原因和恢复建议") },
        { label: translateUi("查看任务状态"), prompt: translateUi("列出当前系统任务状态") },
      ], onQuickAction)}
    </div>
  );
}

function renderListCard(
  output: Record<string, unknown>,
  emptyLabel: string,
  onQuickAction?: (prompt: string) => void,
) {
  const items = asRecordArray(output.items).slice(0, 6);
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.id ?? itemLabel(item)}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="text-sm font-medium text-foreground">{itemLabel(item)}</div>
            {"status" in item && typeof item.status === "string" ? (
              <div className="mt-1 text-xs text-muted-foreground">{i18n.t("creativeHub:toolResultUi.statusLabel", { value: item.status })}</div>
            ) : null}
          </div>
        ))}
      </div>
      {renderActionButtons([{ label: translateUi("继续筛选"), prompt: translateUi("继续细化这个列表结果") }], onQuickAction)}
    </div>
  );
}

function renderChapterCard(output: Record<string, unknown>, onQuickAction?: (prompt: string) => void) {
  const title = typeof output.title === "string" && output.title.trim() ? output.title.trim() : "";
  const order = typeof output.order === "number" ? output.order : null;
  const content = typeof output.content === "string"
    ? output.content
    : typeof output.summary === "string"
      ? output.summary
      : "";
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">
        {order != null ? translateUi("第{{value0}}章", { value0: order }) : translateUi("章节内容")}
        {title ? translateUi("《{{value0}}》", { value0: title }) : ""}
      </div>
      <div className="rounded-md border border-border bg-muted/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
        {content || i18n.t("creativeHub:toolResultUi.chapterContentEmpty")}
      </div>
      {renderActionButtons([
        { label: translateUi("继续总结"), prompt: translateUi("总结这一段内容的关键剧情") },
        { label: translateUi("检查冲突"), prompt: translateUi("检查这一章是否和世界观或前文冲突") },
      ], onQuickAction)}
    </div>
  );
}

export default function CreativeHubToolResultCard({
  toolName,
  summary,
  success,
  output,
  errorCode,
  onQuickAction,
}: CreativeHubToolResultCardProps) {
  const { t } = useTranslation("creativeHub");
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const payload = asRecord(output);
  const summaryText = compactText(summary, 160) || t("toolResult.defaultSummary");
  const cardContent = (() => {
    if (toolName === "list_novels") {
      return renderNovelList(payload, onQuickAction);
    }
    if (toolName === "create_novel") {
      return renderWorkspaceCard(payload, "created", onQuickAction);
    }
    if (toolName === "select_novel_workspace") {
      return renderWorkspaceCard(payload, "selected", onQuickAction);
    }
    if (toolName === "bind_world_to_novel") {
      return renderWorldBindingCard(payload, onQuickAction);
    }
    if (toolName === "generate_world_for_novel") {
      const worldName = typeof payload.worldName === "string" && payload.worldName.trim() ? payload.worldName.trim() : translateUi("未命名世界观");
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.worldGenerated"),
        i18n.t("creativeHub:toolResultUi.worldGeneratedDescription", { world: worldName }),
        [
          { label: i18n.t("creativeHub:toolResultUi.viewProduction"), prompt: translateUi("整本生成到哪一步了") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_novel_characters") {
      const characterCount = typeof payload.characterCount === "number" ? payload.characterCount : 0;
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.charactersGenerated"),
        i18n.t("creativeHub:toolResultUi.charactersGeneratedDescription", { count: characterCount }),
        [
          { label: i18n.t("creativeHub:toolResultUi.viewCharacters"), prompt: translateUi("查看当前小说角色状态") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_story_bible") {
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.bibleGenerated"),
        typeof payload.mainPromise === "string" && payload.mainPromise.trim()
          ? payload.mainPromise.trim()
          : i18n.t("creativeHub:toolResultUi.bibleGeneratedFallback"),
        [
          { label: translateUi("查看整本进度"), prompt: translateUi("整本生成到哪一步了") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_novel_outline") {
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.outlineGenerated"),
        typeof payload.outline === "string" && payload.outline.trim()
          ? payload.outline.trim()
          : i18n.t("creativeHub:toolResultUi.outlineGeneratedFallback"),
        [
          { label: translateUi("查看整本进度"), prompt: translateUi("整本生成到哪一步了") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "generate_structured_outline") {
      const targetChapterCount = typeof payload.targetChapterCount === "number" ? payload.targetChapterCount : 0;
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.structuredOutlineGenerated"),
        targetChapterCount > 0 ? i18n.t("creativeHub:toolResultUi.structuredOutlineDescription", { count: targetChapterCount }) : i18n.t("creativeHub:toolResultUi.structuredOutlineFallback"),
        [
          { label: translateUi("查看整本进度"), prompt: translateUi("整本生成到哪一步了") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "sync_chapters_from_structured_outline") {
      const chapterCount = typeof payload.chapterCount === "number" ? payload.chapterCount : 0;
      return renderProductionAssetCard(
        i18n.t("creativeHub:toolResultUi.chapterCatalogSynced"),
        chapterCount > 0 ? i18n.t("creativeHub:toolResultUi.chapterCatalogDescription", { count: chapterCount }) : i18n.t("creativeHub:toolResultUi.chapterCatalogFallback"),
        [
          { label: translateUi("查看整本进度"), prompt: translateUi("整本生成到哪一步了") },
          { label: translateUi("查看任务状态"), prompt: translateUi("列出当前系统任务状态") },
        ],
        onQuickAction,
      );
    }
    if (toolName === "start_full_novel_pipeline" || toolName === "get_novel_production_status") {
      return renderProductionStatusCard(payload, onQuickAction);
    }
    if (toolName === "preview_pipeline_run" || toolName === "queue_pipeline_run") {
      return renderPipelineRunCard(toolName, payload, onQuickAction);
    }
    if (
      toolName === "get_task_failure_reason"
      || toolName === "get_run_failure_reason"
      || toolName === "get_index_failure_reason"
      || toolName === "get_book_analysis_failure_reason"
      || toolName === "explain_generation_blocker"
      || toolName === "explain_world_conflict"
      || toolName === "failure_diagnostic"
    ) {
      return renderDiagnosticCard(payload, onQuickAction);
    }
    if (
      toolName === "list_worlds"
      || toolName === "list_tasks"
      || toolName === "list_knowledge_documents"
      || toolName === "list_book_analyses"
      || toolName === "list_writing_formulas"
      || toolName === "list_base_characters"
    ) {
      return renderListCard(payload, i18n.t("creativeHub:toolResultUi.noResults"), onQuickAction);
    }
    if (
      toolName === "get_chapter_content"
      || toolName === "get_chapter_content_by_order"
      || toolName === "summarize_chapter_range"
    ) {
      return renderChapterCard(payload, onQuickAction);
    }
    return null;
  })();

  if (!cardContent) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-foreground">{summaryText}</div>
          <Badge variant={success ? "secondary" : "destructive"}>{success ? t("toolResult.success") : t("toolResult.failed")}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {expanded ? t("toolResult.collapse") : t("toolResult.expand")}
        </Button>
      </div>
      {expanded ? (
        <div id={detailsId} className="mt-3 space-y-3">
          {!success && errorCode ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
              {t("toolResult.errorCode", { code: errorCode })}
            </div>
          ) : null}
          {cardContent}
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">{t("toolResult.collapsedHint")}</div>
      )}
    </div>
  );
}
