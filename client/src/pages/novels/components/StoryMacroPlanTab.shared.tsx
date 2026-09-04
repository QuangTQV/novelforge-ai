import { translateUi } from "@/i18n/legacy";
import type { StoryMacroField } from "@ai-novel/shared/types/storyMacro";
import AiButton from "@/components/common/AiButton";
import { Button } from "@/components/ui/button";

export const ENGINE_TEXT_FIELDS: Array<{
  field: StoryMacroField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { field: "expanded_premise", label: translateUi("强化前提"), placeholder: translateUi("先写出被强化后的故事前提，让压迫感和悬念成立。"), multiline: true },
  { field: "protagonist_core", label: translateUi("主角核心处境"), placeholder: translateUi("写主角被困住的处境、裂缝和可变化空间。"), multiline: true },
  { field: "conflict_engine", label: translateUi("冲突引擎"), placeholder: translateUi("写清楚故事为什么能持续升级，而不是只写一个冲突。"), multiline: true },
  { field: "mystery_box", label: translateUi("核心未知"), placeholder: translateUi("写读者最想知道、但暂时拿不到答案的问题。"), multiline: true },
  { field: "emotional_line", label: translateUi("情绪推进"), placeholder: translateUi("写情绪如何逐层加深，而不是简单变强。"), multiline: true },
  { field: "tone_reference", label: translateUi("叙事气质"), placeholder: translateUi("写法风格、叙事姿态、控制方式。"), multiline: true },
];

export const SUMMARY_FIELDS: Array<{
  field: StoryMacroField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { field: "selling_point", label: translateUi("一句话卖点"), placeholder: translateUi("一句话说明这部作品最能吸引读者的地方。") },
  { field: "core_conflict", label: translateUi("长期对立"), placeholder: translateUi("写长期不可调和的对立。") },
  { field: "main_hook", label: translateUi("主线钩子"), placeholder: translateUi("写带未知的主线问题。") },
  { field: "progression_loop", label: translateUi("推进回路"), placeholder: translateUi("写清发现 -> 升级 -> 反转如何循环。"), multiline: true },
  { field: "growth_path", label: translateUi("成长路径"), placeholder: translateUi("写主角认知如何阶段性变化。"), multiline: true },
  { field: "ending_flavor", label: translateUi("结局味道"), placeholder: translateUi("例如崩塌、留白、反转、冷静压抑。") },
];

export function listToText(value: string[]): string {
  return value.join("\n");
}

export function textareaClassName(minHeight = "min-h-28") {
  return `${minHeight} w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring`;
}

export function FieldActions(props: {
  field: StoryMacroField;
  lockedFields: Partial<Record<StoryMacroField, boolean>>;
  regeneratingField: StoryMacroField | "";
  storyInput: string;
  onToggleLock: (field: StoryMacroField) => void;
  onRegenerateField: (field: StoryMacroField) => void;
}) {
  const isLocked = Boolean(props.lockedFields[props.field]);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={isLocked ? "secondary" : "outline"}
        onClick={() => props.onToggleLock(props.field)}
      >
        {isLocked ? translateUi("已锁定") : translateUi("锁定")}
      </Button>
      <AiButton
        size="sm"
        variant="outline"
        onClick={() => props.onRegenerateField(props.field)}
        disabled={props.regeneratingField === props.field || isLocked || !props.storyInput.trim()}
      >
        {props.regeneratingField === props.field ? translateUi("重生成中...") : translateUi("重生成")}
      </AiButton>
    </div>
  );
}
