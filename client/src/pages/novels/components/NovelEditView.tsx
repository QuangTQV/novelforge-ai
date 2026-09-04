import { translateUi } from "@/i18n/legacy";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useIsMobileViewport } from "@/components/layout/mobile/useIsMobileViewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import KnowledgeBindingPanel from "@/components/knowledge/KnowledgeBindingPanel";
import AITakeoverContainer from "@/components/workflow/AITakeoverContainer";
import ChapterManagementTab from "./ChapterManagementTab";
import DirectorFactDebugDialog from "./DirectorFactDebugDialog";
import NovelCharacterPanel from "./NovelCharacterPanel";
import NovelTaskDrawer from "./NovelTaskDrawer";
import OutlineTab from "./OutlineTab";
import PipelineTab from "./PipelineTab";
import StoryMacroPlanTab from "./StoryMacroPlanTab";
import StructuredOutlineTab from "./StructuredOutlineTab";
import VersionHistoryTab from "./VersionHistoryTab";
import BasicInfoTab from "./BasicInfoTab";
import WorldSetupTab from "./WorldSetupTab";
import { devResetNovelChapters } from "@/api/novel";
import { toast } from "@/components/ui/toast";
import { queryKeys } from "@/api/queryKeys";
import MobileNovelEditView from "../mobile/MobileNovelEditView";
import type { NovelEditViewProps } from "./NovelEditView.types";
import {
  getNovelWorkspaceFlowStepIndex,
  getNovelWorkspaceTabLabel,
  NOVEL_WORKSPACE_FLOW_STEPS,
  normalizeNovelWorkspaceTab,
  tabFromDirectorDisplayStage,
} from "../novelWorkspaceNavigation";
import { StepHero } from "./workspaceShell";

export default function NovelEditView(props: NovelEditViewProps) {
  const isMobileViewport = useIsMobileViewport();

  if (isMobileViewport) {
    return <MobileNovelEditView {...props} />;
  }

  return <DesktopNovelEditView {...props} />;
}

function DesktopNovelEditView(props: NovelEditViewProps) {
  const {
    id,
    activeTab,
    workflowCurrentTab,
    exportControls,
    basicTab,
    worldTab,
    storyMacroTab,
    outlineTab,
    structuredTab,
    chapterTab,
    pipelineTab,
    characterTab,
    takeover,
    taskDrawer,
    activeStepTakeoverEntry,
    onSwitchToSimpleMode,
    isSwitchingToSimpleMode = false,
  } = props;

  const [isProjectToolsOpen, setIsProjectToolsOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const resetChaptersMutation = useMutation({
    mutationFn: () => devResetNovelChapters(id),
    onSuccess: async (result) => {
      toast.success(translateUi("已重置 {{value0}} 个章节正文，可重新生成。", { value0: result.resetCount }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.novels.chapters(id) }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : translateUi("章节重置失败，请重试。"));
    },
  });

  const totalChapters = chapterTab.chapters.length;
  const generatedChapters = chapterTab.chapters.filter((item) => Boolean(item.content?.trim())).length;
  const pendingRepairs = pipelineTab.chapterReports.filter(
    (item) => item.overall < pipelineTab.pipelineForm.qualityThreshold,
  ).length;
  const currentModel = pipelineTab.pipelineJob?.payload
    ? (() => {
        try {
          const parsed = JSON.parse(pipelineTab.pipelineJob.payload) as { model?: string };
          return parsed.model ?? "default";
        } catch {
          return "default";
        }
      })()
    : "default";

  const pendingResourceProposalCount = taskDrawer?.resourceProposals?.length ?? 0;
  const taskAttentionLabel = (() => {
    if (pendingResourceProposalCount > 0) {
      return translateUi("{{v0}} 条资源", { v0: pendingResourceProposalCount });
    }
    if (!taskDrawer?.task) {
      return null;
    }
    if (taskDrawer.task.pendingManualRecovery) {
      return translateUi("待恢复");
    }
    if (taskDrawer.task.status === "failed") {
      return translateUi("异常");
    }
    if (taskDrawer.task.status === "waiting_approval") {
      return translateUi("待审核");
    }
    if (taskDrawer.task.status === "running" || taskDrawer.task.status === "queued") {
      return translateUi("进行中");
    }
    return translateUi("最近任务");
  })();

  const normalizedActiveTab = normalizeNovelWorkspaceTab(activeTab);
  const normalizedWorkflowTab = normalizeNovelWorkspaceTab(workflowCurrentTab ?? activeTab);
  const guidedFlowTab = normalizedActiveTab === "history"
    ? normalizedWorkflowTab === "history"
      ? "basic"
      : normalizedWorkflowTab
    : normalizedActiveTab;
  const novelTitle = basicTab.basicForm.title.trim() || translateUi("未命名小说");
  const directorDisplayState = taskDrawer?.snapshot?.displayState ?? null;
  const currentPageLabel = getNovelWorkspaceTabLabel(normalizedActiveTab);
  const currentStepLabel = directorDisplayState?.stageLabel ?? currentPageLabel;
  const recommendedWorkflowTab = directorDisplayState
    ? tabFromDirectorDisplayStage(directorDisplayState.stageKey)
    : normalizedWorkflowTab;
  const workflowStepLabel = recommendedWorkflowTab
    ? getNovelWorkspaceTabLabel(recommendedWorkflowTab)
    : null;
  const stepIndex = directorDisplayState?.stepIndex ?? getNovelWorkspaceFlowStepIndex(guidedFlowTab);
  const progressLabel = stepIndex >= 0
    ? `\u7b2c ${stepIndex + 1} \u6b65 / \u5171 ${directorDisplayState?.totalSteps ?? NOVEL_WORKSPACE_FLOW_STEPS.length} \u6b65`
    : null;
  const showWorkflowRecommendation = Boolean(
    recommendedWorkflowTab
    && recommendedWorkflowTab !== normalizedActiveTab,
  );
  const isTakeoverLoading = takeover?.mode === "loading";
  const hideTakeoverEntry = takeover?.mode === "running" || takeover?.mode === "waiting";
  const workspaceTone = taskDrawer?.task?.status === "failed"
    ? "danger"
    : taskDrawer?.task?.status === "waiting_approval"
      ? "warning"
      : taskDrawer?.task?.status === "running" || taskDrawer?.task?.status === "queued"
        ? "info"
        : "neutral";

  const renderActivePanel = () => {
    switch (activeTab) {
      case "basic":
        return <BasicInfoTab {...basicTab} />;
      case "world":
        return <WorldSetupTab {...worldTab} />;
      case "outline":
        return <OutlineTab {...outlineTab} />;
      case "story_macro":
        return <StoryMacroPlanTab {...storyMacroTab} />;
      case "structured":
        return <StructuredOutlineTab {...structuredTab} />;
      case "chapter":
        return <ChapterManagementTab {...chapterTab} />;
      case "pipeline":
        return <PipelineTab {...pipelineTab} />;
      case "character":
        return <NovelCharacterPanel {...characterTab} />;
      case "history":
        return <VersionHistoryTab novelId={id} />;
      default:
        return <BasicInfoTab {...basicTab} />;
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      {id ? (
        <StepHero
          tone={workspaceTone}
          eyebrow={(
            <>
              <span className="truncate font-semibold text-foreground">{novelTitle}</span>
              {progressLabel ? <span>{progressLabel}</span> : null}
              <span>{translateUi("当前页面：")}{currentPageLabel}</span>
            </>
          )}
          title={currentStepLabel}
          description={showWorkflowRecommendation && workflowStepLabel
            ? translateUi("流程推荐：建议切换到「{{value0}}」继续推进。", { value0: workflowStepLabel })
            : translateUi("按当前步骤整理这本书的生产资产，需要时可以交给 AI 自动导演接管。")}
          actions={(
            <>
            {onSwitchToSimpleMode ? (
              <Button type="button" variant="outline" onClick={onSwitchToSimpleMode} disabled={isSwitchingToSimpleMode}>
                {isSwitchingToSimpleMode ? <Loader2 className="animate-spin" /> : <Sparkles />}

                {translateUi("简易模式")}
              </Button>
            ) : null}
            {!hideTakeoverEntry ? (
              isTakeoverLoading ? (
                <Button type="button" size="sm" disabled>
                  <Loader2 className="animate-spin" />

                  {translateUi("AI 自动导演接管")}
                </Button>
              ) : activeStepTakeoverEntry
            ) : null}

            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{translateUi("导出")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{translateUi("导出项目内容")}</DialogTitle>
                  <DialogDescription>

                    {translateUi("当前步骤会按你正在查看的工作台导出；整本书可导出项目资产，或下载只含正文的 TXT 文件。")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{translateUi("当前步骤：")}{currentStepLabel}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportCurrent("markdown")}
                        disabled={!exportControls.canExportCurrentStep || exportControls.isExportingCurrentMarkdown}
                      >
                        {exportControls.isExportingCurrentMarkdown ? translateUi("导出中...") : "Markdown"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportCurrent("json")}
                        disabled={!exportControls.canExportCurrentStep || exportControls.isExportingCurrentJson}
                      >
                        {exportControls.isExportingCurrentJson ? translateUi("导出中...") : "JSON"}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{translateUi("整本书")}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => exportControls.onExportFull("txt")}
                        disabled={exportControls.isExportingFullTxt}
                      >
                        {exportControls.isExportingFullTxt ? translateUi("导出中...") : translateUi("TXT 正文")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportFull("markdown")}
                        disabled={exportControls.isExportingFullMarkdown}
                      >
                        {exportControls.isExportingFullMarkdown ? translateUi("导出中...") : "Markdown"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportControls.onExportFull("json")}
                        disabled={exportControls.isExportingFullJson}
                      >
                        {exportControls.isExportingFullJson ? translateUi("导出中...") : "JSON"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>

            <DirectorFactDebugDialog novelId={id} taskId={taskDrawer?.task?.id ?? null} />

            <Dialog open={isProjectToolsOpen} onOpenChange={setIsProjectToolsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{translateUi("项目工具")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-auto">
                <DialogHeader>
                  <DialogTitle>{translateUi("项目工具")}</DialogTitle>
                  <DialogDescription>

                    {translateUi("这里收纳次级信息。首屏只保留当前步骤和恢复接管入口，避免主工作区被项目辅助信息挤满。")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{translateUi("章节进度")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{generatedChapters} / {Math.max(totalChapters, 1)}  {translateUi("已生成")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>{translateUi("待修复章节")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{pendingRepairs}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>{translateUi("当前模型")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{currentModel}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>{translateUi("最近任务")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{pipelineTab.pipelineJob?.status ?? "idle"}</p>
                    </CardContent>
                  </Card>
                </div>
                <KnowledgeBindingPanel targetType="novel" targetId={id} title={translateUi("参考知识")} />

                {/* 开发工具区 —— 仅在 DEV 环境可见 */}
                {import.meta.env.DEV ? (
                  <Card className="border-dashed border-yellow-500/60 bg-yellow-50/30 dark:bg-yellow-950/10">
                    <CardHeader>
                      <CardTitle className="text-sm text-yellow-700 dark:text-yellow-400">{translateUi("🛠 开发工具")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">

                        {translateUi("重置后，所有章节正文、事实账本、摘要和质量报告将被清空，章节状态回到\"未规划\"。规划层数据（人物、大纲、卷规划）保留不变。")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/60 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                        disabled={resetChaptersMutation.isPending}
                        onClick={() => {
                          if (window.confirm(translateUi("确认重置本小说所有 {{value0}} 个章节的正文？此操作不可撤销（但快照数据保留）。", { value0: totalChapters }))) {
                            resetChaptersMutation.mutate();
                          }
                        }}
                      >
                        {resetChaptersMutation.isPending
                          ? <><Loader2 className="animate-spin" />{translateUi("重置中…")}</>
                          : <><RotateCcw />{translateUi("重置所有章节正文")}</>}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
              </DialogContent>
            </Dialog>

            <Button
              variant={taskDrawer?.task?.status === "failed" ? "destructive" : "secondary"}
              onClick={() => taskDrawer?.onOpenChange(true)}
            >

              {translateUi("执行详情")}
              {taskAttentionLabel ? <Badge variant="secondary">{taskAttentionLabel}</Badge> : null}
            </Button>
            </>
          )}
        />
      ) : null}

      <div className="space-y-4 pt-1">
        {takeover ? (
          <AITakeoverContainer
            mode={takeover.mode}
            title={takeover.title}
            description={takeover.description}
            progress={takeover.progress}
            currentAction={takeover.currentAction}
            checkpointLabel={takeover.checkpointLabel}
            taskId={takeover.taskId}
            actions={takeover.actions}
          >
            {renderActivePanel()}
          </AITakeoverContainer>
        ) : (
          renderActivePanel()
        )}
      </div>

      {taskDrawer ? <NovelTaskDrawer {...taskDrawer} /> : null}
    </div>
  );
}
