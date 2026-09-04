import { translateUi } from "@/i18n/legacy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreativeHubProductionStatus } from "@ai-novel/shared/types/creativeHub";
import { RefreshCw } from "lucide-react";
import { getNovelDetail, updateNovel } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { WorkspaceStateNotice } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import SelectControl from "@/components/common/SelectControl";

interface NovelProductionStarterCardProps {
  currentNovelTitle?: string | null;
  currentNovelId?: string | null;
  productionStatus?: CreativeHubProductionStatus | null;
  actionDisabled?: boolean;
  onSubmit: (prompt: string) => void | Promise<void>;
  onQuickAction?: (prompt: string) => void;
}

function ProductionField(props: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={props.htmlFor} className="block text-xs font-medium text-foreground">
        {props.label}
      </label>
      {props.children}
      {props.hint ? <p className="text-xs leading-5 text-muted-foreground">{props.hint}</p> : null}
    </div>
  );
}

function fromNarrativePov(value: "first_person" | "third_person" | "mixed" | null | undefined): string {
  if (value === "first_person") return translateUi("第一人称");
  if (value === "third_person") return translateUi("第三人称");
  if (value === "mixed") return translateUi("混合视角");
  return "";
}

function toNarrativePov(value: string): "first_person" | "third_person" | "mixed" | null {
  if (value === "第一人称") return "first_person";
  if (value === "第三人称") return "third_person";
  if (value === "混合视角") return "mixed";
  return null;
}

function fromPacePreference(value: "slow" | "balanced" | "fast" | null | undefined): string {
  if (value === "slow") return translateUi("慢节奏");
  if (value === "balanced") return translateUi("均衡节奏");
  if (value === "fast") return translateUi("快节奏");
  return "";
}

function toPacePreference(value: string): "slow" | "balanced" | "fast" | null {
  if (value === "慢节奏") return "slow";
  if (value === "均衡节奏") return "balanced";
  if (value === "快节奏") return "fast";
  return null;
}

function fromProjectMode(value: "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline" | null | undefined): string {
  if (value === "ai_led") return translateUi("AI 主导");
  if (value === "co_pilot") return translateUi("人机协作");
  if (value === "draft_mode") return translateUi("草稿优先");
  if (value === "auto_pipeline") return translateUi("自动流水线");
  return "";
}

function toProjectMode(value: string): "ai_led" | "co_pilot" | "draft_mode" | "auto_pipeline" | null {
  if (value === "AI 主导") return "ai_led";
  if (value === "人机协作") return "co_pilot";
  if (value === "草稿优先") return "draft_mode";
  if (value === "自动流水线") return "auto_pipeline";
  return null;
}

function fromLevel(value: "low" | "medium" | "high" | null | undefined): string {
  if (value === "low") return translateUi("低");
  if (value === "medium") return translateUi("中");
  if (value === "high") return translateUi("高");
  return "";
}

function toLevel(value: string): "low" | "medium" | "high" | null {
  if (value === "低") return "low";
  if (value === "中") return "medium";
  if (value === "高") return "high";
  return null;
}

function buildProductionPrompt(input: {
  currentNovelId?: string | null;
  title: string;
  description: string;
  targetChapterCount: number;
  genre: string;
  styleTone: string;
  narrativePov: string;
  pacePreference: string;
  projectMode: string;
  emotionIntensity: string;
  aiFreedom: string;
  defaultChapterLength: number;
  worldType: string;
}) {
  const description = input.description.trim();
  const genre = input.genre.trim();
  const styleTone = input.styleTone.trim();
  const narrativePov = input.narrativePov.trim();
  const pacePreference = input.pacePreference.trim();
  const projectMode = input.projectMode.trim();
  const emotionIntensity = input.emotionIntensity.trim();
  const aiFreedom = input.aiFreedom.trim();
  const defaultChapterLength = Math.max(500, Math.min(10000, Math.floor(input.defaultChapterLength || 2500)));
  const worldType = input.worldType.trim();
  const targetChapterCount = Math.max(1, Math.min(200, Math.floor(input.targetChapterCount || 20)));
  if (input.currentNovelId) {
    const segments = [translateUi("继续生成当前小说。目标章节数：{{v0}}。", { v0: targetChapterCount })];
    if (description) {
      segments.push(translateUi("补充设定：{{v0}}。", { v0: description }));
    }
    if (genre) {
      segments.push(translateUi("题材偏好：{{v0}}。", { v0: genre }));
    }
    if (styleTone) {
      segments.push(translateUi("风格基调：{{v0}}。", { v0: styleTone }));
    }
    if (narrativePov) {
      segments.push(translateUi("叙事视角：{{v0}}。", { v0: narrativePov }));
    }
    if (pacePreference) {
      segments.push(translateUi("推进节奏：{{v0}}。", { v0: pacePreference }));
    }
    if (projectMode) {
      segments.push(translateUi("协作模式：{{v0}}。", { v0: projectMode }));
    }
    if (emotionIntensity) {
      segments.push(translateUi("情绪强度：{{v0}}。", { v0: emotionIntensity }));
    }
    if (aiFreedom) {
      segments.push(translateUi("AI 自由度：{{v0}}。", { v0: aiFreedom }));
    }
    if (defaultChapterLength) {
      segments.push(translateUi("默认章长：约 {{v0}} 字。", { v0: defaultChapterLength }));
    }
    if (worldType) {
      segments.push(translateUi("世界观类型偏好：{{v0}}。", { v0: worldType }));
    }
    return segments.join("");
  }
  const title = input.title.trim();
  const segments = [translateUi("创建一本{{v0}}章小说《{{v1}}》，并开始整本生成。", { v0: targetChapterCount, v1: title })];
  if (description) {
    segments.push(translateUi("简介：{{v0}}。", { v0: description }));
  }
  if (genre) {
    segments.push(translateUi("题材：{{v0}}。", { v0: genre }));
  }
  if (styleTone) {
    segments.push(translateUi("风格基调：{{v0}}。", { v0: styleTone }));
  }
  if (narrativePov) {
    segments.push(translateUi("叙事视角：{{v0}}。", { v0: narrativePov }));
  }
  if (pacePreference) {
    segments.push(translateUi("推进节奏：{{v0}}。", { v0: pacePreference }));
  }
  if (projectMode) {
    segments.push(translateUi("协作模式：{{v0}}。", { v0: projectMode }));
  }
  if (emotionIntensity) {
    segments.push(translateUi("情绪强度：{{v0}}。", { v0: emotionIntensity }));
  }
  if (aiFreedom) {
    segments.push(translateUi("AI 自由度：{{v0}}。", { v0: aiFreedom }));
  }
  if (defaultChapterLength) {
    segments.push(translateUi("默认章长：约 {{v0}} 字。", { v0: defaultChapterLength }));
  }
  if (worldType) {
    segments.push(translateUi("世界观类型：{{v0}}。", { v0: worldType }));
  }
  return segments.join("");
}

export default function NovelProductionStarterCard({
  currentNovelTitle,
  currentNovelId,
  productionStatus,
  actionDisabled = false,
  onSubmit,
  onQuickAction,
}: NovelProductionStarterCardProps) {
  const { t } = useTranslation("creativeHub");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetChapterCount, setTargetChapterCount] = useState(20);
  const [genre, setGenre] = useState("");
  const [styleTone, setStyleTone] = useState("");
  const [narrativePov, setNarrativePov] = useState("");
  const [pacePreference, setPacePreference] = useState("");
  const [projectMode, setProjectMode] = useState("");
  const [emotionIntensity, setEmotionIntensity] = useState("");
  const [aiFreedom, setAiFreedom] = useState("");
  const [defaultChapterLength, setDefaultChapterLength] = useState(2500);
  const [worldType, setWorldType] = useState("");
  const submitInFlightRef = useRef(false);

  const novelDetailQuery = useQuery({
    queryKey: queryKeys.novels.detail(currentNovelId || "none"),
    queryFn: () => getNovelDetail(currentNovelId!),
    enabled: Boolean(currentNovelId),
    retry: false,
  });

  useEffect(() => {
    setTitle("");
    setDescription("");
    setTargetChapterCount(20);
    setGenre("");
    setStyleTone("");
    setNarrativePov("");
    setPacePreference("");
    setProjectMode("");
    setEmotionIntensity("");
    setAiFreedom("");
    setDefaultChapterLength(2500);
    setWorldType("");
  }, [currentNovelId]);

  useEffect(() => {
    if (productionStatus?.targetChapterCount) {
      setTargetChapterCount(productionStatus.targetChapterCount);
    }
  }, [productionStatus?.targetChapterCount]);

  useEffect(() => {
    const novel = novelDetailQuery.data?.data;
    if (!currentNovelId || !novel) {
      return;
    }
    setDescription(novel.description ?? "");
    setGenre(novel.genre?.name ?? "");
    setStyleTone(novel.styleTone ?? "");
    setNarrativePov(fromNarrativePov(novel.narrativePov));
    setPacePreference(fromPacePreference(novel.pacePreference));
    setProjectMode(fromProjectMode(novel.projectMode));
    setEmotionIntensity(fromLevel(novel.emotionIntensity));
    setAiFreedom(fromLevel(novel.aiFreedom));
    setDefaultChapterLength(novel.defaultChapterLength ?? 2500);
  }, [currentNovelId, novelDetailQuery.data]);

  const resolvedTitle = currentNovelTitle?.trim() || "";
  const isContinueMode = Boolean(currentNovelId);
  const detailErrorMessage = novelDetailQuery.error instanceof Error
    ? novelDetailQuery.error.message
    : isContinueMode && novelDetailQuery.isSuccess && !novelDetailQuery.data?.data
      ? t("productionStarter.detailNotFound")
      : "";
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (currentNovelId) {
        await updateNovel(currentNovelId, {
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(styleTone.trim() ? { styleTone: styleTone.trim() } : {}),
          ...(toNarrativePov(narrativePov) ? { narrativePov: toNarrativePov(narrativePov) } : {}),
          ...(toPacePreference(pacePreference) ? { pacePreference: toPacePreference(pacePreference) } : {}),
          ...(toProjectMode(projectMode) ? { projectMode: toProjectMode(projectMode) } : {}),
          ...(toLevel(emotionIntensity) ? { emotionIntensity: toLevel(emotionIntensity) } : {}),
          ...(toLevel(aiFreedom) ? { aiFreedom: toLevel(aiFreedom) } : {}),
          ...(defaultChapterLength
            ? { defaultChapterLength: Math.max(500, Math.min(10000, defaultChapterLength)) }
            : {}),
        });
      }
      await onSubmit(buildProductionPrompt({
        currentNovelId,
        title,
        description,
        targetChapterCount,
        genre,
        styleTone,
        narrativePov,
        pacePreference,
        projectMode,
        emotionIntensity,
        aiFreedom,
        defaultChapterLength,
        worldType,
      }));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("productionStarter.startFailed"));
    },
  });
  const formDisabled = actionDisabled
    || novelDetailQuery.isFetching
    || Boolean(detailErrorMessage)
    || submitMutation.isPending;
  const submitDisabled = formDisabled || (!isContinueMode && !title.trim());
  const fieldClassName = "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:text-sm";
  const startProduction = () => {
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;
    submitMutation.mutate(undefined, {
      onSettled: () => {
        submitInFlightRef.current = false;
      },
    });
  };

  return (
    <div className="space-y-3" aria-busy={novelDetailQuery.isFetching || submitMutation.isPending}>
      <div className="text-xs font-medium text-muted-foreground">{t("productionStarter.title")}</div>
      <div className="space-y-3">
        <div className="rounded-md border border-info/25 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
          {isContinueMode
            ? t("productionStarter.continueNotice", { title: resolvedTitle || t("productionStarter.currentNovel") })
            : t("productionStarter.createNotice")}
        </div>
        <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
          {t("productionStarter.confirmHint")}
        </div>

        {novelDetailQuery.isFetching ? (
          <WorkspaceStateNotice
            compact
            loading
            tone="info"
            title={t("productionStarter.loadingTitle")}
            description={t("productionStarter.loadingDescription")}
          />
        ) : detailErrorMessage ? (
          <WorkspaceStateNotice
            compact
            tone="danger"
            title={t("productionStarter.loadFailedTitle")}
            description={t("productionStarter.loadFailedDescription", { error: detailErrorMessage })}
            action={(
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={novelDetailQuery.isFetching}
                onClick={() => void novelDetailQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {novelDetailQuery.isFetching ? t("productionStarter.retrying") : t("productionStarter.reload")}
              </Button>
            )}
          />
        ) : null}

        {!isContinueMode ? (
          <ProductionField
            htmlFor="creative-hub-production-title"
            label={t("productionStarter.fields.title")}
            hint={t("productionStarter.fields.titleHint")}
          >
            <input
              id="creative-hub-production-title"
              className={fieldClassName}
              placeholder={t("productionStarter.fields.titlePlaceholder")}
              value={title}
              disabled={formDisabled}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </ProductionField>
        ) : null}

        <ProductionField htmlFor="creative-hub-production-description" label={t("productionStarter.fields.description")}>
          <textarea
            id="creative-hub-production-description"
            className={`${fieldClassName} min-h-[88px] resize-y`}
            placeholder={t("productionStarter.fields.descriptionPlaceholder")}
            value={description}
            disabled={formDisabled}
            onChange={(event) => setDescription(event.target.value)}
          />
        </ProductionField>

        <div className="grid gap-2 sm:grid-cols-2">
          <ProductionField htmlFor="creative-hub-production-genre" label={t("productionStarter.fields.genre")}>
            <input
              id="creative-hub-production-genre"
              className={fieldClassName}
              placeholder={t("productionStarter.fields.genrePlaceholder")}
              value={genre}
              disabled={formDisabled}
              onChange={(event) => setGenre(event.target.value)}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-style" label={t("productionStarter.fields.style")}>
            <input
              id="creative-hub-production-style"
              className={fieldClassName}
              placeholder={t("productionStarter.fields.stylePlaceholder")}
              value={styleTone}
              disabled={formDisabled}
              onChange={(event) => setStyleTone(event.target.value)}
            />
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ProductionField htmlFor="creative-hub-production-pov" label={t("productionStarter.fields.pov")}>
            <SelectControl
              id="creative-hub-production-pov"
              className={fieldClassName}
              value={narrativePov}
              disabled={formDisabled}
              onChange={(event) => setNarrativePov(event.target.value)}
            >
              <option value="">{t("productionStarter.options.aiDecide")}</option>
              <option value={translateUi("第一人称")}>{t("productionStarter.options.firstPerson")}</option>
              <option value={translateUi("第三人称")}>{t("productionStarter.options.thirdPerson")}</option>
              <option value={translateUi("混合视角")}>{t("productionStarter.options.mixed")}</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-pace" label={t("productionStarter.fields.pace")}>
            <SelectControl
              id="creative-hub-production-pace"
              className={fieldClassName}
              value={pacePreference}
              disabled={formDisabled}
              onChange={(event) => setPacePreference(event.target.value)}
            >
              <option value="">{t("productionStarter.options.aiDecide")}</option>
              <option value={translateUi("慢节奏")}>{t("productionStarter.options.slow")}</option>
              <option value={translateUi("均衡节奏")}>{t("productionStarter.options.balanced")}</option>
              <option value={translateUi("快节奏")}>{t("productionStarter.options.fast")}</option>
            </SelectControl>
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ProductionField htmlFor="creative-hub-production-mode" label={t("productionStarter.fields.mode")}>
            <SelectControl
              id="creative-hub-production-mode"
              className={fieldClassName}
              value={projectMode}
              disabled={formDisabled}
              onChange={(event) => setProjectMode(event.target.value)}
            >
              <option value="">{t("productionStarter.options.novelDefault")}</option>
              <option value={translateUi("AI 主导")}>{t("productionStarter.options.aiLed")}</option>
              <option value={translateUi("人机协作")}>{t("productionStarter.options.coPilot")}</option>
              <option value={translateUi("草稿优先")}>{t("productionStarter.options.draftMode")}</option>
              <option value={translateUi("自动流水线")}>{t("productionStarter.options.autoPipeline")}</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-emotion" label={t("productionStarter.fields.emotion")}>
            <SelectControl
              id="creative-hub-production-emotion"
              className={fieldClassName}
              value={emotionIntensity}
              disabled={formDisabled}
              onChange={(event) => setEmotionIntensity(event.target.value)}
            >
              <option value="">{t("productionStarter.options.novelDefault")}</option>
              <option value={translateUi("低")}>{t("productionStarter.options.low")}</option>
              <option value={translateUi("中")}>{t("productionStarter.options.medium")}</option>
              <option value={translateUi("高")}>{t("productionStarter.options.high")}</option>
            </SelectControl>
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-freedom" label={t("productionStarter.fields.freedom")}>
            <SelectControl
              id="creative-hub-production-freedom"
              className={fieldClassName}
              value={aiFreedom}
              disabled={formDisabled}
              onChange={(event) => setAiFreedom(event.target.value)}
            >
              <option value="">{t("productionStarter.options.novelDefault")}</option>
              <option value={translateUi("低")}>{t("productionStarter.options.low")}</option>
              <option value={translateUi("中")}>{t("productionStarter.options.medium")}</option>
              <option value={translateUi("高")}>{t("productionStarter.options.high")}</option>
            </SelectControl>
          </ProductionField>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ProductionField htmlFor="creative-hub-production-chapters" label={t("productionStarter.fields.chapterCount")}>
            <input
              id="creative-hub-production-chapters"
              className={fieldClassName}
              type="number"
              min={1}
              max={200}
              value={targetChapterCount}
              disabled={formDisabled}
              onChange={(event) => setTargetChapterCount(Number(event.target.value || 20))}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-length" label={t("productionStarter.fields.chapterLength")}>
            <input
              id="creative-hub-production-length"
              className={fieldClassName}
              type="number"
              min={500}
              max={10000}
              value={defaultChapterLength}
              disabled={formDisabled}
              onChange={(event) => setDefaultChapterLength(Number(event.target.value || 2500))}
            />
          </ProductionField>
          <ProductionField htmlFor="creative-hub-production-world" label={t("productionStarter.fields.worldType")}>
            <input
              id="creative-hub-production-world"
              className={fieldClassName}
              placeholder={t("productionStarter.fields.worldPlaceholder")}
              value={worldType}
              disabled={formDisabled}
              onChange={(event) => setWorldType(event.target.value)}
            />
          </ProductionField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={submitDisabled}
            onClick={startProduction}
          >
            {submitMutation.isPending ? t("productionStarter.starting") : isContinueMode ? t("productionStarter.continue") : t("productionStarter.start")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.(translateUi("整本生成到哪一步了"))}
          >
            {t("productionStarter.viewProgress")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.(translateUi("为什么整本生成没有启动"))}
          >
            {t("productionStarter.viewBlocked")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={formDisabled}
            onClick={() => onQuickAction?.(translateUi("基于当前小说信息，为生产前的题材、风格、视角、节奏、章长和 AI 自由度各给出 3 个备选答案。"))}
          >
            {t("productionStarter.generateOptions")}
          </Button>
        </div>
      </div>
    </div>
  );
}
