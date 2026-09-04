import { useEffect, useState } from "react";
import { BookOpenText, MessageCircleMore, Sparkles, WandSparkles } from "lucide-react";
import type { BookAnalysis } from "@ai-novel/shared/types/bookAnalysis";
import type { KnowledgeDocumentDetail, KnowledgeDocumentSummary } from "@ai-novel/shared/types/knowledge";
import type { StyleExtractionSourceProcessingMode, StyleTemplate } from "@ai-novel/shared/types/styleEngine";
import type { UnifiedTaskDetail } from "@ai-novel/shared/types/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import i18n from "@/i18n";
import type {
  WritingFormulaCreateFormState,
  WritingFormulaMaterialSource,
} from "../useWritingFormulaCreateFlow";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`writingFormulaCreate:${key}`, options);

const EXTRACTION_PRESET_OPTIONS = [
  {
    key: "imitate",
    label: "preset.imitate.label",
    summary: "preset.imitate.summary",
  },
  {
    key: "balanced",
    label: "preset.balanced.label",
    summary: "preset.balanced.summary",
  },
  {
    key: "transfer",
    label: "preset.transfer.label",
    summary: "preset.transfer.summary",
  },
] as const;

const MATERIAL_SOURCE_OPTIONS: Array<{
  key: WritingFormulaMaterialSource;
  label: string;
  summary: string;
}> = [
  {
    key: "direct_text",
    label: "source.directText.label",
    summary: "source.directText.summary",
  },
  {
    key: "knowledge_document",
    label: "source.knowledge.label",
    summary: "source.knowledge.summary",
  },
  {
    key: "book_analysis",
    label: "source.analysis.label",
    summary: "source.analysis.summary",
  },
];

const KNOWLEDGE_SOURCE_PROCESSING_OPTIONS: Array<{
  key: StyleExtractionSourceProcessingMode;
  label: string;
  summary: string;
  badge?: string;
}> = [
  {
    key: "representative_sample",
    label: "processing.sample.label",
    summary: "processing.sample.summary",
    badge: "recommended",
  },
  {
    key: "full_text",
    label: "processing.full.label",
    summary: "processing.full.summary",
  },
];

function formatTaskStatus(task: UnifiedTaskDetail | null): string {
  if (!task) {
    return t("task.none");
  }
  if (task.status === "queued") {
    return t("task.queued");
  }
  if (task.status === "running") {
    return t("task.running");
  }
  if (task.status === "succeeded") {
    return t("task.succeeded");
  }
  if (task.status === "failed") {
    return t("task.failed");
  }
  if (task.status === "cancelled") {
    return t("task.cancelled");
  }
  return t("task.waitingApproval");
}

function formatCharCount(value: number | null | undefined): string {
  if (!value) {
    return t("chars", { count: 0 });
  }
  return t("chars", { count: value.toLocaleString(i18n.language === "zh" ? "zh-CN" : i18n.language === "en" ? "en-US" : "vi-VN") });
}

function formatKnowledgeStatus(status: KnowledgeDocumentSummary["status"]): string {
  if (status === "enabled") {
    return t("knowledge.enabled");
  }
  if (status === "disabled") {
    return t("knowledge.disabled");
  }
  return t("knowledge.archived");
}

interface WritingFormulaCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: WritingFormulaCreateFormState;
  onFormChange: (patch: Partial<WritingFormulaCreateFormState>) => void;
  templates: StyleTemplate[];
  createManualPending: boolean;
  createFromBriefPending: boolean;
  createFromTemplatePending: boolean;
  extractTaskSubmitting: boolean;
  activeExtractionTask: UnifiedTaskDetail | null;
  knowledgeDocuments: KnowledgeDocumentSummary[];
  knowledgeDocumentsLoading: boolean;
  selectedKnowledgeDocument: KnowledgeDocumentDetail | null;
  selectedKnowledgeDocumentLoading: boolean;
  bookAnalyses: BookAnalysis[];
  bookAnalysesLoading: boolean;
  selectedPresetKey: "imitate" | "balanced" | "transfer";
  onCreateManual: () => void;
  onCreateFromBrief: () => void;
  onCreateFromTemplate: (templateId: string) => void;
  onPresetChange: (value: "imitate" | "balanced" | "transfer") => void;
  onSubmitExtractionTask: () => void;
  onOpenTaskCenter?: (task: UnifiedTaskDetail) => void;
}

export default function WritingFormulaCreateDialog(props: WritingFormulaCreateDialogProps) {
  const {
    open,
    onOpenChange,
    form,
    onFormChange,
    templates,
    createManualPending,
    createFromBriefPending,
    createFromTemplatePending,
    extractTaskSubmitting,
    activeExtractionTask,
    knowledgeDocuments,
    knowledgeDocumentsLoading,
    selectedKnowledgeDocument,
    selectedKnowledgeDocumentLoading,
    bookAnalyses,
    bookAnalysesLoading,
    selectedPresetKey,
    onCreateManual,
    onCreateFromBrief,
    onCreateFromTemplate,
    onPresetChange,
    onSubmitExtractionTask,
    onOpenTaskCenter,
  } = props;
  const [activeTab, setActiveTab] = useState<"quick_start" | "blank" | "extract">("quick_start");

  useEffect(() => {
    if (open && activeExtractionTask) {
      setActiveTab("extract");
    }
  }, [activeExtractionTask, open]);

  const extractionTaskIsActive = activeExtractionTask?.status === "queued" || activeExtractionTask?.status === "running";
  const selectedPreset = EXTRACTION_PRESET_OPTIONS.find((item) => item.key === selectedPresetKey) ?? EXTRACTION_PRESET_OPTIONS[1];
  const activeKnowledgeVersion = selectedKnowledgeDocument?.versions.find((version) => version.isActive) ?? null;
  const selectedBookAnalysis = bookAnalyses.find((analysis) => analysis.id === form.bookAnalysisId) ?? null;
  const knowledgeDocumentReady = Boolean(
    selectedKnowledgeDocument
      && selectedKnowledgeDocument.status !== "archived"
      && activeKnowledgeVersion
      && activeKnowledgeVersion.content.trim(),
  );
  const bookAnalysisReady = Boolean(form.bookAnalysisId);
  const materialSubmitDisabled = extractTaskSubmitting
    || (form.materialSource !== "book_analysis" && extractionTaskIsActive)
    || !form.extractName.trim()
    || (form.materialSource === "direct_text" && !form.extractSourceText.trim())
    || (form.materialSource === "knowledge_document" && !knowledgeDocumentReady)
    || (form.materialSource === "book_analysis" && !bookAnalysisReady);
  const materialSubmitLabel = form.materialSource === "book_analysis"
    ? "从拆书结果创建写法"
    : form.materialSource === "knowledge_document"
      ? "从知识库原文提取并自动保存"
      : "提交提取任务并自动保存";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="writing-formula-theme flex h-[min(780px,92vh)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-6 py-5 pr-14">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><WandSparkles className="size-5" /></div>
            <div>
          <DialogTitle>{t("ui.title")}</DialogTitle>
          <DialogDescription>
                {t("ui.description")}
          </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col space-y-4 px-6 pb-6 pt-4">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-3 rounded-2xl bg-slate-100/80 p-1">
            <TabsTrigger value="quick_start" className="gap-1.5 rounded-xl py-2.5"><BookOpenText className="size-4" />{t("ui.tabs.template")}</TabsTrigger>
            <TabsTrigger value="blank" className="gap-1.5 rounded-xl py-2.5"><MessageCircleMore className="size-4" />{t("ui.tabs.brief")}</TabsTrigger>
            <TabsTrigger value="extract" className="gap-1.5 rounded-xl py-2.5"><Sparkles className="size-4" />{t("ui.tabs.material")}</TabsTrigger>
          </TabsList>

          <TabsContent value="quick_start" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm leading-6 text-slate-700">
              {t("ui.templateHint")}
            </div>
            <div className="grid gap-3 pr-1 md:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-foreground">{template.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{template.category}</div>
                    </div>
                    <Badge variant="outline">{t("ui.templateBadge")}</Badge>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">{template.description}</div>
                  {template.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.tags.slice(0, 4).map((tag) => (
                        <Badge key={`${template.id}-${tag}`} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {template.applicableGenres.length > 0 ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {t("ui.suitable", { genres: template.applicableGenres.join(" / ") })}
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => onCreateFromTemplate(template.id)}
                    disabled={createFromTemplatePending}
                  >
                    {createFromTemplatePending ? t("ui.creating") : t("ui.createBased")}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="blank" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm leading-6 text-slate-700">
              {t("ui.briefHint")}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="order-2 rounded-2xl border border-slate-200 bg-white p-4 lg:order-1">
                <div className="mb-3">
                  <div className="text-sm font-medium text-foreground">{t("ui.blankTitle")}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("ui.blankDescription")}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("ui.manualPlaceholder")}
                    value={form.manualName}
                    onChange={(event) => onFormChange({ manualName: event.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={onCreateManual}
                    disabled={!form.manualName.trim() || createManualPending}
                  >
                    {createManualPending ? t("ui.creating") : t("ui.createBlank")}
                  </Button>
                </div>
              </div>

              <div className="order-1 rounded-2xl border border-slate-950 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(240,249,255,0.86))] p-4 lg:order-2">
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Sparkles className="size-4 text-sky-700" />{t("ui.aiTitle")}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("ui.aiDescription")}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("ui.nameOptional")}
                    value={form.briefName}
                    onChange={(event) => onFormChange({ briefName: event.target.value })}
                  />
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("ui.categoryOptional")}
                    value={form.briefCategory}
                    onChange={(event) => onFormChange({ briefCategory: event.target.value })}
                  />
                  <textarea
                    className="min-h-[180px] w-full rounded-md border p-2 text-sm"
                    placeholder={t("ui.briefPlaceholder")}
                    value={form.briefPrompt}
                    onChange={(event) => onFormChange({ briefPrompt: event.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={onCreateFromBrief}
                    disabled={!form.briefPrompt.trim() || createFromBriefPending}
                  >
                    {createFromBriefPending ? t("ui.generating") : t("ui.generateFormula")}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extract" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
              {t("ui.extractHint")}
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="space-y-4 rounded-lg border p-4">
                <div className={form.materialSource === "book_analysis" ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
                  <input
                    className="rounded-md border p-2 text-sm"
                    placeholder={t("ui.name")}
                    value={form.extractName}
                    onChange={(event) => onFormChange({ extractName: event.target.value })}
                  />
                  {form.materialSource !== "book_analysis" ? (
                    <input
                      className="rounded-md border p-2 text-sm"
                      placeholder={t("ui.category")}
                      value={form.extractCategory}
                      onChange={(event) => onFormChange({ extractCategory: event.target.value })}
                    />
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {MATERIAL_SOURCE_OPTIONS.map((option) => {
                    const active = option.key === form.materialSource;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white shadow"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                        onClick={() => onFormChange({ materialSource: option.key })}
                      >
                        <div className="text-sm font-semibold">{t(option.label)}</div>
                        <div className={`mt-1 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
                          {t(option.summary)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {form.materialSource === "direct_text" ? (
                  <textarea
                    className="min-h-[260px] w-full rounded-md border p-2 text-sm"
                    placeholder={t("ui.sourceTextPlaceholder")}
                    value={form.extractSourceText}
                    onChange={(event) => onFormChange({ extractSourceText: event.target.value })}
                  />
                ) : null}

                {form.materialSource === "knowledge_document" ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder={t("ui.searchKnowledge")}
                      value={form.knowledgeSearchKeyword}
                      onChange={(event) => onFormChange({ knowledgeSearchKeyword: event.target.value })}
                    />
                    <div className="grid max-h-[220px] gap-2 overflow-y-auto pr-1">
                      {knowledgeDocumentsLoading && knowledgeDocuments.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          {t("ui.loadingKnowledge")}
                        </div>
                      ) : null}
                      {!knowledgeDocumentsLoading && knowledgeDocuments.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          {t("ui.emptyKnowledge")}
                        </div>
                      ) : null}
                      {knowledgeDocuments.map((document) => {
                        const selected = document.id === form.knowledgeDocumentId;
                        return (
                          <button
                            key={document.id}
                            type="button"
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              selected ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            disabled={document.status === "archived"}
                            onClick={() => onFormChange({
                              knowledgeDocumentId: document.id,
                              knowledgeDocumentTitle: document.title,
                              extractName: form.extractName.trim() ? form.extractName : `${document.title}写法`,
                            })}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-950">{document.title}</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">{document.fileName}</div>
                              </div>
                              <Badge variant={selected ? "default" : "outline"}>
                                {selected ? t("ui.selected") : formatKnowledgeStatus(document.status)}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500">
                              {t("ui.activeVersion", { version: document.activeVersionNumber, versions: document.versionCount, analyses: document.bookAnalysisCount })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-2 rounded-xl border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-950">{t("ui.processingTitle")}</div>
                        {activeKnowledgeVersion ? (
                          <div className="text-xs text-slate-500">
                            {t("ui.snapshot", { chars: formatCharCount(activeKnowledgeVersion.charCount) })}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {KNOWLEDGE_SOURCE_PROCESSING_OPTIONS.map((option) => {
                          const active = option.key === form.knowledgeSourceProcessingMode;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              className={`rounded-xl border px-3 py-3 text-left transition ${
                                active
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white hover:border-slate-400"
                              }`}
                              onClick={() => onFormChange({ knowledgeSourceProcessingMode: option.key })}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">{t(option.label)}</div>
                                {option.badge ? (
                                  <Badge variant={active ? "secondary" : "outline"}>{t(option.badge)}</Badge>
                                ) : null}
                              </div>
                              <div className={`mt-1 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
                                {t(option.summary)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {form.knowledgeSourceProcessingMode === "representative_sample" ? (
                        <div className="text-xs leading-5 text-slate-500">
                          {t("ui.sampleNotice")}
                        </div>
                      ) : (
                        <div className="text-xs leading-5 text-amber-700">
                          {t("ui.fullNotice")}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border bg-slate-50/80 p-3 text-sm leading-6 text-slate-700">
                      {selectedKnowledgeDocumentLoading ? (
                        t("ui.reading")
                      ) : selectedKnowledgeDocument ? (
                        <>
                          <div className="font-medium text-slate-950">{selectedKnowledgeDocument.title}</div>
                          {activeKnowledgeVersion ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {t("ui.sourceVersion", { version: activeKnowledgeVersion.versionNumber, chars: formatCharCount(activeKnowledgeVersion.charCount) })}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-amber-700">{t("ui.noActiveVersion")}</div>
                          )}
                          {activeKnowledgeVersion && !activeKnowledgeVersion.content.trim() ? (
                            <div className="mt-1 text-xs text-amber-700">{t("ui.emptyContent")}</div>
                          ) : null}
                        </>
                      ) : (
                        t("ui.selectKnowledge")
                      )}
                    </div>
                  </div>
                ) : null}

                {form.materialSource === "book_analysis" ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      placeholder={t("ui.searchAnalysis")}
                      value={form.bookAnalysisSearchKeyword}
                      onChange={(event) => onFormChange({ bookAnalysisSearchKeyword: event.target.value })}
                    />
                    <div className="grid max-h-[290px] gap-2 overflow-y-auto pr-1">
                      {bookAnalysesLoading && bookAnalyses.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          {t("ui.loadingAnalysis")}
                        </div>
                      ) : null}
                      {!bookAnalysesLoading && bookAnalyses.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          {t("ui.emptyAnalysis")}
                        </div>
                      ) : null}
                      {bookAnalyses.map((analysis) => {
                        const selected = analysis.id === form.bookAnalysisId;
                        return (
                          <button
                            key={analysis.id}
                            type="button"
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              selected ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            onClick={() => onFormChange({
                              bookAnalysisId: analysis.id,
                              bookAnalysisTitle: analysis.title,
                              extractName: form.extractName.trim() ? form.extractName : `${analysis.title}写法`,
                            })}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-950">{analysis.title}</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">{analysis.documentTitle}</div>
                              </div>
                              <Badge variant={selected ? "default" : "outline"}>
                                {selected ? t("ui.selected") : t("ui.canGenerate")}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500">
                              {t("ui.analysisMeta", { version: analysis.documentVersionNumber, summary: analysis.summary || t("ui.analysisFallback") })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="sticky bottom-0 -mx-4 border-t bg-white/95 px-4 py-3 backdrop-blur">
                  <Button
                    className="w-full"
                    onClick={onSubmitExtractionTask}
                    disabled={materialSubmitDisabled}
                  >
                    {extractTaskSubmitting
                      ? form.materialSource === "book_analysis" ? t("ui.creatingFormula") : t("ui.submitting")
                      : extractionTaskIsActive && form.materialSource !== "book_analysis"
                        ? t("ui.taskActive")
                        : materialSubmitLabel}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                {form.materialSource === "book_analysis" ? (
                  <>
                    <div>
                      <div className="text-sm font-medium text-foreground">{t("ui.analysisTitle")}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("ui.analysisDescription")}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
                      {selectedBookAnalysis ? (
                        <>
                          <div className="font-medium text-slate-950">{selectedBookAnalysis.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t("ui.sourceVersion", { version: selectedBookAnalysis.documentVersionNumber, chars: selectedBookAnalysis.documentTitle })}
                          </div>
                          {selectedBookAnalysis.summary ? (
                            <div className="mt-3 text-xs leading-6 text-slate-600">{selectedBookAnalysis.summary}</div>
                          ) : null}
                        </>
                      ) : t("ui.analysisSelected")}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-sm font-medium text-foreground">{t("ui.keepTitle")}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("ui.keepDescription")}
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {EXTRACTION_PRESET_OPTIONS.map((preset) => {
                        const active = preset.key === selectedPresetKey;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              active
                                ? "border-slate-950 bg-slate-950 text-white shadow-lg"
                                : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                            onClick={() => onPresetChange(preset.key)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-base font-semibold">{t(preset.label)}</div>
                              {active ? <Badge variant="secondary" className="bg-white/10 text-white">{t("ui.current")}</Badge> : null}
                            </div>
                            <div className={`mt-2 text-sm leading-6 ${active ? "text-slate-200" : "text-slate-600"}`}>
                              {t(preset.summary)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border bg-amber-50/80 p-3 text-xs leading-6 text-amber-900">
                      {t("submitNotice", { preset: t(selectedPreset.label) })}
                    </div>
                    {activeExtractionTask ? (
                      <div className="rounded-xl border bg-slate-50/80 p-4 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{t("ui.backgroundTask")}</div>
                          <Badge variant={extractionTaskIsActive ? "secondary" : "outline"}>
                            {formatTaskStatus(activeExtractionTask)}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                          <div>{t("ui.taskTitle", { title: activeExtractionTask.title })}</div>
                          <div>{t("ui.stage", { stage: activeExtractionTask.currentStage ?? t("task.waitingApproval") })}</div>
                          <div>{t("ui.progress", { progress: Math.round(activeExtractionTask.progress * 100) })}</div>
                          {activeExtractionTask.failureSummary ? (
                            <div className="text-rose-600">{t("ui.failure", { reason: activeExtractionTask.failureSummary })}</div>
                          ) : null}
                        </div>
                        {onOpenTaskCenter ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-4 w-full"
                            onClick={() => onOpenTaskCenter(activeExtractionTask)}
                          >
                            {t("ui.taskCenter")}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                        {t("ui.afterSubmit")}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
