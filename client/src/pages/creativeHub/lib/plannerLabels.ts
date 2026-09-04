import { translateUi } from "@/i18n/legacy";
const INTENT_LABELS: Record<string, string> = {
  social_opening: translateUi("轻度开场"),
  list_novels: translateUi("列出小说"),
  list_worlds: translateUi("列出世界观"),
  query_task_status: translateUi("查询任务状态"),
  create_novel: translateUi("创建小说"),
  select_novel_workspace: translateUi("切换小说工作区"),
  bind_world_to_novel: translateUi("绑定世界观到小说"),
  unbind_world_from_novel: translateUi("解除小说世界观绑定"),
  produce_novel: translateUi("整本生产"),
  query_novel_production_status: translateUi("查询整本生产状态"),
  query_novel_title: translateUi("查询小说标题"),
  query_chapter_content: translateUi("查询章节内容"),
  query_progress: translateUi("查询创作进度"),
  inspect_failure_reason: translateUi("诊断失败原因"),
  write_chapter: translateUi("写作章节"),
  rewrite_chapter: translateUi("重写章节"),
  save_chapter_draft: translateUi("保存章节草稿"),
  start_pipeline: translateUi("启动流水线"),
  inspect_characters: translateUi("查看角色规划"),
  inspect_timeline: translateUi("查看时间线"),
  inspect_world: translateUi("查看世界观"),
  search_knowledge: translateUi("检索知识库"),
  ideate_novel_setup: translateUi("生成设定备选"),
  general_chat: translateUi("一般对话"),
  unknown: translateUi("未识别意图"),
};

const PLANNER_SOURCE_LABELS: Record<string, string> = {
  llm: translateUi("大模型识别"),
  unknown: translateUi("未知来源"),
};

function formatBilingualLabel(label: string, rawValue: string) {
  return `${label}（${rawValue}）`;
}

export function getIntentDisplayLabel(intent: unknown): string {
  const rawValue = typeof intent === "string" && intent.trim() ? intent.trim() : "unknown";
  const label = INTENT_LABELS[rawValue] ?? translateUi("未映射意图");
  return formatBilingualLabel(label, rawValue);
}

export function getPlannerSourceDisplayLabel(source: unknown): string {
  const rawValue = typeof source === "string" && source.trim() ? source.trim() : "unknown";
  const label = PLANNER_SOURCE_LABELS[rawValue] ?? translateUi("未映射来源");
  return formatBilingualLabel(label, rawValue);
}
