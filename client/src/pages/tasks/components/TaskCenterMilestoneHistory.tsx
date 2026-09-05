import { translateUi } from "@/i18n/legacy";
import { translateTaskProgressLabel } from "@/i18n/taskProgressLabel";
import type { NovelWorkflowMilestone } from "@ai-novel/shared/types/novelWorkflow";
import { formatCheckpoint, formatDate } from "../taskCenterUtils";

interface TaskCenterMilestoneHistoryProps {
  milestones: NovelWorkflowMilestone[];
}

export default function TaskCenterMilestoneHistory({
  milestones,
}: TaskCenterMilestoneHistoryProps) {
  if (milestones.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      <div className="font-medium">{translateUi("里程碑历史")}</div>
      {milestones.map((item) => (
        <div key={`${item.checkpointType}:${item.createdAt}`} className="rounded-md border p-2 text-muted-foreground">
          <div className="font-medium text-foreground">{formatCheckpoint(item.checkpointType)}</div>
          <div className="mt-1">{translateTaskProgressLabel(item.summary)}</div>
          <div className="mt-1 text-xs">{translateUi("记录时间：")}{formatDate(item.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
