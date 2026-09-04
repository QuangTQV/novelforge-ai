import { translateUi } from "../../../i18n/legacy.ts";
import type { NovelWorkspaceTab } from "../novelWorkspaceNavigation";
import type { NovelEditViewProps } from "../components/NovelEditView.types";

export interface MobileSaveState {
  visible: boolean;
  label: string;
  savingLabel: string;
  isSaving: boolean;
  onSave: () => void;
}

export function getMobileNovelWorkspaceStatusText(input: {
  activeLabel: string;
  workflowLabel: string;
}): string {
  if (input.activeLabel === input.workflowLabel) {
    return translateUi("当前步骤：{{v0}}", { v0: input.activeLabel });
  }

  return translateUi("当前步骤：{{v0}} · 流程推荐：{{v1}}", { v0: input.activeLabel, v1: input.workflowLabel });
}

export function getMobileNovelSaveState(
  tab: NovelWorkspaceTab,
  props: NovelEditViewProps,
): MobileSaveState {
  switch (tab) {
    case "basic":
      return {
        visible: true,
        label: translateUi("保存基本信息"),
        savingLabel: translateUi("保存中..."),
        isSaving: props.basicTab.isSaving,
        onSave: props.basicTab.onSave,
      };
    case "story_macro":
      return {
        visible: true,
        label: translateUi("保存故事规划"),
        savingLabel: translateUi("保存中..."),
        isSaving: props.storyMacroTab.isSaving,
        onSave: props.storyMacroTab.onSaveEdits,
      };
    case "world":
      return {
        visible: false,
        label: "",
        savingLabel: "",
        isSaving: false,
        onSave: () => undefined,
      };
    case "character":
      return {
        visible: true,
        label: translateUi("保存角色"),
        savingLabel: translateUi("保存中..."),
        isSaving: props.characterTab.isSavingCharacter,
        onSave: props.characterTab.onSaveCharacter,
      };
    case "outline":
      return {
        visible: true,
        label: translateUi("保存卷工作区"),
        savingLabel: translateUi("保存中..."),
        isSaving: props.outlineTab.isSaving,
        onSave: props.outlineTab.onSave,
      };
    case "structured":
      return {
        visible: true,
        label: translateUi("保存拆章"),
        savingLabel: translateUi("保存中..."),
        isSaving: props.structuredTab.isSaving,
        onSave: props.structuredTab.onSave,
      };
    default:
      return {
        visible: false,
        label: "",
        savingLabel: "",
        isSaving: false,
        onSave: () => undefined,
      };
  }
}
