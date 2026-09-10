import type {
  ChapterExecutionObligationContract,
  ChapterWriteContext,
} from "@ai-novel/shared/types/chapterRuntime";
import {
  hasReaderExperienceContractValue,
  normalizeReaderExperienceContract,
  type ReaderExperienceContract,
} from "@ai-novel/shared/types/novel/readerExperience";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";

const PROTAGONIST_ROLE_ALIASES = new Set(["主角", "nhân vật chính", "protagonist", "main character"]);

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") {
    return vi;
  }
  if (lang === "en") {
    return en;
  }
  return zh;
}

const EMPTY_OBLIGATION_CONTRACT: ChapterExecutionObligationContract = {
  mustHitNow: [],
  mustPreserve: [],
  requiredPayoffTouches: [],
  requiredCharacterAppearances: [],
  requiredGoalChanges: [],
  canDefer: [],
  forbiddenCrossings: [],
};

export function normalizeChapterWriteContext(writeContext: ChapterWriteContext): ChapterWriteContext {
  const legacyContext = writeContext as ChapterWriteContext & {
    obligationContract?: Partial<ChapterExecutionObligationContract> | null;
  };
  const obligationContract = legacyContext.obligationContract ?? {};
  const lang: PromptLanguage = writeContext.promptLanguage ?? "zh";
  const storedReaderExperience = normalizeReaderExperienceContract(writeContext.readerExperience);
  const compatibleReaderExperience: ReaderExperienceContract = hasReaderExperienceContractValue(storedReaderExperience)
    ? storedReaderExperience
    : {
      readerQuestion: writeContext.chapterMission.expectation,
      promisedReward: writeContext.chapterStateGoal?.targetPayoffs[0]
        || writeContext.chapterMission.expectation,
      rewardLevel: writeContext.chapterMission.planRole === "payoff" ? "major" : "partial",
      protagonistWant: writeContext.participants.find((item) => PROTAGONIST_ROLE_ALIASES.has(item.role?.trim().toLowerCase() ?? ""))?.currentGoal
        || writeContext.participants[0]?.currentGoal
        || writeContext.chapterMission.objective,
      primaryResistance: writeContext.openConflictSummaries[0]
        || writeContext.chapterMission.mustAdvance[0]
        || pick(
          lang,
          "完成本章任务时必须面对具体阻力与代价。",
          "Khi hoàn thành nhiệm vụ chương này phải đối mặt với trở lực và cái giá cụ thể.",
          "Completing this chapter's mission must involve a concrete obstacle and cost.",
        ),
      keyTurn: writeContext.chapterBoundary?.exclusiveEvent || writeContext.chapterMission.objective,
      emotionalShift: writeContext.chapterMission.expectation,
      informationReveal: pick(
        lang,
        "本章只交付任务允许的必要信息。",
        "Chương này chỉ giao đúng thông tin cần thiết mà nhiệm vụ cho phép.",
        "This chapter delivers only the necessary information the mission allows.",
      ),
      netChange: writeContext.chapterBoundary?.endingState || writeContext.chapterMission.expectation,
      inheritedHookResponsibilities: [],
      endingHook: writeContext.chapterMission.hookTarget,
    };
  return {
    ...writeContext,
    bookContract: {
      ...writeContext.bookContract,
      readingPromise: writeContext.bookContract.readingPromise ?? "",
      protagonistFantasy: writeContext.bookContract.protagonistFantasy ?? "",
      coreSellingPoint: writeContext.bookContract.coreSellingPoint ?? writeContext.bookContract.sellingPoint ?? "",
      chapter3Payoff: writeContext.bookContract.chapter3Payoff ?? "",
      chapter10Payoff: writeContext.bookContract.chapter10Payoff ?? "",
      chapter30Payoff: writeContext.bookContract.chapter30Payoff ?? "",
      escalationLadder: writeContext.bookContract.escalationLadder ?? "",
      relationshipMainline: writeContext.bookContract.relationshipMainline ?? "",
      activeMilestonePayoffs: writeContext.bookContract.activeMilestonePayoffs ?? [],
    },
    volumeWindow: writeContext.volumeWindow
      ? {
        ...writeContext.volumeWindow,
        keyMilestoneGuards: writeContext.volumeWindow.keyMilestoneGuards ?? [],
        readerRewardLadder: writeContext.volumeWindow.readerRewardLadder ?? "",
        coreReward: writeContext.volumeWindow.coreReward ?? "",
      }
      : null,
    narrativeProgressHint: writeContext.narrativeProgressHint ?? null,
    obligationContract: {
      mustHitNow: obligationContract.mustHitNow ?? EMPTY_OBLIGATION_CONTRACT.mustHitNow,
      mustPreserve: obligationContract.mustPreserve ?? EMPTY_OBLIGATION_CONTRACT.mustPreserve,
      requiredPayoffTouches: obligationContract.requiredPayoffTouches ?? EMPTY_OBLIGATION_CONTRACT.requiredPayoffTouches,
      requiredCharacterAppearances: obligationContract.requiredCharacterAppearances ?? EMPTY_OBLIGATION_CONTRACT.requiredCharacterAppearances,
      requiredGoalChanges: obligationContract.requiredGoalChanges ?? EMPTY_OBLIGATION_CONTRACT.requiredGoalChanges,
      canDefer: obligationContract.canDefer ?? EMPTY_OBLIGATION_CONTRACT.canDefer,
      forbiddenCrossings: obligationContract.forbiddenCrossings ?? EMPTY_OBLIGATION_CONTRACT.forbiddenCrossings,
    },
    characterHardFacts: writeContext.characterHardFacts ?? [],
    previousChapterTail: writeContext.previousChapterTail ?? null,
    styleConstraints: writeContext.styleConstraints ?? [],
    continuationConstraints: writeContext.continuationConstraints ?? [],
    ragFacts: writeContext.ragFacts ?? [],
    completedMilestones: writeContext.completedMilestones ?? [],
    recentScenePatterns: writeContext.recentScenePatterns ?? [],
    readerExperience: compatibleReaderExperience,
  };
}

export function selectCharacterHardFactsForWriter(input: {
  hardFacts: ChapterWriteContext["characterHardFacts"];
  participants: ChapterWriteContext["participants"];
  characterBehaviorGuides: ChapterWriteContext["characterBehaviorGuides"];
  currentChapterOrder: number;
}): ChapterWriteContext["characterHardFacts"] {
  const selectedIds = new Set(input.participants.map((character) => character.id));
  for (const guide of input.characterBehaviorGuides) {
    if (
      guide.shouldPreferAppearance
      || guide.plannedChapterOrders.includes(input.currentChapterOrder)
      || guide.absenceRisk === "high"
      || guide.absenceRisk === "warn"
      || guide.relationStageLabels.length > 0
    ) {
      selectedIds.add(guide.characterId);
    }
  }
  const selected = input.hardFacts.filter((fact) => selectedIds.has(fact.characterId));
  return selected.length > 0 ? selected.slice(0, 8) : input.hardFacts.slice(0, 4);
}
