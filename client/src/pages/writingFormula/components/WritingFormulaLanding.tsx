import { translateResourceText, translateUi } from "@/i18n/legacy";
import type { KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LandingProfileItem } from "../writingFormulaLandingItems";

interface WritingFormulaLandingProps {
  onOpenCreate: () => void;
  onSelectProfile: (profileId: string) => void;
  onEditProfile: (profileId: string) => void;
  onOpenWorkbench: (profileId: string) => void;
  onUseProfileForClean: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onOpenPromptLab: () => void;
  deletePending: boolean;
  profileItems: LandingProfileItem[];
  selectedProfileId: string;
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const text = value?.trim() ?? "";
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function handleSelectableKeyDown(event: KeyboardEvent<HTMLDivElement>, onSelect: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  onSelect();
}

function DetailPanel(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card/80 p-4 shadow-sm">
      <div className="space-y-1">
        <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">{props.title}</div>
        {props.description ? (
          <div className="text-xs leading-6 text-muted-foreground">{props.description}</div>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

function DetailStatRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm leading-6">
      <div className="text-muted-foreground">{props.label}</div>
      <div className="text-right text-foreground">{props.value}</div>
    </div>
  );
}

function SummaryCard(props: { title: string; summary: string }) {
  return (
    <div className="rounded-2xl border bg-muted/25 p-3.5">
      <div className="text-sm font-medium text-foreground">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{props.summary}</div>
    </div>
  );
}

export default function WritingFormulaLanding(props: WritingFormulaLandingProps) {
  const { t } = useTranslation("writingFormulaLanding");
  const {
    onOpenCreate,
    onSelectProfile,
    onEditProfile,
    onOpenWorkbench,
    onUseProfileForClean,
    onDeleteProfile,
    onOpenPromptLab,
    deletePending,
    profileItems,
    selectedProfileId,
  } = props;

  const customProfiles = profileItems.filter((item) => !item.isStarter);
  const starterProfiles = profileItems.filter((item) => item.isStarter);

  const renderProfileCard = (profile: LandingProfileItem) => {
    const isSelected = profile.id === selectedProfileId;
    const selectedStyle = "border-primary/60 bg-primary/[0.045] shadow-sm";
    const idleStyle = "border-border bg-card hover:border-primary/35 hover:bg-muted/25";
    const badgeClassName = profile.isStarter
      ? "h-6 border-sky-200 bg-white text-sky-700"
      : "h-6";

    return (
      <div
        key={profile.id}
        role="button"
        tabIndex={0}
        onClick={() => onSelectProfile(profile.id)}
        onKeyDown={(event) => handleSelectableKeyDown(event, () => onSelectProfile(profile.id))}
        className={`rounded-3xl border px-5 py-4 text-left transition duration-200 ${isSelected ? selectedStyle : idleStyle}`}
      >
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-2 xl:min-w-[280px]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 max-w-full break-words text-base font-semibold leading-6 text-foreground">{translateUi(profile.name)}</div>
              <Badge variant={profile.isStarter ? "outline" : (isSelected ? "default" : "secondary")} className={badgeClassName}>
                {profile.originLabel}
              </Badge>
              {profile.category ? (
                <Badge variant="outline" className="h-6">
                  {translateResourceText(profile.category)}
                </Badge>
              ) : null}
              <Badge variant="outline" className="h-6">
                {profile.sourceTypeLabel}
              </Badge>
            </div>
            <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {truncateText(profile.summaryLine, 120) || t("emptySummary")}
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.tags.slice(0, 4).map((tag) => (
                <Badge key={`${profile.id}-${tag}`} variant="outline" className="h-6">
                  {translateResourceText(tag)}
                </Badge>
              ))}
              {profile.recentNovelTitle ? (
              <Badge variant="secondary" className="h-6">
                  {t("recentBinding", { title: profile.recentNovelTitle })}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-[min(100%,520px)] xl:shrink xl:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onEditProfile(profile.id);
              }}
            >
              {t("actions.edit")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onOpenWorkbench(profile.id);
              }}
            >
              {t("actions.apply")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation();
                onUseProfileForClean(profile.id);
              }}
            >
              {t("actions.clean")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deletePending}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteProfile(profile.id);
              }}
            >
              {deletePending ? translateUi("删除中...") : translateUi("删除")}
            </Button>
          </div>
        </div>

        {isSelected ? (
          <div className="mt-5 space-y-4 rounded-2xl border bg-muted/25 p-4 md:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_280px]">
              <DetailPanel
                title={t("panels.feel.title")}
                description={t("panels.feel.description")}
              >
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm leading-7 text-slate-700">
                  {translateUi(profile.description)}
                </div>
                {profile.detailLines.length > 0 ? (
                  <div className="grid gap-2">
                    {profile.detailLines.map((line) => (
                      <div key={`${profile.id}-${line}`} className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-3 text-sm leading-6 text-slate-700">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
                {profile.sourceContentPreview ? (
                  <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(241,245,249,0.9),rgba(255,255,255,0.98))] px-4 py-4 text-sm leading-7 text-slate-700">
                    <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-slate-500">{t("panels.sourceSample")}</div>
                    <div>{profile.sourceContentPreview}</div>
                  </div>
                ) : null}
              </DetailPanel>

              <div className="space-y-4">
                <DetailPanel
                  title={t("panels.rules.title")}
                  description={t("panels.rules.description")}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <SummaryCard title={t("panels.rules.narrative")} summary={profile.narrativeSummary} />
                    <SummaryCard title={t("panels.rules.character")} summary={profile.characterSummary} />
                    <SummaryCard title={t("panels.rules.language")} summary={profile.languageSummary} />
                    <SummaryCard title={t("panels.rules.rhythm")} summary={profile.rhythmSummary} />
                  </div>
                </DetailPanel>

                <DetailPanel
                  title={t("panels.antiAi.title")}
                  description={t("panels.antiAi.description")}
                >
                  {profile.antiAiFocus.length > 0 || profile.antiAiRuleNames.length > 0 || profile.extractionAntiAiRecommendationCount > 0 ? (
                    <div className="space-y-3">
                      {profile.antiAiFocus.length > 0 ? (
                        <div className="grid gap-2">
                          {profile.antiAiFocus.map((line) => (
                            <div key={`${profile.id}-${line}`} className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3 text-sm leading-6 text-amber-900">
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {profile.antiAiRuleNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.antiAiRuleNames.map((ruleName) => (
                            <Badge key={`${profile.id}-${ruleName}`} variant="secondary" className="bg-slate-100 text-slate-700">
                              {ruleName}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      {profile.extractionAntiAiRecommendationCount > 0 ? (
                        <div className="rounded-xl border bg-slate-50/80 px-3 py-3 text-sm leading-6 text-slate-600">

                          {translateUi("这套写法在提取阶段额外建议了")} {profile.extractionAntiAiRecommendationCount}  {translateUi("条反 AI 规则，适合后续继续精配。")}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-3 py-3 text-sm leading-6 text-slate-500">

                      {translateUi("这套写法还没有绑定明确的反 AI 约束，所以“去 AI 味”时可读性会偏弱。")}
                    </div>
                  )}
                </DetailPanel>
              </div>

              <div className="space-y-4">
                <DetailPanel
                  title={t("panels.asset.title")}
                  description={t("panels.asset.description")}
                >
                  <div className="space-y-2">
                    <DetailStatRow label={translateUi("来源")} value={profile.sourceTypeLabel} />
                    <DetailStatRow label={translateUi("最近更新")} value={profile.updatedAtLabel} />
                    <DetailStatRow label={translateUi("启用特征")} value={translateUi("{{value0}} 项", { value0: profile.extractedFeatureCount })} />
                    <DetailStatRow label={translateUi("高风险指纹")} value={translateUi("{{value0}} 项", { value0: profile.highRiskFeatureCount })} />
                    <DetailStatRow
                      label={translateUi("当前预设")}
                      value={profile.selectedPresetLabel || translateUi("未锁定")}
                    />
                    <DetailStatRow
                      label={translateUi("可选预设")}
                      value={profile.presetLabels.length > 0 ? profile.presetLabels.join(" / ") : translateUi("暂无")}
                    />
                    <DetailStatRow label={translateUi("已绑定目标")} value={translateUi("{{value0}} 个", { value0: profile.bindingCount })} />
                    <DetailStatRow
                      label={translateUi("最近小说")}
                      value={profile.recentNovelTitle || translateUi("还没有绑定到小说")}
                    />
                    <DetailStatRow
                      label={translateUi("适用题材")}
                      value={profile.applicableGenres.length > 0 ? profile.applicableGenres.join(" / ") : translateUi("未填写")}
                    />
                  </div>
                </DetailPanel>

                <DetailPanel
                  title={t("panels.next.title")}
                  description={t("panels.next.description")}
                >
                  <div className="space-y-2 text-sm leading-6 text-slate-700">
                    <div>{translateUi("编辑设定：维护这套写法本身的说明、规则和反 AI 约束。")}</div>
                    <div>{translateUi("应用与测试：绑定到小说或章节，并做试写验证。")}</div>
                    <div>{translateUi("去 AI 味：只处理正文检测和修正，不改写法字段。")}</div>
                  </div>
                </DetailPanel>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-card shadow-sm">
        <CardContent className="space-y-6 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">

                {translateUi("我的写法资产")}
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">

                  {translateUi("先选一套写法，再决定要编辑、应用还是去 AI 味。")}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">

                  {translateUi("首页负责看清你已有的写法资产。展开后会直接展示这套写法的读感定位、规则摘要、反 AI 约束和当前成熟度。")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onOpenPromptLab}>

                {translateUi("正文效果实验室")}
              </Button>
              <Button type="button" onClick={onOpenCreate}>

                {translateUi("新建一套写法")}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] px-4 py-3 text-sm leading-7 text-muted-foreground">

            {translateUi("书级默认写法请从小说基础信息进入，由小说来选择要使用的写法资产，再带入后续导演和正文流程。")}
          </div>

          {profileItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-muted/20 p-6">
              <div className="text-lg font-semibold text-foreground">{translateUi("当前还没有写法资产")}</div>
              <div className="mt-2 text-sm leading-7 text-muted-foreground">

                {translateUi("先创建第一套写法，后面再回来慢慢补规则、做试写和绑定目标。")}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={onOpenCreate}>

                  {translateUi("去创建第一套写法")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {customProfiles.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{translateUi("你自己创建的写法")}</div>
                      <div className="text-xs leading-6 text-slate-500">

                        {translateUi("这些是你沉淀下来的可复用资产，应该优先在这里挑。")}
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      {customProfiles.length}  {translateUi("套")}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {customProfiles.map(renderProfileCard)}
                  </div>
                </section>
              ) : null}

              {starterProfiles.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{translateUi("可直接改的起步写法")}</div>
                      <div className="text-xs leading-6 text-slate-500">

                        {translateUi("这些预置资产适合先借一套骨架，再按当前项目改成自己的写法。")}
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      {starterProfiles.length}  {translateUi("套")}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {starterProfiles.map(renderProfileCard)}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
