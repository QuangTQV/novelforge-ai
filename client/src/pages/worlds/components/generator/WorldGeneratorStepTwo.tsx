import { useTranslation } from "react-i18next";
import type {
  WorldSkeletonGenerationCounts,
  WorldSkeletonPreset,
} from "@ai-novel/shared/types/worldWizard";
import {
  WORLD_SKELETON_COUNT_LIMITS,
  WORLD_SKELETON_PRESET_COUNTS,
} from "@ai-novel/shared/types/worldWizard";
import { Button } from "@/components/ui/button";

const PRESET_CARDS: Array<{
  value: WorldSkeletonPreset;
  /** worlds:generator.stepTwo.preset.<value>.title */
  titleKey: string;
  /** worlds:generator.stepTwo.preset.<value>.description */
  descriptionKey: string;
}> = [
  {
    value: "light",
    titleKey: "generator.stepTwo.preset.light.title",
    descriptionKey: "generator.stepTwo.preset.light.description",
  },
  {
    value: "standard",
    titleKey: "generator.stepTwo.preset.standard.title",
    descriptionKey: "generator.stepTwo.preset.standard.description",
  },
  {
    value: "epic",
    titleKey: "generator.stepTwo.preset.epic.title",
    descriptionKey: "generator.stepTwo.preset.epic.description",
  },
];

/** value = worlds:generator.stepTwo.count.<key> i18n key */
const COUNT_LABEL_KEYS: Record<keyof WorldSkeletonGenerationCounts, string> = {
  rules: "generator.stepTwo.count.rules",
  factionGroups: "generator.stepTwo.count.factionGroups",
  forces: "generator.stepTwo.count.forces",
  locations: "generator.stepTwo.count.locations",
  conflicts: "generator.stepTwo.count.conflicts",
  storyEntrySuggestions: "generator.stepTwo.count.storyEntrySuggestions",
};

interface WorldGeneratorStepTwoProps {
  preset: WorldSkeletonPreset;
  counts: WorldSkeletonGenerationCounts;
  generating: boolean;
  onPresetChange: (preset: WorldSkeletonPreset) => void;
  onCountChange: (key: keyof WorldSkeletonGenerationCounts, value: number) => void;
  onGenerateSkeleton: () => void;
}

export default function WorldGeneratorStepTwo(props: WorldGeneratorStepTwoProps) {
  const { t } = useTranslation("worlds");
  const {
    preset,
    counts,
    generating,
    onPresetChange,
    onCountChange,
    onGenerateSkeleton,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4">
        <div className="text-sm font-medium">{t("generator.stepTwo.scaleTitle")}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t("generator.stepTwo.scaleHint")}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PRESET_CARDS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`rounded-md border p-4 text-left transition ${
              preset === item.value ? "border-primary bg-primary/5" : "bg-background hover:border-primary/60"
            }`}
            onClick={() => onPresetChange(item.value)}
          >
            <div className="text-sm font-semibold">{t(item.titleKey)}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{t(item.descriptionKey)}</div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>{t("generator.stepTwo.preview.forces", { count: WORLD_SKELETON_PRESET_COUNTS[item.value].forces })}</span>
              <span>{t("generator.stepTwo.preview.locations", { count: WORLD_SKELETON_PRESET_COUNTS[item.value].locations })}</span>
              <span>{t("generator.stepTwo.preview.conflicts", { count: WORLD_SKELETON_PRESET_COUNTS[item.value].conflicts })}</span>
              <span>{t("generator.stepTwo.preview.entries", { count: WORLD_SKELETON_PRESET_COUNTS[item.value].storyEntrySuggestions })}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-md border p-4">
        <div className="text-sm font-medium">{t("generator.stepTwo.adjustTitle")}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t("generator.stepTwo.adjustHint")}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(Object.keys(COUNT_LABEL_KEYS) as Array<keyof WorldSkeletonGenerationCounts>).map((key) => {
            const limit = WORLD_SKELETON_COUNT_LIMITS[key];
            return (
              <label key={key} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{t(COUNT_LABEL_KEYS[key])}</span>
                  <span className="text-xs text-muted-foreground">{counts[key]}</span>
                </div>
                <input
                  className="mt-3 w-full"
                  type="range"
                  min={limit.min}
                  max={limit.max}
                  step={1}
                  value={counts[key]}
                  onChange={(event) => onCountChange(key, Number(event.target.value))}
                />
              </label>
            );
          })}
        </div>
      </div>

      <Button onClick={onGenerateSkeleton} disabled={generating}>
        {generating ? t("generator.stepTwo.generating") : t("generator.stepTwo.generate")}
      </Button>
    </div>
  );
}
