import { translateUi } from "@/i18n/legacy";
import { Link } from "react-router-dom";
import { BookOpen, GitCompareArrows, GitFork, Library, Map, Network, Workflow } from "lucide-react";
import type {
  NovelWorldAssetSummary,
  NovelWorldHandbook,
  NovelWorldSummary,
  NovelWorldSyncDiff,
  NovelWorldSyncInput,
  NovelWorldSyncRecordSummary,
} from "@ai-novel/shared/types/novelWorld";
import { Button } from "@/components/ui/button";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import i18n from "@/i18n";
import { DetailDisclosure } from "../workspaceShell";
import {
  NovelWorldUsageDetails,
  type NovelWorldUsageCardProps,
  type NovelWorldUsageDraftState,
} from "../NovelWorldUsageCard";
import NovelWorldSourcePanel, { type WorldOption } from "./NovelWorldSourcePanel";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`novelWorldHandbook:${key}`, options);

export type NovelWorldDialogTab = "overview" | "rules" | "guidance" | "usage" | "sync";

interface NovelWorldHandbookDialogProps {
  open: boolean;
  activeTab: NovelWorldDialogTab;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: NovelWorldDialogTab) => void;
  novelWorld: NovelWorldSummary | null;
  handbook: NovelWorldHandbook | null;
  worldAssets: NovelWorldAssetSummary[];
  syncHistory: NovelWorldSyncRecordSummary[];
  syncDiff: NovelWorldSyncDiff | null;
  activeWorldName: string;
  worldOptions: WorldOption[];
  selectedWorldId: string;
  isImporting: boolean;
  isGenerating: boolean;
  isCreatingManual: boolean;
  isSavingToLibrary: boolean;
  isLoadingSyncDiff: boolean;
  isSyncing: boolean;
  selectedSyncSections: NovelWorldSyncInput["sections"];
  onSelectedSyncSectionsChange: (sections: NovelWorldSyncInput["sections"]) => void;
  onImport: Parameters<typeof NovelWorldSourcePanel>[0]["onImport"];
  onCreateManual: Parameters<typeof NovelWorldSourcePanel>[0]["onCreateManual"];
  onGenerate: Parameters<typeof NovelWorldSourcePanel>[0]["onGenerate"];
  onSaveToLibrary: () => void;
  onSync: (payload: NovelWorldSyncInput) => void;
  usageProps: NovelWorldUsageCardProps;
  usageDraft: NovelWorldUsageDraftState;
}

const ASSET_ICON_BY_TYPE: Record<NovelWorldAssetSummary["assetType"], typeof BookOpen> = {
  map: Map,
  faction_diagram: Network,
  timeline: GitFork,
  character_network: GitCompareArrows,
  power_system_tree: Workflow,
};

function labelSourceType(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case "imported":
      return t("source.imported");
    case "generated":
      return t("source.generated");
    case "manual":
      return t("source.manual");
    default:
      return t("source.unset");
  }
}

function labelSyncDirection(direction: string | null | undefined): string {
  switch (direction) {
    case "push":
      return t("sync.push");
    case "pull":
      return t("sync.pull");
    case "bidirectional":
      return t("sync.bidirectional");
    default:
      return t("sync.none");
  }
}

function sectionLabel(section: string): string {
  switch (section) {
    case "profile":
      return t("section.profile");
    case "rules":
      return t("section.rules");
    case "factions":
      return t("section.factions");
    case "forces":
      return t("section.forces");
    case "locations":
      return t("section.locations");
    case "relations":
      return t("section.relations");
    default:
      return section;
  }
}

function labelAssetStatus(status: string, hasRenderData: boolean): string {
  if (hasRenderData || status === "ready") {
      return t("asset.ready");
  }
  switch (status) {
    case "draft":
      return t("asset.draft");
    case "archived":
      return t("asset.archived");
    default:
      return t("asset.pending");
  }
}

function assetReadinessHint(assetType: NovelWorldAssetSummary["assetType"]): string {
  switch (assetType) {
    case "map":
      return t("assetHints.map");
    case "faction_diagram":
      return t("assetHints.factionDiagram");
    case "timeline":
      return t("assetHints.timeline");
    case "character_network":
      return t("assetHints.characterNetwork");
    case "power_system_tree":
      return t("assetHints.powerSystemTree");
    default:
      return t("assetHints.default");
  }
}

function formatSyncTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(i18n.language === "zh" ? "zh-CN" : i18n.language === "en" ? "en-US" : "vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InlineMeta(props: { items: Array<string | null | undefined> }) {
  const items = props.items.filter((item): item is string => Boolean(item));
  if (!items.length) {
    return null;
  }
  return <div className="mt-3 text-xs leading-5 text-muted-foreground">{items.join(" · ")}</div>;
}

function SectionTitle(props: { title: string; description?: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-foreground">{props.title}</div>
      {props.description ? <div className="mt-1 text-sm leading-6 text-muted-foreground">{props.description}</div> : null}
    </div>
  );
}

function EmptyLine(props: { children: string }) {
  return <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">{props.children}</div>;
}

function WorldOverviewTab(props: {
  novelWorld: NovelWorldSummary | null;
  handbook: NovelWorldHandbook | null;
  activeWorldName: string;
}) {
  const { novelWorld, handbook } = props;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title={t("overview.title")} description={t("overview.description")} />
        <div className="mt-4 rounded-2xl bg-muted/15 p-5">
          <div className="text-xs text-muted-foreground">
            {novelWorld ? labelSourceType(novelWorld.sourceType) : t("overview.sourceUnset")} · {novelWorld?.hasStorySlice ? t("overview.scopeReady") : t("overview.scopePending")}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{props.activeWorldName}</div>
          <div className="mt-3 max-w-4xl text-base leading-8 text-muted-foreground">
            {handbook?.summary ?? novelWorld?.coverSummary ?? t("overview.preparing")}
          </div>
          <InlineMeta items={[
            handbook?.identity ? t("overview.identity", { value: handbook.identity }) : null,
            handbook?.tone ? t("overview.tone", { value: handbook.tone }) : null,
            ...(handbook?.themes.slice(0, 4) ?? []),
          ]} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle title={t("overview.mainForces")} />
          <div className="mt-3 space-y-3">
            {(handbook?.forces.length ? handbook.forces : handbook?.factions ?? []).slice(0, 8).map((item) => (
              <div key={item.name} className="border-t border-border/50 pt-3 text-sm">
                <div className="font-medium text-foreground">{item.name}</div>
                <div className="mt-1 leading-6 text-muted-foreground">
                  {"pressure" in item && item.pressure ? item.pressure : null}
                  {"doctrine" in item && item.doctrine ? item.doctrine : null}
                  {"summary" in item && item.summary ? item.summary : null}
                  {"narrativeRole" in item && item.narrativeRole ? ` · ${item.narrativeRole}` : null}
                </div>
              </div>
            ))}
            {(!handbook || (handbook.forces.length === 0 && handbook.factions.length === 0)) ? <EmptyLine>{t("overview.noForces")}</EmptyLine> : null}
          </div>
        </div>
        <div>
          <SectionTitle title={translateUi("故事舞台")} />
          <div className="mt-3 space-y-3">
            {handbook?.locations.slice(0, 8).map((location) => (
              <div key={location.name} className="border-t border-border/50 pt-3 text-sm">
                <div className="font-medium text-foreground">{location.name}</div>
                <div className="mt-1 leading-6 text-muted-foreground">
                  {location.narrativeFunction || location.summary || translateUi("暂无说明")}
                  {location.risk ? translateUi(" · 风险：{{value0}}", { value0: location.risk }) : null}
                </div>
              </div>
            ))}
            {!handbook?.locations.length ? <EmptyLine>{translateUi("还没有明确的故事舞台。")}</EmptyLine> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function RulesTab(props: { handbook: NovelWorldHandbook | null }) {
  const handbook = props.handbook;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title={translateUi("规则与代价")} description={translateUi("章节生成会优先遵守这些硬规则，避免临时发明不一致的设定。")} />
        <div className="mt-4 space-y-4">
          {handbook?.coreRules.length ? handbook.coreRules.map((rule) => (
            <div key={`${rule.name}-${rule.summary}`} className="border-t border-border/60 pt-4">
              <div className="text-sm font-medium text-foreground">{rule.name}</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">{rule.summary || translateUi("暂无说明")}</div>
              <InlineMeta items={[
                rule.cost ? translateUi("代价：{{value0}}", { value0: rule.cost }) : null,
                rule.boundary ? translateUi("边界：{{value0}}", { value0: rule.boundary }) : null,
              ]} />
            </div>
          )) : <EmptyLine>{translateUi("还没有明确的核心规则。")}</EmptyLine>}
        </div>
      </section>

      <section>
        <SectionTitle title={translateUi("关键张力")} description={translateUi("这些长期矛盾会帮助大纲和章节保持世界压力。")} />
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          {handbook?.tensions.length ? handbook.tensions.map((tension) => (
            <div key={tension} className="border-t border-border/50 pt-2">{tension}</div>
          )) : <EmptyLine>{translateUi("还没有明确的长期矛盾。")}</EmptyLine>}
        </div>
      </section>
    </div>
  );
}

function GuidanceTab(props: { handbook: NovelWorldHandbook | null }) {
  const guidance = props.handbook?.generationGuidance ?? null;
  const groups = [
    { title: translateUi("角色身份边界"), items: guidance?.characterUses ?? [] },
    { title: translateUi("故事范围线索"), items: guidance?.outlineUses ?? [] },
    { title: translateUi("场景规则约束"), items: guidance?.chapterUses ?? [] },
    { title: translateUi("需要避开的越界"), items: guidance?.avoidUses ?? [] },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle title={translateUi("生成约束")} description={translateUi("这些内容解释本书世界会怎样进入角色、大纲和章节生成。")} />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-xl bg-muted/15 p-4">
            <div className="text-sm font-medium text-foreground">{group.title}</div>
            <div className="mt-3 space-y-2">
              {group.items.length > 0 ? group.items.slice(0, 6).map((item) => (
                <div key={item} className="text-sm leading-6 text-muted-foreground">{item}</div>
              )) : (
                <div className="text-sm leading-6 text-muted-foreground">{translateUi("暂无明确提示。")}</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AssetsPanel(props: { worldAssets: NovelWorldAssetSummary[] }) {
  return (
    <section>
      <SectionTitle title={translateUi("世界资产")} description={translateUi("地图、势力图谱、时间线和体系树用于帮助你看见世界，不是章节生成的唯一来源。")} />
      {props.worldAssets.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {props.worldAssets.map((asset) => {
            const Icon = ASSET_ICON_BY_TYPE[asset.assetType] ?? BookOpen;
            return (
              <div key={asset.assetType} className="rounded-xl bg-muted/15 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {asset.title}
                </div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">{asset.description}</div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">{assetReadinessHint(asset.assetType)}</div>
                <div className="mt-3 text-xs text-muted-foreground">{labelAssetStatus(asset.status, asset.hasRenderData)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyLine>{translateUi("世界资产入口会随本书世界手册一起整理。")}</EmptyLine>
        </div>
      )}
    </section>
  );
}

function SyncPanel(props: Pick<NovelWorldHandbookDialogProps,
  "novelWorld" | "syncDiff" | "syncHistory" | "isLoadingSyncDiff" | "isSyncing" |
  "selectedSyncSections" | "onSelectedSyncSectionsChange" | "onSync"
>) {
  const { novelWorld, syncDiff } = props;
  const hasSyncDiff = Boolean(syncDiff?.differences.length);
  const effectiveSyncSections = props.selectedSyncSections && props.selectedSyncSections.length > 0
    ? props.selectedSyncSections
    : syncDiff?.differences.map((item) => item.section);
  const selectedSectionCount = effectiveSyncSections?.length ?? 0;

  if (!novelWorld?.sourceWorldId) {
    return null;
  }

  return (
    <section id="novel-world-sync">
      <SectionTitle
        title={translateUi("同步管理")}
        description={translateUi("先看本书世界和世界库样本差在哪里，再选择要同步的分区。系统不会自动覆盖两边内容。")}
      />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-muted/15 p-3">
          <div className="text-xs text-muted-foreground">{translateUi("差异检查")}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {props.isLoadingSyncDiff ? translateUi("检查中") : syncDiff ? translateUi("检查完成") : translateUi("等待检查")}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {syncDiff?.differenceCount ? translateUi("{{value0}} 个分区存在差异。", { value0: syncDiff.differenceCount }) : syncDiff ? translateUi("没有发现需要处理的分区差异。") : translateUi("打开本书世界时会读取差异摘要。")}
          </div>
        </div>
        <div className="rounded-xl bg-muted/15 p-3">
          <div className="text-xs text-muted-foreground">{translateUi("选择分区")}</div>
          <div className="mt-1 text-sm font-medium text-foreground">{hasSyncDiff ? translateUi("{{value0}} 个分区", { value0: selectedSectionCount }) : translateUi("无需选择")}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{translateUi("只同步你确认过的概要、规则、势力、地点或关系网络。")}</div>
        </div>
        <div className="rounded-xl bg-muted/15 p-3">
          <div className="text-xs text-muted-foreground">{translateUi("手动同步")}</div>
          <div className="mt-1 text-sm font-medium text-foreground">{novelWorld.syncEnabled ? labelSyncDirection(novelWorld.syncDirection) : translateUi("独立副本")}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{translateUi("推送会改世界库样本；拉取会改本书世界副本。")}</div>
        </div>
      </div>

      {!syncDiff?.differences.length && novelWorld.syncPendingSummary ? (
        <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground whitespace-pre-line">
          {novelWorld.syncPendingSummary}
        </div>
      ) : null}

      {!novelWorld.syncEnabled ? (
        <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">

          {translateUi("本书世界会作为独立副本使用。需要同步时，可以手动推送本书世界或拉取世界库内容。")}
        </div>
      ) : null}

      {syncDiff?.canSync === false ? (
        <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {syncDiff.reason ?? translateUi("暂无法同步。")}
        </div>
      ) : syncDiff?.differences.length ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {syncDiff.differences.map((item) => {
              const checked = !props.selectedSyncSections?.length || props.selectedSyncSections.includes(item.section);
              return (
                <label key={item.section} className="flex items-start gap-3 rounded-md bg-muted/20 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(event) => {
                      const current = props.selectedSyncSections && props.selectedSyncSections.length > 0
                        ? props.selectedSyncSections
                        : syncDiff.differences.map((diff) => diff.section);
                      props.onSelectedSyncSectionsChange(event.target.checked
                        ? Array.from(new Set([...current, item.section]))
                        : current.filter((section) => section !== item.section));
                    }}
                  />
                  <span>
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="mt-1 block text-muted-foreground">{item.summary}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={props.isSyncing || !effectiveSyncSections?.length} onClick={() => props.onSync({ direction: "pull", sections: effectiveSyncSections })}>
              {props.isSyncing ? translateUi("同步中...") : translateUi("拉取世界库更新")}
            </Button>
            <Button type="button" variant="secondary" disabled={props.isSyncing || !effectiveSyncSections?.length} onClick={() => props.onSync({ direction: "push", sections: effectiveSyncSections })}>
              {props.isSyncing ? translateUi("同步中...") : translateUi("推送本书修改")}
            </Button>
            <Button type="button" variant="outline" disabled={props.isSyncing} onClick={() => props.onSync({ direction: "none" })}>

              {translateUi("关闭同步")}
            </Button>
          </div>
        </div>
      ) : !novelWorld.syncEnabled ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={props.isSyncing} onClick={() => props.onSync({ direction: "pull" })}>
            {props.isSyncing ? translateUi("同步中...") : translateUi("拉取世界库内容")}
          </Button>
          <Button type="button" variant="secondary" disabled={props.isSyncing} onClick={() => props.onSync({ direction: "push" })}>
            {props.isSyncing ? translateUi("同步中...") : translateUi("推送本书世界")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">

          {translateUi("本书世界和世界库样本保持一致。")}
        </div>
      )}

      {props.syncHistory.length > 0 ? (
        <DetailDisclosure title={translateUi("最近同步")} description={translateUi("查看最近几次主动同步记录。")} className="mt-4">
          <div className="space-y-2">
            {props.syncHistory.map((record) => (
              <div key={record.id} className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">{record.direction === "pull" ? translateUi("拉取") : translateUi("推送")}</span>
                <span> · {formatSyncTime(record.createdAt) ?? record.createdAt}</span>
                {record.syncedSections.length > 0 ? <span> · {record.syncedSections.map(sectionLabel).join(translateUi("、"))}</span> : null}
                {record.diffSummary ? <span className="block">{record.diffSummary}</span> : null}
              </div>
            ))}
          </div>
        </DetailDisclosure>
      ) : null}
    </section>
  );
}

function SourceAndLibraryPanel(props: Pick<NovelWorldHandbookDialogProps,
  "novelWorld" | "worldOptions" | "selectedWorldId" | "isImporting" | "isGenerating" |
  "isCreatingManual" | "isSavingToLibrary" | "onImport" | "onCreateManual" | "onGenerate" | "onSaveToLibrary"
>) {
  return (
    <section>
      <SectionTitle title={translateUi("来源与世界库")} description={translateUi("从世界库导入、根据本书生成，或保存本书世界作为可复用样本。")} />
      {props.novelWorld && !props.novelWorld.sourceWorldId ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">{translateUi("保存到世界库")}</div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">

              {translateUi("把本书世界保存为可复用样本，后续可以推送本书修改或拉取世界库内容。")}
            </div>
          </div>
          <Button type="button" variant="secondary" disabled={props.isSavingToLibrary} onClick={() => props.onSaveToLibrary()}>
            <Library className="size-4" />
            {props.isSavingToLibrary ? translateUi("保存中...") : translateUi("保存到世界库")}
          </Button>
        </div>
      ) : null}

      <DetailDisclosure
        title={translateUi("选择或更换本书世界来源")}
        description={translateUi("从世界库导入、根据本书生成，或先创建一个自定义世界骨架。")}
        meta={props.novelWorld ? translateUi("按需更换") : translateUi("待选择")}
        defaultOpen={!props.novelWorld}
        className="mt-4"
      >
        <div id="novel-world-source">
          <NovelWorldSourcePanel
            worldOptions={props.worldOptions}
            selectedWorldId={props.selectedWorldId}
            isImporting={props.isImporting}
            isGenerating={props.isGenerating}
            isCreatingManual={props.isCreatingManual}
            onImport={props.onImport}
            onCreateManual={props.onCreateManual}
            onGenerate={props.onGenerate}
          />
        </div>
      </DetailDisclosure>
    </section>
  );
}

export function NovelWorldHandbookDialog(props: NovelWorldHandbookDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <AppDialogContent
        title={props.activeWorldName}
        description={translateUi("查看本书世界手册、生成约束和使用范围。这里的内容会服务角色、大纲和章节生成。")}
        className="h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] xl:max-w-7xl"
        bodyClassName="overflow-hidden p-0"
      >
        <Tabs value={props.activeTab} onValueChange={(value) => props.onTabChange(value as NovelWorldDialogTab)} className="grid h-full min-h-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          <TabsList className={cn(
            "m-0 h-auto justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-3",
            "lg:flex lg:flex-col lg:items-stretch lg:overflow-visible lg:border-b-0 lg:border-r",
          )}>
            {[
              ["overview", translateUi("世界总览")],
              ["rules", translateUi("规则与张力")],
              ["guidance", translateUi("生成约束")],
              ["usage", translateUi("使用范围")],
              ["sync", translateUi("同步与资产")],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="justify-start data-[state=active]:bg-muted">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <TabsContent value="overview" className="mt-0">
              <WorldOverviewTab novelWorld={props.novelWorld} handbook={props.handbook} activeWorldName={props.activeWorldName} />
            </TabsContent>
            <TabsContent value="rules" className="mt-0">
              <RulesTab handbook={props.handbook} />
            </TabsContent>
            <TabsContent value="guidance" className="mt-0">
              <GuidanceTab handbook={props.handbook} />
            </TabsContent>
            <TabsContent value="usage" className="mt-0">
              <NovelWorldUsageDetails {...props.usageProps} draft={props.usageDraft} />
            </TabsContent>
            <TabsContent value="sync" className="mt-0 space-y-8">
              {props.novelWorld?.sourceWorldId ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/worlds/${props.novelWorld.sourceWorldId}/workspace`}>{translateUi("打开来源世界手册")}</Link>
                </Button>
              ) : null}
              <AssetsPanel worldAssets={props.worldAssets} />
              <SyncPanel
                novelWorld={props.novelWorld}
                syncDiff={props.syncDiff}
                syncHistory={props.syncHistory}
                isLoadingSyncDiff={props.isLoadingSyncDiff}
                isSyncing={props.isSyncing}
                selectedSyncSections={props.selectedSyncSections}
                onSelectedSyncSectionsChange={props.onSelectedSyncSectionsChange}
                onSync={props.onSync}
              />
              <SourceAndLibraryPanel
                novelWorld={props.novelWorld}
                worldOptions={props.worldOptions}
                selectedWorldId={props.selectedWorldId}
                isImporting={props.isImporting}
                isGenerating={props.isGenerating}
                isCreatingManual={props.isCreatingManual}
                isSavingToLibrary={props.isSavingToLibrary}
                onImport={props.onImport}
                onCreateManual={props.onCreateManual}
                onGenerate={props.onGenerate}
                onSaveToLibrary={props.onSaveToLibrary}
              />
            </TabsContent>
          </div>
        </Tabs>
      </AppDialogContent>
    </Dialog>
  );
}
