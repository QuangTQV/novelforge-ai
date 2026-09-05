import { translateUi } from "@/i18n/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DirectorIdeaConstellationOption,
  DirectorIdeaConstellationSelection,
  DirectorIdeaInspiration,
} from "@ai-novel/shared/types/novelDirector";
import type { NovelResourceRecommendationSource } from "@ai-novel/shared/types/novelResourceRecommendation";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Layers3, Route, Sparkles, X } from "lucide-react";
import { flattenGenreTreeOptions, type GenreTreeNode } from "@/api/genre";
import { flattenStoryModeTreeOptions, type StoryModeTreeNode } from "@/api/storyMode";
import { Button } from "@/components/ui/button";
import NovelAutoDirectorIdeaInspirationPanel from "../components/NovelAutoDirectorIdeaInspirationPanel";
import OnboardingTip from "@/components/onboarding/OnboardingTip";
import StoryModeProfileDetails from "@/components/storyModes/StoryModeProfileDetails";
import CreationFoundationPickerDialog from "./CreationFoundationPickerDialog";
import StoryConstellationDialog from "./ideaConstellation/StoryConstellationDialog";
import type { FoundationConstellationOption } from "./ideaConstellation/ideaConstellationState";

interface StageIdeaProps {
  idea: string;
  onIdeaChange: (value: string) => void;
  ideaInspirations: DirectorIdeaInspiration[];
  isGeneratingIdeaInspirations: boolean;
  onGenerateIdeaInspirations: () => void;
  ideaConstellationOptions: DirectorIdeaConstellationOption[];
  isGeneratingIdeaConstellationOptions: boolean;
  isComposingIdeaConstellation: boolean;
  onGenerateIdeaConstellationOptions: () => void;
  onComposeIdeaConstellation: (selected: DirectorIdeaConstellationSelection[]) => Promise<string>;
  onContinue: () => void;
  onQuickGenerate: () => void;
  canContinue: boolean;
  isGenerating: boolean;
  genreTree: GenreTreeNode[];
  storyModeTree: StoryModeTreeNode[];
  selectedGenreId: string;
  selectedGenreIds: string[];
  selectedGenreLabel: string;
  selectedGenreSource?: NovelResourceRecommendationSource;
  selectedStoryModeId: string;
  selectedStoryModeLabel: string;
  selectedStoryModeSource?: NovelResourceRecommendationSource;
  genreLoading: boolean;
  genreError: boolean;
  storyModeLoading: boolean;
  storyModeError: boolean;
  isUpdatingFoundation: boolean;
  onRetryGenres: () => void;
  onRetryStoryModes: () => void;
  onFoundationChange: (patch: Partial<{
    genreId: string;
    genreIds: string[];
    primaryStoryModeId: string;
  }>) => Promise<boolean>;
}

function sourceLabel(source: NovelResourceRecommendationSource | undefined): string | null {
  if (source === "user_selected") return translateUi("你的选择");
  if (source === "ai_recommended") return translateUi("AI 匹配");
  if (source === "market_recommended") return translateUi("雷达推荐");
  return null;
}

function buildFoundationCloudOptions(
  options: Array<{ id: string; name: string; level: number; description?: string | null }>,
  selectedId: string,
  fallbackHint: string,
): FoundationConstellationOption[] {
  const nestedOptions = options.filter((option) => option.level > 0);
  const preferred = nestedOptions.length >= 3 ? nestedOptions : options;
  const selected = options.find((option) => option.id === selectedId);
  const available = selected && !preferred.some((option) => option.id === selected.id)
    ? [...preferred, selected]
    : preferred;
  return available.map((option) => ({
    id: option.id,
    label: translateUi(option.name),
    hint: option.description?.trim() || fallbackHint,
  }));
}

export default function StageIdea({
  idea,
  onIdeaChange,
  ideaInspirations,
  isGeneratingIdeaInspirations,
  onGenerateIdeaInspirations,
  ideaConstellationOptions,
  isGeneratingIdeaConstellationOptions,
  isComposingIdeaConstellation,
  onGenerateIdeaConstellationOptions,
  onComposeIdeaConstellation,
  onContinue,
  onQuickGenerate,
  canContinue,
  isGenerating,
  genreTree,
  storyModeTree,
  selectedGenreId,
  selectedGenreIds,
  selectedGenreLabel,
  selectedGenreSource,
  selectedStoryModeId,
  selectedStoryModeLabel,
  selectedStoryModeSource,
  genreLoading,
  genreError,
  storyModeLoading,
  storyModeError,
  isUpdatingFoundation,
  onRetryGenres,
  onRetryStoryModes,
  onFoundationChange,
}: StageIdeaProps) {
  useTranslation();
  const reducedMotion = useReducedMotion();
  const [showInspirations, setShowInspirations] = useState(false);
  const [constellationDialogOpen, setConstellationDialogOpen] = useState(false);
  const [genreDialogOpen, setGenreDialogOpen] = useState(false);
  const [storyModeDialogOpen, setStoryModeDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimersRef = useRef<number[]>([]);
  const constellationGenreOptions = useMemo(
    () => buildFoundationCloudOptions(
      flattenGenreTreeOptions(genreTree),
      selectedGenreId,
      translateUi("这个故事类型会约束世界、人物和主要冲突。"),
    ),
    [genreTree, selectedGenreId],
  );
  const constellationStoryModeOptions = useMemo(
    () => buildFoundationCloudOptions(
      flattenStoryModeTreeOptions(storyModeTree),
      selectedStoryModeId,
      translateUi("这种推进方式会决定故事持续制造期待的方法。"),
    ),
    [selectedStoryModeId, storyModeTree],
  );

  useEffect(() => () => {
    typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
  }, [idea]);

  const fillIdea = (text: string) => {
    typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    typingTimersRef.current = [];
    setShowInspirations(false);
    if (reducedMotion) {
      onIdeaChange(text);
      return;
    }
    onIdeaChange("");
    const steps = 12;
    for (let step = 1; step <= steps; step += 1) {
      const timer = window.setTimeout(() => {
        const end = Math.ceil((text.length * step) / steps);
        onIdeaChange(text.slice(0, end));
      }, step * 18);
      typingTimersRef.current.push(timer);
    }
  };

  const useIdeaInspiration = (text: string) => {
    if (idea.trim()) {
      const confirmed = window.confirm(translateUi("上方起始想法已有内容。确认使用这条灵感并覆盖原内容吗？"));
      if (!confirmed) return;
    }
    fillIdea(text);
  };

  const useConstellationIdea = (text: string) => {
    fillIdea(text);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleOpenConstellation = () => {
    setConstellationDialogOpen(true);
    if (ideaConstellationOptions.length === 0 && !isGeneratingIdeaConstellationOptions) {
      onGenerateIdeaConstellationOptions();
    }
  };

  const handleShowInspirations = () => {
    setShowInspirations(true);
    if (ideaInspirations.length === 0 && !isGeneratingIdeaInspirations) {
      onGenerateIdeaInspirations();
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-4xl flex-col items-center justify-center px-1 py-10 sm:py-16">
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="w-full text-center"
      >
        <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-[32px]">

          {translateUi("用一句话，开始你的整本书")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">

          {translateUi("写下你想看的故事，AI 会先帮你整理成可选择的整本书方向。")}
        </p>
      </motion.div>

      <div className="mt-6 w-full">
        <OnboardingTip
          storageKey="auto-director-idea"
          title={translateUi("一句话不需要写成完整大纲")}
          description={translateUi("写清主角、处境或最想看的冲突即可。故事类型和推进方式可以交给 AI，也可以在下方先指定。")}
          next={translateUi("AI 生成两套差异明确的整书方向。")}
        />
      </div>

      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.22, delay: reducedMotion ? 0 : 0.08 }}
        className="mt-8 w-full rounded-lg bg-muted/20 p-3 shadow-[0_14px_44px_rgba(15,23,42,0.06)] transition focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/30 sm:p-4"
      >
        <textarea
          ref={textareaRef}
          className="min-h-[180px] w-full resize-none bg-transparent px-1 py-1 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-lg sm:leading-8"
          value={idea}
          onChange={(event) => onIdeaChange(event.target.value)}
          placeholder={translateUi("例如：普通女大学生误入异能组织，一边上学打工，一边调查父亲失踪真相。")}
        />
        <div className="px-1 pb-3 text-left text-xs text-muted-foreground">

          {translateUi("填写内容会保存在本机，刷新或重新打开后可以继续。")}
        </div>
        <div className="border-t border-border/60 pt-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{translateUi("创作偏好（可选）")}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-md bg-background/65 ring-1 ring-border/70">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/45 disabled:opacity-50"
                onClick={() => setGenreDialogOpen(true)}
                disabled={isGenerating || isUpdatingFoundation}
              >
                <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {selectedGenreLabel || translateUi("故事类型：AI 自动匹配")}
                </span>
                {sourceLabel(selectedGenreSource) ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{sourceLabel(selectedGenreSource)}</span>
                ) : null}
              </button>
              {selectedGenreId ? (
                <button
                  type="button"
                  className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={translateUi("清除故事类型")}
                  disabled={isGenerating || isUpdatingFoundation}
                  onClick={() => void onFoundationChange({ genreId: "", genreIds: [] })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 items-center rounded-md bg-background/65 ring-1 ring-border/70">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/45 disabled:opacity-50"
                onClick={() => setStoryModeDialogOpen(true)}
                disabled={isGenerating || isUpdatingFoundation}
              >
                <Route className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {selectedStoryModeLabel || translateUi("推进方式：AI 自动搭配")}
                </span>
                {sourceLabel(selectedStoryModeSource) ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{sourceLabel(selectedStoryModeSource)}</span>
                ) : null}
              </button>
              {selectedStoryModeId ? (
                <button
                  type="button"
                  className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={translateUi("清除推进方式")}
                  disabled={isGenerating || isUpdatingFoundation}
                  onClick={() => void onFoundationChange({ primaryStoryModeId: "" })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 rounded-md bg-background/65 p-3 ring-1 ring-border/70">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{translateUi("Thể loại (có thể chọn nhiều)")}</div>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {flattenGenreTreeOptions(genreTree).map((option) => {
                const activeIds = selectedGenreIds.length > 0 ? selectedGenreIds : selectedGenreId ? [selectedGenreId] : [];
                const checked = activeIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={checked}
                    disabled={isGenerating || isUpdatingFoundation}
                    className={`rounded-full px-3 py-1.5 text-xs ring-1 transition ${checked ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground ring-border hover:bg-muted"}`}
                    onClick={() => {
                      const nextIds = checked ? activeIds.filter((id) => id !== option.id) : [...activeIds, option.id];
                      void onFoundationChange({ genreIds: nextIds, genreId: nextIds[0] ?? "" });
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{translateUi("Có thể chọn nhiều thể loại. Thể loại đầu tiên được dùng làm thể loại chính.")}</div>
          </div>
          {(genreError || storyModeError) ? (
            <div className="mt-2 text-xs text-muted-foreground">

              {translateUi("部分可选方向暂时未加载，你仍可交给 AI 自动搭配后继续。")}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenConstellation}
              disabled={isGenerating || isComposingIdeaConstellation}
            >
              <Sparkles className="h-4 w-4" />

              {translateUi("打开故事星图")}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              onClick={handleShowInspirations}
              disabled={isGeneratingIdeaInspirations}
            >
              {isGeneratingIdeaInspirations ? translateUi("正在准备几个想法...") : translateUi("直接给我几个想法")}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              className="text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              onClick={onQuickGenerate}
              disabled={!canContinue || isGenerating}
            >
              {isGenerating ? translateUi("生成中...") : translateUi("用默认设置直接生成方向")}
            </button>
            <Button type="button" onClick={onContinue} disabled={!canContinue}>

              {translateUi("继续完善设定")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {showInspirations && (ideaInspirations.length > 0 || isGeneratingIdeaInspirations) ? (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className="w-full"
        >
          <NovelAutoDirectorIdeaInspirationPanel
            ideas={ideaInspirations}
            isGenerating={isGeneratingIdeaInspirations}
            onGenerate={onGenerateIdeaInspirations}
            onUseIdea={useIdeaInspiration}
          />
        </motion.div>
      ) : null}

      <StoryConstellationDialog
        open={constellationDialogOpen}
        onOpenChange={setConstellationDialogOpen}
        options={ideaConstellationOptions}
        genreOptions={constellationGenreOptions}
        storyModeOptions={constellationStoryModeOptions}
        selectedGenreId={selectedGenreId}
        selectedStoryModeId={selectedStoryModeId}
        isUpdatingFoundation={isUpdatingFoundation}
        isGenerating={isGeneratingIdeaConstellationOptions}
        isComposing={isComposingIdeaConstellation}
        onGenerate={onGenerateIdeaConstellationOptions}
        onSelectGenre={(genreId) => onFoundationChange({ genreId })}
        onSelectStoryMode={(primaryStoryModeId) => onFoundationChange({ primaryStoryModeId })}
        onCompose={onComposeIdeaConstellation}
        onUseIdea={useConstellationIdea}
      />

      <CreationFoundationPickerDialog
        open={genreDialogOpen}
        onOpenChange={setGenreDialogOpen}
        title={translateUi("选择故事类型")}
        description={translateUi("这个选择会约束后续方向、世界、人物与剧情规划；不确定时交给 AI 即可。")}
        treeTitle={translateUi("题材目录")}
        nodes={genreTree}
        selectedId={selectedGenreId}
        autoLabel={translateUi("交给 AI 匹配故事类型")}
        emptyLabel={translateUi("题材基底库暂时为空，可以先交给 AI 自动处理。")}
        loading={genreLoading}
        error={genreError}
        applying={isUpdatingFoundation}
        onRetry={onRetryGenres}
        onApply={(genreId) => onFoundationChange({ genreId })}
      />

      <CreationFoundationPickerDialog
        open={storyModeDialogOpen}
        onOpenChange={setStoryModeDialogOpen}
        title={translateUi("选择主要推进方式")}
        description={translateUi("它决定故事主要靠什么持续变精彩；辅助推进方式仍由 AI 自动补充。")}
        treeTitle={translateUi("推进模式目录")}
        nodes={storyModeTree}
        selectedId={selectedStoryModeId}
        autoLabel={translateUi("交给 AI 搭配推进方式")}
        emptyLabel={translateUi("推进模式库暂时为空，可以先交给 AI 自动处理。")}
        loading={storyModeLoading}
        error={storyModeError}
        applying={isUpdatingFoundation}
        onRetry={onRetryStoryModes}
        onApply={(primaryStoryModeId) => onFoundationChange({ primaryStoryModeId })}
        renderDetails={(node) => <StoryModeProfileDetails node={node} eyebrow={translateUi("当前选择")} />}
      />
    </section>
  );
}
