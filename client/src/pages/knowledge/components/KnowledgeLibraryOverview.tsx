import { translateUi } from "@/i18n/legacy";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  CircleAlert,
  Database,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  Upload,
} from "lucide-react";
import {
  AssetLibraryHeader,
  AssetLibraryRecommendation,
  type AssetLibraryTone,
} from "@/components/assetLibrary";
import OpenInCreativeHubButton from "@/components/creativeHub/OpenInCreativeHubButton";
import { Button } from "@/components/ui/button";

type RecommendationAction = "clear_filters" | "open_documents" | "open_ops" | "retry" | "upload";

interface RecommendationState {
  action: RecommendationAction;
  description: string;
  icon: LucideIcon;
  title: string;
  tone: AssetLibraryTone;
}

interface KnowledgeLibraryOverviewProps {
  activeJobCount: number;
  enabledCount: number;
  failedIndexDocumentCount: number;
  failedJobCount: number;
  hasFilters: boolean;
  isError: boolean;
  isLoading: boolean;
  searchableDocumentCount: number;
  selectedDocumentId?: string;
  visibleDocumentCount: number;
  onClearFilters: () => void;
  onOpenDocuments: () => void;
  onOpenOps: () => void;
  onRetry: () => void;
  onUpload: () => void;
}

function getRecommendation(props: KnowledgeLibraryOverviewProps): RecommendationState {
  if (props.isError) {
    return {
      action: "retry",
      description: translateUi("资料列表暂时无法读取。重新加载不会修改已有资料或索引任务。"),
      icon: CircleAlert,
      title: translateUi("重新加载知识资料"),
      tone: "danger",
    };
  }
  if (props.isLoading) {
    return {
      action: "open_documents",
      description: translateUi("正在整理资料状态与索引结果，加载完成后会给出可执行的下一步。"),
      icon: LoaderCircle,
      title: translateUi("正在读取知识资料"),
      tone: "neutral",
    };
  }
  if (props.activeJobCount > 0) {
    return {
      action: "open_ops",
      description: translateUi("{{count}} 个索引任务正在执行，可查看进度；创作时优先选择已完成索引的资料。", { count: props.activeJobCount }),
      icon: RefreshCw,
      title: translateUi("查看资料同步进度"),
      tone: "info",
    };
  }
  if (props.failedIndexDocumentCount > 0 || props.failedJobCount > 0) {
    return {
      action: "open_ops",
      description: translateUi("部分资料尚未完成索引。先查看失败原因并重建索引，其他可用资料仍可继续参与创作。"),
      icon: CircleAlert,
      title: translateUi("处理未完成的资料索引"),
      tone: "warning",
    };
  }
  if (props.visibleDocumentCount === 0 && props.hasFilters) {
    return {
      action: "clear_filters",
      description: translateUi("当前搜索或状态条件没有匹配结果，清除筛选即可返回完整资料列表。"),
      icon: SearchCheck,
      title: translateUi("查看其他知识资料"),
      tone: "neutral",
    };
  }
  if (props.visibleDocumentCount === 0) {
    return {
      action: "upload",
      description: translateUi("上传一份 TXT 资料，系统会建立索引，供拆书、规划和正文创作调用。"),
      icon: Upload,
      title: translateUi("先添加一份创作资料"),
      tone: "info",
    };
  }
  if (props.searchableDocumentCount === 0) {
    return {
      action: "open_documents",
      description: translateUi("列表中还没有已启用且完成索引的资料。选择一份资料启用或重建索引后即可用于创作。"),
      icon: Database,
      title: translateUi("准备一份可检索资料"),
      tone: "warning",
    };
  }
  return {
    action: "open_documents",
    description: translateUi("{{count}} 份资料可以参与检索。可查看版本、测试召回，或选择资料继续创作。", { count: props.searchableDocumentCount }),
    icon: BookOpenCheck,
    title: translateUi("选择资料继续创作"),
    tone: "success",
  };
}

export default function KnowledgeLibraryOverview(props: KnowledgeLibraryOverviewProps) {
  const recommendation = getRecommendation(props);
  const documentStatusUnavailable = props.isLoading || props.isError;

  const recommendationAction = (() => {
    switch (recommendation.action) {
      case "upload":
        return (
          <Button type="button" size="sm" onClick={props.onUpload}>
            <Upload className="h-4 w-4" />

            {translateUi("上传资料")}
          </Button>
        );
      case "retry":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onRetry}>
            <RefreshCw className="h-4 w-4" />

            {translateUi("重新加载")}
          </Button>
        );
      case "clear_filters":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onClearFilters}>

            {translateUi("清除筛选")}
          </Button>
        );
      case "open_ops":
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onOpenOps}>

            {translateUi("查看索引状态")}
          </Button>
        );
      default:
        if (props.isLoading) {
          return (
            <Button type="button" size="sm" variant="outline" disabled>

              {translateUi("正在加载")}
            </Button>
          );
        }
        return (
          <Button type="button" size="sm" variant="outline" onClick={props.onOpenDocuments}>

            {translateUi("查看资料")}
          </Button>
        );
    }
  })();

  return (
    <>
      <AssetLibraryHeader
        icon={Database}
        context={translateUi("创作资产 · 知识与检索")}
        title={translateUi("知识资料库")}
        description={translateUi("集中管理可复用的创作资料，确认索引状态，再把可靠内容带入拆书、规划和正文创作。")}
        actions={(
          <>
            <Button type="button" onClick={props.onUpload}>
              <Upload className="h-4 w-4" />

              {translateUi("上传资料")}
            </Button>
            <OpenInCreativeHubButton
              bindings={{ knowledgeDocumentIds: props.selectedDocumentId ? [props.selectedDocumentId] : [] }}
              label={translateUi("发送到创作中枢")}
            />
          </>
        )}
      />

      <section aria-label={translateUi("知识资料状态")} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-muted/25 px-5 py-3">
        {[
          { label: props.hasFilters ? translateUi("筛选结果") : translateUi("全部资料"), value: documentStatusUnavailable ? "—" : props.visibleDocumentCount, dot: "bg-muted-foreground/45" },
          { label: translateUi("已启用"), value: documentStatusUnavailable ? "—" : props.enabledCount, dot: "bg-success" },
          { label: translateUi("可检索"), value: documentStatusUnavailable ? "—" : props.searchableDocumentCount, dot: "bg-success" },
          { label: translateUi("同步中"), value: props.activeJobCount, dot: props.failedJobCount > 0 ? "bg-destructive" : "bg-info" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
          </div>
        ))}
        {props.failedJobCount > 0 ? (
          <span className="text-xs text-destructive">{props.failedJobCount}  {translateUi("个索引任务需要处理")}</span>
        ) : null}
      </section>

      {recommendation.tone !== "success" ? (
        <AssetLibraryRecommendation
          icon={recommendation.icon}
          title={recommendation.title}
          description={recommendation.description}
          tone={recommendation.tone}
          action={recommendationAction}
        />
      ) : null}
    </>
  );
}
