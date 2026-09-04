import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character, CharacterCastOption, CharacterCastRole, CharacterGender } from "@ai-novel/shared/types/novel";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import AiButton from "@/components/common/AiButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyCharacterCastOption,
  clearCharacterCastOptions,
  deleteCharacterCastOption,
  generateCharacterCastOptions,
  getCharacterCastOptions,
  getCharacterRelations,
} from "@/api/novel";
import { getNovelWorldSlice } from "@/api/novelWorldSlice";
import { queryKeys } from "@/api/queryKeys";
import SelectControl from "@/components/common/SelectControl";
import i18n from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`characterCast:${key}`, options);

interface CharacterCastOptionsSectionProps {
  novelId: string;
  characters: Character[];
  selectedCharacter?: Character;
  onSelectedCharacterChange: (id: string) => void;
  llmProvider?: LLMProvider;
  llmModel?: string;
}

const CAST_ROLE_LABELS: Record<CharacterCastRole, string> = {
  protagonist: t("roles.protagonist"), antagonist: t("roles.antagonist"), ally: t("roles.ally"), foil: t("roles.foil"),
  mentor: t("roles.mentor"), love_interest: t("roles.loveInterest"), pressure_source: t("roles.pressureSource"), catalyst: t("roles.catalyst"),
};

const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  male: t("gender.male"), female: t("gender.female"), other: t("gender.other"), unknown: t("gender.unknown"),
};

function getCastRoleLabel(castRole?: CharacterCastRole | null): string {
  if (!castRole) {
    return t("unclassified");
  }
  return CAST_ROLE_LABELS[castRole] ?? castRole;
}

function getCharacterGenderLabel(gender?: CharacterGender | null): string {
  if (!gender) {
    return t("gender.unknown");
  }
  return CHARACTER_GENDER_LABELS[gender] ?? gender;
}

function getCharacterCastQualityWarnings(option: CharacterCastOption): string[] {
  const assessment = option.qualityAssessment;
  if (!assessment || assessment.autoApplicable) {
    return [];
  }
  const issueMessages = Array.from(
    new Set(assessment.issues.map((issue) => issue.message).filter((message) => message.trim().length > 0)),
  );
  if (issueMessages.length > 0) {
    return issueMessages;
  }
  return assessment.blockingReasons;
}

function buildCharacterCastApplyConfirmMessage(option: CharacterCastOption, warnings: string[]): string {
  const warningText = warnings
    .slice(0, 4)
    .map((warning, index) => `${index + 1}. ${warning}`)
    .join("\n");
  return [
    t("confirm.qualityWarning", { title: option.title }),
    warningText,
    t("confirm.applyAnyway"),
  ].filter((line) => line.trim().length > 0).join("\n\n");
}

export default function CharacterCastOptionsSection(props: CharacterCastOptionsSectionProps) {
  const { novelId, characters, selectedCharacter, onSelectedCharacterChange, llmProvider, llmModel } = props;
  const queryClient = useQueryClient();
  const [storyInput, setStoryInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isPlannerExpanded, setIsPlannerExpanded] = useState(true);
  const [useWorldContext, setUseWorldContext] = useState(true);
  const [preferredWorldFaction, setPreferredWorldFaction] = useState("");
  const [forceWorldCompliance, setForceWorldCompliance] = useState(true);

  const castOptionsQuery = useQuery({
    queryKey: queryKeys.novels.characterCastOptions(novelId),
    queryFn: () => getCharacterCastOptions(novelId),
    enabled: Boolean(novelId),
  });

  const relationsQuery = useQuery({
    queryKey: queryKeys.novels.characterRelations(novelId),
    queryFn: () => getCharacterRelations(novelId),
    enabled: Boolean(novelId),
  });

  const worldSliceQuery = useQuery({
    queryKey: queryKeys.novels.worldSlice(novelId),
    queryFn: () => getNovelWorldSlice(novelId),
    enabled: Boolean(novelId) && useWorldContext,
  });

  const castOptions = castOptionsQuery.data?.data ?? [];
  const relations = relationsQuery.data?.data ?? [];
  const worldSliceView = worldSliceQuery.data?.data;
  const hasUsableWorld = Boolean(worldSliceView?.hasWorld);
  const hasWorldSlice = Boolean(worldSliceView?.slice);
  const activeWorldForces = worldSliceQuery.data?.data?.slice?.activeForces ?? [];
  const appliedOption = useMemo(
    () => castOptions.find((option) => option.status === "applied") ?? null,
    [castOptions],
  );
  const characterNameById = useMemo(
    () => new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  );

  useEffect(() => {
    setIsPlannerExpanded(appliedOption == null);
  }, [appliedOption?.id]);

  async function refreshCastOptions() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCastOptions(novelId) });
  }

  async function refreshAppliedCharacterWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.detail(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCastOptions(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterRelations(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterDynamicsOverview(novelId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.novels.characterCandidates(novelId) }),
    ]);
  }

  function handleDeleteOption(option: CharacterCastOption) {
    const confirmed = window.confirm(
      option.status === "applied"
        ? t("confirm.deleteApplied", { title: option.title })
        : t("confirm.delete", { title: option.title }),
    );
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(option.id);
  }

  function handleRejectAll() {
    const confirmed = window.confirm(
      appliedOption
        ? t("confirm.clearApplied")
        : t("confirm.clear", { count: castOptions.length }),
    );
    if (!confirmed) {
      return;
    }
    clearMutation.mutate();
  }

  const filteredRelations = useMemo(() => {
    if (!selectedCharacter) {
      return relations.slice(0, 8);
    }
    return relations.filter(
      (relation) => relation.sourceCharacterId === selectedCharacter.id || relation.targetCharacterId === selectedCharacter.id,
    );
  }, [relations, selectedCharacter]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateCharacterCastOptions(novelId, {
        provider: llmProvider,
        model: llmModel,
        temperature: 0.6,
        storyInput: storyInput.trim() || undefined,
        useWorldContext,
        worldFocusHints: useWorldContext
          ? {
            preferFaction: preferredWorldFaction || undefined,
            forceCompliance: forceWorldCompliance,
          }
          : undefined,
      }),
    onSuccess: async (response) => {
      setStatusMessage(response.message ?? t("status.generated"));
      setIsPlannerExpanded(true);
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : t("status.generateFailed"));
    },
  });

  const applyMutation = useMutation({
    mutationFn: (input: { optionId: string; overrideQualityGate?: boolean }) => (
      applyCharacterCastOption(novelId, input.optionId, {
        overrideQualityGate: input.overrideQualityGate,
        provider: llmProvider,
        model: llmModel,
        temperature: 0.45,
      })
    ),
    onSuccess: async (response) => {
      const primaryCharacterId = response.data?.primaryCharacterId ?? "";
      if (primaryCharacterId) {
        onSelectedCharacterChange(primaryCharacterId);
      }
      const createdCount = response.data?.createdCount ?? 0;
      const updatedCount = response.data?.updatedCount ?? 0;
      const backgroundHint = t("status.backgroundHint");
      setStatusMessage(
        response.data?.qualityOverrideApplied
          ? t("status.applied", { createdCount, updatedCount, backgroundHint })
          : `${response.message ?? t("status.synced", { createdCount, updatedCount })}${backgroundHint}`,
      );
      setIsPlannerExpanded(false);
      await refreshAppliedCharacterWorkspace();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : t("status.applyFailed"));
    },
  });

  function handleApplyOption(option: CharacterCastOption) {
    const qualityWarnings = getCharacterCastQualityWarnings(option);
    if (qualityWarnings.length > 0) {
      const confirmed = window.confirm(buildCharacterCastApplyConfirmMessage(option, qualityWarnings));
      if (!confirmed) {
        return;
      }
      applyMutation.mutate({ optionId: option.id, overrideQualityGate: true });
      return;
    }
    applyMutation.mutate({ optionId: option.id });
  }

  const deleteMutation = useMutation({
    mutationFn: (optionId: string) => deleteCharacterCastOption(novelId, optionId),
    onSuccess: async (response) => {
      if (response.data?.deletedAppliedOption) {
        setStatusMessage(t("status.deletedApplied"));
      } else {
        setStatusMessage(t("status.deleted"));
      }
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : t("status.deleteFailed"));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearCharacterCastOptions(novelId),
    onSuccess: async (response) => {
      const deletedCount = response.data?.deletedCount ?? 0;
      const deletedAppliedCount = response.data?.deletedAppliedCount ?? 0;
      if (deletedCount === 0) {
        setStatusMessage(t("status.clearEmpty"));
      } else if (deletedAppliedCount > 0) {
        setStatusMessage(t("status.clearApplied", { count: deletedCount }));
      } else {
        setStatusMessage(t("status.clearOptions", { count: deletedCount }));
      }
      setIsPlannerExpanded(true);
      await refreshCastOptions();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : t("status.clearFailed"));
    },
  });
  const isWorking =
    generateMutation.isPending
    || applyMutation.isPending
    || deleteMutation.isPending
    || clearMutation.isPending;

  return (
    <div className="space-y-4">
      <Card className={appliedOption && !isPlannerExpanded ? "border-border/60 bg-muted/15" : ""}>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <CardTitle>{t("ui.title")}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {t("ui.description")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{t("ui.candidateCount", { count: castOptions.length })}</Badge>
              <Badge variant="outline">{t("ui.relationCount", { count: relations.length })}</Badge>
              {appliedOption ? <Badge variant="secondary">{t("ui.appliedOption")}</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {appliedOption && !isPlannerExpanded ? (
            <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{appliedOption.title}</div>
                  <Badge variant="secondary">{t("ui.current")}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{appliedOption.summary}</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t("ui.members", { count: appliedOption.members.length })}</span>
                  <span>{t("ui.relations", { count: appliedOption.relations.length })}</span>
                  {appliedOption.recommendedReason ? <span>{t("ui.recommendation", { value: appliedOption.recommendedReason })}</span> : null}
                </div>
                {statusMessage ? <div className="text-xs text-muted-foreground">{statusMessage}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIsPlannerExpanded(true)}>
                  {t("ui.viewOthers")}
                </Button>
                <Button variant="secondary" onClick={() => setIsPlannerExpanded(true)}>
                  {t("ui.replan")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{t("ui.instruction")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("ui.instructionHint")}
                    </div>
                  </div>
                  <textarea
                    className="min-h-[140px] w-full rounded-xl border bg-background p-3 text-sm"
                    placeholder={t("ui.instructionPlaceholder")}
                    value={storyInput}
                    onChange={(event) => setStoryInput(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={useWorldContext}
                        onChange={(event) => setUseWorldContext(event.target.checked)}
                      />
                      {t("ui.worldBased")}
                    </label>
                    {useWorldContext ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={forceWorldCompliance}
                          onChange={(event) => setForceWorldCompliance(event.target.checked)}
                        />
                        {t("ui.worldCompliance")}
                      </label>
                    ) : null}
                  </div>
                  {useWorldContext ? (
                    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                      {worldSliceQuery.isLoading ? (
                        <div>{t("ui.worldLoading")}</div>
                      ) : !hasUsableWorld ? (
                        <div>
                          {t("ui.noWorld")}
                        </div>
                      ) : !hasWorldSlice ? (
                        <div>
                          {t("ui.worldNotOrganized")}
                        </div>
                      ) : null}
                      <label className="space-y-1">
                        <span className="font-medium text-foreground">{t("ui.faction")}</span>
                        <SelectControl
                          className="w-full rounded-md border bg-background p-2 text-sm"
                          value={preferredWorldFaction}
                          onChange={(event) => setPreferredWorldFaction(event.target.value)}
                          disabled={!hasWorldSlice || activeWorldForces.length === 0}
                        >
                          <option value="">{t("ui.aiJudge")}</option>
                          {activeWorldForces.map((force) => (
                            <option key={force.id} value={force.name}>{force.name}</option>
                          ))}
                        </SelectControl>
                      </label>
                      <div>
                        {hasWorldSlice
                          ? t("ui.worldHint")
                          : t("ui.worldHintEmpty")}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <AiButton onClick={() => generateMutation.mutate()} disabled={isWorking}>
                      {generateMutation.isPending ? t("ui.generating") : t("ui.generate")}
                    </AiButton>
                    {castOptions.length > 0 ? (
                      <Button variant="outline" onClick={handleRejectAll} disabled={isWorking}>
                        {clearMutation.isPending ? t("ui.clearing") : t("ui.clear")}
                      </Button>
                    ) : null}
                    {appliedOption ? (
                      <Button variant="outline" onClick={() => setIsPlannerExpanded(false)} disabled={isWorking}>
                        {t("ui.collapse")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    {t("ui.applyNotice")}
                  </div>
                  {statusMessage ? (
                    <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                      {statusMessage}
                    </div>
                  ) : null}
                </div>

                {castOptionsQuery.isLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                    {t("ui.loadingOptions")}
                  </div>
                ) : castOptions.length > 0 ? (
                  <div className="grid gap-3 2xl:grid-cols-2">
                    {castOptions.map((option) => {
                      const qualityWarnings = getCharacterCastQualityWarnings(option);
                      const requiresQualityConfirmation = qualityWarnings.length > 0;
                      const isApplyingThisOption = applyMutation.isPending && applyMutation.variables?.optionId === option.id;
                      return (
                        <div
                          key={option.id}
                          className={`rounded-2xl border p-4 ${
                            option.status === "applied" ? "border-emerald-500/40 bg-emerald-50/40" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium">{option.title}</div>
                                {option.status === "applied" ? <Badge variant="secondary">{t("ui.applied")}</Badge> : null}
                                {option.recommendedReason ? <Badge variant="outline">{t("ui.recommended")}</Badge> : null}
                                {requiresQualityConfirmation ? <Badge variant="outline">{t("ui.needsConfirmation")}</Badge> : null}
                              </div>
                              <div className="text-xs leading-5 text-muted-foreground">{option.summary}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApplyOption(option)}
                                disabled={isWorking}
                                variant={option.status === "applied" ? "outline" : "default"}
                              >
                                {isApplyingThisOption
                                  ? t("ui.applying")
                                  : option.status === "applied"
                                    ? t("ui.reapply")
                                    : requiresQualityConfirmation
                                      ? t("ui.applyConfirmed")
                                      : t("ui.applyThis")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteOption(option)}
                                disabled={isWorking}
                              >
                                {deleteMutation.isPending && deleteMutation.variables === option.id ? t("ui.deleting") : t("ui.delete")}
                              </Button>
                            </div>
                          </div>
                          {requiresQualityConfirmation ? (
                            <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900">
                              <div className="font-medium">{t("ui.qualityTitle")}</div>
                              <div className="mt-1">
                                {t("ui.qualityDescription")}
                              </div>
                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                {qualityWarnings.slice(0, 3).map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {option.recommendedReason ? (
                            <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-xs text-muted-foreground">
                              {t("ui.reason", { value: option.recommendedReason })}
                            </div>
                          ) : null}
                          {option.whyItWorks ? (
                            <div className="mt-2 text-xs text-muted-foreground">{t("ui.whyWorks", { value: option.whyItWorks })}</div>
                          ) : null}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {option.members.map((member) => (
                              <div key={member.id} className="rounded-xl border border-dashed p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{member.name}</span>
                                  <Badge variant="outline">{getCastRoleLabel(member.castRole)}</Badge>
                                  <Badge variant="secondary">{getCharacterGenderLabel(member.gender)}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{member.role}</div>
                                <div className="mt-2 text-xs text-muted-foreground">{t("ui.storyRole", { value: member.storyFunction })}</div>
                                {member.relationToProtagonist ? (
                                  <div className="text-xs text-muted-foreground">
                                    {t("ui.relation", { value: member.relationToProtagonist })}
                                  </div>
                                ) : null}
                                {member.outerGoal ? (
                                  <div className="text-xs text-muted-foreground">{t("ui.goal", { value: member.outerGoal })}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm text-muted-foreground">
                    {t("ui.emptyOptions")}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ui.relationNetwork")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selectedCharacter ? (
            <div className="text-xs text-muted-foreground">
              {t("ui.focus", { name: selectedCharacter.name, role: selectedCharacter.role || t("ui.undefined") })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{t("ui.defaultRelations")}</div>
          )}
          {relationsQuery.isLoading ? (
            <div className="text-muted-foreground">{t("ui.loadingRelations")}</div>
          ) : filteredRelations.length > 0 ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {filteredRelations.map((relation) => {
                const selectedIsSource = selectedCharacter ? relation.sourceCharacterId === selectedCharacter.id : false;
                const counterpartId = selectedIsSource ? relation.targetCharacterId : relation.sourceCharacterId;
                const counterpartName = selectedIsSource
                  ? relation.targetCharacterName || characterNameById.get(counterpartId) || t("ui.unnamed")
                  : relation.sourceCharacterName || characterNameById.get(counterpartId) || t("ui.unnamed");
                return (
                  <button
                    key={relation.id}
                    type="button"
                    className="w-full rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
                    onClick={() => {
                      if (counterpartId) {
                        onSelectedCharacterChange(counterpartId);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{counterpartName}</div>
                      <Badge variant="outline">{relation.surfaceRelation}</Badge>
                    </div>
                    {relation.hiddenTension ? (
                      <div className="mt-2 text-xs text-muted-foreground">{t("ui.hiddenTension", { value: relation.hiddenTension })}</div>
                    ) : null}
                    {relation.conflictSource ? (
                      <div className="text-xs text-muted-foreground">{t("ui.conflictSource", { value: relation.conflictSource })}</div>
                    ) : null}
                    {relation.nextTurnPoint ? (
                      <div className="text-xs text-muted-foreground">{t("ui.nextTurn", { value: relation.nextTurnPoint })}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-muted-foreground">
              {t("ui.emptyRelations")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
