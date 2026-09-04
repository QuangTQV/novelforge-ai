import { translateUi } from "@/i18n/legacy";
import type { RagJobSummary } from "@/api/knowledge";

export function formatStatus(status: string): string {
  switch (status) {
    case "enabled":
      return translateUi("已启用");
    case "disabled":
      return translateUi("已停用");
    case "archived":
      return translateUi("已归档");
    case "idle":
      return translateUi("空闲");
    case "queued":
      return translateUi("排队中");
    case "running":
      return translateUi("执行中");
    case "succeeded":
      return translateUi("成功");
    case "failed":
      return translateUi("失败");
    default:
      return status;
  }
}

export function getRagJobProgressPercent(job: RagJobSummary): number {
  const raw = job.progress?.percent ?? (job.status === "succeeded" ? 1 : 0);
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function getRagJobProgressWidth(job: RagJobSummary): string {
  const percent = getRagJobProgressPercent(job);
  if (job.status === "queued" || job.status === "running") {
    return `${Math.max(percent, 6)}%`;
  }
  return `${percent}%`;
}

export function formatRagJobMeta(job: RagJobSummary): string {
  const parts = [job.jobType, translateUi("尝试 {{v0}}/{{v1}}", { v0: job.attempts, v1: job.maxAttempts })];
  if (job.progress?.current !== undefined && job.progress?.total !== undefined && job.progress.total > 0) {
    parts.push(`${job.progress.current}/${job.progress.total}`);
  }
  if (job.progress?.chunks) {
    parts.push(translateUi("{{v0}} 分块", { v0: job.progress.chunks }));
  }
  if (job.progress?.documents) {
    parts.push(translateUi("{{v0}} 文档", { v0: job.progress.documents }));
  }
  return parts.join(" | ");
}
