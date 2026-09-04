import { translateUi } from "@/i18n/legacy";
import type { RecoverableTaskSummary } from "@ai-novel/shared/types/task";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AppDialogContent,
  Dialog,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useTaskRecovery } from "./TaskRecoveryContext";

function formatTaskKind(kind: RecoverableTaskSummary["kind"]): string {
  if (kind === "novel_workflow") {
    return "小说主流程";
  }
  if (kind === "novel_pipeline") {
    return "章节流水线";
  }
  if (kind === "book_analysis") {
    return "拆书任务";
  }
  if (kind === "style_extraction") {
    return "写法提取";
  }
  return "图片任务";
}

export default function TaskRecoveryDialog() {
  const {
    items,
    isOpen,
    busyTaskId,
    isResumeSinglePending,
    isResumeAllPending,
    closeDialog,
    resumeSingle,
    resumeAll,
  } = useTaskRecovery();

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) closeDialog(); }}>
      <AppDialogContent
        title={translateUi("检测到待恢复任务")}
        description={translateUi("系统启动时发现有后台任务在服务重启前中断了。现在不会自动继续执行，你可以先逐个确认，再决定是否恢复。")}
        footer={(
          <>
            <Button variant="outline" onClick={closeDialog}>

              {translateUi("稍后处理")}
            </Button>
            <Button onClick={resumeAll} disabled={isResumeSinglePending || isResumeAllPending}>
              {isResumeAllPending ? translateUi("恢复全部中...") : translateUi("继续全部")}
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={`${item.kind}-${item.id}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatTaskKind(item.kind)}</Badge>
                      <Badge variant={item.status === "running" ? "default" : "secondary"}>
                        {item.status === "running" ? translateUi("运行中断") : translateUi("排队中断")}
                      </Badge>
                    </div>
                    <div className="text-base font-semibold">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{translateUi("所属对象：")}{item.ownerLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => resumeSingle({ kind: item.kind, id: item.id })}
                      disabled={isResumeAllPending || (isResumeSinglePending && busyTaskId !== item.id)}
                    >
                      {isResumeSinglePending && busyTaskId === item.id ? translateUi("恢复中...") : translateUi("继续单个")}
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={item.sourceRoute} onClick={closeDialog}>{translateUi("打开任务位置")}</Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground">
                  {item.currentStage ? <div>{translateUi("当前阶段：")}{item.currentStage}</div> : null}
                  {item.currentItemLabel ? <div>{translateUi("中断位置：")}{item.currentItemLabel}</div> : null}
                  {item.resumeAction ? <div>{translateUi("建议动作：")}{item.resumeAction}</div> : null}
                  {item.recoveryHint ? <div>{translateUi("恢复建议：")}{item.recoveryHint}</div> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
