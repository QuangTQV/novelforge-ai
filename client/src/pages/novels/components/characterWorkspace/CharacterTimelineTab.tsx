import { translateUi } from "@/i18n/legacy";
import type { CharacterTimeline } from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";

interface CharacterTimelineTabProps {
  timelineEvents: CharacterTimeline[];
  onSyncTimeline: () => void;
  isSyncingTimeline: boolean;
  onSyncAllTimeline: () => void;
  isSyncingAllTimeline: boolean;
}

export default function CharacterTimelineTab(props: CharacterTimelineTabProps) {
  const { timelineEvents, onSyncTimeline, isSyncingTimeline, onSyncAllTimeline, isSyncingAllTimeline } = props;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{translateUi("角色事件流")}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">

              {translateUi("用最近章节事件观察角色处境变化，必要时同步时间线后再继续写作。")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiButton size="sm" variant="outline" onClick={onSyncTimeline} disabled={isSyncingTimeline}>
              {isSyncingTimeline ? translateUi("同步中...") : translateUi("同步角色时间线")}
            </AiButton>
            <AiButton size="sm" variant="outline" onClick={onSyncAllTimeline} disabled={isSyncingAllTimeline}>
              {isSyncingAllTimeline ? translateUi("同步中...") : translateUi("同步全部角色时间线")}
            </AiButton>
          </div>
        </div>
      </section>

      {timelineEvents.length > 0 ? (
        <div className="space-y-2">
          {timelineEvents.slice(-12).reverse().map((event) => (
            <div key={event.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{event.title}</div>
                <Badge variant="outline">{event.source}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.chapterOrder ? translateUi("章节 {{value0}}", { value0: event.chapterOrder }) : translateUi("无章节归属")} ·{" "}
                {new Date(event.createdAt).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{event.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">

          {translateUi("暂无事件，先点击“同步角色时间线”。")}
        </div>
      )}
    </div>
  );
}
