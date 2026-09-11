import type {
  ChapterWriteContext,
  GenerationContextPackage,
} from "@ai-novel/shared/types/chapterRuntime";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { compactText, takeUnique } from "./chapterLayeredContextShared";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") {
    return vi;
  }
  if (lang === "en") {
    return en;
  }
  return zh;
}

function buildVisibleProfileSummary(
  character: GenerationContextPackage["characterRoster"][number] | undefined,
  lang: PromptLanguage,
): string | null {
  if (!character) {
    return null;
  }
  const parts = takeUnique([
    character.appearance || character.physique
      ? `${pick(lang, "样貌/体态=", "Diện mạo/vóc dáng=", "Appearance/physique=")}${compactText([character.appearance, character.physique].filter(Boolean).join(pick(lang, "；", "; ", "; ")))}`
      : "",
    character.attireStyle ? `${pick(lang, "常见穿着=", "Trang phục thường thấy=", "Usual attire=")}${compactText(character.attireStyle)}` : "",
    character.signatureDetail ? `${pick(lang, "标志=", "Đặc trưng=", "Signature=")}${compactText(character.signatureDetail)}` : "",
    character.voiceTexture ? `${pick(lang, "声音=", "Giọng nói=", "Voice=")}${compactText(character.voiceTexture)}` : "",
    character.presenceImpression ? `${pick(lang, "登场印象=", "Ấn tượng xuất hiện=", "Presence impression=")}${compactText(character.presenceImpression)}` : "",
  ], 6);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function absenceRiskRank(risk: "none" | "info" | "warn" | "high"): number {
  return ["none", "info", "warn", "high"].indexOf(risk);
}

export function buildDynamicCharacterGuidance(
  contextPackage: GenerationContextPackage,
  lang: PromptLanguage = "zh",
): Pick<ChapterWriteContext, "characterBehaviorGuides" | "activeRelationStages" | "pendingCandidateGuards"> {
  const overview = contextPackage.characterDynamics;
  if (!overview) {
    return {
      characterBehaviorGuides: [],
      activeRelationStages: [],
      pendingCandidateGuards: [],
    };
  }

  const currentChapterOrder = contextPackage.chapter.order;
  const rosterById = new Map(contextPackage.characterRoster.map((character) => [character.id, character]));
  const mindByCharacterId = new Map((contextPackage.characterMindStates ?? []).map((mind) => [mind.characterId, mind]));
  const dialogueGuidanceByCharacterId = new Map(
    (contextPackage.characterDialogueGuidances ?? []).map((guidance) => [guidance.characterId, guidance]),
  );
  const planParticipantNames = new Set((contextPackage.plan?.participants ?? []).map((item) => compactText(item)));
  const conflictCharacterIds = new Set(
    contextPackage.openConflicts.flatMap((conflict) => conflict.affectedCharacterIds ?? []),
  );

  const activeRelationStages = overview.relations
    .slice(0, 8)
    .map((relation) => ({
      relationId: relation.relationId ?? null,
      sourceCharacterId: relation.sourceCharacterId,
      sourceCharacterName: compactText(relation.sourceCharacterName, relation.sourceCharacterId),
      targetCharacterId: relation.targetCharacterId,
      targetCharacterName: compactText(relation.targetCharacterName, relation.targetCharacterId),
      stageLabel: compactText(relation.stageLabel),
      stageSummary: compactText(relation.stageSummary),
      nextTurnPoint: compactText(relation.nextTurnPoint, "") || null,
      isCurrent: relation.isCurrent,
    }));
  const relationStageByCharacterId = new Map<string, typeof activeRelationStages>();
  for (const relation of activeRelationStages) {
    const sourceStages = relationStageByCharacterId.get(relation.sourceCharacterId) ?? [];
    sourceStages.push(relation);
    relationStageByCharacterId.set(relation.sourceCharacterId, sourceStages);

    const targetStages = relationStageByCharacterId.get(relation.targetCharacterId) ?? [];
    targetStages.push(relation);
    relationStageByCharacterId.set(relation.targetCharacterId, targetStages);
  }

  const characterBehaviorGuides = overview.characters
    .filter((item) => rosterById.has(item.characterId))
    .map((item) => {
      const roster = rosterById.get(item.characterId);
      const relationStages = relationStageByCharacterId.get(item.characterId) ?? [];
      const shouldPreferAppearance = item.isCoreInVolume && (
        item.plannedChapterOrders.includes(currentChapterOrder)
        || item.absenceRisk === "high"
        || item.absenceRisk === "warn"
      );
      let score = 0;
      if (item.isCoreInVolume) {
        score += 40;
      }
      if (item.volumeResponsibility) {
        score += 20;
      }
      if (item.plannedChapterOrders.includes(currentChapterOrder)) {
        score += 25;
      }
      if (relationStages.length > 0) {
        score += 24;
      }
      if (item.absenceRisk === "high") {
        score += 30;
      } else if (item.absenceRisk === "warn") {
        score += 20;
      } else if (item.absenceRisk === "info") {
        score += 8;
      }
      if (planParticipantNames.has(item.name)) {
        score += 16;
      }
      if (conflictCharacterIds.has(item.characterId)) {
        score += 12;
      }
      if (item.currentGoal) {
        score += 4;
      }
      return {
        score,
        guide: {
          characterId: item.characterId,
          name: item.name,
          role: roster?.role ?? item.role,
          castRole: item.castRole ?? null,
          volumeRoleLabel: item.volumeRoleLabel ?? null,
          volumeResponsibility: item.volumeResponsibility ?? null,
          currentGoal: roster?.currentGoal ?? item.currentGoal ?? null,
          currentState: roster?.currentState ?? item.currentState ?? null,
          visibleProfileSummary: buildVisibleProfileSummary(roster, lang),
          factionLabel: item.factionLabel ?? null,
          stanceLabel: item.stanceLabel ?? null,
          relationStageLabels: takeUnique(
            relationStages.map((relation) => (
              relation.nextTurnPoint
                ? `${relation.stageLabel} -> ${relation.nextTurnPoint}`
                : relation.stageLabel
            )),
            3,
          ),
          relationRiskNotes: takeUnique(
            relationStages.map((relation) => (
              `${relation.sourceCharacterName} / ${relation.targetCharacterName}: ${relation.stageSummary}${relation.nextTurnPoint ? ` | next=${relation.nextTurnPoint}` : ""}`
            )),
            3,
          ),
          plannedChapterOrders: item.plannedChapterOrders,
          absenceRisk: item.absenceRisk,
          absenceSpan: item.absenceSpan,
          isCoreInVolume: item.isCoreInVolume,
          shouldPreferAppearance,
          mindGuidance: buildMindGuidance(mindByCharacterId.get(item.characterId), lang),
          authorInfluenceGuidance: buildDialogueInfluenceGuidance(dialogueGuidanceByCharacterId.get(item.characterId), lang),
        },
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.guide.shouldPreferAppearance !== right.guide.shouldPreferAppearance) {
        return left.guide.shouldPreferAppearance ? -1 : 1;
      }
      if (left.guide.isCoreInVolume !== right.guide.isCoreInVolume) {
        return left.guide.isCoreInVolume ? -1 : 1;
      }
      if (left.guide.absenceRisk !== right.guide.absenceRisk) {
        return absenceRiskRank(right.guide.absenceRisk) - absenceRiskRank(left.guide.absenceRisk);
      }
      return left.guide.name.localeCompare(right.guide.name, "zh-Hans-CN");
    })
    .slice(0, 8)
    .map((item) => item.guide);

  return {
    characterBehaviorGuides,
    activeRelationStages,
    pendingCandidateGuards: overview.candidates
      .slice(0, 4)
      .map((candidate) => ({
        id: candidate.id,
        proposedName: compactText(candidate.proposedName),
        proposedRole: compactText(candidate.proposedRole, "") || null,
        summary: compactText(candidate.summary, "") || null,
        evidence: takeUnique(candidate.evidence, 3),
        sourceChapterOrder: candidate.sourceChapterOrder ?? null,
      })),
  };
}

function buildMindGuidance(
  mind: GenerationContextPackage["characterMindStates"][number] | undefined,
  lang: PromptLanguage,
): string | null {
  if (!mind) {
    return null;
  }
  const parts = takeUnique([
    mind.currentInterpretation ? `${pick(lang, "角色理解：", "Cách nhân vật hiểu: ", "Character's read: ")}${compactText(mind.currentInterpretation)}` : "",
    mind.activePlan ? `${pick(lang, "倾向行动：", "Hành động thiên về: ", "Leaning action: ")}${compactText(mind.activePlan)}` : "",
    mind.actionTendency ? `${pick(lang, "受压反应：", "Phản ứng khi bị ép: ", "Under-pressure reaction: ")}${compactText(mind.actionTendency)}` : "",
    mind.misbeliefs[0] ? `${pick(lang, "可能误判：", "Có thể phán đoán sai: ", "Possible misjudgment: ")}${compactText(mind.misbeliefs[0])}` : "",
  ], 3);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function buildDialogueInfluenceGuidance(
  influence: NonNullable<GenerationContextPackage["characterDialogueGuidances"]>[number] | undefined,
  lang: PromptLanguage,
): string | null {
  if (!influence) {
    return null;
  }
  const parts = takeUnique([
    influence.behaviorGuidance ? `${pick(lang, "行动倾向：", "Xu hướng hành động: ", "Action tendency: ")}${compactText(influence.behaviorGuidance)}` : "",
    influence.emotionalGuidance ? `${pick(lang, "情绪倾向：", "Xu hướng cảm xúc: ", "Emotional tendency: ")}${compactText(influence.emotionalGuidance)}` : "",
    influence.relationTension ? `${pick(lang, "关系张力：", "Căng thẳng quan hệ: ", "Relationship tension: ")}${compactText(influence.relationTension)}` : "",
    influence.summary ? `${pick(lang, "对话沉淀：", "Đọng lại sau đối thoại: ", "Dialogue takeaway: ")}${compactText(influence.summary)}` : "",
  ], 3);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function buildParticipants(
  contextPackage: GenerationContextPackage,
  characterBehaviorGuides: ChapterWriteContext["characterBehaviorGuides"] = [],
): GenerationContextPackage["characterRoster"] {
  const rosterById = new Map(contextPackage.characterRoster.map((character) => [character.id, character]));
  const participantNames = new Set(contextPackage.plan?.participants ?? []);
  const conflictCharacterIds = new Set(
    contextPackage.openConflicts.flatMap((conflict) => conflict.affectedCharacterIds ?? []),
  );
  if (characterBehaviorGuides.length > 0) {
    const selected = characterBehaviorGuides
      .filter((guide) => (
        guide.shouldPreferAppearance
        || guide.isCoreInVolume
        || guide.relationStageLabels.length > 0
        || participantNames.has(guide.name)
        || conflictCharacterIds.has(guide.characterId)
      ))
      .map((guide) => rosterById.get(guide.characterId))
      .filter((character): character is NonNullable<typeof character> => Boolean(character));
    if (selected.length > 0) {
      return selected.slice(0, 6);
    }
  }

  const selected = contextPackage.characterRoster.filter((character) => (
    participantNames.has(character.name) || conflictCharacterIds.has(character.id)
  ));
  if (selected.length > 0) {
    return selected.slice(0, 6);
  }
  return contextPackage.characterRoster.slice(0, 4);
}
