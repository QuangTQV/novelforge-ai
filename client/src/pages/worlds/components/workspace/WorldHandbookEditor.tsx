import { translateUi } from "@/i18n/legacy";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BookOpen, Castle, GitBranch, MapPinned, Pencil, Save, ScrollText, WandSparkles } from "lucide-react";
import type {
  WorldBindingSupport,
  WorldStructuredData,
  WorldStructureSectionKey,
} from "@ai-novel/shared/types/world";
import type { WorldStructurePayload } from "@/api/world";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HandbookField,
  HandbookPreviewCard,
  HandbookPreviewLine,
  HandbookTextarea,
} from "./handbook/HandbookPrimitives";
import WorldHandbookForceSection from "./handbook/WorldHandbookForceSection";
import WorldHandbookLocationSection from "./handbook/WorldHandbookLocationSection";
import WorldHandbookRuleSection from "./handbook/WorldHandbookRuleSection";
import WorldHandbookTensionSection from "./handbook/WorldHandbookTensionSection";

type EditableHandbookSection = "profile" | "rules" | "forces" | "locations" | "relations";

function compactText(value: string | null | undefined, fallback: string, limit = 120): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function joinPreview(items: Array<string | null | undefined>, fallback: string): string {
  const text = items
    .map((item) => item?.replace(/\s+/g, " ").trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 3)
    .join(" / ");
  return text || fallback;
}

export default function WorldHandbookEditor(props: {
  initialPayload?: WorldStructurePayload;
  savePending: boolean;
  backfillPending: boolean;
  generatePending: boolean;
  onSave: (structure: WorldStructuredData, bindingSupport: WorldBindingSupport) => Promise<void>;
  onBackfill: () => Promise<{ structure: WorldStructuredData; bindingSupport: WorldBindingSupport } | undefined>;
  onGenerate: (
    section: WorldStructureSectionKey,
    structure: WorldStructuredData,
    bindingSupport: WorldBindingSupport,
  ) => Promise<{ structure: WorldStructuredData; bindingSupport: WorldBindingSupport } | undefined>;
  onOpenDeepening: () => void;
  onOpenLayers: () => void;
  onOpenOverview: () => void;
  onOpenAdvanced: () => void;
}) {
  const { t } = useTranslation("worldHandbookEditor");
  const {
    initialPayload,
    savePending,
    backfillPending,
    generatePending,
    onSave,
    onBackfill,
    onGenerate,
    onOpenDeepening,
    onOpenLayers,
    onOpenOverview,
    onOpenAdvanced,
  } = props;
  const [draftStructure, setDraftStructure] = useState<WorldStructuredData | null>(initialPayload?.structure ?? null);
  const [draftBindingSupport, setDraftBindingSupport] = useState<WorldBindingSupport | null>(
    initialPayload?.bindingSupport ?? null,
  );
  const [activeAiSection, setActiveAiSection] = useState<WorldStructureSectionKey>("profile");
  const [editingSection, setEditingSection] = useState<EditableHandbookSection | null>(null);

  useEffect(() => {
    if (!initialPayload) {
      return;
    }
    setDraftStructure(initialPayload.structure);
    setDraftBindingSupport(initialPayload.bindingSupport);
  }, [initialPayload]);

  if (!draftStructure || !draftBindingSupport) {
    return (
      <section className="flex min-h-56 flex-col items-center justify-center rounded-3xl bg-muted/20 px-6 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
          <div className="mt-3 font-medium">{t("loading.title")}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{t("loading.description")}</div>
          <Button
            className="mt-4 rounded-full"
            variant="outline"
            onClick={async () => {
              const result = await onBackfill();
              if (result) {
                setDraftStructure(result.structure);
                setDraftBindingSupport(result.bindingSupport);
              }
            }}
            disabled={backfillPending}
          >
            {backfillPending ? t("actions.organizing") : t("actions.organizeWithAi")}
          </Button>
      </section>
    );
  }

  const saveDraft = async () => {
    await onSave(draftStructure, draftBindingSupport);
  };

  const generateSection = async () => {
    const result = await onGenerate(activeAiSection, draftStructure, draftBindingSupport);
    if (result) {
      setDraftStructure(result.structure);
      setDraftBindingSupport(result.bindingSupport);
    }
  };

  return (
    <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onOpenOverview}>
              <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("actions.viewHandbook")}
            </Button>
            <Button type="button" size="sm" className="rounded-full" onClick={saveDraft} disabled={savePending}>
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {savePending ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </div>
        <div className="rounded-3xl bg-muted/20 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="border-0 bg-primary/[0.07] font-normal text-primary">{t("sections.profile")}</Badge>
            {draftStructure.profile.tone ? <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{draftStructure.profile.tone}</Badge> : null}
            {draftStructure.profile.themes.slice(0, 4).map((theme) => (
              <Badge key={theme} variant="secondary" className="border-0 bg-muted/60 font-normal">
                {theme}
              </Badge>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
            <HandbookPreviewLine
              label={t("profile.identity")}
              value={draftStructure.profile.identity}
              fallback={t("profile.identityFallback")}
            />
            <HandbookPreviewLine
              label={t("profile.summary")}
              value={draftStructure.profile.summary}
              fallback={t("profile.summaryFallback")}
            />
            <HandbookPreviewLine
              label={t("profile.tone")}
              value={draftStructure.profile.tone || draftStructure.profile.themes.join(translateUi("、"))}
              fallback={t("profile.toneFallback")}
            />
            <HandbookPreviewLine
              label={t("profile.coreConflict")}
              value={draftStructure.profile.coreConflict}
              fallback={t("profile.coreConflictFallback")}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setEditingSection("profile")}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("actions.editProfile")}
            </Button>
          </div>
          {editingSection === "profile" ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.4fr]">
            <div className="space-y-3">
              <HandbookField title={translateUi("一句话世界印象")} hint={translateUi("让作者和 AI 一眼知道这个世界的类型、时代感和核心奇观。")}>
                <Input
                  value={draftStructure.profile.identity}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, identity: event.target.value } } : prev,
                    )
                  }
                  placeholder={translateUi("例如：星核枯竭的仙侠王朝")}
                />
              </HandbookField>
              <HandbookField title={translateUi("阅读气质")} hint={translateUi("决定故事是黑暗、热血、轻喜、权谋，还是冒险探索。")}>
                <Input
                  value={draftStructure.profile.tone}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, tone: event.target.value } } : prev,
                    )
                  }
                  placeholder={translateUi("黑暗史诗、轻喜冒险、权谋争霸...")}
                />
              </HandbookField>
              <HandbookField title={translateUi("主题关键词")} hint={translateUi("用顿号分隔，帮助后续角色、地点和冲突保持同一种题材方向。")}>
                <Input
                  value={draftStructure.profile.themes.join(translateUi("、"))}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            themes: event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
                          },
                        }
                        : prev,
                    )
                  }
                  placeholder={translateUi("复仇、王朝更替、异能觉醒")}
                />
              </HandbookField>
            </div>
            <div className="space-y-3">
              <HandbookField title={translateUi("世界给读者的第一眼")} hint={translateUi("写成作者能直接复述的短段落，不需要拆成地理、文化、历史字段。")}>
                <HandbookTextarea
                  value={draftStructure.profile.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) => (prev ? { ...prev, profile: { ...prev.profile, summary: value } } : prev))
                  }
                  placeholder={translateUi("用一段话让作者知道这个世界长什么样、故事会从哪里开始。")}
                />
              </HandbookField>
              <HandbookField title={translateUi("能持续推动剧情的矛盾")} hint={translateUi("这不是背景介绍，而是角色行动、势力冲突和章节事件反复围绕的问题。")}>
                <HandbookTextarea
                  value={draftStructure.profile.coreConflict}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, profile: { ...prev.profile, coreConflict: value } } : prev,
                    )
                  }
                  placeholder={translateUi("例如：星核枯竭让修行者争夺寿命，朝廷想封锁真相，边境异魔趁机入侵。")}
                  minRows={3}
                />
              </HandbookField>
            </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border/35 bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("ai.title")}</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("ai.description")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "profile", label: t("sections.profile") }, { key: "rules", label: t("sections.rules") },
                { key: "factions", label: t("sections.factions") }, { key: "locations", label: t("sections.locations") },
                { key: "relations", label: t("sections.relations") },
              ].map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeAiSection === item.key ? "default" : "ghost"}
                  className="rounded-full"
                  onClick={() => setActiveAiSection(item.key as WorldStructureSectionKey)}
                >
                  {item.label}
                </Button>
              ))}
              <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={generateSection} disabled={generatePending}>
                <WandSparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                {generatePending ? t("actions.generating") : t("actions.generateSection")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <HandbookPreviewCard
            icon={ScrollText}
            title={t("sections.rules")}
            description={t("rules.description", { count: draftStructure.rules.axioms.length })}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("rules")}>
                {t("actions.editRules")}
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label={t("rules.summary")}
                value={draftStructure.rules.summary}
                fallback={t("rules.summaryFallback")}
              />
              <HandbookPreviewLine
                label={t("rules.axioms")}
                value={joinPreview(
                  draftStructure.rules.axioms.map((rule) => [rule.name, rule.summary].filter(Boolean).join(translateUi("："))),
                  t("rules.axiomsFallback"),
                )}
                fallback={t("rules.axiomsFallback")}
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={Castle}
            title={translateUi("主要势力")}
            description={translateUi("{{value0}} 个势力决定角色归属、阵营压力和资源争夺。", { value0: draftStructure.forces.length })}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("forces")}>

                {translateUi("整理势力")}
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label={translateUi("活跃势力")}
                value={joinPreview(
                  draftStructure.forces.map((force) => [force.name, force.currentObjective].filter(Boolean).join(translateUi("："))),
                  translateUi("补充主要势力后，角色身份和阵营冲突会更清楚。"),
                )}
                fallback={translateUi("补充主要势力后，角色身份和阵营冲突会更清楚。")}
              />
              <HandbookPreviewLine
                label={translateUi("故事压力")}
                value={joinPreview(
                  draftStructure.forces.map((force) => force.pressure),
                  translateUi("补充势力给主角和世界秩序造成的压力。"),
                )}
                fallback={translateUi("补充势力给主角和世界秩序造成的压力。")}
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={MapPinned}
            title={translateUi("故事舞台")}
            description={translateUi("{{value0}} 个地点承载开局、升级、转折、决战和地图资产。", { value0: draftStructure.locations.length })}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("locations")}>

                {translateUi("整理地点")}
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label={translateUi("可用地点")}
                value={joinPreview(
                  draftStructure.locations.map((location) =>
                    [location.name, location.narrativeFunction || location.terrain].filter(Boolean).join(translateUi("：")),
                  ),
                  translateUi("补充开局地点、试炼地点、冲突地点或真相地点。"),
                )}
                fallback={translateUi("补充开局地点、试炼地点、冲突地点或真相地点。")}
              />
              <HandbookPreviewLine
                label={translateUi("进入风险")}
                value={joinPreview(
                  draftStructure.locations.map((location) => location.risk),
                  translateUi("补充进入地点会遇到的阻力、代价或身份风险。"),
                )}
                fallback={translateUi("补充进入地点会遇到的阻力、代价或身份风险。")}
              />
            </div>
          </HandbookPreviewCard>

          <HandbookPreviewCard
            icon={GitBranch}
            title={translateUi("冲突张力")}
            description={translateUi("记录势力关系、地点控制、共同后果和禁忌组合，帮助世界保持可写性。")}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection("relations")}>

                {translateUi("整理张力")}
              </Button>
            }
          >
            <div className="space-y-3">
              <HandbookPreviewLine
                label={translateUi("势力关系")}
                value={joinPreview(
                  draftStructure.relations.forceRelations.map((relation) =>
                    [relation.relation, relation.tension || relation.detail].filter(Boolean).join(translateUi("：")),
                  ),
                  translateUi("补充谁与谁结盟、敌对、竞争或互相利用。"),
                )}
                fallback={translateUi("补充谁与谁结盟、敌对、竞争或互相利用。")}
              />
              <HandbookPreviewLine
                label={translateUi("共同后果")}
                value={joinPreview(
                  draftStructure.rules.sharedConsequences,
                  translateUi("补充违反规则或冲突升级后会影响全局的后果。"),
                )}
                fallback={translateUi("补充违反规则或冲突升级后会影响全局的后果。")}
              />
            </div>
          </HandbookPreviewCard>
        </div>

        {editingSection ? (
          <div className="rounded-2xl bg-primary/[0.055] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-primary" aria-hidden="true" />

                {translateUi("正在整理选中区块，保存后会更新上方手册概览。")}
              </div>
              <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setEditingSection(null)}>

                {translateUi("收起编辑")}
              </Button>
            </div>
          </div>
        ) : null}

        {editingSection === "rules" ? (
          <WorldHandbookRuleSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "forces" ? (
          <WorldHandbookForceSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "locations" ? (
          <WorldHandbookLocationSection draftStructure={draftStructure} setDraftStructure={setDraftStructure} />
        ) : null}
        {editingSection === "relations" ? (
          <WorldHandbookTensionSection
            draftStructure={draftStructure}
            setDraftStructure={setDraftStructure}
            onOpenDeepening={onOpenDeepening}
            onOpenLayers={onOpenLayers}
            onOpenAdvanced={onOpenAdvanced}
          />
        ) : null}
    </section>
  );
}
