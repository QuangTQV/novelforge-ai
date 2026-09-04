import { translateUi } from "@/i18n/legacy";
import {
  STYLE_ENGINE_COMPATIBILITY_FIELDS,
  type AntiAiRule,
  type StyleExtractionPreset,
  type StyleProfile,
  type StyleProfileFeature,
  type StyleRulePatch,
} from "@ai-novel/shared/types/styleEngine";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildReadableRuleEntries, type RuleSection } from "../writingFormulaRulePresentation";
import { parseJsonInput } from "../writingFormula.utils";
import { isStarterStyleProfile } from "../writingFormulaV2.shared";

interface WritingFormulaEditorState {
  name: string;
  description: string;
  category: string;
  tags: string;
  applicableGenres: string;
  sourceContent: string;
  extractedFeatures: StyleProfileFeature[];
  analysisMarkdown: string;
  narrativeRules: string;
  characterRules: string;
  languageRules: string;
  rhythmRules: string;
  antiAiRuleIds: string[];
}

interface WritingFormulaEditorPanelProps {
  selectedProfile: StyleProfile | null;
  editor: WritingFormulaEditorState;
  antiAiRules: AntiAiRule[];
  savePending: boolean;
  deletePending: boolean;
  reextractPending: boolean;
  onEditorChange: (patch: Partial<WritingFormulaEditorState>) => void;
  onToggleExtractedFeature: (featureId: string, checked: boolean) => void;
  onReextractFeatures: () => void;
  onToggleAntiAiRule: (ruleId: string, checked: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
}

function FieldBlock(props: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{props.label}</div>
        <div className="text-xs leading-6 text-slate-500">{props.hint}</div>
      </div>
      {props.children}
    </label>
  );
}

const FEATURE_DECISION_META: Record<NonNullable<StyleProfileFeature["selectedDecision"]>, { label: string; className: string }> = {
  keep: {
    label: "decisions.keep",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  weaken: {
    label: "decisions.weaken",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  remove: {
    label: "decisions.remove",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const RULE_PATCH_SECTION_LABELS: Record<keyof StyleRulePatch, string> = {
  narrativeRules: "sections.narrative",
  characterRules: "sections.character",
  languageRules: "sections.language",
  rhythmRules: "sections.rhythm",
};

function formatScorePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function countPresetDecisions(
  preset: StyleExtractionPreset,
): Record<NonNullable<StyleProfileFeature["selectedDecision"]>, number> {
  return preset.decisions.reduce<Record<NonNullable<StyleProfileFeature["selectedDecision"]>, number>>((result, item) => {
    result[item.decision] += 1;
    return result;
  }, {
    keep: 0,
    weaken: 0,
    remove: 0,
  });
}

function listRulePatchSections(patch: StyleRulePatch | undefined): string[] {
  if (!patch) {
    return [];
  }

  return (Object.entries(RULE_PATCH_SECTION_LABELS) as Array<[keyof StyleRulePatch, string]>)
    .filter(([key]) => {
      const section = patch[key];
      return Boolean(section && typeof section === "object" && !Array.isArray(section) && Object.keys(section).length > 0);
    })
    .map(([, label]) => label);
}

function RuleFieldCard(props: {
  title: string;
  hint: string;
  section: RuleSection;
  value: string;
  onChange: (value: string) => void;
}) {
  let parseError = false;
  let parsedRules: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(props.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsedRules = parsed as Record<string, unknown>;
    } else {
      parseError = true;
    }
  } catch {
    parsedRules = parseJsonInput(props.value);
    parseError = props.value.trim() !== "" && Object.keys(parsedRules).length === 0 && props.value.trim() !== "{}";
  }

  const entries = buildReadableRuleEntries(props.section, parsedRules);

  return (
    <div className="space-y-2 rounded-2xl border bg-slate-50/70 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{props.title}</div>
        <div className="text-xs leading-6 text-slate-500">{props.hint}</div>
      </div>

      {entries.length > 0 ? (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div key={`${props.section}-${entry.key}`} className="rounded-xl border bg-white px-3 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{entry.label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-700">{entry.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-white px-3 py-3 text-sm leading-6 text-slate-500">
          {i18n.t("writingFormulaEditor:advanced.emptyHint")}
        </div>
      )}

      <details className="rounded-xl border bg-white">
        <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-slate-700">
          {i18n.t("writingFormulaEditor:advanced.toggle")}
        </summary>
        <div className="space-y-3 border-t px-3 py-3">
          <div className="text-xs leading-6 text-slate-500">
            {i18n.t("writingFormulaEditor:advanced.description")}
          </div>
          {parseError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
              {i18n.t("writingFormulaEditor:advanced.invalidJson")}
            </div>
          ) : null}
          <textarea
            className="min-h-[190px] w-full rounded-xl border bg-slate-50 p-3 font-mono text-xs"
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
          />
        </div>
      </details>
    </div>
  );
}

export default function WritingFormulaEditorPanel(props: WritingFormulaEditorPanelProps) {
  const { t } = useTranslation("writingFormulaEditor");
  const {
    selectedProfile,
    editor,
    antiAiRules,
    savePending,
    deletePending,
    reextractPending,
    onEditorChange,
    onToggleExtractedFeature,
    onReextractFeatures,
    onToggleAntiAiRule,
    onSave,
    onDelete,
  } = props;
  const compatibilityFields = STYLE_ENGINE_COMPATIBILITY_FIELDS.narrativeRules.join(" / ");
  const extractionPresets = selectedProfile?.extractionPresets ?? [];
  const selectedPresetKey = selectedProfile?.selectedExtractionPresetKey ?? null;
  const antiAiRuleByKey = new Map(antiAiRules.map((rule) => [rule.key, rule]));

  return (
    <Card data-writing-formula-editor-panel tabIndex={-1}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("title")}</CardTitle>
          {selectedProfile ? (
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={deletePending}>
              {t("actions.delete")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!selectedProfile ? (
          <div className="text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <>
            {isStarterStyleProfile(selectedProfile) ? (
              <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm leading-7 text-muted-foreground">
                {t("starterNotice")}
              </div>
            ) : null}

            <div className="rounded-2xl border bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-700">
              {t("editingNotice")}
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">{t("sections.basics")}</div>
                <div className="text-sm leading-6 text-slate-500">
                  {t("sections.basicsHint")}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label={t("fields.name")} hint={t("fields.nameHint")}>
                  <input
                    data-writing-formula-primary-input
                    className="w-full rounded-md border p-2 text-sm"
                    value={editor.name}
                    onChange={(event) => onEditorChange({ name: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label={t("fields.category")} hint={t("fields.categoryHint")}>
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("fields.categoryPlaceholder")}
                    value={editor.category}
                    onChange={(event) => onEditorChange({ category: event.target.value })}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label={t("fields.summary")}
                hint={t("fields.summaryHint")}
              >
                <textarea
                  className="min-h-[96px] w-full rounded-md border p-2 text-sm"
                  placeholder={t("fields.summaryPlaceholder")}
                  value={editor.description}
                  onChange={(event) => onEditorChange({ description: event.target.value })}
                />
              </FieldBlock>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label={t("fields.tags")} hint={t("fields.tagsHint")}>
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("fields.tagsPlaceholder")}
                    value={editor.tags}
                    onChange={(event) => onEditorChange({ tags: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label={t("fields.genres")} hint={t("fields.genresHint")}>
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    placeholder={t("fields.genresPlaceholder")}
                    value={editor.applicableGenres}
                    onChange={(event) => onEditorChange({ applicableGenres: event.target.value })}
                  />
                </FieldBlock>
              </div>
            </div>

            {selectedProfile.sourceType === "from_text"
            || selectedProfile.sourceType === "from_knowledge_document"
            || editor.sourceContent.trim() ? (
              <div className="space-y-4 rounded-2xl border p-4">
                <div className="space-y-1">
                  <div className="text-base font-semibold text-slate-950">{t("fields.evidenceTitle")}</div>
                  <div className="text-sm leading-6 text-slate-500">
                    {t("fields.evidenceDescription")}
                  </div>
                </div>

                <FieldBlock
                  label={t("fields.sourceSample")}
                  hint={t("fields.sourceHint")}
                >
                  <textarea
                    className="min-h-[160px] w-full rounded-md border p-2 text-sm"
                    placeholder={t("fields.sourcePlaceholder")}
                    value={editor.sourceContent}
                    onChange={(event) => onEditorChange({ sourceContent: event.target.value })}
                  />
                </FieldBlock>

                <div className="rounded-2xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t("fields.featureEnabled")}</div>
                      <div className="text-xs leading-6 text-slate-500">
                        {t("fields.featureHint")}{editor.extractedFeatures.length > 0 ? ` ${editor.extractedFeatures.length}` : ""}
                      </div>
                    </div>
                    {editor.sourceContent.trim() ? (
                      <Button size="sm" variant="outline" onClick={onReextractFeatures} disabled={reextractPending}>
                        {reextractPending ? t("fields.reextracting") : t("fields.reextract")}
                      </Button>
                    ) : null}
                  </div>

                  {editor.extractedFeatures.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                      {editor.extractedFeatures.map((feature) => (
                        <label key={feature.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={feature.enabled}
                            onChange={(event) => onToggleExtractedFeature(feature.id, event.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{feature.label}</span>
                              <span className="text-xs text-muted-foreground">[{feature.group}]</span>
                              {feature.selectedDecision ? (
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${FEATURE_DECISION_META[feature.selectedDecision].className}`}>
                                  {t(FEATURE_DECISION_META[feature.selectedDecision].label)}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-xs leading-6 text-muted-foreground">{feature.description}</span>
                            <span className="mt-1 block text-xs leading-6 text-muted-foreground">{t("fields.evidence", { value: feature.evidence })}</span>
                            <span className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {t("fields.importance", { value: formatScorePercent(feature.importance) })}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {t("fields.imitationValue", { value: formatScorePercent(feature.imitationValue) })}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {t("fields.transferability", { value: formatScorePercent(feature.transferability) })}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {t("fields.fingerprintRisk", { value: formatScorePercent(feature.fingerprintRisk) })}
                              </span>
                            </span>
                            <span className="mt-2 flex flex-wrap gap-2">
                              {listRulePatchSections(feature.keepRulePatch).length > 0 ? (
                                listRulePatchSections(feature.keepRulePatch).map((label) => (
                                  <span key={`${feature.id}-${label}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                    {t(label)}{t("labels.rulesSuffix")}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded-full border border-dashed border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                                  {t("fields.summaryOnly")}
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                      ))}
                      </div>

                      {extractionPresets.length > 0 ? (
                        <div className="rounded-2xl border bg-slate-50/70 p-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">{t("fields.presetTitle")}</div>
                            <div className="text-xs leading-6 text-slate-500">
                              {t("fields.presetDescription")}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            {extractionPresets.map((preset) => {
                              const counts = countPresetDecisions(preset);
                              const isSelected = preset.key === selectedPresetKey;
                              return (
                                <div
                                  key={preset.key}
                                  className={`rounded-xl border bg-white p-3 ${isSelected ? "border-primary ring-1 ring-primary/20" : ""}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium text-slate-900">{preset.label}</div>
                                    {isSelected ? (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                        {t("fields.currentPreset")}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs leading-6 text-slate-500">{preset.summary}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                                      {t("fields.keep", { count: counts.keep })}
                                    </span>
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                                      {t("fields.weaken", { count: counts.weaken })}
                                    </span>
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                                      {t("fields.remove", { count: counts.remove })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {selectedProfile.extractionAntiAiRuleKeys.length > 0 ? (
                        <div className="rounded-2xl border bg-slate-50/70 p-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">{t("fields.antiAiTitle")}</div>
                            <div className="text-xs leading-6 text-slate-500">
                              {t("fields.antiAiDescription")}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedProfile.extractionAntiAiRuleKeys.map((ruleKey) => {
                              const matchedRule = antiAiRuleByKey.get(ruleKey);
                              const isBound = Boolean(matchedRule && editor.antiAiRuleIds.includes(matchedRule.id));
                              return (
                                <span
                                  key={ruleKey}
                                  className={`rounded-full border px-2 py-1 text-xs ${
                                    isBound
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-white text-slate-600"
                                  }`}
                                >
                                  {matchedRule?.name ?? ruleKey}
                                  {isBound ? t("fields.bound") : matchedRule ? t("fields.recommendedUnbound") : t("fields.originalSuggestion")}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {t("fields.noFeatures")}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">{t("fields.analysisTitle")}</div>
                <div className="text-sm leading-6 text-slate-500">
                  {t("fields.analysisDescription")}
                </div>
              </div>
              <textarea
                className="min-h-[110px] w-full rounded-md border p-2 text-sm"
                placeholder={t("fields.analysisPlaceholder")}
                value={editor.analysisMarkdown}
                onChange={(event) => onEditorChange({ analysisMarkdown: event.target.value })}
              />
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">{t("fields.advancedTitle")}</div>
                <div className="text-sm leading-6 text-slate-500">
                  {t("fields.advancedDescription")}
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
                {t("fields.compatibility", { fields: compatibilityFields })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <RuleFieldCard
                  title={t("fields.narrativeTitle")}
                  hint={t("fields.narrativeHint")}
                  section="narrativeRules"
                  value={editor.narrativeRules}
                  onChange={(value) => onEditorChange({ narrativeRules: value })}
                />
                <RuleFieldCard
                  title={t("fields.characterTitle")}
                  hint={t("fields.characterHint")}
                  section="characterRules"
                  value={editor.characterRules}
                  onChange={(value) => onEditorChange({ characterRules: value })}
                />
                <RuleFieldCard
                  title={t("fields.languageTitle")}
                  hint={t("fields.languageHint")}
                  section="languageRules"
                  value={editor.languageRules}
                  onChange={(value) => onEditorChange({ languageRules: value })}
                />
                <RuleFieldCard
                  title={t("fields.rhythmTitle")}
                  hint={t("fields.rhythmHint")}
                  section="rhythmRules"
                  value={editor.rhythmRules}
                  onChange={(value) => onEditorChange({ rhythmRules: value })}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-950">{t("fields.antiAiBindingTitle")}</div>
                <div className="text-sm leading-6 text-slate-500">
                  {t("fields.antiAiBindingDescription")}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {antiAiRules.map((rule) => (
                  <label key={rule.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={editor.antiAiRuleIds.includes(rule.id)}
                      onChange={(event) => onToggleAntiAiRule(rule.id, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{translateUi(rule.name)}</span>
                      <span className="mt-1 block text-xs leading-6 text-muted-foreground">{translateUi(rule.description)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50/70 px-4 py-3">
              <div className="text-sm leading-6 text-slate-600">
                {t("fields.savedNotice")}
              </div>
              <Button onClick={onSave} disabled={savePending || !editor.name.trim()}>
                {savePending ? t("fields.saving") : t("fields.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
