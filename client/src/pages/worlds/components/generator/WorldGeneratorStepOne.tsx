import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { WorldOptionRefinementLevel, WorldReferenceAnchor, WorldReferenceMode } from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";
import KnowledgeDocumentPicker from "@/components/knowledge/KnowledgeDocumentPicker";
import type {
  GeneratorGenreOption,
  InspirationMode,
  WorldGeneratorConceptCard,
} from "./worldGeneratorShared";
import { REFERENCE_MODE_OPTIONS } from "./worldGeneratorShared";
import SelectControl from "@/components/common/SelectControl";

const INSPIRATION_MODE_CARDS: Array<{
  value: InspirationMode;
  /** worlds:generator.stepOne.inspirationMode.<value>.title */
  titleKey: string;
  /** worlds:generator.stepOne.inspirationMode.<value>.description */
  descriptionKey: string;
}> = [
  {
    value: "free",
    titleKey: "generator.stepOne.inspirationMode.free.title",
    descriptionKey: "generator.stepOne.inspirationMode.free.description",
  },
  {
    value: "reference",
    titleKey: "generator.stepOne.inspirationMode.reference.title",
    descriptionKey: "generator.stepOne.inspirationMode.reference.description",
  },
  {
    value: "random",
    titleKey: "generator.stepOne.inspirationMode.random.title",
    descriptionKey: "generator.stepOne.inspirationMode.random.description",
  },
];

interface WorldGeneratorStepOneProps {
  worldName: string;
  selectedGenreId: string;
  selectedGenre: GeneratorGenreOption | null;
  genreOptions: GeneratorGenreOption[];
  genreLoading: boolean;
  inspirationMode: InspirationMode;
  referenceMode: WorldReferenceMode;
  selectedKnowledgeDocumentIds: string[];
  preserveText: string;
  allowedChangesText: string;
  forbiddenText: string;
  inspirationText: string;
  optionRefinementLevel: WorldOptionRefinementLevel;
  optionsCount: number;
  canAnalyze: boolean;
  analyzeStreaming: boolean;
  analyzeButtonLabel: string;
  analyzeProgressMessage?: string;
  inspirationSourceMeta: {
    extracted: boolean;
    originalLength: number;
    chunkCount: number;
  } | null;
  concept: WorldGeneratorConceptCard | null;
  propertyOptionsCount: number;
  referenceAnchors: WorldReferenceAnchor[];
  onWorldNameChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onOpenGenreManager: () => void;
  onInspirationModeChange: (value: InspirationMode) => void;
  onKnowledgeDocumentIdsChange: (ids: string[]) => void;
  onReferenceModeChange: (value: WorldReferenceMode) => void;
  onPreserveTextChange: (value: string) => void;
  onAllowedChangesTextChange: (value: string) => void;
  onForbiddenTextChange: (value: string) => void;
  onInspirationTextChange: (value: string) => void;
  onOptionRefinementLevelChange: (value: WorldOptionRefinementLevel) => void;
  onOptionsCountChange: (value: number) => void;
  onAnalyze: () => void;
}

export default function WorldGeneratorStepOne(props: WorldGeneratorStepOneProps) {
  const { t } = useTranslation("worlds");
  const {
    worldName,
    selectedGenreId,
    selectedGenre,
    genreOptions,
    genreLoading,
    inspirationMode,
    referenceMode,
    selectedKnowledgeDocumentIds,
    preserveText,
    allowedChangesText,
    forbiddenText,
    inspirationText,
    optionRefinementLevel,
    optionsCount,
    canAnalyze,
    analyzeStreaming,
    analyzeButtonLabel,
    analyzeProgressMessage,
    inspirationSourceMeta,
    concept,
    propertyOptionsCount,
    referenceAnchors,
    onWorldNameChange,
    onGenreChange,
    onOpenGenreManager,
    onInspirationModeChange,
    onKnowledgeDocumentIdsChange,
    onReferenceModeChange,
    onPreserveTextChange,
    onAllowedChangesTextChange,
    onForbiddenTextChange,
    onInspirationTextChange,
    onOptionRefinementLevelChange,
    onOptionsCountChange,
    onAnalyze,
  } = props;

  const isReferenceMode = inspirationMode === "reference";
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">{t("generator.stepOne.name.label")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("generator.stepOne.name.hint")}
          </div>
        </div>
        <input
          className="w-full rounded-md border p-2 text-sm"
          placeholder={t("generator.stepOne.name.placeholder")}
          value={worldName}
          onChange={(event) => onWorldNameChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-sm font-medium">{t("generator.stepOne.genre.label")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("generator.stepOne.genre.hint")}
          </div>
        </div>
        <SelectControl
          className="w-full rounded-md border bg-background p-2 text-sm"
          value={selectedGenreId}
          disabled={genreLoading || genreOptions.length === 0}
          onChange={(event) => onGenreChange(event.target.value)}
        >
          <option value="">{genreLoading ? t("generator.stepOne.genre.loadingOption") : t("generator.stepOne.genre.selectPlaceholder")}</option>
          {genreOptions.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.path}
            </option>
          ))}
        </SelectControl>
        {selectedGenre ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            <div>{t("generator.stepOne.genre.currentPath", { path: selectedGenre.path })}</div>
            {selectedGenre.description?.trim() ? <div>{t("generator.stepOne.genre.description", { description: selectedGenre.description.trim() })}</div> : null}
            {selectedGenre.template?.trim() ? (
              <div className="whitespace-pre-wrap">{t("generator.stepOne.genre.template", { template: selectedGenre.template.trim() })}</div>
            ) : null}
          </div>
        ) : null}
        {genreLoading ? <div className="text-xs text-muted-foreground">{t("generator.stepOne.genre.loadingTree")}</div> : null}
          {!genreLoading && genreOptions.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-2">
            <div>{t("generator.stepOne.genre.emptyLibrary")}</div>
            <Button type="button" variant="outline" onClick={onOpenGenreManager}>
              {t("generator.stepOne.genre.goToLibrary")}
            </Button>
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          {t("generator.stepOne.genre.footerHint")}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t("generator.stepOne.mode.label")}</div>
        <div className="grid gap-3 md:grid-cols-3">
          {INSPIRATION_MODE_CARDS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={[
                "rounded-md border p-3 text-left transition-colors",
                inspirationMode === item.value ? "border-primary bg-primary/5" : "border-border/70 bg-background hover:bg-muted/40",
              ].join(" ")}
              onClick={() => onInspirationModeChange(item.value)}
            >
              <div className="text-sm font-medium text-foreground">{t(item.titleKey)}</div>
              <div className="mt-2 text-xs text-muted-foreground">{t(item.descriptionKey)}</div>
            </button>
          ))}
        </div>
      </div>

      {isReferenceMode ? (
        <div className="space-y-3">
          <KnowledgeDocumentPicker
            selectedIds={selectedKnowledgeDocumentIds}
            onChange={(next) => onKnowledgeDocumentIdsChange(next ?? [])}
            title={t("generator.stepOne.reference.knowledgeTitle")}
            description={t("generator.stepOne.reference.knowledgeDescription")}
            queryStatus="enabled"
          />

          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="font-medium">{t("generator.stepOne.reference.modeLabel")}</div>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={referenceMode}
              onChange={(event) => onReferenceModeChange(event.target.value as WorldReferenceMode)}
            >
              {REFERENCE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </SelectControl>
            <div className="text-xs text-muted-foreground">
              {(() => {
                const descriptionKey = REFERENCE_MODE_OPTIONS.find((item) => item.value === referenceMode)?.descriptionKey;
                return descriptionKey ? t(descriptionKey) : null;
              })()}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">{t("generator.stepOne.reference.preserveLabel")}</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder={t("generator.stepOne.reference.preservePlaceholder")}
                value={preserveText}
                onChange={(event) => onPreserveTextChange(event.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">{t("generator.stepOne.reference.allowedLabel")}</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder={t("generator.stepOne.reference.allowedPlaceholder")}
                value={allowedChangesText}
                onChange={(event) => onAllowedChangesTextChange(event.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-medium">{t("generator.stepOne.reference.forbiddenLabel")}</div>
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 text-sm"
                placeholder={t("generator.stepOne.reference.forbiddenPlaceholder")}
                value={forbiddenText}
                onChange={(event) => onForbiddenTextChange(event.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <textarea
        className="min-h-[180px] w-full rounded-md border p-2 text-sm"
        placeholder={
          isReferenceMode
            ? t("generator.stepOne.inspirationText.referencePlaceholder")
            : inspirationMode === "random"
              ? t("generator.stepOne.inspirationText.randomPlaceholder")
              : t("generator.stepOne.inspirationText.freePlaceholder")
        }
        value={inspirationText}
        onChange={(event) => onInspirationTextChange(event.target.value)}
      />

      <div className="rounded-md border p-3 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">{t("generator.stepOne.preferences.title")}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("generator.stepOne.preferences.hint")}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreferencesOpen((value) => !value)}>
            {preferencesOpen ? t("generator.stepOne.preferences.collapse") : t("generator.stepOne.preferences.expand")}
          </Button>
        </div>
        {preferencesOpen ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium">{t("generator.stepOne.preferences.refinementLabel")}</div>
              <SelectControl
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={optionRefinementLevel}
                onChange={(event) => onOptionRefinementLevelChange(event.target.value as WorldOptionRefinementLevel)}
              >
                <option value="basic">{t("generator.stepOne.preferences.refinement.basic")}</option>
                <option value="standard">{t("generator.stepOne.preferences.refinement.standard")}</option>
                <option value="detailed">{t("generator.stepOne.preferences.refinement.detailed")}</option>
              </SelectControl>
            </div>
            <div className="space-y-2">
              <div className="font-medium">{t("generator.stepOne.preferences.countLabel")}</div>
              <input
                className="w-full rounded-md border p-2 text-sm"
                type="number"
                min={4}
                max={8}
                value={optionsCount}
                onChange={(event) => onOptionsCountChange(Number(event.target.value) || 6)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Button onClick={onAnalyze} disabled={!canAnalyze}>
        {analyzeButtonLabel}
      </Button>

      {analyzeStreaming ? (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="font-medium">{t("generator.stepOne.progress.title")}</div>
          <div>{analyzeProgressMessage ?? t("generator.stepOne.progress.starting")}</div>
          <div className="text-xs text-muted-foreground">
            {isReferenceMode
              ? t("generator.stepOne.progress.referenceHint")
              : t("generator.stepOne.progress.freeHint")}
          </div>
        </div>
      ) : null}

      {inspirationSourceMeta?.extracted ? (
        <div className="text-xs text-muted-foreground">
          {t("generator.stepOne.sourceMeta.extracted", {
            length: inspirationSourceMeta.originalLength,
            count: inspirationSourceMeta.chunkCount,
          })}
        </div>
      ) : null}

      {concept ? (
        <div className="rounded-md border p-3 text-sm space-y-2">
          <div className="font-medium">{isReferenceMode ? t("generator.stepOne.concept.referenceTitle") : t("generator.stepOne.concept.title")}</div>
          <div>{t("generator.stepOne.concept.worldType", { value: concept.worldType })}</div>
          <div>{t("generator.stepOne.concept.tone", { value: concept.tone })}</div>
          <div>{t("generator.stepOne.concept.keywords", { value: concept.keywords.join(" / ") || "-" })}</div>
          <div>{t("generator.stepOne.concept.propertyOptions", { count: propertyOptionsCount })}</div>
          {isReferenceMode && referenceAnchors.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">{t("generator.stepOne.concept.anchorsTitle")}</div>
              {referenceAnchors.map((anchor) => (
                <div key={anchor.id} className="text-xs text-muted-foreground">
                  {t("generator.stepOne.concept.anchorLine", { label: anchor.label, content: anchor.content })}
                </div>
              ))}
            </div>
          ) : null}
          <div className="whitespace-pre-wrap">{concept.summary}</div>
        </div>
      ) : null}
    </div>
  );
}
