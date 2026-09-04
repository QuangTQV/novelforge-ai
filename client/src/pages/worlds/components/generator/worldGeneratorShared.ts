import type {
  WorldOptionRefinementLevel,
  WorldPropertyOption,
  WorldReferenceMode,
  WorldReferenceSeedBundle,
  WorldReferenceSeedSelection,
} from "@ai-novel/shared/types/worldWizard";

export type InspirationMode = "free" | "reference" | "random";

export interface WorldGeneratorConceptCard {
  worldType: string;
  templateKey: string;
  coreImagery: string[];
  tone: string;
  keywords: string[];
  summary: string;
}

export interface GeneratorGenreOption {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  template?: string | null;
}

export interface WorldGeneratorTemplateOption {
  key: string;
  name: string;
  description: string;
  worldType: string;
  classicElements: string[];
  pitfalls: string[];
}

export const REFERENCE_MODE_OPTIONS: Array<{
  value: WorldReferenceMode;
  /** worlds:generator.referenceMode.<mode>.label */
  labelKey: string;
  /** worlds:generator.referenceMode.<mode>.description */
  descriptionKey: string;
}> = [
  {
    value: "adapt_world",
    labelKey: "generator.referenceMode.adaptWorld.label",
    descriptionKey: "generator.referenceMode.adaptWorld.description",
  },
  {
    value: "extract_base",
    labelKey: "generator.referenceMode.extractBase.label",
    descriptionKey: "generator.referenceMode.extractBase.description",
  },
  {
    value: "tone_rebuild",
    labelKey: "generator.referenceMode.toneRebuild.label",
    descriptionKey: "generator.referenceMode.toneRebuild.description",
  },
];

export const DEFAULT_DIMENSIONS: Record<string, boolean> = {
  foundation: true,
  power: true,
  society: true,
  culture: true,
  history: true,
  conflict: true,
};

/** value = worlds:generator.dimensions.<key> i18n key */
const DIMENSION_LABEL_KEYS: Record<string, string> = {
  foundation: "generator.dimensions.foundation",
  power: "generator.dimensions.power",
  society: "generator.dimensions.society",
  culture: "generator.dimensions.culture",
  history: "generator.dimensions.history",
  conflict: "generator.dimensions.conflict",
};

export const REFERENCE_SEED_SELECTION_KEYS: Record<
  keyof WorldReferenceSeedBundle,
  keyof WorldReferenceSeedSelection
> = {
  rules: "ruleIds",
  factions: "factionIds",
  forces: "forceIds",
  locations: "locationIds",
};

/** returns a worlds namespace i18n key (or the raw key if unknown) — translate at render site */
export function getDimensionLabelKey(key: string): string {
  return DIMENSION_LABEL_KEYS[key] ?? key;
}

export function normalizeAxiomTexts(items: unknown): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

export function clampOptionsCount(value: number): number {
  return Math.max(4, Math.min(8, Math.floor(value)));
}

export function parseReferenceControlText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,，;；]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/** returns a worlds namespace i18n key — translate at render site */
export function getReferenceModeLabelKey(mode: WorldReferenceMode): string {
  return (
    REFERENCE_MODE_OPTIONS.find((item) => item.value === mode)?.labelKey
    ?? "generator.referenceMode.adaptWorld.label"
  );
}

export function buildDefaultPropertySelectionState(options: WorldPropertyOption[]) {
  return {
    selectedIds: options.map((option) => option.id),
    selectedChoiceIds: options.reduce<Record<string, string>>((acc, option) => {
      const firstChoiceId = option.choices?.[0]?.id;
      if (firstChoiceId) {
        acc[option.id] = firstChoiceId;
      }
      return acc;
    }, {}),
  };
}

export function buildDefaultReferenceSeedSelection(seeds: WorldReferenceSeedBundle): WorldReferenceSeedSelection {
  return {
    ruleIds: seeds.rules.map((item) => item.id),
    factionIds: seeds.factions.map((item) => item.id),
    forceIds: seeds.forces.map((item) => item.id),
    locationIds: seeds.locations.map((item) => item.id),
  };
}

export function isWorldGeneratorTemplateOption(
  value: unknown,
): value is WorldGeneratorTemplateOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.key === "string" && typeof record.name === "string";
}

export type GeneratorOptionRefinementLevel = WorldOptionRefinementLevel;
