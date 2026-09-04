import { translateUi } from "@/i18n/legacy";
import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Maximize2, Minimize2 } from "lucide-react";
import type { PromptCatalogItem, PromptSlotOverrideScope } from "@/api/promptWorkbench";
import type { NovelLanguage } from "@ai-novel/shared/types/novel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import SelectControl from "@/components/common/SelectControl";
import {
  ENTRYPOINT_OPTIONS,
  MANAGEMENT_STATUS_LABELS,
  OUTPUT_TYPE_LABELS,
  TASK_TYPE_LABELS,
  capabilityLabels,
  getPromptDisplayLabel,
} from "../promptWorkbenchLabels";

interface PromptEditorShellProps {
  prompt: PromptCatalogItem;
  immersive?: boolean;
  onImmersiveChange?: (next: boolean) => void;
  entrypoint: string;
  onEntrypointChange: (entrypoint: string) => void;
  outputLanguage: NovelLanguage;
  onOutputLanguageChange: (language: NovelLanguage) => void;
  scope: PromptSlotOverrideScope;
  onScopeChange: (scope: PromptSlotOverrideScope) => void;
  selectedNovelId: string;
  onNovelChange: (novelId: string) => void;
  novels: Array<{ id: string; title?: string | null }>;
  selectedChapterId: string;
  onChapterChange: (chapterId: string) => void;
  chapters: Array<{ id: string; title?: string | null; order?: number | null; hasContent?: boolean }>;
  bodyPanel: ReactNode;
  contextPanel?: ReactNode;
  runBar: ReactNode;
  simplified?: boolean;
  heading?: string;
}

export function PromptEditorShell(props: PromptEditorShellProps) {
  const {
    bodyPanel,
    contextPanel,
    entrypoint,
    immersive = false,
    novels,
    chapters,
    onEntrypointChange,
    onOutputLanguageChange,
    onChapterChange,
    onImmersiveChange,
    onNovelChange,
    onScopeChange,
    prompt,
    outputLanguage,
    runBar,
    scope,
    selectedChapterId,
    selectedNovelId,
    simplified = false,
    heading,
  } = props;
  const capabilities = capabilityLabels(prompt);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col bg-background",
        immersive && "bg-background",
      )}
    >
      <header
        className={cn(
          "shrink-0 border-b border-border bg-card px-5 py-4",
          immersive && "border-border bg-card px-6 py-3",
        )}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground">
                {heading || getPromptDisplayLabel(prompt)}
              </h2>
              {!simplified ? (
                <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {prompt.version}
                </span>
              ) : null}
              {immersive ? (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {translateUi("沉浸编辑")}
                </span>
              ) : null}
            </div>
            {simplified ? (
              <div className="mt-1 text-sm text-muted-foreground">{translateUi("选择小说和章节，修改本书正文模板并直接查看试写效果。")}</div>
            ) : (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{prompt.key}</span>
                  <span>·</span>
                  <span>{translateUi(TASK_TYPE_LABELS[prompt.taskType] ?? prompt.taskType)}</span>
                  <span>·</span>
                  <span>{translateUi(OUTPUT_TYPE_LABELS[prompt.outputType] ?? prompt.outputType)}</span>
                  <span>·</span>
                  <span>{translateUi(MANAGEMENT_STATUS_LABELS[prompt.managementStatus])}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-[#eef6f4] px-2 py-1 text-[#315f58]">
                    {prompt.language === "zh" ? translateUi("中文") : prompt.language}
                  </span>
                  <span className="rounded-md bg-[#eef3fb] px-2 py-1 text-[#385273]">{prompt.family}</span>
                  <span className="rounded-md bg-[#fff3dc] px-2 py-1 text-[#7a5620]">
                    {prompt.contextPolicy.maxTokensBudget} tokens
                  </span>
                  <span className={cn(
                    "rounded-md px-2 py-1",
                    prompt.slotSupported ? "bg-[#e8f7f2] text-[#0f766e]" : "bg-muted text-muted-foreground",
                  )}>
                    {prompt.slotSupported ? translateUi("{{v0}} 个槽位", { v0: prompt.slots.length }) : translateUi("只读提示词")}
                  </span>
                  {capabilities.map((label) => (
                    <span key={label} className="rounded-md bg-white/80 px-2 py-1 text-[#52606d] ring-1 ring-[#dfe7ee]">
                      {translateUi(label)}
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{translateUi("Ngôn ngữ prompt")}</span>
              <SelectControl
                value={outputLanguage}
                onChange={(event) => onOutputLanguageChange(event.target.value as NovelLanguage)}
                aria-label={translateUi("Ngôn ngữ prompt")}
                className="h-8 w-32"
              >
                <option value="vi">{translateUi("Tiếng Việt")}</option>
                <option value="en">English</option>
                <option value="zh">{translateUi("中文")}</option>
              </SelectControl>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center xl:justify-end">
            {!simplified ? (
              <>
                <SelectControl
                  value={entrypoint}
                  onChange={(event) => onEntrypointChange(event.target.value)}
                  className="h-10 min-w-40 rounded-md border border-[#cfdad7] bg-white px-3 text-sm shadow-sm"
                >
                  {ENTRYPOINT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>

                <Tabs
                  value={scope}
                  onValueChange={(value) => onScopeChange(value as PromptSlotOverrideScope)}
                >
                  <TabsList className="h-10">
                    <TabsTrigger value="global" className="px-4">{translateUi("全局")}</TabsTrigger>
                    <TabsTrigger value="novel" className="px-4">{translateUi("本书")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </>
            ) : null}

            {scope === "novel" ? (
              <SelectControl
                value={selectedNovelId}
                onChange={(event) => onNovelChange(event.target.value)}
                className="h-10 min-w-52 rounded-md border border-[#cfdad7] bg-white px-3 text-sm shadow-sm"
              >
                <option value="">{translateUi("选择小说")}</option>
                {novels.map((novel) => (
                  <option key={novel.id} value={novel.id}>
                    {novel.title || novel.id}
                  </option>
                ))}
              </SelectControl>
            ) : null}

            {scope === "novel" && selectedNovelId ? (
              <SelectControl
                value={selectedChapterId}
                onChange={(event) => onChapterChange(event.target.value)}
                className="h-10 min-w-52 rounded-md border border-[#cfdad7] bg-white px-3 text-sm shadow-sm"
              >
                <option value="">{translateUi("选择预览章节")}</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {translateUi("第")} {chapter.order ?? "?"} {translateUi("章")} {chapter.title || translateUi("未命名章节")}{chapter.hasContent ? "" : translateUi("（无正文）")}
                  </option>
                ))}
              </SelectControl>
            ) : null}

            {onImmersiveChange ? (
              <Button
                type="button"
                variant={immersive ? "outline" : "secondary"}
                onClick={() => onImmersiveChange(!immersive)}
                className={cn(
                  "h-10 gap-2 border-[#b8d9d0]",
                  immersive
                    ? "border-success/40 bg-card text-success hover:bg-success/10"
                    : "border-success bg-success text-success-foreground hover:bg-success/90",
                )}
                title={immersive ? translateUi("退出沉浸编辑") : translateUi("进入沉浸编辑")}
              >
                {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {immersive ? translateUi("退出沉浸") : translateUi("沉浸编辑")}
              </Button>
            ) : null}
          </div>
        </div>

      </header>

      <div className={cn("min-h-0 flex-1", immersive && "px-4 py-4")}>
        {contextPanel ? <Group
          orientation="horizontal"
          className={cn(
            "h-full min-h-0",
            immersive && "overflow-hidden rounded-lg border border-border bg-card shadow-[0_18px_60px_hsl(var(--foreground)/0.14)]",
          )}
        >
          <Panel defaultSize={immersive ? 74 : 66} minSize={immersive ? 58 : 48}>
            <div
              className={cn(
                "h-full min-h-0 overflow-y-auto px-5 py-5 pb-28",
                immersive && "bg-card px-8 py-7 pb-32",
              )}
            >
              {bodyPanel}
            </div>
          </Panel>
          <Separator className={cn("w-1 bg-[#cbdcd5] transition-colors hover:bg-[#7eb6aa]")} />
          <Panel defaultSize={immersive ? 26 : 34} minSize={immersive ? 20 : 24}>
            <div className={cn("h-full min-h-0 border-l border-[#cbdcd5] bg-[#f6faf8]", !immersive && "bg-muted/[0.08]")}>
              {contextPanel}
            </div>
          </Panel>
        </Group> : (
          <div className={cn("h-full min-h-0 overflow-y-auto px-5 py-5 pb-28", immersive && "bg-card px-8 py-7 pb-32")}>
            {bodyPanel}
          </div>
        )}
      </div>

      {runBar}
    </section>
  );
}
