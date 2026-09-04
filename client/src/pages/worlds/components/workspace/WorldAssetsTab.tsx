import { translateUi } from "@/i18n/legacy";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { GitCompareArrows, GitFork, Map, Network, Workflow } from "lucide-react";
import type { World, WorldSnapshot } from "@ai-novel/shared/types/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KnowledgeBindingPanel from "@/components/knowledge/KnowledgeBindingPanel";
import SelectControl from "@/components/common/SelectControl";

interface WorldLibraryItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  worldType?: string | null;
  usageCount: number;
  sourceWorldId?: string | null;
}

interface WorldAssetsTabProps {
  worldId: string;
  world?: World;
  selectedLayerPrimaryField: "background" | "magicSystem" | "politics" | "cultures" | "history" | "conflicts";
  libraryKeyword: string;
  setLibraryKeyword: Dispatch<SetStateAction<string>>;
  libraryCategory: string;
  setLibraryCategory: Dispatch<SetStateAction<string>>;
  publishName: string;
  setPublishName: Dispatch<SetStateAction<string>>;
  publishCategory: string;
  setPublishCategory: Dispatch<SetStateAction<string>>;
  publishDescription: string;
  setPublishDescription: Dispatch<SetStateAction<string>>;
  snapshotLabel: string;
  setSnapshotLabel: Dispatch<SetStateAction<string>>;
  diffFrom: string;
  setDiffFrom: Dispatch<SetStateAction<string>>;
  diffTo: string;
  setDiffTo: Dispatch<SetStateAction<string>>;
  importFormat: "json" | "markdown" | "text";
  setImportFormat: Dispatch<SetStateAction<"json" | "markdown" | "text">>;
  importContent: string;
  setImportContent: Dispatch<SetStateAction<string>>;
  libraryItems: WorldLibraryItem[];
  snapshots: WorldSnapshot[];
  diffChanges: Array<{ field: string; before: string | null; after: string | null }>;
  createSnapshotPending: boolean;
  publishPending: boolean;
  importPending: boolean;
  onRefreshLibrary: () => void;
  onInjectLibraryField: (libraryId: string) => void;
  onInjectLibraryStructure: (libraryId: string, targetCollection: "forces" | "locations") => void;
  onPublishLibrary: () => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDiffSnapshots: () => void;
  onExport: (format: "markdown" | "json") => Promise<void>;
  onImport: () => void;
}

type AssetTool = "visualAssets" | "references" | "library" | "snapshots" | "export" | "import";

const WORLD_ASSET_PRESETS = [
  {
    icon: Map,
    titleKey: "presets.map.title",
    descriptionKey: "presets.map.description",
    readinessKey: "presets.map.readiness",
  },
  {
    icon: Network,
    titleKey: "presets.factions.title",
    descriptionKey: "presets.factions.description",
    readinessKey: "presets.factions.readiness",
  },
  {
    icon: GitFork,
    titleKey: "presets.timeline.title",
    descriptionKey: "presets.timeline.description",
    readinessKey: "presets.timeline.readiness",
  },
  {
    icon: GitCompareArrows,
    titleKey: "presets.characters.title",
    descriptionKey: "presets.characters.description",
    readinessKey: "presets.characters.readiness",
  },
  {
    icon: Workflow,
    titleKey: "presets.power.title",
    descriptionKey: "presets.power.description",
    readinessKey: "presets.power.readiness",
  },
];

function AssetToolButton({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
        selected ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      ].join(" ")}
      onClick={onClick}
      title={description}
    >
      {label}
    </button>
  );
}

export default function WorldAssetsTab(props: WorldAssetsTabProps) {
  const { t } = useTranslation("worldAssets");
  const [activeTool, setActiveTool] = useState<AssetTool>("visualAssets");
  const {
    selectedLayerPrimaryField,
    libraryKeyword,
    setLibraryKeyword,
    libraryCategory,
    setLibraryCategory,
    publishName,
    setPublishName,
    publishCategory,
    setPublishCategory,
    publishDescription,
    setPublishDescription,
    snapshotLabel,
    setSnapshotLabel,
    diffFrom,
    setDiffFrom,
    diffTo,
    setDiffTo,
    importFormat,
    setImportFormat,
    importContent,
    setImportContent,
    libraryItems,
    snapshots,
    diffChanges,
    createSnapshotPending,
    publishPending,
    importPending,
    onRefreshLibrary,
    onInjectLibraryField,
    onInjectLibraryStructure,
    onPublishLibrary,
    onCreateSnapshot,
    onRestoreSnapshot,
    onDiffSnapshots,
    onExport,
    onImport,
  } = props;

  return (
    <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{translateUi("世界资料与版本")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{translateUi("管理参考资料、可复用素材、版本备份以及导入导出，地图与图谱能力也从这里进入。")}</p>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted/30 p-1">
          <AssetToolButton
            label={translateUi("地图与图谱")}
            description={translateUi("预留世界资产入口。")}
            selected={activeTool === "visualAssets"}
            onClick={() => setActiveTool("visualAssets")}
          />
          <AssetToolButton
            label={translateUi("参考资料")}
            description={translateUi("关联能支撑世界设定的资料。")}
            selected={activeTool === "references"}
            onClick={() => setActiveTool("references")}
          />
          <AssetToolButton
            label={translateUi("世界素材")}
            description={translateUi("复用地点、势力、资源等可沉淀内容。")}
            selected={activeTool === "library"}
            onClick={() => setActiveTool("library")}
          />
          <AssetToolButton
            label={translateUi("版本快照")}
            description={translateUi("保存版本并比较两次设定差异。")}
            selected={activeTool === "snapshots"}
            onClick={() => setActiveTool("snapshots")}
          />
          <AssetToolButton
            label={translateUi("导出备份")}
            description={translateUi("复制 Markdown 或 JSON。")}
            selected={activeTool === "export"}
            onClick={() => setActiveTool("export")}
          />
          <AssetToolButton
            label={translateUi("导入文本")}
            description={translateUi("从文本、Markdown 或 JSON 创建世界。")}
            selected={activeTool === "import"}
            onClick={() => setActiveTool("import")}
          />
        </div>

        {activeTool === "visualAssets" ? (
          <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-medium">{t("planning.title")}</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("planning.description")}
                </div>
              </div>
              <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{t("planning.reserved")}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {WORLD_ASSET_PRESETS.map((asset) => {
                const Icon = asset.icon;
                return (
                  <div key={asset.titleKey} className="rounded-2xl bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      {t(asset.titleKey)}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">{t(asset.descriptionKey)}</div>
                    <div className="mt-3 rounded-xl bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                      {t(asset.readinessKey)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTool === "references" ? (
          <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="mb-3 font-medium">{t("references.title")}</div>
            <KnowledgeBindingPanel targetType="world" targetId={props.worldId} title={t("references.title")} />
          </div>
        ) : null}

        {activeTool === "library" ? (
          <div className="space-y-4 rounded-3xl border border-border/35 bg-card/70 p-5">
            <div className="font-medium">{t("library.title")}</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder={t("library.keyword")}
                value={libraryKeyword}
                onChange={(event) => setLibraryKeyword(event.target.value)}
              />
              <SelectControl
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={libraryCategory}
                onChange={(event) => setLibraryCategory(event.target.value)}
              >
                <option value="all">{t("categories.all")}</option><option value="terrain">{t("categories.terrain")}</option><option value="race">{t("categories.race")}</option><option value="power_system">{t("categories.power")}</option><option value="organization">{t("categories.organization")}</option><option value="resource">{t("categories.resource")}</option><option value="event">{t("categories.event")}</option><option value="artifact">{t("categories.artifact")}</option><option value="custom">{t("categories.custom")}</option>
              </SelectControl>
              <Button variant="outline" onClick={onRefreshLibrary}>
                {t("actions.refresh")}
              </Button>
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/20 p-4">
              <div className="text-xs font-semibold text-muted-foreground">
                {t("library.saveCurrent")}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder={t("library.name")}
                  value={publishName}
                  onChange={(event) => setPublishName(event.target.value)}
                />
                <SelectControl
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={publishCategory}
                  onChange={(event) => setPublishCategory(event.target.value)}
                >
                  <option value="custom">{t("categories.custom")}</option><option value="terrain">{t("categories.terrain")}</option><option value="race">{t("categories.race")}</option><option value="power_system">{t("categories.power")}</option><option value="organization">{t("categories.organization")}</option><option value="resource">{t("categories.resource")}</option><option value="event">{t("categories.event")}</option><option value="artifact">{t("categories.artifact")}</option>
                </SelectControl>
                <Button onClick={onPublishLibrary} disabled={publishPending}>
                  {publishPending ? t("actions.saving") : t("actions.saveAsset")}
                </Button>
              </div>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background p-2 text-sm"
                value={publishDescription}
                onChange={(event) => setPublishDescription(event.target.value)}
                placeholder={t("library.descriptionPlaceholder")}
              />
            </div>
            {libraryItems.map((item) => (
              <div key={item.id} className="space-y-3 rounded-2xl border border-border/35 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.category}  {translateUi("/ 使用次数=")}{item.usageCount}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onInjectLibraryField(item.id)}>
                    {t("library.addToLayer", { field: selectedLayerPrimaryField })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onInjectLibraryStructure(item.id, "forces")}>
                    {t("library.addToForces")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onInjectLibraryStructure(item.id, "locations")}>
                    {t("library.addToLocations")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTool === "snapshots" ? (
          <div className="space-y-4 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">{t("snapshots.title")}</div>
          <div className="flex gap-2">
            <Input
              placeholder={t("snapshots.labelPlaceholder")}
              value={snapshotLabel}
              onChange={(event) => setSnapshotLabel(event.target.value)}
            />
            <Button onClick={onCreateSnapshot} disabled={createSnapshotPending}>
              {t("snapshots.create")}
            </Button>
          </div>
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between rounded-2xl bg-muted/20 p-3 text-sm">
              <div>
                {snapshot.label ?? snapshot.id.slice(0, 8)} / {new Date(snapshot.createdAt).toLocaleString()}
              </div>
              <Button size="sm" variant="outline" onClick={() => onRestoreSnapshot(snapshot.id)}>
                {t("snapshots.restore")}
              </Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-3">
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={diffFrom}
              onChange={(event) => setDiffFrom(event.target.value)}
            >
              <option value="">{t("snapshots.from")}</option>
              {snapshots.map((snapshot) => (
                <option key={`from-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.label ?? snapshot.id.slice(0, 8)}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={diffTo}
              onChange={(event) => setDiffTo(event.target.value)}
            >
              <option value="">{t("snapshots.to")}</option>
              {snapshots.map((snapshot) => (
                <option key={`to-${snapshot.id}`} value={snapshot.id}>
                  {snapshot.label ?? snapshot.id.slice(0, 8)}
                </option>
              ))}
            </SelectControl>
            <Button onClick={onDiffSnapshots} disabled={!diffFrom || !diffTo}>
              {t("snapshots.compare")}
            </Button>
          </div>
          {diffChanges.map((change) => (
            <div key={change.field} className="rounded-2xl bg-muted/20 p-3 text-xs">
              {change.field}: {change.before ?? translateUi("空")} {"->"} {change.after ?? translateUi("空")}
            </div>
          ))}
          </div>
        ) : null}

        {activeTool === "export" ? (
          <div className="space-y-3 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">{t("export.title")}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void onExport("markdown")}>
              {t("export.markdown")}
            </Button>
            <Button variant="secondary" onClick={() => void onExport("json")}>
              {t("export.json")}
            </Button>
          </div>
          </div>
        ) : null}

        {activeTool === "import" ? (
          <div className="space-y-3 rounded-3xl border border-border/35 bg-card/70 p-5">
          <div className="font-medium">{t("import.title")}</div>
          <SelectControl
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={importFormat}
            onChange={(event) => setImportFormat(event.target.value as "json" | "markdown" | "text")}
          >
            <option value="text">{t("import.text")}</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
          </SelectControl>
          <textarea
            className="min-h-[160px] w-full rounded-md border bg-background p-2 text-sm"
            value={importContent}
            onChange={(event) => setImportContent(event.target.value)}
            placeholder={t("import.placeholder")}
          />
          <Button onClick={onImport} disabled={importPending || !importContent.trim()}>
            {importPending ? t("import.importing") : t("import.createWorld")}
          </Button>
          </div>
        ) : null}
    </section>
  );
}
