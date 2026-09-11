import type {
  ChapterRepairContext,
  ChapterReviewContext,
  ChapterWriteContext,
} from "@ai-novel/shared/types/chapterRuntime";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { createContextBlock } from "../../../core/contextBudget";
import type { PromptContextBlock } from "../../../core/promptTypes";
import { buildWriterStyleContractText } from "../../../../services/styleEngine/styleContractText";
import {
  buildCharacterGuidanceText,
  buildLedgerItemLine,
  buildParticipantText,
  buildPendingCandidateGuardText,
  buildRelationStageText,
  compactText,
  resolveTargetWordRange,
  takeUnique,
  toListBlock,
} from "../chapterLayeredContextShared";
import { normalizeChapterWriteContext } from "./chapterContextPolicies";

export const WRITER_FORBIDDEN_GROUPS = [
  "full_outline",
  "full_bible",
  "all_characters",
  "all_audit_issues",
  "anti_copy_corpus",
  "raw_rag_dump",
] as const;

export type ChapterWriterBlockMode = "full" | "incremental" | "review" | "repair";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") {
    return vi;
  }
  if (lang === "en") {
    return en;
  }
  return zh;
}

interface ChapterWriterBlockOptions {
  mode?: ChapterWriterBlockMode;
  incrementalContext?: {
    previousRoundSummary?: string | null;
    roundInstruction?: string | null;
    currentSceneProgress?: string | null;
  } | null;
}

export function sanitizeWriterContextBlocks(blocks: PromptContextBlock[]): {
  allowedBlocks: PromptContextBlock[];
  removedBlockIds: string[];
} {
  const forbidden = new Set<string>(WRITER_FORBIDDEN_GROUPS);
  const removedBlockIds = blocks
    .filter((block) => forbidden.has(block.group))
    .map((block) => block.id);
  return {
    allowedBlocks: blocks.filter((block) => !forbidden.has(block.group)),
    removedBlockIds,
  };
}

function hasLedgerPressure(writeContext: ChapterWriteContext): boolean {
  return writeContext.ledgerUrgentItems.length > 0
    || writeContext.ledgerOverdueItems.length > 0
    || writeContext.ledgerPendingItems.length > 0;
}

function hasCharacterResourcePressure(writeContext: ChapterWriteContext): boolean {
  const context = writeContext.characterResourceContext;
  if (!context) {
    return false;
  }
  return context.availableItems.length > 0
    || context.setupNeededItems.length > 0
    || context.blockedItems.length > 0
    || context.highRiskCommittedItems.length > 0
    || context.pendingProposalItems.length > 0
    || context.riskSignals.length > 0;
}

function buildCharacterHardFactsText(writeContext: ChapterWriteContext): string {
  const lang = writeContext.promptLanguage;
  const heading = pick(lang, "【角色硬事实】", "[Sự thật cứng về nhân vật]", "[Character hard facts]");
  const hardFacts = writeContext.characterHardFacts ?? [];
  if (hardFacts.length === 0) {
    return [
      heading,
      pick(
        lang,
        "当前没有已登记的角色硬事实；不得凭空改写角色阵营、身份、境界、所在地或行动可用性。",
        "Hiện chưa có sự thật cứng nào được đăng ký; không được tự ý viết lại phe, danh tính, cảnh giới, vị trí hay khả năng hành động của nhân vật.",
        "No registered character hard facts yet; do not rewrite any character's faction, identity, cultivation tier, location, or action availability out of thin air.",
      ),
      pick(
        lang,
        "如章节任务没有明确要求，不要新增不可逆角色状态。",
        "Nếu nhiệm vụ chương không yêu cầu rõ ràng, đừng thêm trạng thái nhân vật không thể đảo ngược.",
        "Unless the chapter mission explicitly requires it, do not add irreversible character states.",
      ),
    ].join("\n");
  }
  const hasPendingReviewFields = hardFacts.some((fact) => (fact.pendingReviewFields ?? []).length > 0);
  const pendingSuffix = pick(
    lang,
    "(待确认，如与最新剧情冲突可按合理逻辑调整)",
    " (chờ xác nhận, nếu mâu thuẫn với diễn biến mới nhất có thể điều chỉnh theo logic hợp lý)",
    " (pending confirmation; if it conflicts with the latest plot, adjust by reasonable logic)",
  );
  const kv = {
    role: pick(lang, "角色定位=", "Định vị nhân vật=", "Role="),
    identity: pick(lang, "身份=", "Danh tính=", "Identity="),
    faction: pick(lang, "阵营=", "Phe=", "Faction="),
    stance: pick(lang, "立场=", "Lập trường=", "Stance="),
    power: pick(lang, "战力=", "Chiến lực=", "Power="),
    realm: pick(lang, "境界=", "Cảnh giới=", "Realm="),
    location: pick(lang, "当前位置=", "Vị trí hiện tại=", "Current location="),
    availability: pick(lang, "可出场状态=", "Trạng thái có thể xuất hiện=", "Availability="),
    currentState: pick(lang, "当前状态", "Trạng thái hiện tại", "Current state"),
    currentGoal: pick(lang, "当前目标", "Mục tiêu hiện tại", "Current goal"),
    prohibitions: pick(lang, "禁止误写=", "Cấm viết sai=", "Do not miswrite="),
  };

  return [
    heading,
    pick(
      lang,
      "以下内容是正文生成前的不可违背写作约束，优先级高于软性人物简介。",
      "Nội dung dưới đây là ràng buộc viết không được vi phạm trước khi sinh chính văn, ưu tiên cao hơn tiểu sử nhân vật mềm.",
      "The following are inviolable writing constraints before prose generation; they outrank the soft character profiles.",
    ),
    hasPendingReviewFields
      ? pick(
        lang,
        "标记为待确认的当前状态/当前目标只作参考；如与最新剧情冲突，可按合理逻辑调整。",
        "Trạng thái/mục tiêu hiện tại được đánh dấu chờ xác nhận chỉ để tham khảo; nếu mâu thuẫn với diễn biến mới nhất, có thể điều chỉnh theo logic hợp lý.",
        "Current state/goal marked as pending is reference only; if it conflicts with the latest plot, adjust by reasonable logic.",
      )
      : "",
    ...hardFacts.slice(0, 8).map((fact) => {
      const pendingReviewFields = new Set(fact.pendingReviewFields ?? []);
      const parts = takeUnique([
        fact.role ? `${kv.role}${fact.role}` : "",
        fact.identityLabel ? `${kv.identity}${fact.identityLabel}` : "",
        fact.factionLabel ? `${kv.faction}${fact.factionLabel}` : "",
        fact.stanceLabel ? `${kv.stance}${fact.stanceLabel}` : "",
        fact.powerLevel ? `${kv.power}${fact.powerLevel}` : "",
        fact.realm ? `${kv.realm}${fact.realm}` : "",
        fact.currentLocation ? `${kv.location}${fact.currentLocation}` : "",
        fact.availability ? `${kv.availability}${fact.availability}` : "",
        fact.currentState
          ? pendingReviewFields.has("currentState")
            ? `${kv.currentState}${pendingSuffix}=${fact.currentState}`
            : `${kv.currentState}=${fact.currentState}`
          : "",
        fact.currentGoal
          ? pendingReviewFields.has("currentGoal")
            ? `${kv.currentGoal}${pendingSuffix}=${fact.currentGoal}`
            : `${kv.currentGoal}=${fact.currentGoal}`
          : "",
        fact.prohibitions.length > 0 ? `${kv.prohibitions}${fact.prohibitions.join(" / ")}` : "",
      ], 12);
      return `- ${fact.name}: ${parts.join(" | ")}`;
    }),
  ].filter(Boolean).join("\n");
}

function buildResourceItemLine(item: NonNullable<ChapterWriteContext["characterResourceContext"]>["availableItems"][number]): string {
  const holder = item.holderCharacterName ? `holder=${item.holderCharacterName}` : "holder=unknown";
  const window = item.expectedUseStartChapterOrder || item.expectedUseEndChapterOrder
    ? `window=${item.expectedUseStartChapterOrder ?? "?"}-${item.expectedUseEndChapterOrder ?? "?"}`
    : "";
  const constraints = item.constraints.length > 0 ? `constraints=${item.constraints.slice(0, 2).join(" / ")}` : "";
  return `${item.name} [${item.status}; ${holder}; ${item.narrativeFunction}] ${item.summary}${window ? ` | ${window}` : ""}${constraints ? ` | ${constraints}` : ""}`;
}

function buildResourceProposalLine(item: NonNullable<ChapterWriteContext["characterResourceContext"]>["pendingProposalItems"][number]): string {
  const evidence = item.evidence[0] ? ` | evidence=${item.evidence[0]}` : "";
  return `${item.summary} [risk=${item.riskLevel}; status=${item.status}]${evidence}`;
}

function buildCharacterResourceContextBlock(writeContext: ChapterWriteContext): string {
  const context = writeContext.characterResourceContext;
  if (!context) {
    return "";
  }
  return [
    `Resource ledger summary: ${context.summary}`,
    toListBlock("Available resources", context.availableItems.slice(0, 6).map(buildResourceItemLine)),
    toListBlock("Needs setup before use", context.setupNeededItems.slice(0, 5).map(buildResourceItemLine)),
    toListBlock("Unavailable or risky to reuse", context.blockedItems.slice(0, 5).map(buildResourceItemLine)),
    toListBlock("High-risk committed resources", context.highRiskCommittedItems.slice(0, 4).map(buildResourceItemLine)),
    toListBlock("Pending resource proposals (not committed)", context.pendingProposalItems.slice(0, 4).map(buildResourceProposalLine)),
    toListBlock("Resource risk signals", context.riskSignals.slice(0, 5).map((item) => `${item.severity}: ${item.summary}`)),
  ].filter(Boolean).join("\n");
}

function shouldIncludeCharacterDynamics(
  writeContext: ChapterWriteContext,
  mode: ChapterWriterBlockMode,
): boolean {
  if (mode === "incremental") {
    return writeContext.activeRelationStages.length > 0
      || writeContext.pendingCandidateGuards.length > 0;
  }
  if (mode === "repair") {
    return writeContext.characterBehaviorGuides.length > 0 || writeContext.activeRelationStages.length > 0;
  }
  return writeContext.characterBehaviorGuides.length > 0
    || writeContext.activeRelationStages.length > 0
    || writeContext.pendingCandidateGuards.length > 0;
}

function buildIncrementalRoundContextBlock(
  incrementalContext: ChapterWriterBlockOptions["incrementalContext"],
): PromptContextBlock | null {
  if (!incrementalContext) {
    return null;
  }
  const content = [
    incrementalContext.previousRoundSummary?.trim()
      ? `Previous round summary: ${incrementalContext.previousRoundSummary.trim()}`
      : "",
    incrementalContext.currentSceneProgress?.trim()
      ? `Current scene progress: ${incrementalContext.currentSceneProgress.trim()}`
      : "",
    incrementalContext.roundInstruction?.trim()
      ? `Current round instruction: ${incrementalContext.roundInstruction.trim()}`
      : "",
  ].filter(Boolean).join("\n");
  if (!content) {
    return null;
  }
  return createContextBlock({
    id: "incremental_round_context",
    group: "incremental_round_context",
    priority: 99,
    required: true,
    content,
  });
}

function buildChapterBoundaryContextBlock(writeContext: ChapterWriteContext): PromptContextBlock | null {
  const boundary = writeContext.chapterBoundary;
  if (!boundary) {
    return null;
  }
  return createContextBlock({
    id: "chapter_boundary",
    group: "chapter_boundary",
    priority: 99,
    required: true,
    allowSummary: false,
    content: [
      "Chapter boundary:",
      boundary.exclusiveEvent ? `Exclusive event: ${compactText(boundary.exclusiveEvent)}` : "",
      boundary.entryState ? `Entry state: ${compactText(boundary.entryState)}` : "",
      boundary.endingState ? `Ending state: ${compactText(boundary.endingState)}` : "",
      boundary.nextChapterEntryState ? `Next chapter entry state: ${compactText(boundary.nextChapterEntryState)}` : "",
      typeof boundary.allowedRevealLevel === "number" ? `Allowed reveal level: ${boundary.allowedRevealLevel}` : "",
      toListBlock("Do not cross", boundary.doNotCross ?? []),
      toListBlock("Protected reveals", boundary.protectedReveals ?? []),
    ].filter(Boolean).join("\n"),
  });
}

export function buildChapterWriterContextBlocks(
  writeContext: ChapterWriteContext,
  options: ChapterWriterBlockOptions = {},
): PromptContextBlock[] {
  writeContext = normalizeChapterWriteContext(writeContext);
  const lang = writeContext.promptLanguage;
  const none = pick(lang, "无", "không có", "none");
  const mode = options.mode ?? "full";
  const isIncremental = mode === "incremental";
  const includeVolumeWindow = mode === "full" || mode === "review";
  const includePayoffLedger = mode === "full" && hasLedgerPressure(writeContext);
  const includePayoffDirectives = writeContext.payoffDirectives.length > 0;
  const hasObligationContract = Object.values(writeContext.obligationContract).some((items) => items.length > 0);
  const includeCharacterResources = !isIncremental && hasCharacterResourcePressure(writeContext);
  const includeCharacterDynamics = shouldIncludeCharacterDynamics(writeContext, mode);
  const includeOpenConflicts = !isIncremental && writeContext.openConflictSummaries.length > 0;
  const includeRecentChapters = mode === "full" && writeContext.recentChapterSummaries.length > 0;
  const includeStyleContract = mode !== "incremental" && Boolean(writeContext.styleContract);
  const includeContinuationConstraints = mode === "full" && writeContext.continuationConstraints.length > 0;
  const wordRange = resolveTargetWordRange(writeContext.chapterMission.targetWordCount);
  const blocks: Array<PromptContextBlock | null> = [
    writeContext.productionFoundationPrompt
      ? createContextBlock({
        id: "production_foundation",
        group: "production_foundation",
        priority: 100,
        required: true,
        allowSummary: false,
        content: [
          pick(
            lang,
            "本书创作底座（正文、验收与修复必须共同遵守）：",
            "Nền tảng sáng tác của sách này (chính văn, nghiệm thu và sửa chữa đều phải tuân thủ):",
            "This book's creative foundation (prose, review, and repair must all follow it):",
          ),
          writeContext.productionFoundationPrompt,
        ].join("\n"),
      })
      : null,
    createContextBlock({
      id: "chapter_mission",
      group: "chapter_mission",
      priority: 100,
      required: true,
      content: [
        `${pick(lang, "章节任务：", "Nhiệm vụ chương: ", "Chapter mission: ")}${writeContext.chapterMission.title}`,
        `${pick(lang, "目标：", "Mục tiêu: ", "Objective: ")}${writeContext.chapterMission.objective}`,
        `${pick(lang, "预期效果：", "Hiệu quả kỳ vọng: ", "Expected effect: ")}${writeContext.chapterMission.expectation}`,
        `${pick(lang, "状态驱动的下一步动作：", "Hành động kế tiếp do trạng thái quyết định: ", "State-driven next action: ")}${writeContext.nextAction}`,
        writeContext.chapterMission.planRole ? `${pick(lang, "计划角色：", "Vai trong kế hoạch: ", "Plan role: ")}${writeContext.chapterMission.planRole}` : "",
        wordRange.targetWordCount != null
          ? pick(
            lang,
            `目标篇幅：约 ${wordRange.targetWordCount} 个中文字符（可接受范围 ${wordRange.minWordCount}-${wordRange.maxWordCount}；不要明显低于最低值）。`,
            `Độ dài mục tiêu: khoảng ${wordRange.targetWordCount} từ (khoảng chấp nhận ${wordRange.minWordCount}-${wordRange.maxWordCount}; đừng thấp hơn hẳn mức tối thiểu).`,
            `Target length: about ${wordRange.targetWordCount} words (acceptable range ${wordRange.minWordCount}-${wordRange.maxWordCount}; do not fall clearly below the minimum).`,
          )
          : "",
        writeContext.completedMilestones.length > 0
          ? toListBlock(
            pick(lang, "已完成事项（不得重复追求或重新触发）", "Việc đã hoàn thành (không được đuổi theo lại hoặc kích hoạt lại)", "Completed items (do not pursue or re-trigger again)"),
            writeContext.completedMilestones,
            none,
          )
          : "",
        toListBlock(pick(lang, "必须推进", "Bắt buộc đẩy tới", "Must advance"), writeContext.chapterMission.mustAdvance, none),
        toListBlock(pick(lang, "必须保留", "Bắt buộc giữ lại", "Must preserve"), writeContext.chapterMission.mustPreserve, none),
        toListBlock(pick(lang, "风险提示", "Cảnh báo rủi ro", "Risk notes"), writeContext.chapterMission.riskNotes, none),
        writeContext.chapterMission.taskSheet
          ? `${pick(lang, "原始任务单：", "Bảng nhiệm vụ gốc: ", "Original task sheet: ")}\n${writeContext.chapterMission.taskSheet}`
          : "",
        writeContext.chapterMission.hookTarget ? `${pick(lang, "章末钩子：", "Hook cuối chương: ", "End-of-chapter hook: ")}${writeContext.chapterMission.hookTarget}` : "",
      ].filter(Boolean).join("\n"),
    }),
    writeContext.previousChapterTail
      ? createContextBlock({
        id: "previous_chapter_tail",
        group: "previous_chapter_tail",
        priority: 100,
        required: true,
        allowSummary: false,
        content: [
          pick(
            lang,
            "上一章实际尾段（本章开头必须直接承接这里的时间、地点、人物状态和未兑现动作）：",
            "Đoạn kết thực tế của chương trước (đầu chương này phải nối thẳng thời gian, địa điểm, trạng thái nhân vật và hành động chưa tất toán ở đây):",
            "The previous chapter's actual tail (this chapter's opening must directly continue its time, place, character states, and unresolved actions):",
          ),
          writeContext.previousChapterTail,
        ].join("\n"),
      })
      : null,
    createContextBlock({
      id: "reader_experience",
      group: "reader_experience",
      priority: 100,
      required: true,
      allowSummary: false,
      content: [
        pick(
          lang,
          "读者体验合同（本章正文、验收与修复共用）：",
          "Hợp đồng trải nghiệm người đọc (dùng chung cho chính văn, nghiệm thu và sửa chữa chương này):",
          "Reader experience contract (shared by this chapter's prose, review, and repair):",
        ),
        `${pick(lang, "读者核心问题：", "Câu hỏi cốt lõi của người đọc: ", "Reader's core question: ")}${writeContext.readerExperience.readerQuestion}`,
        `${pick(lang, "本章可见回报：", "Phần thưởng nhìn thấy được ở chương này: ", "Visible reward this chapter: ")}${writeContext.readerExperience.promisedReward}`,
        `${pick(lang, "回报级别：", "Cấp độ phần thưởng: ", "Reward level: ")}${writeContext.readerExperience.rewardLevel}`,
        `${pick(lang, "主角即时欲望：", "Khát khao tức thời của nhân vật chính: ", "Protagonist's immediate want: ")}${writeContext.readerExperience.protagonistWant}`,
        `${pick(lang, "主要阻力：", "Trở lực chính: ", "Primary resistance: ")}${writeContext.readerExperience.primaryResistance}`,
        `${pick(lang, "关键转折：", "Chuyển biến then chốt: ", "Key turn: ")}${writeContext.readerExperience.keyTurn}`,
        `${pick(lang, "情绪位移：", "Dịch chuyển cảm xúc: ", "Emotional shift: ")}${writeContext.readerExperience.emotionalShift}`,
        `${pick(lang, "信息交付：", "Giao thông tin: ", "Information delivered: ")}${writeContext.readerExperience.informationReveal}`,
        `${pick(lang, "章末净变化：", "Thay đổi ròng cuối chương: ", "Net change at chapter end: ")}${writeContext.readerExperience.netChange}`,
        toListBlock(
          pick(lang, "继承的钩子责任（优先回应后再制造新问题）", "Trách nhiệm hook kế thừa (hồi đáp trước rồi mới tạo câu hỏi mới)", "Inherited hook responsibilities (answer first, then raise new questions)"),
          writeContext.readerExperience.inheritedHookResponsibilities,
          pick(lang, "无明确旧钩子责任", "không có trách nhiệm hook cũ rõ ràng", "no explicit prior hook responsibility"),
        ),
        `${pick(lang, "章末追读钩子：", "Hook giữ chân người đọc cuối chương: ", "End-of-chapter read-on hook: ")}${writeContext.readerExperience.endingHook}`,
      ].join("\n"),
    }),
    hasObligationContract
      ? createContextBlock({
        id: "obligation_contract",
        group: "obligation_contract",
        priority: 99,
        required: true,
        allowSummary: false,
        content: [
          `${pick(lang, "章节执行义务", "Nghĩa vụ thực thi chương", "Chapter execution obligations")}:`,
          toListBlock(pick(lang, "本章必须命中", "Chương này bắt buộc chạm tới", "Must hit this chapter"), writeContext.obligationContract.mustHitNow, none),
          toListBlock(pick(lang, "必须保留", "Bắt buộc giữ lại", "Must preserve"), writeContext.obligationContract.mustPreserve, none),
          toListBlock(pick(lang, "必须触碰的伏笔", "Mồi cài bắt buộc phải chạm", "Foreshadowing that must be touched"), writeContext.obligationContract.requiredPayoffTouches, none),
          toListBlock(pick(lang, "必须出场的角色", "Nhân vật bắt buộc xuất hiện", "Characters that must appear"), writeContext.obligationContract.requiredCharacterAppearances, none),
          toListBlock(pick(lang, "必须变化的目标", "Mục tiêu bắt buộc phải thay đổi", "Goals that must change"), writeContext.obligationContract.requiredGoalChanges, none),
          toListBlock(pick(lang, "可延后处理", "Có thể xử lý sau", "Can be deferred"), writeContext.obligationContract.canDefer, none),
          toListBlock(pick(lang, "禁止越界", "Cấm vượt ranh giới", "Forbidden crossings"), writeContext.obligationContract.forbiddenCrossings, none),
        ].filter(Boolean).join("\n"),
      })
      : null,
    includePayoffDirectives
      ? createContextBlock({
        id: "payoff_directives",
        group: "payoff_directives",
        priority: 98,
        required: true,
        allowSummary: false,
        content: [
          "Payoff directives:",
          ...writeContext.payoffDirectives.map((item) => [
            `- ${item.title} [${item.operation}]`,
            item.ledgerKey ? `ledger=${item.ledgerKey}` : "",
            item.reason ? `reason=${item.reason}` : "",
            item.forbiddenReveal ? `forbiddenReveal=${item.forbiddenReveal}` : "",
          ].filter(Boolean).join(" | ")),
        ].join("\n"),
      })
      : null,
    createContextBlock({
      id: "state_goal",
      group: "state_goal",
      priority: 97,
      required: Boolean(writeContext.chapterStateGoal),
      content: writeContext.chapterStateGoal
        ? [
             `State goal: ${writeContext.chapterStateGoal.summary}`,
             toListBlock("Target conflicts", writeContext.chapterStateGoal.targetConflicts),
             toListBlock("Target relationships", writeContext.chapterStateGoal.targetRelationships),
             toListBlock("Protected secrets", writeContext.protectedSecrets),
           ].filter(Boolean).join("\n")
        : "",
    }),
    buildIncrementalRoundContextBlock(options.incrementalContext),
    includeVolumeWindow
      ? createContextBlock({
        id: "volume_window",
        group: "volume_window",
        priority: 96,
        content: writeContext.volumeWindow
          ? [
              `Current volume: ${writeContext.volumeWindow.title}`,
              `Volume mission: ${writeContext.volumeWindow.missionSummary}`,
              writeContext.volumeWindow.coreReward
                ? `Current volume reader reward: ${writeContext.volumeWindow.coreReward}`
                : "",
              writeContext.volumeWindow.readerRewardLadder
                ? `Book reader reward ladder: ${writeContext.volumeWindow.readerRewardLadder}`
                : "",
              toListBlock("Current volume pending payoffs", writeContext.volumeWindow.pendingPayoffs.slice(0, 3)),
              writeContext.volumeWindow.keyMilestoneGuards.length > 0
                ? toListBlock(
                  "Volume key milestone guards — pacing constraints",
                  writeContext.volumeWindow.keyMilestoneGuards
                    .filter((guard) => guard.status !== "done")
                    .map((guard) => `[${guard.targetChapterRange}] ${guard.event}: ${guard.note}`),
                )
                : "",
            ].filter(Boolean).join("\n")
          : "Current volume: none",
      })
      : null,
    writeContext.narrativeProgressHint
      ? createContextBlock({
        id: "narrative_progress_hint",
        group: "narrative_progress_hint",
        priority: 98,
        required: false,
        content: writeContext.narrativeProgressHint,
      })
      : null,
    includePayoffLedger
      ? createContextBlock({
        id: "payoff_ledger",
        group: "payoff_ledger",
        priority: 95,
        content: [
          writeContext.ledgerSummary
            ? `Payoff ledger summary: pending=${writeContext.ledgerSummary.pendingCount}, urgent=${writeContext.ledgerSummary.urgentCount}, overdue=${writeContext.ledgerSummary.overdueCount}`
            : "Payoff ledger summary: none",
          toListBlock("Urgent payoffs", writeContext.ledgerUrgentItems.map((item) => buildLedgerItemLine(item, "urgent"))),
          toListBlock("Overdue payoffs", writeContext.ledgerOverdueItems.map((item) => buildLedgerItemLine(item, "overdue"))),
          toListBlock(
            "Active pending payoffs",
            writeContext.ledgerPendingItems.slice(0, 3).map((item) => buildLedgerItemLine(item, "pending")),
          ),
        ].join("\n"),
      })
      : null,
    createContextBlock({
      id: "character_hard_facts",
      group: "character_hard_facts",
      priority: 99,
      required: true,
      allowSummary: false,
      content: buildCharacterHardFactsText(writeContext),
    }),
    createContextBlock({
      id: "participant_subset",
      group: "participant_subset",
      priority: 92,
      required: true,
      content: buildParticipantText(writeContext),
    }),
    includeCharacterDynamics
      ? createContextBlock({
        id: "character_dynamics",
        group: "character_dynamics",
        priority: 91,
        content: [
          buildCharacterGuidanceText(writeContext),
          buildRelationStageText(writeContext),
          buildPendingCandidateGuardText(writeContext),
        ].join("\n\n"),
      })
      : null,
    includeCharacterResources
      ? createContextBlock({
        id: "character_resource_context",
        group: "character_resource_context",
        priority: 90,
        required: mode === "review" || mode === "repair",
        content: buildCharacterResourceContextBlock(writeContext),
      })
      : null,
    createContextBlock({
      id: "local_state",
      group: "local_state",
      priority: 89,
      required: true,
      content: `${pick(lang, "写作前当前局面", "Cục diện hiện tại trước khi viết", "Current situation before writing")}:\n${writeContext.localStateSummary}`,
    }),
    includeOpenConflicts
      ? createContextBlock({
        id: "open_conflicts",
        group: "open_conflicts",
        priority: 88,
        content: toListBlock("Open conflicts", writeContext.openConflictSummaries.slice(0, 6)),
      })
      : null,
    includeRecentChapters
      ? createContextBlock({
        id: "recent_chapters",
        group: "recent_chapters",
        priority: 86,
        content: toListBlock("Recent chapter summaries", writeContext.recentChapterSummaries),
      })
      : null,
    mode === "full"
      ? createContextBlock({
        id: "opening_constraints",
        group: "opening_constraints",
        priority: 80,
        content: [
          `Opening anti-repeat hint:\n${writeContext.openingAntiRepeatHint}`,
          writeContext.recentScenePatterns.length > 0
            ? toListBlock(
              "Scene pattern blacklist — do NOT repeat these exact time+location+action combinations",
              writeContext.recentScenePatterns.slice(0, 6),
            )
            : "",
        ].filter(Boolean).join("\n\n"),
      })
      : null,
    includeStyleContract
      ? createContextBlock({
        id: "style_contract",
        group: "style_contract",
        priority: 74,
        required: mode === "full",
        content: buildWriterStyleContractText(writeContext.styleContract),
      })
      : null,
    includeContinuationConstraints
      ? createContextBlock({
        id: "continuation_constraints",
        group: "continuation_constraints",
        priority: 74,
        required: mode === "full",
        allowSummary: false,
        content: toListBlock("Continuation constraints", writeContext.continuationConstraints),
      })
      : null,
  ];
  return blocks.filter((block): block is PromptContextBlock => block !== null && block.content.trim().length > 0);
}

export function buildChapterReviewContextBlocks(reviewContext: ChapterReviewContext): PromptContextBlock[] {
  return [
    ...buildChapterWriterContextBlocks(reviewContext, { mode: "review" }),
    buildChapterBoundaryContextBlock(reviewContext),
    createContextBlock({
      id: "structure_obligations",
      group: "structure_obligations",
      priority: 94,
      required: true,
      content: toListBlock("Structure obligations", reviewContext.structureObligations),
    }),
    createContextBlock({
      id: "world_rules",
      group: "world_rules",
      priority: 84,
      content: toListBlock("Relevant world rules", reviewContext.worldRules),
    }),
    createContextBlock({
      id: "historical_issues",
      group: "historical_issues",
      priority: 82,
      content: toListBlock("Historical unresolved issues", reviewContext.historicalIssues),
    }),
  ].filter((block): block is PromptContextBlock => block !== null && block.content.trim().length > 0);
}

export function buildChapterRepairContextBlocks(repairContext: ChapterRepairContext): PromptContextBlock[] {
  return [
    ...buildChapterWriterContextBlocks(repairContext.writeContext, { mode: "repair" }),
    createContextBlock({
      id: "repair_issues",
      group: "repair_issues",
      priority: 100,
      required: true,
      content: repairContext.issues.length > 0
        ? [
            "Repair issues:",
            ...repairContext.issues.map((issue) => (
              `- ${issue.severity}/${issue.category}: ${issue.evidence} | fix: ${issue.fixSuggestion}`
            )),
          ].join("\n")
        : "Repair issues: none",
    }),
    buildChapterBoundaryContextBlock(repairContext.writeContext),
    createContextBlock({
      id: "structure_obligations",
      group: "structure_obligations",
      priority: 95,
      required: true,
      content: toListBlock("Structure obligations", repairContext.structureObligations),
    }),
    createContextBlock({
      id: "repair_boundaries",
      group: "repair_boundaries",
      priority: 96,
      required: true,
      content: toListBlock("Allowed edit boundaries", repairContext.allowedEditBoundaries),
    }),
    createContextBlock({
      id: "world_rules",
      group: "world_rules",
      priority: 84,
      content: toListBlock("Relevant world rules", repairContext.worldRules),
    }),
    createContextBlock({
      id: "historical_issues",
      group: "historical_issues",
      priority: 82,
      content: toListBlock("Historical unresolved issues", repairContext.historicalIssues),
    }),
  ].filter((block): block is PromptContextBlock => block !== null && block.content.trim().length > 0);
}
