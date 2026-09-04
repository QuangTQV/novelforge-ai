import { translateUi } from "@/i18n/legacy";
const WORKFLOW_ACTIVITY_TAGS = [
  translateUi("资产回灌中"),
  translateUi("角色成长中"),
  translateUi("状态同步中"),
  translateUi("资源账本同步中"),
  translateUi("伏笔账本同步中"),
  translateUi("账本校准中"),
  translateUi("伏笔回填中"),
] as const;

export function extractWorkflowActivityTags(value: string | null | undefined): string[] {
  const source = value?.trim() ?? "";
  if (!source) {
    return [];
  }
  return WORKFLOW_ACTIVITY_TAGS.filter((label) => source.includes(label));
}
