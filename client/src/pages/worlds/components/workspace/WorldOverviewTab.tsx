import { translateUi } from "@/i18n/legacy";
import {
  BookOpen,
  Castle,
  Clock3,
  GitBranch,
  Map,
  MapPinned,
  Network,
  Pencil,
  ShieldAlert,
  Sparkles,
  WandSparkles,
  Workflow,
} from "lucide-react";
import type { WorldStructuredData, WorldVisualizationPayload } from "@ai-novel/shared/types/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { featureFlags } from "@/config/featureFlags";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import WorldVisualizationBoard from "../WorldVisualizationBoard";

interface WorldOverviewTabProps {
  summary?: string;
  sections: Array<{ key: string; title: string; content: string }>;
  structure?: WorldStructuredData;
  visualization?: WorldVisualizationPayload;
  onOpenStructure?: () => void;
  onOpenLayers?: () => void;
}

function compactText(value: string | null | undefined, fallback: string, limit = 120) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function listText(items: Array<string | null | undefined>, fallback: string, limit = 3) {
  const visible = items.map((item) => compactText(item, "", 96)).filter(Boolean).slice(0, limit);
  return visible.length > 0 ? visible : [fallback];
}

function HandbookBlock({
  icon: Icon,
  title,
  items,
  accent = "default",
}: {
  icon: typeof BookOpen;
  title: string;
  items: string[];
  accent?: "default" | "primary";
}) {
  return (
    <div className={accent === "primary" ? "rounded-2xl bg-primary/[0.055] p-4" : "rounded-2xl bg-muted/20 p-4"}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <div key={item} className="line-clamp-3">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHandbookBlock({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/45 bg-background/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
    </div>
  );
}

function WorldAssetPreviewBlock({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/45 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </div>
        <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{status}</Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

export default function WorldOverviewTab(props: WorldOverviewTabProps) {
  const { summary, sections, structure, visualization, onOpenStructure, onOpenLayers } = props;
  const profile = structure?.profile;
  const hasHandbook = Boolean(structure);
  const { t } = useTranslation("worldOverview");
  const worldPromise = compactText(
    profile?.identity || profile?.summary,
    summary ?? t("ui.promiseFallback"),
    120,
  );
  const coreRules = listText(
    structure?.rules?.axioms.map((rule) => [rule.name, rule.summary].filter(Boolean).join("：")) ?? [],
    t("ui.coreRules"),
  );
  const majorForces = listText(
    [
      ...(structure?.forces ?? []).map((force) => [force.name, force.summary || force.currentObjective].filter(Boolean).join("：")),
      ...(structure?.factions ?? []).map((faction) => [faction.name, faction.position || faction.doctrine].filter(Boolean).join("：")),
    ],
    t("ui.forces"),
  );
  const storyLocations = listText(
    structure?.locations.map((location) =>
      [location.name, location.narrativeFunction || location.risk || location.summary].filter(Boolean).join("："),
    ) ?? [],
    t("ui.locations"),
  );
  const tensions = listText(
    [
      profile?.coreConflict,
      ...(structure?.relations.forceRelations ?? []).map((relation) =>
        [relation.relation, relation.tension || relation.detail].filter(Boolean).join("："),
      ),
      ...(structure?.rules.sharedConsequences ?? []),
    ],
    t("ui.tensions"),
  );

  return (
    <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{featureFlags.worldVisEnabled ? t("ui.readGraph") : t("ui.readHandbook")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("ui.description")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={onOpenStructure}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("ui.edit")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onOpenLayers}>
              <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("ui.build")}
            </Button>
          </div>
        </div>
        {hasHandbook ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-3xl bg-muted/20 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">{t("ui.sample")}</Badge>
                  {profile?.tone ? <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{profile.tone}</Badge> : null}
                  {profile?.themes?.slice(0, 4).map((theme) => (
                    <Badge key={theme} variant="secondary" className="border-0 bg-muted/60 font-normal">
                      {theme}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 text-lg font-semibold leading-7">
                  {worldPromise}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {compactText(profile?.summary, summary ?? t("ui.summaryFallback"), 180)}
                </div>
                <div className="mt-3 text-sm leading-6">
                  {compactText(profile?.coreConflict, t("ui.conflictFallback"), 160)}
                </div>
              </div>

              <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
                <div className="text-sm font-medium">{t("ui.provides")}</div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <div>{t("ui.identity")}</div>
                  <div>{t("ui.stage")}</div>
                  <div>{t("ui.rules")}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-7 gap-y-2 px-1 text-sm text-muted-foreground">
              <span><strong className="font-semibold tabular-nums text-foreground">{structure?.rules.axioms.length ?? 0}</strong>  {translateUi("条核心规则")}</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{(structure?.forces.length ?? 0) + (structure?.factions.length ?? 0)}</strong>  {translateUi("个势力与阵营")}</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{structure?.locations.length ?? 0}</strong>  {translateUi("个故事地点")}</span>
              <span><strong className="font-semibold tabular-nums text-foreground">{(structure?.relations.forceRelations.length ?? 0) + (structure?.relations.locationControls.length ?? 0)}</strong>  {translateUi("条关系线索")}</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <HandbookBlock icon={Sparkles} title={translateUi("力量与规则")} items={coreRules} accent="primary" />
              <HandbookBlock icon={Castle} title={translateUi("主要势力")} items={majorForces} />
              <HandbookBlock icon={MapPinned} title={translateUi("故事舞台")} items={storyLocations} />
              <HandbookBlock icon={GitBranch} title={translateUi("关键张力")} items={tensions} />
            </div>

            <HandbookBlock
              icon={ShieldAlert}
              title={translateUi("本书使用时应优先遵守")}
              items={[
                compactText(structure?.rules.summary, translateUi("核心规则会约束角色身份、冲突来源和世界一致性。"), 150),
                ...listText(structure?.rules.taboo ?? [], translateUi("没有记录禁忌组合。需要强约束时，在手册编修中补充。"), 2),
              ]}
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <div className="rounded-3xl bg-muted/20 p-5">
                <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">{translateUi("世界手册待成型")}</Badge>
                <div className="mt-3 text-lg font-semibold leading-7">
                  {compactText(summary, translateUi("先让 AI 或手册编修整理世界骨架，再把它作为可复用世界样本。"), 160)}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">

                  {translateUi("世界手册会把零散设定整理成规则、势力、地点和剧情压力，方便作者理解，也方便本书使用。")}
                </div>
              </div>

              <div className="rounded-3xl border border-border/35 bg-card/70 p-5">
                <div className="text-sm font-medium">{translateUi("建议下一步")}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={onOpenLayers}>
                    <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />

                    {translateUi("AI 构建世界")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={onOpenStructure}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />

                    {translateUi("编修手册")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <EmptyHandbookBlock icon={Sparkles} title={translateUi("力量与规则")} description={translateUi("记录世界不能随意打破的底层规则、代价和禁忌组合。")} />
              <EmptyHandbookBlock icon={Castle} title={translateUi("主要势力")} description={translateUi("整理会推动剧情的组织、阵营、利益集团和压力来源。")} />
              <EmptyHandbookBlock icon={MapPinned} title={translateUi("故事舞台")} description={translateUi("标出开局、升级、冲突爆发和转折发生的关键地点。")} />
              <EmptyHandbookBlock icon={GitBranch} title={translateUi("关键张力")} description={translateUi("沉淀能反复制造冲突的资源矛盾、阵营冲突和规则代价。")} />
            </div>

            {sections.length > 0 ? (
              <div className="rounded-3xl border border-border/35 p-4">
                <div className="mb-2 text-sm font-medium">{translateUi("已有设定片段")}</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {sections.map((section) => (
                    <div key={section.key} className="rounded-2xl bg-muted/20 p-4 text-sm">
                      <div className="mb-1 font-medium">{section.title}</div>
                      <div className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{section.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
        {featureFlags.worldVisEnabled ? (
          <WorldVisualizationBoard payload={visualization} />
        ) : (
          <div className="rounded-3xl border border-border/35 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Map className="h-4 w-4 text-primary" aria-hidden="true" />

                  {translateUi("世界资产入口")}
                </div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">

                  {translateUi("地图和图谱是世界手册的可视化资产，不参与自动同步覆盖，也不替代世界手册的规则来源。")}
                </div>
              </div>
              <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{translateUi("预留入口")}</Badge>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <WorldAssetPreviewBlock
                icon={MapPinned}
                title={translateUi("世界地图")}
                description={translateUi("承载区域、地点连通、故事发生地和冲突热度。")}
                status={(structure?.locations.length ?? 0) > 0 ? translateUi("可整理") : translateUi("待补地点")}
              />
              <WorldAssetPreviewBlock
                icon={Network}
                title={translateUi("势力图谱")}
                description={translateUi("承载势力节点、盟友敌对、控制关系和力量对比。")}
                status={(structure?.forces.length ?? 0) + (structure?.factions.length ?? 0) > 0 ? translateUi("可整理") : translateUi("待补势力")}
              />
              <WorldAssetPreviewBlock
                icon={Clock3}
                title={translateUi("世界时间线")}
                description={translateUi("承载历史事件、局势变化和小说推进中的世界进展。")}
                status={profile?.coreConflict ? translateUi("可整理") : translateUi("待补张力")}
              />
              <WorldAssetPreviewBlock
                icon={Workflow}
                title={translateUi("力量体系树")}
                description={translateUi("承载等级、资源、代价、禁忌和突破边界。")}
                status={(structure?.rules.axioms.length ?? 0) > 0 ? translateUi("可整理") : translateUi("待补规则")}
              />
            </div>
          </div>
        )}
    </section>
  );
}
