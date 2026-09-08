import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { PromptAsset } from "../../../core/promptTypes";
import { renderSelectedContextBlocks } from "../../../core/renderContextBlocks";
import {
  createChapterBoundarySchema,
  createChapterExecutionContractSchema,
  createChapterPurposeSchema,
  createChapterTaskSheetSchema,
} from "../../../../services/novel/volume/volumeGenerationSchemas";
import { type VolumeChapterDetailPromptInput } from "./shared";
import { buildVolumeChapterDetailContextBlocks } from "./contextBlocks";
import { NOVEL_PROMPT_BUDGETS } from "../promptBudgetProfiles";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { pick } from "./localize";

const TITLE_EVENT_ANCHOR_HINTS = [
  "激活",
  "入手",
  "兑现",
  "暴露",
  "发现",
  "转向",
  "升级",
  "查账",
  "接管",
  "请缨",
  "破局",
  "反压",
  "发难",
  "露白",
  "启动",
  "异响",
  "得手",
  "松动",
];

function normalizeComparableText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function cleanAnchorFragment(value: string): string {
  return value.replace(/[《》【】「」『』“”"'‘’]/g, "").trim();
}

function extractEventAnchorsFromTitle(title: string | null | undefined): string[] {
  const normalized = normalizeComparableText(title);
  if (!normalized) {
    return [];
  }
  const seen = new Set<string>();
  const fragments = normalized
    .split(/[，,。；;：:、|/\\\-\s（）()]+/g)
    .map((item) => cleanAnchorFragment(item))
    .filter((item) => item.length >= 4 && item.length <= 16)
    .filter((item) => TITLE_EVENT_ANCHOR_HINTS.some((hint) => item.includes(hint)));

  for (const fragment of fragments) {
    seen.add(fragment);
  }
  return [...seen];
}

function buildCurrentChapterContractText(input: VolumeChapterDetailPromptInput): string {
  const { targetChapter } = input;
  return normalizeComparableText([
    targetChapter.title,
    targetChapter.summary,
    targetChapter.purpose,
    targetChapter.exclusiveEvent,
    targetChapter.endingState,
    targetChapter.nextChapterEntryState,
    targetChapter.payoffRefs.join(" "),
  ].filter(Boolean).join("\n"));
}

function validateBoundaryContract(
  output: {
    exclusiveEvent: string;
    endingState: string;
    nextChapterEntryState: string;
    conflictLevel: number;
    revealLevel: number;
    targetWordCount: number;
    mustAvoid: string;
    payoffRefs: string[];
  },
  input: VolumeChapterDetailPromptInput,
): {
  exclusiveEvent: string;
  endingState: string;
  nextChapterEntryState: string;
  conflictLevel: number;
  revealLevel: number;
  targetWordCount: number;
  mustAvoid: string;
  payoffRefs: string[];
} {
  const sortedChapters = input.targetVolume.chapters
    .slice()
    .sort((left, right) => left.chapterOrder - right.chapterOrder);
  const targetIndex = sortedChapters.findIndex((chapter) => chapter.id === input.targetChapter.id);
  if (targetIndex < 0) {
    return output;
  }

  const previousChapter = targetIndex > 0 ? sortedChapters[targetIndex - 1] : null;
  const nextChapter = targetIndex < sortedChapters.length - 1 ? sortedChapters[targetIndex + 1] : null;
  const currentContractText = buildCurrentChapterContractText(input);

  if (
    previousChapter?.exclusiveEvent?.trim()
    && output.exclusiveEvent.includes(previousChapter.exclusiveEvent.trim())
    && !currentContractText.includes(previousChapter.exclusiveEvent.trim())
  ) {
    throw new Error(`当前章独占事件与上一章独占事件「${previousChapter.exclusiveEvent.trim()}」冲突。一次性节点不能跨章重复占用。`);
  }
  const leakedNextAnchor = nextChapter
    ? extractEventAnchorsFromTitle(nextChapter.title).find((anchor) => (
      output.exclusiveEvent.includes(anchor)
      || output.endingState.includes(anchor)
      || output.nextChapterEntryState.includes(anchor)
    ))
    : null;
  if (leakedNextAnchor && !currentContractText.includes(leakedNextAnchor)) {
    throw new Error(`当前章边界合同疑似提前占用了下一章标题中的一次性事件锚点「${leakedNextAnchor}」。`);
  }
  if (normalizeComparableText(output.endingState) === normalizeComparableText(output.nextChapterEntryState)) {
    throw new Error("endingState 与 nextChapterEntryState 不能完全相同。前者是本章结束态，后者是下章入口态，必须体现承接而不是机械重复。");
  }

  return output;
}

function buildTaskSheetSemanticText(output: {
  taskSheet: string;
  sceneCards: Array<{
    title: string;
    purpose: string;
    entryState: string;
    exitState: string;
    mustAdvance: string[];
    forbiddenExpansion: string[];
  }>;
}): string {
  return normalizeComparableText([
    output.taskSheet,
    ...output.sceneCards.flatMap((scene) => [
      scene.title,
      scene.purpose,
      scene.entryState,
      scene.exitState,
      scene.mustAdvance.join(" "),
      scene.forbiddenExpansion.join(" "),
    ]),
  ].join("\n"));
}

function validateAdjacentChapterBoundary<T extends {
    taskSheet: string;
    sceneCards: Array<{
      title: string;
      purpose: string;
      entryState: string;
      exitState: string;
      mustAdvance: string[];
      forbiddenExpansion: string[];
    }>;
  }>(
  output: T,
  input: VolumeChapterDetailPromptInput,
): T {
  const sortedChapters = input.targetVolume.chapters
    .slice()
    .sort((left, right) => left.chapterOrder - right.chapterOrder);
  const targetIndex = sortedChapters.findIndex((chapter) => chapter.id === input.targetChapter.id);
  if (targetIndex < 0) {
    return output;
  }

  const currentContractText = buildCurrentChapterContractText(input);
  const outputText = buildTaskSheetSemanticText(output);
  const adjacentChapters = [
    { label: "上一章", chapter: targetIndex > 0 ? sortedChapters[targetIndex - 1] : null },
    { label: "下一章", chapter: targetIndex < sortedChapters.length - 1 ? sortedChapters[targetIndex + 1] : null },
  ];

  for (const adjacent of adjacentChapters) {
    const chapter = adjacent.chapter;
    if (!chapter) {
      continue;
    }
    const leakedAnchor = extractEventAnchorsFromTitle(chapter.title)
      .find((anchor) => outputText.includes(anchor) && !currentContractText.includes(anchor));
    if (leakedAnchor) {
      throw new Error(
        `${adjacent.label}标题中的一次性事件锚点「${leakedAnchor}」疑似越界进入当前章节执行合同。当前章只能承接相邻章节状态，不能提前、滞后或重复承担相邻章节的关键首次事件。`,
      );
    }
  }

  return output;
}

function createVolumeDetailSystemPrompt(
  detailMode: VolumeChapterDetailPromptInput["detailMode"],
  lang: PromptLanguage,
): string {
  const editorRole = pick(lang,
    "你是资深连载小说章节编辑。",
    "Bạn là biên tập viên chương kỳ cựu cho tiểu thuyết dài kỳ.",
    "You are a senior chapter editor for serialized fiction.");
  if (detailMode === "purpose") {
    return [
      editorRole,
      pick(lang, "当前任务是收束单章 purpose。", "Nhiệm vụ hiện tại là chốt purpose của một chương.", "The current task is to finalize a single chapter's purpose."),
      pick(lang, "只输出严格 JSON，且只包含 purpose 字段。", "Chỉ xuất JSON nghiêm ngặt, chỉ chứa field purpose.", "Output strict JSON containing only the purpose field."),
      pick(lang,
        "purpose 必须说明这一章要推进什么，不要复述摘要。",
        "purpose phải nói rõ chương này đẩy điều gì, không thuật lại tóm tắt.",
        "purpose must state what this chapter advances — do not restate the summary."),
    ].join("\n");
  }
  if (detailMode === "boundary") {
    return [
      editorRole,
      pick(lang, "当前任务是为单章定义执行边界。", "Nhiệm vụ hiện tại là định ranh giới thực thi cho một chương.", "The current task is to define the execution boundary for a single chapter."),
      pick(lang,
        "只输出严格 JSON，且只包含 exclusiveEvent、endingState、nextChapterEntryState、conflictLevel、revealLevel、targetWordCount、mustAvoid、payoffRefs。",
        "Chỉ xuất JSON nghiêm ngặt, chỉ chứa exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, targetWordCount, mustAvoid, payoffRefs.",
        "Output strict JSON containing only exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, targetWordCount, mustAvoid, payoffRefs."),
      pick(lang,
        "exclusiveEvent 表示只能由本章承担的一次性里程碑事件，必须具体，不能写成空泛主题。",
        "exclusiveEvent là sự kiện cột mốc một-lần chỉ chương này gánh, phải cụ thể, không viết thành chủ đề chung chung.",
        "exclusiveEvent is the one-time milestone event only this chapter carries — it must be concrete, not a vague theme."),
      pick(lang,
        "endingState 表示本章写完时的稳定局面。",
        "endingState là cục diện ổn định khi viết xong chương này.",
        "endingState is the stable situation when this chapter is finished."),
      pick(lang,
        "nextChapterEntryState 表示下一章开场时应承接的入口状态，必须与 endingState 强关联但不能逐字重复。",
        "nextChapterEntryState là trạng thái vào đầu mà chương sau tiếp nhận, phải liên kết chặt với endingState nhưng không lặp lại nguyên văn.",
        "nextChapterEntryState is the entry state the next chapter picks up — strongly tied to endingState but not a verbatim repeat."),
      pick(lang,
        "边界合同必须保证：上一章已完成的独占事件不重复，本章独占事件不偷跑到下一章，下一章只承接状态不重演本章里程碑。",
        "Hợp đồng ranh giới phải bảo đảm: sự kiện độc quyền chương trước đã xong không lặp lại, sự kiện độc quyền chương này không lẻn sang chương sau, chương sau chỉ tiếp nhận trạng thái chứ không diễn lại cột mốc của chương này.",
        "The boundary contract must guarantee: the previous chapter's completed exclusive event does not repeat, this chapter's exclusive event does not leak into the next chapter, and the next chapter only inherits state without re-enacting this chapter's milestone."),
      pick(lang,
        "各字段必须与当前卷节奏和相邻章节保持一致。",
        "Các field phải nhất quán với nhịp tập hiện tại và các chương liền kề.",
        "All fields must stay consistent with the current volume's pacing and the adjacent chapters."),
      pick(lang,
        "如果 conflict_level_curve 标出用户锚定的 conflictLevel，该数值是硬约束，不得改写。",
        "Nếu conflict_level_curve nêu conflictLevel do người dùng ghim, giá trị đó là ràng buộc cứng, không được đổi.",
        "If conflict_level_curve marks a user-anchored conflictLevel, that value is a hard constraint — do not change it."),
    ].join("\n");
  }
  return [
    editorRole,
    pick(lang,
      "当前任务是生成可直接交给正文生成器的章节执行合同。",
      "Nhiệm vụ hiện tại là tạo hợp đồng thực thi chương có thể giao thẳng cho bộ sinh chính văn.",
      "The current task is to produce a chapter execution contract that can go straight to the prose generator."),
    pick(lang,
      "只输出严格 JSON，且只包含 taskSheet、readerExperience、sceneCards 三个字段。",
      "Chỉ xuất JSON nghiêm ngặt, chỉ chứa ba field: taskSheet, readerExperience, sceneCards.",
      "Output strict JSON containing only three fields: taskSheet, readerExperience, sceneCards."),
    pick(lang,
      "taskSheet 是给用户读的简洁执行摘要，需要覆盖情绪基调、冲突对象、关键推进和收尾要求。",
      "taskSheet là bản tóm tắt thực thi ngắn gọn cho người dùng đọc, cần bao quát tông cảm xúc, đối tượng xung đột, điểm đẩy then chốt và yêu cầu kết chương.",
      "taskSheet is a concise execution summary for the user to read — it must cover the emotional tone, the conflict target, the key progression, and the ending requirements."),
    pick(lang,
      "readerExperience 是本章唯一的读者体验合同，必须包含 readerQuestion、promisedReward、rewardLevel、protagonistWant、primaryResistance、keyTurn、emotionalShift、informationReveal、netChange、inheritedHookResponsibilities、endingHook。",
      "readerExperience là hợp đồng trải nghiệm đọc duy nhất của chương, phải chứa readerQuestion, promisedReward, rewardLevel, protagonistWant, primaryResistance, keyTurn, emotionalShift, informationReveal, netChange, inheritedHookResponsibilities, endingHook.",
      "readerExperience is the chapter's single reader-experience contract and must contain readerQuestion, promisedReward, rewardLevel, protagonistWant, primaryResistance, keyTurn, emotionalShift, informationReveal, netChange, inheritedHookResponsibilities, endingHook."),
    pick(lang,
      "rewardLevel 只能是 setup、partial、major；由本章在卷节奏中的职责决定，不要每章都写成 major。",
      "rewardLevel chỉ được là setup, partial, major; do trách nhiệm của chương trong nhịp tập quyết định, đừng chương nào cũng ghi major.",
      "rewardLevel is only setup, partial, or major — determined by this chapter's role in the volume pacing; do not mark every chapter major."),
    pick(lang,
      "inheritedHookResponsibilities 必须优先承接相邻章已经提出的问题；没有明确旧钩子时返回空数组，不要编造。",
      "inheritedHookResponsibilities phải ưu tiên tiếp nhận các câu hỏi mà chương liền kề đã nêu; khi không có móc câu cũ rõ ràng thì trả mảng rỗng, đừng bịa.",
      "inheritedHookResponsibilities must first pick up the questions the adjacent chapters already raised; when there is no clear prior hook, return an empty array — do not fabricate."),
    pick(lang,
      "promisedReward 与 netChange 必须是读者在正文中能看见的回报和变化，不能写成作者意图或抽象主题。",
      "promisedReward và netChange phải là phần thưởng và thay đổi người đọc thấy được trong chính văn, không viết thành ý đồ tác giả hay chủ đề trừu tượng.",
      "promisedReward and netChange must be the reward and change the reader can see in the prose — not authorial intent or an abstract theme."),
    pick(lang,
      "sceneCards 必须是 3-8 个场景卡数组，每个场景卡都必须包含 key、title、purpose、mustAdvance、mustPreserve、entryState、exitState、forbiddenExpansion、targetWordCount、resistance、turn、emotionalShift、readerValue。",
      "sceneCards phải là mảng 3-8 thẻ cảnh, mỗi thẻ phải chứa key, title, purpose, mustAdvance, mustPreserve, entryState, exitState, forbiddenExpansion, targetWordCount, resistance, turn, emotionalShift, readerValue.",
      "sceneCards must be an array of 3-8 scene cards, each containing key, title, purpose, mustAdvance, mustPreserve, entryState, exitState, forbiddenExpansion, targetWordCount, resistance, turn, emotionalShift, readerValue."),
    pick(lang,
      "每个场景都必须有具体阻力和转折；readerValue 要说明该场景给读者带来的推进、揭示、情绪或关系价值。",
      "Mỗi cảnh phải có lực cản và bước ngoặt cụ thể; readerValue phải nói rõ cảnh đó mang lại giá trị đẩy truyện, hé lộ, cảm xúc hay quan hệ nào cho người đọc.",
      "Every scene must have concrete resistance and a turn; readerValue must state the progression, reveal, emotional, or relational value the scene gives the reader."),
    pick(lang,
      "sceneCards 必须完整覆盖整章推进和结尾 hook，不要把整章压成一个场景。",
      "sceneCards phải phủ đủ toàn bộ diễn tiến chương và móc câu kết, đừng dồn cả chương vào một cảnh.",
      "sceneCards must fully cover the whole chapter's progression and the ending hook — do not compress the whole chapter into one scene."),
    pick(lang,
      "当前章节的 title、summary、purpose、exclusiveEvent、endingState、nextChapterEntryState、conflictLevel、revealLevel、mustAvoid、payoffRefs 共同组成了本章硬边界合同。taskSheet 和 sceneCards 只能执行当前章合同，不能改写或覆盖它。",
      "title, summary, purpose, exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, mustAvoid, payoffRefs của chương hiện tại cùng tạo thành hợp đồng ranh giới cứng của chương. taskSheet và sceneCards chỉ được thực thi hợp đồng chương này, không được viết lại hay ghi đè.",
      "The current chapter's title, summary, purpose, exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, mustAvoid, payoffRefs together form this chapter's hard boundary contract. taskSheet and sceneCards may only execute this chapter's contract — they must not rewrite or override it."),
    pick(lang,
      "你必须把 chapter_neighbors 视为相邻章边界提示：上一章已经完成的关键首次事件不能在本章重写一次，下一章标题或摘要中的关键首次事件也不能提前写进本章。",
      "Bạn phải coi chapter_neighbors là gợi ý ranh giới chương liền kề: sự kiện lần-đầu then chốt chương trước đã hoàn thành không được viết lại trong chương này, và sự kiện lần-đầu then chốt trong tiêu đề hay tóm tắt chương sau cũng không được viết trước vào chương này.",
      "You must treat chapter_neighbors as adjacent-chapter boundary hints: a key first-time event the previous chapter already completed must not be re-written here, and a key first-time event in the next chapter's title or summary must not be pulled forward into this chapter."),
    pick(lang,
      "本章结尾只能把局面推到下一章入口，不能直接落完下一章标题所承诺的核心里程碑。",
      "Kết chương này chỉ được đẩy cục diện tới lối vào chương sau, không được hoàn thành trọn cột mốc cốt lõi mà tiêu đề chương sau hứa.",
      "This chapter's ending may only push the situation to the next chapter's entry point — it must not fully land the core milestone the next chapter's title promises."),
    pick(lang,
      "如果相邻章标题已经明确标出一次性节点，例如系统激活、第一笔资源入手、身份暴露、关键查账、正式请缨等，本章不得重复承担该节点，除非当前章自己的合同已经明确要求。",
      "Nếu tiêu đề chương liền kề đã nêu rõ một nút một-lần (ví dụ: kích hoạt hệ thống, nhận nguồn lực đầu tiên, lộ thân phận, kiểm tra sổ sách then chốt, chính thức xin ra trận), chương này không được gánh lại nút đó, trừ khi hợp đồng của chính chương này yêu cầu rõ.",
      "If an adjacent chapter's title clearly marks a one-time node (e.g. system activation, first resource acquired, identity exposed, a key audit, formally volunteering), this chapter must not carry that node again unless this chapter's own contract explicitly requires it."),
    pick(lang,
      "你必须优先识别最近章节执行合同与当前章节之间的叙事重复风险，重点检查开场方式、推进方式、状态变化和结尾钩子是否连续复用。",
      "Bạn phải ưu tiên nhận diện rủi ro lặp lại tự sự giữa các hợp đồng thực thi chương gần đây và chương hiện tại, tập trung kiểm tra: cách mở đầu, cách đẩy truyện, thay đổi trạng thái và móc câu kết có bị dùng lại liên tiếp không.",
      "You must first identify narrative-repetition risk between the recent chapters' execution contracts and this chapter — check especially whether the opening style, progression style, state change, and ending hook are being reused in a row."),
    pick(lang,
      "如果最近章节已经连续使用同类开场或同类推进，本章必须主动切换，不得继续沿用同一路数。",
      "Nếu các chương gần đây đã dùng liên tiếp cùng kiểu mở đầu hoặc cùng kiểu đẩy truyện, chương này phải chủ động đổi, không được tiếp tục theo cùng một lối.",
      "If recent chapters have used the same kind of opening or the same kind of progression in a row, this chapter must actively switch — do not keep following the same playbook."),
    pick(lang,
      "差异化要求必须落实到 taskSheet 和 sceneCards 里，而不是停留在抽象提醒。",
      "Yêu cầu tạo khác biệt phải được cụ thể hóa vào taskSheet và sceneCards, không dừng ở nhắc nhở trừu tượng.",
      "The differentiation requirement must be made concrete in taskSheet and sceneCards, not left as an abstract reminder."),
    pick(lang,
      "首个 sceneCard 必须通过 purpose、entryState 或 forbiddenExpansion 明确避开最近章节的重复开场。",
      "sceneCard đầu tiên phải qua purpose, entryState hoặc forbiddenExpansion tránh rõ ràng kiểu mở đầu lặp lại của các chương gần đây.",
      "The first sceneCard must, via purpose, entryState, or forbiddenExpansion, clearly avoid the repeated opening of recent chapters."),
    pick(lang,
      "至少一个中段 sceneCard 的 mustAdvance 必须明确要求不同于最近章节的推进结果，例如主动试探、关系建立、资源获得、规则认知或计划转向。",
      "mustAdvance của ít nhất một sceneCard đoạn giữa phải yêu cầu rõ một kết quả đẩy truyện khác với các chương gần đây, ví dụ: chủ động thăm dò, xây quan hệ, thu nguồn lực, nhận thức luật lệ, hoặc đổi hướng kế hoạch.",
      "At least one mid-chapter sceneCard's mustAdvance must explicitly require a progression result different from recent chapters, e.g. active probing, building a relationship, acquiring resources, understanding a rule, or a plan pivot."),
    pick(lang,
      "如果最近章节已经连续写成外部压迫或被动逃离，本章不得继续只靠同类压迫推进，必须给出新的推进机制。",
      "Nếu các chương gần đây đã liên tiếp viết theo kiểu áp lực từ bên ngoài hoặc chạy trốn bị động, chương này không được tiếp tục chỉ dựa vào cùng kiểu áp lực đó để đẩy truyện, phải đưa ra cơ chế đẩy mới.",
      "If recent chapters have consecutively been external pressure or passive flight, this chapter must not keep advancing on the same kind of pressure — provide a new progression mechanism."),
  ].join("\n");
}

function createExecutionContractSystemPromptGarbledBackup(): string {
  return [
    "浣犳槸璧勬繁缃戞枃绔犺妭缂栬緫銆?",
    "褰撳墠浠诲姟鏄竴娆℃€х敓鎴愬彲鐩存帴浜ょ粰鍐欎綔鍣ㄧ殑绔犺妭鎵ц鍚堝悓銆?",
    "鍙緭鍑轰弗鏍?JSON锛屽繀椤诲悓鏃跺寘鍚?purpose銆乪xclusiveEvent銆乪ndingState銆乶extChapterEntryState銆乧onflictLevel銆乺evealLevel銆乼argetWordCount銆乵ustAvoid銆乸ayoffRefs銆乼askSheet銆乻ceneCards銆?",
    "purpose 鐢ㄤ竴鍙ヨ瘽璇存槑鏈珷鍒板簳瑕佹帹杩涗粈涔堬紝涓嶈鍐欐垚鎽樿澶嶈堪銆?",
    "exclusiveEvent / endingState / nextChapterEntryState 绛夊瓧娈典笉鍙己澶憋紝瀹冧滑鏄珷鑺傜殑纭竟鐣屽悎鍚屻€?",
    "taskSheet 鏄粰姝ｆ枃鍐欎綔鍣ㄧ殑绠€娲佹墽琛屾寚浠わ紝sceneCards 鏄?3-8 涓満鏅崱鐨勬墽琛屾媶瑙ｃ€?",
    "taskSheet 鍜?sceneCards 鍙兘鎵ц褰撳墠绔犵殑鍚堝悓锛屼笉寰楁彁鍓嶅崰鐢ㄧ浉閭荤珷鐨勪竴娆℃€т簨浠讹紝涔熶笉寰楅噸鍐欎笂涓€绔犲凡缁忓畬鎴愮殑閲岀▼纰戙€?",
    "濡傛灉鏈€杩戠珷鑺傚凡缁忚繛缁娇鐢ㄧ浉鍚屽紑鍦恒€佺浉鍚屾帹杩涜矾鏁版垨鍚岀被閽╁瓙锛屾湰绔犲繀椤婚€氳繃 sceneCards 涓诲姩鍋氬嚭宸紓鍖栥€?",
  ].join("\n");
}

function createExecutionContractSystemPrompt(lang: PromptLanguage): string {
  return [
    pick(lang,
      "你是资深连载小说章节编辑。",
      "Bạn là biên tập viên chương kỳ cựu cho tiểu thuyết dài kỳ.",
      "You are a senior chapter editor for serialized fiction."),
    pick(lang,
      "当前任务是一次性生成可直接交给写作器的章节执行合同。",
      "Nhiệm vụ hiện tại là tạo trong một lần hợp đồng thực thi chương có thể giao thẳng cho bộ viết.",
      "The current task is to produce, in one pass, a chapter execution contract that can go straight to the writer."),
    pick(lang,
      "只输出严格 JSON，必须同时包含 purpose、exclusiveEvent、endingState、nextChapterEntryState、conflictLevel、revealLevel、targetWordCount、mustAvoid、payoffRefs、taskSheet、readerExperience、sceneCards。",
      "Chỉ xuất JSON nghiêm ngặt, phải chứa đồng thời purpose, exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, targetWordCount, mustAvoid, payoffRefs, taskSheet, readerExperience, sceneCards.",
      "Output strict JSON containing all of: purpose, exclusiveEvent, endingState, nextChapterEntryState, conflictLevel, revealLevel, targetWordCount, mustAvoid, payoffRefs, taskSheet, readerExperience, sceneCards."),
    pick(lang,
      "purpose 用一句话说明本章到底要推进什么，不要写成摘要复述。",
      "purpose dùng một câu nói rõ chương này rốt cuộc đẩy điều gì, không viết thành thuật lại tóm tắt.",
      "purpose is one sentence stating what this chapter actually advances — not a restated summary."),
    pick(lang,
      "exclusiveEvent / endingState / nextChapterEntryState 等字段不可缺失，它们是章节的硬边界合同。",
      "Các field như exclusiveEvent / endingState / nextChapterEntryState không được thiếu — chúng là hợp đồng ranh giới cứng của chương.",
      "Fields like exclusiveEvent / endingState / nextChapterEntryState must not be missing — they are the chapter's hard boundary contract."),
    pick(lang,
      "taskSheet 是给正文写作器的简洁执行指令，sceneCards 是 3-8 个场景卡的执行拆解。",
      "taskSheet là chỉ thị thực thi ngắn gọn cho bộ viết chính văn; sceneCards là bản tách thực thi gồm 3-8 thẻ cảnh.",
      "taskSheet is a concise execution instruction for the prose writer; sceneCards is the execution breakdown into 3-8 scene cards."),
    pick(lang,
      "readerExperience 是本章唯一的读者体验合同，必须完整包含 readerQuestion、promisedReward、rewardLevel、protagonistWant、primaryResistance、keyTurn、emotionalShift、informationReveal、netChange、inheritedHookResponsibilities、endingHook。",
      "readerExperience là hợp đồng trải nghiệm đọc duy nhất của chương, phải chứa đủ readerQuestion, promisedReward, rewardLevel, protagonistWant, primaryResistance, keyTurn, emotionalShift, informationReveal, netChange, inheritedHookResponsibilities, endingHook.",
      "readerExperience is the chapter's single reader-experience contract and must fully contain readerQuestion, promisedReward, rewardLevel, protagonistWant, primaryResistance, keyTurn, emotionalShift, informationReveal, netChange, inheritedHookResponsibilities, endingHook."),
    pick(lang,
      "rewardLevel 只能使用 setup、partial、major；promisedReward 和 netChange 必须能在正文中被读者直接感知。",
      "rewardLevel chỉ dùng setup, partial, major; promisedReward và netChange phải được người đọc cảm nhận trực tiếp trong chính văn.",
      "rewardLevel is only setup, partial, or major; promisedReward and netChange must be directly perceptible to the reader in the prose."),
    pick(lang,
      "sceneCards 除原字段外还必须包含 resistance、turn、emotionalShift、readerValue，确保每个场景都有阻力、转折和读者价值。",
      "Ngoài các field gốc, sceneCards còn phải chứa resistance, turn, emotionalShift, readerValue, bảo đảm mỗi cảnh đều có lực cản, bước ngoặt và giá trị cho người đọc.",
      "Beyond its base fields, each sceneCard must also contain resistance, turn, emotionalShift, readerValue — ensuring every scene has resistance, a turn, and reader value."),
    pick(lang,
      "taskSheet 和 sceneCards 只能执行当前章的合同，不得提前占用相邻章的一次性事件，也不得重写上一章已经完成的里程碑。",
      "taskSheet và sceneCards chỉ được thực thi hợp đồng chương hiện tại, không được chiếm trước sự kiện một-lần của chương liền kề, cũng không được viết lại cột mốc chương trước đã hoàn thành.",
      "taskSheet and sceneCards may only execute the current chapter's contract — do not pre-empt an adjacent chapter's one-time event, and do not rewrite a milestone the previous chapter already completed."),
    pick(lang,
      "如果 conflict_level_curve 标出用户锚定的 conflictLevel，该数值是硬约束，不得改写。",
      "Nếu conflict_level_curve nêu conflictLevel do người dùng ghim, giá trị đó là ràng buộc cứng, không được đổi.",
      "If conflict_level_curve marks a user-anchored conflictLevel, that value is a hard constraint — do not change it."),
    pick(lang,
      "如果最近章节已经连续使用相同开场、相同推进路数或同类钩子，本章必须通过 sceneCards 主动做出差异化。",
      "Nếu các chương gần đây đã dùng liên tiếp cùng kiểu mở đầu, cùng lối đẩy truyện hoặc cùng loại móc câu, chương này phải qua sceneCards chủ động tạo khác biệt.",
      "If recent chapters have consecutively used the same opening, the same progression playbook, or the same kind of hook, this chapter must actively differentiate via sceneCards."),
    pick(lang,
      "purpose、边界字段和 readerExperience 各字段只写 1 句，单字段不超过 120 字；taskSheet 不超过 300 字。",
      "purpose, các field ranh giới và các field readerExperience mỗi field chỉ viết 1 câu, không quá 120 ký tự; taskSheet không quá 300 ký tự.",
      "purpose, the boundary fields, and each readerExperience field are one sentence, at most 120 characters; taskSheet is at most 300 characters."),
    pick(lang,
      "每个 sceneCard 的文本字段只写执行所需信息，单字段不超过 120 字；不得扩写正文或对白。",
      "Các field văn bản của mỗi sceneCard chỉ viết thông tin cần cho thực thi, không quá 120 ký tự mỗi field; không được triển khai chính văn hay đối thoại.",
      "Each sceneCard's text fields contain only the info needed to execute, at most 120 characters per field; do not expand into prose or dialogue."),
    pick(lang,
      "targetWordCount 必须沿用当前目标章节的字数预算，范围只能是 200-20000，不能误用全书或全卷字数。",
      "targetWordCount phải theo ngân sách chữ của chương mục tiêu hiện tại, phạm vi chỉ 200-20000, không được nhầm dùng số chữ cả sách hay cả tập.",
      "targetWordCount must follow the current target chapter's word budget, range 200-20000 only — do not mistakenly use the whole-book or whole-volume count."),
    pick(lang,
      "完成最后一个 sceneCard 后立即结束 JSON，禁止续写解释、复读或自我修正。",
      "Hoàn thành sceneCard cuối thì kết thúc JSON ngay; cấm viết tiếp lời giải thích, đọc lại hay tự sửa.",
      "End the JSON immediately after the last sceneCard — do not continue with explanations, re-reading, or self-correction."),
  ].join("\n");
}

function buildChapterDetailPrompt(contextText: string, detailMode: VolumeChapterDetailPromptInput["detailMode"]): string {
  return [
    `detail mode: ${detailMode}`,
    "",
    "chapter detail context:",
    contextText,
  ].join("\n");
}

const baseContextPolicy = {
  maxTokensBudget: NOVEL_PROMPT_BUDGETS.volumeChapterDetail,
  requiredGroups: ["book_contract", "target_volume", "chapter_neighbors", "chapter_detail_draft"],
  preferredGroups: ["recent_execution_contracts", "macro_constraints", "target_beat_sheet", "volume_window"],
  dropOrder: ["volume_window"],
};

export const volumeChapterPurposePrompt: PromptAsset<
  VolumeChapterDetailPromptInput,
  ReturnType<typeof createChapterPurposeSchema>["_output"]
> = {
  id: "novel.volume.chapter_purpose",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: baseContextPolicy,
  outputSchema: createChapterPurposeSchema(),
  render: (input, context) => [
    new SystemMessage(createVolumeDetailSystemPrompt("purpose", context.promptLanguage)),
    new HumanMessage(buildChapterDetailPrompt(renderSelectedContextBlocks(context), input.detailMode)),
  ],
};

export const volumeChapterBoundaryPrompt: PromptAsset<
  VolumeChapterDetailPromptInput,
  ReturnType<typeof createChapterBoundarySchema>["_output"]
> = {
  id: "novel.volume.chapter_boundary",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: baseContextPolicy,
  semanticRetryPolicy: {
    maxAttempts: 2,
  },
  outputSchema: createChapterBoundarySchema(),
  render: (input, context) => [
    new SystemMessage(createVolumeDetailSystemPrompt("boundary", context.promptLanguage)),
    new HumanMessage(buildChapterDetailPrompt(renderSelectedContextBlocks(context), input.detailMode)),
  ],
  postValidate: (output, input) => validateBoundaryContract(output, input),
};

export const volumeChapterTaskSheetPrompt: PromptAsset<
  VolumeChapterDetailPromptInput,
  ReturnType<typeof createChapterTaskSheetSchema>["_output"]
> = {
  id: "novel.volume.chapter_task_sheet",
  version: "v3",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: baseContextPolicy,
  semanticRetryPolicy: {
    maxAttempts: 2,
  },
  outputSchema: createChapterTaskSheetSchema(),
  render: (input, context) => [
    new SystemMessage(createVolumeDetailSystemPrompt("task_sheet", context.promptLanguage)),
    new HumanMessage(buildChapterDetailPrompt(renderSelectedContextBlocks(context), input.detailMode)),
  ],
  postValidate: (output, input) => validateAdjacentChapterBoundary(output, input),
};

export const volumeChapterExecutionContractPrompt: PromptAsset<
  VolumeChapterDetailPromptInput,
  ReturnType<typeof createChapterExecutionContractSchema>["_output"]
> = {
  id: "novel.volume.chapter_execution_contract",
  version: "v3",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: baseContextPolicy,
  outputSchema: createChapterExecutionContractSchema(),
  render: (input, context) => [
    new SystemMessage(createExecutionContractSystemPrompt(context.promptLanguage)),
    new HumanMessage(buildChapterDetailPrompt(renderSelectedContextBlocks(context), input.detailMode)),
  ],
  postValidate: (output, input) => {
    validateBoundaryContract(output, input);
    validateAdjacentChapterBoundary(output, input);
    return output;
  },
};

export { buildVolumeChapterDetailContextBlocks };
