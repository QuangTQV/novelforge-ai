import { translateUi } from "@/i18n/legacy";
import type { TaskKind, TaskStatus } from "@ai-novel/shared/types/task";
import { Input } from "@/components/ui/input";
import type { TaskSortMode } from "../taskCenterUtils";
import SelectControl from "@/components/common/SelectControl";

interface TaskCenterFilterPanelProps {
  kind: TaskKind | "";
  status: TaskStatus | "";
  keyword: string;
  onlyAnomaly: boolean;
  sortMode: TaskSortMode;
  onKindChange: (value: TaskKind | "") => void;
  onStatusChange: (value: TaskStatus | "") => void;
  onKeywordChange: (value: string) => void;
  onOnlyAnomalyChange: (value: boolean) => void;
  onSortModeChange: (value: TaskSortMode) => void;
}

// Mobile lays the filters on an explicit 3-column / 2-row grid; `xl:col-auto xl:row-auto`
// releases the placement so the desktop custom track template flows them in one row.
export default function TaskCenterFilterPanel({
  kind,
  status,
  keyword,
  onlyAnomaly,
  sortMode,
  onKindChange,
  onStatusChange,
  onKeywordChange,
  onOnlyAnomalyChange,
  onSortModeChange,
}: TaskCenterFilterPanelProps) {
  return (
    <section aria-label={translateUi("筛选运行记录")} className="task-filter-card rounded-2xl bg-muted/20 px-4 py-3">
      <div className="task-filter-controls grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[150px_150px_auto_minmax(220px,1fr)_220px] xl:items-center">
        <SelectControl
          aria-label={translateUi("按任务类型筛选")}
          className="task-filter-kind col-start-1 row-start-1 xl:col-auto xl:row-auto h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={kind}
          onChange={(event) => onKindChange(event.target.value as TaskKind | "")}
        >
          <option value="">{translateUi("全部类型")}</option>
          <option value="book_analysis">{translateUi("拆书分析")}</option>
          <option value="novel_workflow">{translateUi("小说创作")}</option>
          <option value="novel_pipeline">{translateUi("小说流水线")}</option>
          <option value="knowledge_document">{translateUi("知识库索引")}</option>
          <option value="image_generation">{translateUi("图片生成")}</option>
          <option value="style_extraction">{translateUi("写法提取")}</option>
          <option value="agent_run">{translateUi("Agent 运行")}</option>
        </SelectControl>
        <SelectControl
          aria-label={translateUi("按任务状态筛选")}
          className="task-filter-status col-start-2 row-start-1 xl:col-auto xl:row-auto h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus | "")}
        >
          <option value="">{translateUi("全部状态")}</option>
          <option value="queued">{translateUi("排队中")}</option>
          <option value="running">{translateUi("运行中")}</option>
          <option value="waiting_approval">{translateUi("等待审批")}</option>
          <option value="failed">{translateUi("失败")}</option>
          <option value="cancelled">{translateUi("已取消")}</option>
          <option value="succeeded">{translateUi("已完成")}</option>
        </SelectControl>
        <label className="task-filter-pill col-start-3 row-start-1 xl:col-auto xl:row-auto flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-background px-4 text-sm text-muted-foreground transition-colors hover:bg-muted has-[:checked]:bg-destructive/10 has-[:checked]:text-destructive">
          <input
            type="checkbox"
            className="sr-only"
            checked={onlyAnomaly}
            onChange={(event) => onOnlyAnomalyChange(event.target.checked)}
          />
          {translateUi("只看需处理")}
        </label>
        <Input
          aria-label={translateUi("按标题或关联对象搜索")}
          className="task-filter-keyword col-span-2 col-start-1 row-start-2 xl:col-span-1 xl:col-auto xl:row-auto h-10 rounded-xl border-border/45 bg-background px-3"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={translateUi("标题或关联对象")}
        />
        <SelectControl
          aria-label={translateUi("任务排序方式")}
          className="task-filter-sort col-start-3 row-start-2 xl:col-auto xl:row-auto h-10 w-full rounded-xl border-border/45 bg-background px-3 text-sm"
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value as TaskSortMode)}
        >
          <option value="updated_desc">{translateUi("按更新时间排序：最新优先")}</option>
          <option value="updated_asc">{translateUi("按更新时间排序：最早优先")}</option>
          <option value="heartbeat_desc">{translateUi("按最近心跳排序：最新优先")}</option>
          <option value="heartbeat_asc">{translateUi("按最近心跳排序：最早优先")}</option>
          <option value="default">{translateUi("默认排序：需处理优先")}</option>
        </SelectControl>
      </div>
    </section>
  );
}
