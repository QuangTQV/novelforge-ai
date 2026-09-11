import type {
  BookContractContext,
  ChapterWriteContext,
  GenerationContextPackage,
  MacroConstraintContext,
} from "@ai-novel/shared/types/chapterRuntime";
import { resolveLengthBudgetContract } from "@ai-novel/shared/types/chapterLengthControl";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { buildPlannerStyleContractSummaryText } from "../../../services/styleEngine/styleContractText";

/**
 * Every helper here renders *derived* context straight into the chapter
 * writer / review / repair prompt. The label text must follow the novel's
 * output language (carried on `ChapterWriteContext.promptLanguage`) so a
 * Vietnamese novel does not get a Vietnamese/Chinese mixed prompt.
 */
function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") {
    return vi;
  }
  if (lang === "en") {
    return en;
  }
  return zh;
}

export function compactText(value: string | null | undefined, fallback = ""): string {
  return value?.replace(/\s+/g, " ").trim() || fallback;
}

export function takeUnique(items: Array<string | null | undefined>, limit = items.length): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const item of items) {
    const normalized = compactText(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

export function splitLines(value: string | null | undefined, limit = 4): string[] {
  return takeUnique(
    (value ?? "")
      .split(/\r?\n+/g)
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim()),
    limit,
  );
}

export function toListBlock(title: string, values: string[], emptyLabel = "none"): string {
  if (values.length === 0) {
    return `${title}: ${emptyLabel}`;
  }
  return [title, ...values.map((value) => `- ${value}`)].join("\n");
}

function displayPromptValue(
  value: string | null | undefined,
  lang: PromptLanguage,
  fallback = pick(lang, "未指定", "chưa xác định", "not specified"),
): string {
  const normalized = compactText(value);
  const labels: Record<string, string> = {
    unknown: fallback,
    "not specified": fallback,
    none: pick(lang, "无", "không có", "none"),
    first_person: pick(lang, "第一人称", "ngôi thứ nhất", "first person"),
    third_person: pick(lang, "第三人称", "ngôi thứ ba", "third person"),
    omniscient: pick(lang, "全知视角", "góc nhìn toàn tri", "omniscient"),
    fast: pick(lang, "快节奏", "nhịp nhanh", "fast pace"),
    balanced: pick(lang, "均衡节奏", "nhịp cân bằng", "balanced pace"),
    slow: pick(lang, "慢节奏", "nhịp chậm", "slow pace"),
    low: pick(lang, "低", "thấp", "low"),
    medium: pick(lang, "中", "trung bình", "medium"),
    high: pick(lang, "高", "cao", "high"),
  };
  return labels[normalized] ?? (normalized || fallback);
}

export function renderBookContractText(contract: BookContractContext, lang: PromptLanguage = "zh"): string {
  const dv = (value: string | null | undefined): string => displayPromptValue(value, lang);
  const undecided = pick(lang, "未定", "chưa định", "TBD");
  const targetWord = pick(lang, "目标", "mục tiêu", "target");
  return [
    `${pick(lang, "标题：", "Tiêu đề: ", "Title: ")}${dv(contract.title)}`,
    `${pick(lang, "题材：", "Thể loại: ", "Genre: ")}${dv(contract.genre)}`,
    `${pick(lang, "目标读者：", "Độc giả mục tiêu: ", "Target audience: ")}${dv(contract.targetAudience)}`,
    `${pick(lang, "核心卖点：", "Điểm bán cốt lõi: ", "Core selling point: ")}${dv(contract.sellingPoint)}`,
    `${contract.promiseScope === "whole_book"
      ? pick(lang, "全书核心承诺：", "Cam kết cốt lõi toàn sách: ", "Whole-book core promise: ")
      : pick(lang, "前 30 章承诺：", "Cam kết 30 chương đầu: ", "First-30-chapter promise: ")}${dv(contract.first30ChapterPromise)}`,
    contract.completionMode === "compact_book"
      ? pick(
        lang,
        `紧凑全书合同：目标 ${contract.targetChapterCount ?? "未定"} 章，结局最迟第 ${contract.endingRequiredBy ?? "目标"} 章完成；终章不得开启必须续写的新主线。`,
        `Hợp đồng sách gọn: mục tiêu ${contract.targetChapterCount ?? undecided} chương, hồi kết phải hoàn tất chậm nhất ở chương ${contract.endingRequiredBy ?? targetWord}; chương cuối không được mở tuyến chính mới bắt buộc viết tiếp.`,
        `Compact whole-book contract: target ${contract.targetChapterCount ?? undecided} chapters, ending must land by chapter ${contract.endingRequiredBy ?? targetWord}; the final chapter must not open a new main line that requires a sequel.`,
      )
      : "",
    contract.readingPromise ? `${pick(lang, "阅读承诺：", "Cam kết trải nghiệm đọc: ", "Reading promise: ")}${dv(contract.readingPromise)}` : "",
    contract.protagonistFantasy ? `${pick(lang, "主角幻想：", "Ảo tưởng nhân vật chính: ", "Protagonist fantasy: ")}${dv(contract.protagonistFantasy)}` : "",
    contract.coreSellingPoint ? `${pick(lang, "合同核心卖点：", "Điểm bán cốt lõi của hợp đồng: ", "Contract core selling point: ")}${dv(contract.coreSellingPoint)}` : "",
    contract.chapter3Payoff ? `${pick(lang, "第 3 章兑现：", "Tất toán chương 3: ", "Chapter 3 payoff: ")}${dv(contract.chapter3Payoff)}` : "",
    contract.chapter10Payoff ? `${pick(lang, "第 10 章兑现：", "Tất toán chương 10: ", "Chapter 10 payoff: ")}${dv(contract.chapter10Payoff)}` : "",
    contract.chapter30Payoff ? `${pick(lang, "第 30 章兑现：", "Tất toán chương 30: ", "Chapter 30 payoff: ")}${dv(contract.chapter30Payoff)}` : "",
    contract.escalationLadder ? `${pick(lang, "升级阶梯：", "Thang leo thang: ", "Escalation ladder: ")}${dv(contract.escalationLadder)}` : "",
    contract.relationshipMainline ? `${pick(lang, "关系主线：", "Tuyến quan hệ chính: ", "Relationship main line: ")}${dv(contract.relationshipMainline)}` : "",
    (contract.activeMilestonePayoffs?.length ?? 0) > 0
      ? `${pick(lang, "当前阶段必须关注的兑现：", "Các cú tất toán phải chú ý ở giai đoạn này: ", "Payoffs to watch in the current stage: ")}${contract.activeMilestonePayoffs.join(" | ")}`
      : "",
    `${pick(lang, "叙事视角：", "Góc nhìn trần thuật: ", "Narrative POV: ")}${dv(contract.narrativePov)}`,
    `${pick(lang, "节奏偏好：", "Nhịp ưa thích: ", "Pace preference: ")}${dv(contract.pacePreference)}`,
    `${pick(lang, "情绪强度：", "Cường độ cảm xúc: ", "Emotion intensity: ")}${dv(contract.emotionIntensity)}`,
    contract.toneGuardrails.length > 0 ? `${pick(lang, "语气护栏：", "Rào chắn giọng văn: ", "Tone guardrails: ")}${contract.toneGuardrails.join(" | ")}` : "",
    contract.hardConstraints.length > 0 ? `${pick(lang, "硬性约束：", "Ràng buộc cứng: ", "Hard constraints: ")}${contract.hardConstraints.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

export function renderStoryMacroText(macro: MacroConstraintContext, lang: PromptLanguage = "zh"): string {
  const dv = (value: string | null | undefined): string => displayPromptValue(value, lang);
  return [
    `${pick(lang, "核心卖点：", "Điểm bán cốt lõi: ", "Core selling point: ")}${dv(macro.sellingPoint)}`,
    `${pick(lang, "核心冲突：", "Xung đột cốt lõi: ", "Core conflict: ")}${dv(macro.coreConflict)}`,
    `${pick(lang, "主钩子：", "Hook chính: ", "Main hook: ")}${dv(macro.mainHook)}`,
    `${pick(lang, "推进循环：", "Vòng lặp đẩy truyện: ", "Progression loop: ")}${dv(macro.progressionLoop)}`,
    `${pick(lang, "成长路径：", "Lộ trình trưởng thành: ", "Growth path: ")}${dv(macro.growthPath)}`,
    `${pick(lang, "结局味道：", "Dư vị hồi kết: ", "Ending flavor: ")}${dv(macro.endingFlavor)}`,
    macro.hardConstraints.length > 0 ? `${pick(lang, "硬性约束：", "Ràng buộc cứng: ", "Hard constraints: ")}${macro.hardConstraints.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

export function resolveTargetWordRange(targetWordCount: number | null | undefined): {
  targetWordCount: number | null;
  minWordCount: number | null;
  maxWordCount: number | null;
} {
  const budget = resolveLengthBudgetContract(targetWordCount);
  if (!budget) {
    return {
      targetWordCount: null,
      minWordCount: null,
      maxWordCount: null,
    };
  }
  return {
    targetWordCount: budget.targetWordCount,
    minWordCount: budget.softMinWordCount,
    maxWordCount: budget.softMaxWordCount,
  };
}

export function summarizeStateSnapshot(
  contextPackage: GenerationContextPackage,
  lang: PromptLanguage = "zh",
): string {
  const goalLabel = pick(lang, "目标：", "mục tiêu: ", "goal: ");
  const stateLabel = pick(lang, "状态：", "trạng thái: ", "state: ");
  const emotionLabel = pick(lang, "情绪：", "cảm xúc: ", "emotion: ");
  const readerKnows = pick(lang, "（读者已知）", " (người đọc đã biết)", " (reader knows)");
  const unnamed = pick(lang, "未命名角色", "nhân vật chưa đặt tên", "unnamed character");
  if (contextPackage.canonicalState) {
    const snapshot = contextPackage.canonicalState;
    const fragments = takeUnique([
      snapshot.narrative.currentChapterGoal,
      ...snapshot.characters
        .slice(0, 3)
        .map((state) => {
          const parts = takeUnique([
            state.currentGoal ? `${goalLabel}${state.currentGoal}` : "",
            state.currentState ? `${stateLabel}${state.currentState}` : "",
            state.emotion ? `${emotionLabel}${state.emotion}` : "",
            state.summary,
          ]);
          if (parts.length === 0) {
            return "";
          }
          return `${state.name}: ${parts.join(" | ")}`;
        }),
      ...snapshot.narrative.publicKnowledge
        .slice(0, 2)
        .map((fact) => `${fact}${readerKnows}`),
    ], 6);
    return fragments.join("\n") || pick(
      lang,
      "暂无上一轮权威状态快照。",
      "Chưa có snapshot trạng thái chính thức của vòng trước.",
      "No authoritative state snapshot from the previous round yet.",
    );
  }

  const characterNameById = new Map(
    contextPackage.characterRoster.map((character) => [character.id, character.name.trim() || unnamed]),
  );
  const fragments = takeUnique([
    contextPackage.stateSnapshot?.summary,
    ...contextPackage.stateSnapshot?.characterStates
      .slice(0, 3)
      .map((state) => {
        const parts = takeUnique([
          state.currentGoal ? `${goalLabel}${state.currentGoal}` : "",
          state.emotion ? `${emotionLabel}${state.emotion}` : "",
          state.summary ? `${stateLabel}${state.summary}` : "",
        ]);
        if (parts.length === 0) {
          return "";
        }
        const characterName = characterNameById.get(state.characterId) ?? unnamed;
        return `${characterName}${pick(lang, "：", ": ", ": ")}${parts.join(" | ")}`;
      }) ?? [],
    ...contextPackage.stateSnapshot?.informationStates
      .slice(0, 2)
      .map((info) => `${info.fact}${pick(lang, `（状态：${info.status}）`, ` (trạng thái: ${info.status})`, ` (status: ${info.status})`)}`) ?? [],
  ], 6);
  return fragments.join("\n") || pick(
    lang,
    "暂无上一轮状态快照。",
    "Chưa có snapshot trạng thái của vòng trước.",
    "No state snapshot from the previous round yet.",
  );
}

export function summarizeOpenConflicts(contextPackage: GenerationContextPackage): string[] {
  if (contextPackage.canonicalState) {
    return contextPackage.canonicalState.narrative.openConflicts
      .slice(0, 4)
      .map((conflict) => {
        const parts = takeUnique([
          conflict.title,
          conflict.summary,
          conflict.resolutionHint ? `resolution hint: ${conflict.resolutionHint}` : "",
        ], 3);
        return parts.join(" | ");
      })
      .filter(Boolean);
  }

  return contextPackage.openConflicts
    .slice(0, 4)
    .map((conflict) => {
      const parts = takeUnique([
        conflict.title,
        conflict.summary,
        conflict.resolutionHint ? `resolution hint: ${conflict.resolutionHint}` : "",
      ], 3);
      return parts.join(" | ");
    })
    .filter(Boolean);
}

export function summarizeWorldRules(
  contextPackage: GenerationContextPackage,
  lang: PromptLanguage = "zh",
): string[] {
  const worldSlice = contextPackage.storyWorldSlice;
  if (worldSlice) {
    return takeUnique([
      worldSlice.coreWorldFrame,
      ...worldSlice.appliedRules.slice(0, 3).map((rule) => `${rule.name}: ${rule.summary}`),
      ...worldSlice.forbiddenCombinations.slice(0, 2),
      worldSlice.storyScopeBoundary,
    ], 6);
  }

  if (!contextPackage.canonicalState?.worldState) {
    return [];
  }
  const world = contextPackage.canonicalState.worldState;
  const continuityRecord = pick(lang, "连续性记录：", "Ghi nhận tính liên tục: ", "Continuity record: ");
  const ruleRecord = pick(lang, "连续性规则记录：", "Ghi nhận luật liên tục: ", "Continuity rule record: ");
  const tabooRecord = pick(lang, "连续性禁忌记录：", "Ghi nhận điều cấm kỵ liên tục: ", "Continuity taboo record: ");
  const worldStateRecord = pick(lang, "当前世界状态记录：", "Ghi nhận trạng thái thế giới hiện tại: ", "Current world-state record: ");
  return takeUnique([
    world.summary ? `${continuityRecord}${world.summary}` : "",
    ...world.rules.slice(0, 3).map((rule) => `${ruleRecord}${rule}`),
    ...world.tabooRules.slice(0, 2).map((rule) => `${tabooRecord}${rule}`),
    world.currentSituation ? `${worldStateRecord}${world.currentSituation}` : "",
  ], 6);
}

export function summarizeHistoricalIssues(contextPackage: GenerationContextPackage): string[] {
  return contextPackage.openAuditIssues
    .slice(0, 4)
    .map((issue) => `${issue.severity}/${issue.auditType}: ${issue.description}`)
    .filter(Boolean);
}

export function summarizeStyleConstraints(contextPackage: GenerationContextPackage): string[] {
  const contract = contextPackage.styleContext?.compiledBlocks?.contract;
  if (!contract) {
    return [];
  }
  return takeUnique(
    buildPlannerStyleContractSummaryText(contract)
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean),
    8,
  );
}

export function summarizeContinuationConstraints(
  contextPackage: GenerationContextPackage,
  lang: PromptLanguage = "zh",
): string[] {
  if (!contextPackage.continuation.enabled) {
    return [];
  }
  // NOTE: the section labels below match the upstream continuation `humanBlock`,
  // which is still authored in Chinese — localizing them here would break the
  // parse. Only the derived output prefix follows `lang`.
  const humanBlock = contextPackage.continuation.humanBlock ?? "";
  const sourceLine = takeUnique([
    findInlineValue(humanBlock, "续写来源"),
    findInlineValue(humanBlock, "前作标题"),
    findInlineValue(humanBlock, "知识库文档标题"),
    findInlineValue(humanBlock, "拆书分析"),
  ], 4);
  const sectionLines = [
    ...extractContinuationSectionLines(humanBlock, "前作核心角色状态", 3),
    ...extractContinuationSectionLines(humanBlock, "前作终局章节摘要", 3),
    ...extractContinuationSectionLines(humanBlock, "前作关键事实", 3),
    ...extractContinuationSectionLines(humanBlock, "前作未完线索", 3),
    ...extractContinuationSectionLines(humanBlock, "可承接信息摘要", 4),
  ];
  return takeUnique([
    compactText(contextPackage.continuation.systemRule),
    sourceLine.length > 0
      ? `${pick(lang, "续写来源约束：", "Ràng buộc nguồn viết tiếp: ", "Continuation source constraint: ")}${sourceLine.join(" / ")}`
      : "",
    ...sectionLines,
  ], 12);
}

function findInlineValue(source: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^${escaped}[：:]\\s*(.+)$`, "m"));
  return compactText(match?.[1]);
}

function extractContinuationSectionLines(source: string, sectionLabel: string, limit: number): string[] {
  const normalizedLabel = sectionLabel.replace(/[（(].*$/, "");
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const results: string[] = [];
  let collecting = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (collecting && results.length > 0) {
        break;
      }
      continue;
    }
    if (line.startsWith(sectionLabel) || line.startsWith(normalizedLabel)) {
      collecting = true;
      const inlineValue = line.replace(/^.*?[：:]\s*/, "").trim();
      if (inlineValue && inlineValue !== line) {
        results.push(`${normalizedLabel}：${inlineValue}`);
      }
      continue;
    }
    if (collecting && /^[^：:\n]{2,32}[：:]$/.test(line)) {
      break;
    }
    if (!collecting) {
      continue;
    }
    const cleaned = compactText(line.replace(/^[-*•\d.、\s]+/, ""));
    if (cleaned) {
      results.push(`${normalizedLabel}：${cleaned}`);
    }
    if (results.length >= limit) {
      break;
    }
  }
  return takeUnique(results, limit);
}

function formatLedgerWindow(start: number | null | undefined, end: number | null | undefined, lang: PromptLanguage): string {
  if (typeof start === "number" && typeof end === "number") {
    return pick(lang, `目标窗口=${start}-${end}`, `cửa sổ mục tiêu=${start}-${end}`, `target window=${start}-${end}`);
  }
  if (typeof end === "number") {
    return pick(lang, `目标窗口截止第${end}章`, `cửa sổ mục tiêu đến chương ${end}`, `target window ends at chapter ${end}`);
  }
  if (typeof start === "number") {
    return pick(lang, `目标窗口起于第${start}章`, `cửa sổ mục tiêu bắt đầu từ chương ${start}`, `target window starts at chapter ${start}`);
  }
  return "";
}

export function buildLedgerItemLine(
  item: GenerationContextPackage["ledgerPendingItems"][number],
  label: string,
  lang: PromptLanguage = "zh",
): string {
  return takeUnique([
    `${label}: ${item.title}`,
    item.summary,
    formatLedgerWindow(item.targetStartChapterOrder, item.targetEndChapterOrder, lang),
    item.statusReason ?? "",
  ], 4).join(" | ");
}

export function buildParticipantText(writeContext: ChapterWriteContext): string {
  const lang = writeContext.promptLanguage;
  const none = pick(lang, "无", "không có", "none");
  if (writeContext.participants.length === 0) {
    return `${pick(lang, "出场角色", "Nhân vật xuất hiện", "Participants")}: ${none}`;
  }
  const authorInfluenceLabel = pick(
    lang,
    "角色对话后确认的软性行为倾向（非客观事实）：",
    "Xu hướng hành vi mềm đã xác nhận sau đối thoại nhân vật (không phải sự thật khách quan): ",
    "Soft behavioral tendency confirmed after character dialogue (not objective fact): ",
  );
  const absenceRiskLabel = (risk: string, span: number): string => pick(
    lang,
    `缺席风险：${risk}（跨度 ${span}）`,
    `Rủi ro vắng mặt: ${risk} (khoảng ${span})`,
    `Absence risk: ${risk} (span ${span})`,
  );
  const guideByCharacterId = new Map(
    writeContext.characterBehaviorGuides.map((guide) => [guide.characterId, guide]),
  );
  return [
    `${pick(lang, "出场角色", "Nhân vật xuất hiện", "Participants")}:`,
    ...writeContext.participants.map((character) => {
      const guide = guideByCharacterId.get(character.id);
      const visibleProfile = takeUnique([
        character.appearance || character.physique
          ? `${pick(lang, "外观：", "Ngoại hình: ", "Appearance: ")}${compactText([character.appearance, character.physique].filter(Boolean).join(pick(lang, "；", "; ", "; ")))}`
          : "",
        character.attireStyle ? `${pick(lang, "常见穿着：", "Trang phục thường thấy: ", "Usual attire: ")}${compactText(character.attireStyle)}` : "",
        character.signatureDetail ? `${pick(lang, "标志细节：", "Chi tiết đặc trưng: ", "Signature detail: ")}${compactText(character.signatureDetail)}` : "",
        character.voiceTexture ? `${pick(lang, "声音：", "Giọng nói: ", "Voice: ")}${compactText(character.voiceTexture)}` : "",
        character.presenceImpression ? `${pick(lang, "登场印象：", "Ấn tượng khi xuất hiện: ", "Presence impression: ")}${compactText(character.presenceImpression)}` : "",
      ], 3).join(" | ");
      const parts = takeUnique([
        character.role,
        visibleProfile,
        guide?.volumeRoleLabel ? `${pick(lang, "卷内定位：", "Định vị trong tập: ", "Volume role: ")}${guide.volumeRoleLabel}` : "",
        guide?.volumeResponsibility ? `${pick(lang, "卷内职责：", "Trách nhiệm trong tập: ", "Volume responsibility: ")}${guide.volumeResponsibility}` : "",
        character.personality,
        character.currentState ? `${pick(lang, "状态：", "Trạng thái: ", "State: ")}${character.currentState}` : "",
        character.currentGoal ? `${pick(lang, "目标：", "Mục tiêu: ", "Goal: ")}${character.currentGoal}` : "",
        guide?.relationStageLabels.length ? `${pick(lang, "关系阶段：", "Giai đoạn quan hệ: ", "Relation stage: ")}${guide.relationStageLabels.join(" / ")}` : "",
        guide?.mindGuidance ? `${pick(lang, "主观倾向：", "Xu hướng chủ quan: ", "Subjective tendency: ")}${guide.mindGuidance}` : "",
        guide?.authorInfluenceGuidance ? `${authorInfluenceLabel}${guide.authorInfluenceGuidance}` : "",
        guide?.absenceRisk && guide.absenceRisk !== "none"
          ? absenceRiskLabel(guide.absenceRisk, guide.absenceSpan)
          : "",
      ], 4);
      return `- ${character.name}: ${parts.join(" | ")}`;
    }),
  ].join("\n");
}

export function buildCharacterGuidanceText(writeContext: ChapterWriteContext): string {
  const lang = writeContext.promptLanguage;
  const none = pick(lang, "无", "không có", "none");
  const title = pick(lang, "角色行为指导", "Hướng dẫn hành vi nhân vật", "Character behavior guidance");
  if (writeContext.characterBehaviorGuides.length === 0) {
    return `${title}: ${none}`;
  }
  const mindLabel = pick(lang, "主观倾向（非客观事实）：", "Xu hướng chủ quan (không phải sự thật khách quan): ", "Subjective tendency (not objective fact): ");
  const authorInfluenceLabel = pick(
    lang,
    "角色对话后确认的软性行为倾向（非客观事实）：",
    "Xu hướng hành vi mềm đã xác nhận sau đối thoại nhân vật (không phải sự thật khách quan): ",
    "Soft behavioral tendency confirmed after character dialogue (not objective fact): ",
  );
  return [
    `${title}:`,
    ...writeContext.characterBehaviorGuides.map((guide) => {
      const parts = takeUnique([
        guide.isCoreInVolume
          ? pick(lang, "本卷核心角色", "Nhân vật cốt lõi của tập này", "Core character of this volume")
          : pick(lang, "本卷辅助角色", "Nhân vật phụ trợ của tập này", "Supporting character of this volume"),
        guide.mindGuidance ? `${mindLabel}${guide.mindGuidance}` : "",
        guide.authorInfluenceGuidance ? `${authorInfluenceLabel}${guide.authorInfluenceGuidance}` : "",
        guide.visibleProfileSummary ? `${pick(lang, "可见表现：", "Biểu hiện nhìn thấy được: ", "Visible profile: ")}${guide.visibleProfileSummary}` : "",
        guide.volumeRoleLabel ? `${pick(lang, "卷内定位：", "Định vị trong tập: ", "Volume role: ")}${guide.volumeRoleLabel}` : "",
        guide.volumeResponsibility ? `${pick(lang, "职责：", "Trách nhiệm: ", "Responsibility: ")}${guide.volumeResponsibility}` : "",
        guide.currentGoal ? `${pick(lang, "目标：", "Mục tiêu: ", "Goal: ")}${guide.currentGoal}` : "",
        guide.currentState ? `${pick(lang, "状态：", "Trạng thái: ", "State: ")}${guide.currentState}` : "",
        guide.relationStageLabels.length ? `${pick(lang, "关系阶段：", "Giai đoạn quan hệ: ", "Relation stage: ")}${guide.relationStageLabels.join(" / ")}` : "",
        guide.absenceRisk !== "none"
          ? pick(
            lang,
            `缺席风险：${guide.absenceRisk}（跨度 ${guide.absenceSpan}）`,
            `Rủi ro vắng mặt: ${guide.absenceRisk} (khoảng ${guide.absenceSpan})`,
            `Absence risk: ${guide.absenceRisk} (span ${guide.absenceSpan})`,
          )
          : "",
        guide.factionLabel ? `${pick(lang, "阵营：", "Phe: ", "Faction: ")}${guide.factionLabel}` : "",
        guide.stanceLabel ? `${pick(lang, "立场：", "Lập trường: ", "Stance: ")}${guide.stanceLabel}` : "",
        guide.shouldPreferAppearance
          ? pick(lang, "本章优先使用外观细节", "Chương này ưu tiên dùng chi tiết ngoại hình", "Prefer appearance details in this chapter")
          : "",
      ], 6);
      return `- ${guide.name}: ${parts.join(" | ")}`;
    }),
  ].join("\n");
}

export function buildRelationStageText(writeContext: ChapterWriteContext): string {
  const lang = writeContext.promptLanguage;
  const title = pick(lang, "活跃关系阶段", "Giai đoạn quan hệ đang hoạt động", "Active relation stages");
  if (writeContext.activeRelationStages.length === 0) {
    return `${title}: ${pick(lang, "无", "không có", "none")}`;
  }
  const nextTurnLabel = pick(lang, "下一转折：", "Chuyển biến kế tiếp: ", "Next turn: ");
  return [
    `${title}:`,
    ...writeContext.activeRelationStages.map((relation) => (
      `- ${relation.sourceCharacterName} -> ${relation.targetCharacterName}: ${relation.stageLabel} | ${relation.stageSummary}${relation.nextTurnPoint ? ` | ${nextTurnLabel}${relation.nextTurnPoint}` : ""}`
    )),
  ].join("\n");
}

export function buildPendingCandidateGuardText(writeContext: ChapterWriteContext): string {
  const lang = writeContext.promptLanguage;
  const title = pick(lang, "候选角色护栏", "Rào chắn nhân vật ứng viên", "Pending candidate guardrails");
  if (writeContext.pendingCandidateGuards.length === 0) {
    return `${title}: ${pick(lang, "无", "không có", "none")}`;
  }
  const heading = pick(
    lang,
    "候选角色护栏（只读，不要直接写入正文）：",
    "Rào chắn nhân vật ứng viên (chỉ đọc, không viết thẳng vào chính văn):",
    "Pending candidate guardrails (read-only, do not write straight into the prose):",
  );
  return [
    heading,
    ...writeContext.pendingCandidateGuards.map((candidate) => {
      const parts = takeUnique([
        candidate.proposedRole ? `${pick(lang, "定位：", "Định vị: ", "Role: ")}${candidate.proposedRole}` : "",
        candidate.summary ?? "",
        candidate.sourceChapterOrder != null
          ? pick(lang, `来源章节：第 ${candidate.sourceChapterOrder} 章`, `Chương nguồn: chương ${candidate.sourceChapterOrder}`, `Source chapter: chapter ${candidate.sourceChapterOrder}`)
          : "",
        ...candidate.evidence.slice(0, 2),
      ], 4);
      return `- ${candidate.proposedName}: ${parts.join(" | ")}`;
    }),
  ].join("\n");
}
