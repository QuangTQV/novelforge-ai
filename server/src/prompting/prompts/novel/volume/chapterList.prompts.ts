import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { PromptAsset } from "../../../core/promptTypes";
import { renderSelectedContextBlocks } from "../../../core/renderContextBlocks";
import { createVolumeChapterBeatBlockSchema } from "../../../../services/novel/volume/volumeGenerationSchemas";
import { type VolumeChapterListPromptInput } from "./shared";
import { buildVolumeChapterListContextBlocks } from "./contextBlocks";
import { NOVEL_PROMPT_BUDGETS } from "../promptBudgetProfiles";
import {
  getChapterTitleCollisionIssue,
  getChapterTitleDiversityIssue,
  isBlockingChapterTitleQualityIssue,
  isChapterTitleDuplicateIssue,
  isChapterTitleDiversityIssue,
} from "../../../../services/novel/volume/chapterTitleDiversity";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { pick } from "./localize";

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function buildRetryDirective(reason: string | null | undefined, lang: PromptLanguage): string {
  const normalizedReason = reason?.trim();
  if (!normalizedReason) {
    return "";
  }

  return [
    pick(lang,
      "上一次输出没有通过业务校验，本次必须优先修正：",
      "Lần xuất trước không qua kiểm tra nghiệp vụ, lần này phải ưu tiên sửa:",
      "The previous output failed business validation — this time you must fix, as top priority:"),
    normalizedReason,
    pick(lang,
      "先判断失败类型：标题结构、标题基础质量、章节功能、摘要推进、结尾牵引。",
      "Trước hết xác định loại lỗi: cấu trúc tiêu đề, chất lượng nền tiêu đề, chức năng chương, lực đẩy trong tóm tắt, sức kéo phần kết.",
      "First identify the failure type: title structure, baseline title quality, chapter function, progression in the summary, or ending pull."),
    pick(lang,
      "不要只替换被点名的一章；如果问题来自标题同构或章节功能重复，必须重排整组标题骨架和章节功能分配。",
      "Đừng chỉ thay chương bị nêu tên; nếu vấn đề đến từ tiêu đề đồng dạng hoặc chức năng chương lặp lại, phải sắp xếp lại toàn bộ khung tiêu đề và phân bổ chức năng chương.",
      "Do not just replace the one named chapter; if the problem comes from homogeneous titles or repeated chapter functions, you must rearrange the whole group's title skeleton and chapter-function allocation."),
  ].join("\n");
}

function classifyChapterListRetryIssue(reason: string): string {
  if (isChapterTitleDiversityIssue(reason)) {
    return "标题结构：重排整组标题骨架，混用动作推进型、冲突压迫型、异常发现型、结果兑现型、决断转向型和问题钩子型。";
  }
  if (isBlockingChapterTitleQualityIssue(reason)) {
    return "标题基础质量：标题必须短促客观，不能第一人称、不能过长、不能写成完整剧情句。";
  }
  if (reason.includes("章节中主角或核心视角角色的主动行动不足") || reason.includes("连续多章呈现被动推进")) {
    return "章节功能：重排每章职责，让核心视角角色主动选择、试探、反击、布局、交换、隐忍或承担代价。";
  }
  if (reason.includes("过多章节摘要偏空泛")) {
    return "摘要推进：每章 summary 必须写出新增信息、局面变化、冲突推进、关系变化、资源得失或风险转向。";
  }
  if (reason.includes("当前节奏段缺少阶段性兑现") || reason.includes("结尾章缺少当前 beat")) {
    return "结尾牵引：最后一章必须完成当前 beat 的阶段兑现、明确转向或进入下一 beat 的阅读压力。";
  }
  return "综合质量：按失败原因重排标题、章节功能和摘要推进，保证每章都有新增变化。";
}

function resolvePromptConfig(
  input:
    | number
    | {
      targetChapterCount: number;
      targetBeatKey?: string;
      targetBeatLabel?: string | null;
      isBookFinale?: boolean;
      reservedChapterTitles?: string[];
      },
): {
  targetChapterCount: number;
  targetBeatKey: string;
  targetBeatLabel: string;
  isBookFinale: boolean;
  reservedChapterTitles: string[];
} {
  if (typeof input === "number") {
    return {
      targetChapterCount: input,
      targetBeatKey: "target_beat",
      targetBeatLabel: "目标节奏段",
      isBookFinale: false,
      reservedChapterTitles: [],
    };
  }

  return {
    targetChapterCount: input.targetChapterCount,
    targetBeatKey: input.targetBeatKey?.trim() || "target_beat",
    targetBeatLabel: input.targetBeatLabel?.trim() || "目标节奏段",
    isBookFinale: input.isBookFinale === true,
    reservedChapterTitles: input.reservedChapterTitles ?? [],
  };
}

/**
 * 轻量章节功能质量检测。
 *
 * 目的：
 * - 不代替 LLM Critic；
 * - 只拦截最常见的低质量章节块：
 *   1. 连续多章只是调查/发现/意识到；
 *   2. summary 大量空泛；
 *   3. 缺少主角行动；
 *   4. 结尾章没有兑现/转向/钩子。
 *
 * 后续可以把这个函数升级成：
 * - chapterFunctionDiversity.ts
 * - 或一个独立 LLM quality critic 节点。
 */
function getChapterFunctionQualityIssue(
  chapters: Array<{
    title: string;
    summary: string;
    beatKey: string;
  }>,
): string | null {
  if (!chapters.length) {
    return "章节列表不能为空。";
  }

  const summaries = chapters.map((chapter) => chapter.summary.trim());
  const titles = chapters.map((chapter) => chapter.title.trim());

  const vagueSummaryPatterns = [
    /进一步推动/,
    /逐渐展开/,
    /局势变得复杂/,
    /为后续.*铺垫/,
    /埋下伏笔/,
    /产生影响/,
    /意识到.*重要/,
    /发现.*不简单/,
    /开始重视/,
  ];

  const passivePatterns = [
    /得知/,
    /听说/,
    /被告知/,
    /发现/,
    /意识到/,
    /察觉/,
    /局势.*变化/,
    /危机.*出现/,
  ];

  const activePatterns = [
    /决定/,
    /选择/,
    /试探/,
    /反击/,
    /布局/,
    /交换/,
    /逼迫/,
    /隐瞒/,
    /揭穿/,
    /设局/,
    /追查/,
    /拒绝/,
    /承认/,
    /利用/,
    /夺回/,
    /放弃/,
    /承担/,
    /压下/,
    /转向/,
  ];

  const payoffPatterns = [
    /兑现/,
    /反转/,
    /揭开/,
    /坐实/,
    /落定/,
    /反击/,
    /胜出/,
    /败露/,
    /失控/,
    /转向/,
    /代价/,
    /后手/,
    /陷阱/,
    /威胁/,
    /逼到/,
    /不得不/,
  ];

  const hookPatterns = [
    /但/,
    /却/,
    /反而/,
    /没想到/,
    /真正/,
    /背后/,
    /代价/,
    /后手/,
    /陷阱/,
    /更大的/,
    /新的/,
    /逼迫/,
    /不得不/,
    /暴露/,
    /留下/,
  ];

  const vagueCount = summaries.filter((summary) =>
    vagueSummaryPatterns.some((pattern) => pattern.test(summary)),
  ).length;

  if (chapters.length >= 4 && vagueCount >= Math.ceil(chapters.length / 2)) {
    return "过多章节摘要偏空泛，不能大量使用“进一步推动 / 局势复杂 / 为后续铺垫 / 埋下伏笔”等低信息密度表达。";
  }

  const activeCount = summaries.filter((summary) =>
    activePatterns.some((pattern) => pattern.test(summary)),
  ).length;

  if (chapters.length >= 4 && activeCount < Math.ceil(chapters.length / 3)) {
    return "章节中主角或核心视角角色的主动行动不足，不能让多数章节只是外部事件发生或角色被动得知信息。";
  }

  let consecutivePassive = 0;
  for (const summary of summaries) {
    const isPassive = passivePatterns.some((pattern) => pattern.test(summary));
    const isActive = activePatterns.some((pattern) => pattern.test(summary));

    if (isPassive && !isActive) {
      consecutivePassive += 1;
    } else {
      consecutivePassive = 0;
    }

    if (consecutivePassive >= 3) {
      return "连续多章呈现被动推进，例如只是发现、得知、意识到或局势变化，需要改成主动选择、试探、反击、布局或承担代价。";
    }
  }

  if (chapters.length >= 5) {
    const hasPayoffOrTurn = summaries.some((summary) =>
      payoffPatterns.some((pattern) => pattern.test(summary)),
    );

    if (!hasPayoffOrTurn) {
      return "当前节奏段缺少阶段性兑现、转折、反击、代价或局面反转，不能全是平滑铺垫。";
    }
  }

  const lastSummary = summaries[summaries.length - 1] ?? "";
  const lastTitle = titles[titles.length - 1] ?? "";

  const lastHasPayoffOrHook =
    payoffPatterns.some((pattern) => pattern.test(lastSummary)) ||
    hookPatterns.some((pattern) => pattern.test(lastSummary)) ||
    hookPatterns.some((pattern) => pattern.test(lastTitle));

  if (chapters.length >= 3 && !lastHasPayoffOrHook) {
    return "结尾章缺少当前 beat 的阶段兑现、明确转向或进入下一 beat 的阅读牵引。";
  }

  return null;
}

function isChapterFunctionQualityIssue(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("章节中主角或核心视角角色的主动行动不足") ||
    message.includes("连续多章呈现被动推进") ||
    message.includes("当前节奏段缺少阶段性兑现") ||
    message.includes("结尾章缺少当前 beat") ||
    message.includes("过多章节摘要偏空泛")
  );
}

export function createVolumeChapterListPrompt(
  input:
    | number
    | {
        targetChapterCount: number;
        targetBeatKey?: string;
        targetBeatLabel?: string | null;
        isBookFinale?: boolean;
        reservedChapterTitles?: string[];
      },
): PromptAsset<
  VolumeChapterListPromptInput,
  ReturnType<typeof createVolumeChapterBeatBlockSchema>["_output"]
> {
  const { targetChapterCount, targetBeatKey, targetBeatLabel, isBookFinale = false, reservedChapterTitles } =
    resolvePromptConfig(input);

  return {
    id: "novel.volume.chapter_list",
    version: "v9",
    taskType: "planner",
    mode: "structured",
    language: "zh",

    contextPolicy: {
      maxTokensBudget: NOVEL_PROMPT_BUDGETS.volumeChapterList,
      requiredGroups: ["book_contract", "target_volume", "target_beat_contract"],
      preferredGroups: [
        "macro_constraints",
        "beat_context_window",
        "previous_beat_chapters",
        "preserved_beat_chapters",
        "adjacent_volumes",
        "soft_future_summary",
      ],
      dropOrder: ["soft_future_summary"],
    },

    semanticRetryPolicy: {
      maxAttempts: 2,
      buildMessages: ({
        attempt,
        baseMessages,
        parsedOutput,
        validationError,
      }) => {
        const normalizedValidationError = validationError?.trim() || "未通过章节列表业务校验。";
        const retryIssueClass = classifyChapterListRetryIssue(normalizedValidationError);
        return [
          ...baseMessages,
          new HumanMessage(
            [
              `上一次章节块通过了 JSON 结构校验，但没有通过业务校验。这是第 ${attempt} 次语义重试。`,
              `失败原因：${normalizedValidationError}`,
              `失败类型：${retryIssueClass}`,
              "",
              "重写要求：",
              "1. 只重写当前节奏段的章节列表，不得越界生成其他节奏段章节。",
              "2. 必须保留原有章节位数，最终 chapters.length 仍然必须等于目标章数。",
              "3. 必须先按失败类型修复：标题结构问题重排整组标题骨架；标题基础质量问题重写所有不合格标题；章节功能问题重排每章职责；摘要推进问题重写所有空泛摘要；结尾牵引问题重写末章的兑现和转向。",
              "4. 不要只局部替换触发校验的一章；需要保证整组章节的标题骨架、章节功能、摘要推进和结尾牵引同时通过。",
              "5. 若失败原因是标题重复或标题骨架集中，必须重写所有命中重复骨架的标题，而不是只局部修补几章。",
              "6. 若失败原因是章节功能重复，必须重新分配章节功能，避免连续多章只做调查、发现、意识到或铺垫。",
              "7. 每章 summary 必须体现新增推进，优先体现核心视角角色的选择、试探、反击、布局、交换、隐忍或承担代价。",
              "8. 明确避免大量使用“X的Y / X中的Y / 在X中Y”骨架。",
              "9. 明确避免整批标题继续塌成“A，B / 四字动作，四字结果”并列模板。",
              "10. 标题必须是客观章名，不用第一人称，不写成完整剧情句，核心字数不超过 16 个。",
              "11. 每章 beatKey 必须保持为当前目标 beatKey。",
              "12. 摘要必须体现本章造成的局面变化，不得空泛复述标题。",
              isBookFinale
                ? "13. 全书终章必须完成结局合同，不得创建必须续写的新主线或下一 beat 钩子。"
                : "13. 最后一章必须完成当前 beat 的 mustDeliver，同时留下阅读牵引，但不得提前兑现下一 beat 的核心事件。",
              "",
              "上一次的 JSON 输出：",
              safeJsonStringify(parsedOutput),
              "",
              "请重新输出完整 JSON 对象。",
            ].join("\n"),
          ),
        ];
      },
    },

    outputSchema: createVolumeChapterBeatBlockSchema({
      exactChapterCount: targetChapterCount,
      expectedBeatKey: targetBeatKey,
      expectedBeatLabel: targetBeatLabel,
    }),

    render: (promptInput, context) => {
      const lang = context.promptLanguage;
      return [
      new SystemMessage(
        [
          pick(lang,
            "你是连载小说章节拆分规划助手。",
            "Bạn là trợ lý hoạch định tách chương cho tiểu thuyết dài kỳ.",
            "You are a chapter-splitting planning assistant for serialized fiction."),
          pick(lang,
            "你的任务不是写正文，也不是扩写细纲，而是只为当前卷的单个节奏段生成一块可执行的章节列表。",
            "Nhiệm vụ của bạn không phải viết chính văn hay mở rộng dàn ý, mà chỉ tạo một khối danh sách chương khả thi cho một đoạn nhịp của tập hiện tại.",
            "Your task is not to write prose or expand an outline — only to produce one executable chapter-list block for a single pacing segment of the current volume."),
          pick(lang,
            "你必须同时满足：结构化输出正确、章节功能清晰、标题像章节名、摘要有真实推进。",
            "Bạn phải đồng thời đạt: đầu ra có cấu trúc đúng, chức năng chương rõ ràng, tiêu đề giống tên chương thật, tóm tắt có lực đẩy thực sự.",
            "You must simultaneously satisfy: correct structured output, clear chapter functions, titles that read like real chapter names, and summaries with genuine progression."),
          "",
          pick(lang, "一、任务边界", "I. Ranh giới nhiệm vụ", "I. Task boundary"),
          pick(lang,
            `1. 你当前只能为「${targetBeatLabel}」生成 ${targetChapterCount} 章，数量不得多也不得少。`,
            `1. Hiện chỉ được tạo ${targetChapterCount} chương cho beat "${targetBeatLabel}", không nhiều không ít.`,
            `1. You may only generate ${targetChapterCount} chapters for the "${targetBeatLabel}" beat — no more, no fewer.`),
          pick(lang,
            "2. 只允许覆盖当前目标 beat，不得越界生成相邻 beat 的章节。",
            "2. Chỉ được phủ beat mục tiêu hiện tại, không tạo chương của beat liền kề.",
            "2. Only cover the current target beat — do not generate chapters for adjacent beats."),
          pick(lang,
            "3. 不得把两个章节合并成一章摘要，也不得用空泛占位章来凑数。",
            "3. Không gộp hai chương vào một tóm tắt, cũng không dùng chương giữ chỗ chung chung để cho đủ số.",
            "3. Do not merge two chapters into one summary, and do not pad with vague placeholder chapters."),
          pick(lang,
            "4. 若 beat 信息不足，也必须补齐到精确章数，但只能做保守过渡，不得发明重大新设定。",
            "4. Nếu beat thiếu thông tin, vẫn phải điền đủ số chương chính xác, nhưng chỉ làm chuyển tiếp bảo thủ, không phát minh thiết lập lớn mới.",
            "4. If the beat lacks information, still fill exactly to the chapter count — but only with conservative transitions, no major new setting."),
          pick(lang,
            "5. 本任务只生成章节列表，不写正文，不写详细场景，不写完整对白。",
            "5. Nhiệm vụ này chỉ tạo danh sách chương; không viết chính văn, không viết cảnh chi tiết, không viết đối thoại đầy đủ.",
            "5. This task only produces the chapter list — no prose, no detailed scenes, no full dialogue."),
          "",
          pick(lang, "二、硬性输出约束", "II. Ràng buộc đầu ra bắt buộc", "II. Hard output constraints"),
          pick(lang,
            "1. 顶层必须输出 beatKey、beatLabel、chapterCount、chapters 四个字段。",
            "1. Cấp cao nhất phải xuất bốn field: beatKey, beatLabel, chapterCount, chapters.",
            "1. The top level must output four fields: beatKey, beatLabel, chapterCount, chapters."),
          pick(lang,
            "2. 每章只能包含 title、summary、beatKey 三个字段，不得新增字段。",
            "2. Mỗi chương chỉ chứa ba field: title, summary, beatKey; không thêm field.",
            "2. Each chapter contains only three fields: title, summary, beatKey — add no fields."),
          pick(lang,
            `3. beatKey 必须严格等于 ${targetBeatKey}。`,
            `3. beatKey phải bằng đúng ${targetBeatKey}.`,
            `3. beatKey must be exactly ${targetBeatKey}.`),
          pick(lang,
            `4. beatLabel 必须严格等于 ${targetBeatLabel}。`,
            `4. beatLabel phải bằng đúng ${targetBeatLabel}.`,
            `4. beatLabel must be exactly ${targetBeatLabel}.`),
          pick(lang,
            `5. chapterCount 与 chapters.length 必须严格等于 ${targetChapterCount}。`,
            `5. chapterCount và chapters.length phải bằng đúng ${targetChapterCount}.`,
            `5. chapterCount and chapters.length must be exactly ${targetChapterCount}.`),
          pick(lang,
            `6. 每章 beatKey 都必须严格等于 ${targetBeatKey}。`,
            `6. beatKey của mỗi chương phải bằng đúng ${targetBeatKey}.`,
            `6. Every chapter's beatKey must be exactly ${targetBeatKey}.`),
          pick(lang,
            "7. 不得输出 Markdown、注释、解释或任何额外文本。",
            "7. Không xuất Markdown, chú thích, lời giải thích hay bất kỳ văn bản thừa nào.",
            "7. Do not output Markdown, comments, explanations, or any extra text."),
          pick(lang,
            "8. 每章 summary 控制在 40-120 字，只写核心行动、阻力和造成的新局面；禁止扩写场景、对白或正文。",
            "8. Mỗi summary chương giữ trong 40-120 ký tự, chỉ viết hành động cốt lõi, lực cản và cục diện mới tạo ra; cấm triển khai cảnh, đối thoại hay chính văn.",
            "8. Keep each chapter summary within 40-120 characters — only the core action, the resistance, and the new situation it creates; do not expand into scenes, dialogue, or prose."),
          pick(lang,
            "9. 写完指定数量的最后一章后立即结束 JSON，不得追加分析、自检过程或候选版本。",
            "9. Viết xong chương cuối theo đúng số lượng thì kết thúc JSON ngay; không thêm phân tích, quá trình tự kiểm hay bản ứng viên.",
            "9. After the last chapter of the specified count, end the JSON immediately — no appended analysis, self-check process, or candidate versions."),
          "",
          pick(lang, "三、章节规划核心原则", "III. Nguyên tắc cốt lõi khi lập kế hoạch chương", "III. Core chapter-planning principles"),
          pick(lang,
            "1. 章节列表必须严格服从当前卷骨架与当前目标 beat 合同，不能偷跑到相邻 beat。",
            "1. Danh sách chương phải tuân thủ nghiêm ngặt khung tập hiện tại và hợp đồng beat mục tiêu, không được lẻn sang beat liền kề.",
            "1. The chapter list must strictly obey the current volume skeleton and the target beat contract — do not creep into adjacent beats."),
          pick(lang,
            "2. 每章都必须回答：这一章为什么必须存在，它推进了什么，它造成了什么新的局面变化。",
            "2. Mỗi chương phải trả lời: vì sao chương này phải tồn tại, nó đẩy được gì, nó tạo ra biến chuyển cục diện mới nào.",
            "2. Every chapter must answer: why must it exist, what does it advance, and what new situation change does it cause."),
          pick(lang,
            "3. 当前节奏段的章节拆分要体现清晰阅读感，但不能机械平均切分。",
            "3. Việc tách chương của đoạn nhịp này phải có cảm giác đọc rõ ràng, nhưng không được chia đều máy móc.",
            "3. The chapter split for this pacing segment must have a clear reading feel — not a mechanical even division."),
          pick(lang,
            "4. 章节必须形成连续递进，不能出现只是换说法、没有新增推进的信息重复章。",
            "4. Các chương phải tạo tăng tiến liên tục, không được có chương chỉ đổi cách nói mà không thêm tiến triển.",
            "4. Chapters must form continuous progression — no chapter that just rephrases with no added advance."),
          pick(lang,
            "5. 每章 summary 不只要写“发生了什么”，还要写“因此改变了什么”。",
            "5. summary mỗi chương không chỉ viết \"đã xảy ra chuyện gì\" mà còn \"vì thế thay đổi điều gì\".",
            "5. Each chapter's summary states not only \"what happened\" but also \"what therefore changed\"."),
          "",
          pick(lang, "四、章节功能分配要求", "IV. Yêu cầu phân bổ chức năng chương", "IV. Chapter-function allocation requirements"),
          pick(lang,
            "1. 生成前必须在脑内把当前 beat 拆成若干章节功能：承接、加压、试探、发现、转折、反击、兑现、余波或钩子。",
            "1. Trước khi tạo, phải nhẩm tách beat hiện tại thành các chức năng chương: tiếp nối, gia áp, thăm dò, phát hiện, bước ngoặt, phản công, trả nợ, dư âm hoặc móc câu.",
            "1. Before generating, mentally split the current beat into chapter functions: pick-up, pressure, probe, discovery, turn, counter, payoff, aftermath, or hook."),
          pick(lang,
            "2. 实际输出时不要暴露这些功能标签，但每章 summary 必须体现清晰功能。",
            "2. Khi xuất thực tế đừng để lộ các nhãn chức năng này, nhưng summary mỗi chương phải thể hiện chức năng rõ ràng.",
            "2. In the actual output, do not expose these function labels — but each chapter's summary must convey a clear function."),
          pick(lang,
            "3. 连续章节不能承担完全相同的功能，尤其不能连续多章只做调查、讨论、铺垫、等待、意识到或发现。",
            "3. Các chương liên tiếp không được gánh chức năng hoàn toàn giống nhau, đặc biệt không được nhiều chương liền nhau chỉ điều tra, bàn bạc, dàn dựng, chờ đợi, nhận ra hoặc phát hiện.",
            "3. Consecutive chapters must not carry identical functions — especially not several in a row that only investigate, discuss, set up, wait, realize, or discover."),
          pick(lang,
            "4. 若目标章数大于等于 5，至少应包含一次局面加压、一次关键发现或判断反转、一次阶段性兑现或明确转向。",
            "4. Nếu số chương mục tiêu từ 5 trở lên, phải có ít nhất: một lần gia áp cục diện, một lần phát hiện then chốt hoặc đảo phán đoán, một lần trả nợ giai đoạn hoặc chuyển hướng rõ ràng.",
            "4. If the target count is 5 or more, include at least: one situation-pressure beat, one key discovery or judgment reversal, and one phased payoff or clear pivot."),
          pick(lang,
            "5. 关键推进可以占更多章节，过渡章要短促有力，不要为了凑数制造低信息密度章节。",
            "5. Các bước đẩy then chốt có thể chiếm nhiều chương hơn; chương chuyển tiếp phải ngắn gọn mạnh mẽ, đừng tạo chương mật độ thông tin thấp để cho đủ số.",
            "5. Key progressions may take more chapters; transitional chapters must be short and forceful — do not create low-information-density chapters just to fill the count."),
          isBookFinale
            ? pick(lang,
              "6. 全书终章必须完成结局合同中的主冲突、关系变化、核心回报与主题落点，不得留下必须续写的新主线。",
              "6. Các chương kết của cả sách phải hoàn thành xung đột chính, thay đổi quan hệ, phần thưởng cốt lõi và điểm rơi chủ đề trong hợp đồng kết truyện; không được để lại tuyến chính mới bắt buộc phải viết tiếp.",
              "6. The book's finale chapters must complete the main conflict, relationship change, core reward, and thematic landing in the ending contract — no new main line that must be continued.")
            : pick(lang,
              "6. 最后一章必须完成当前 beat 的 mustDeliver，同时留下进入下一 beat 的阅读牵引，但不得提前兑现下一 beat 的核心事件。",
              "6. Chương cuối phải hoàn thành mustDeliver của beat hiện tại, đồng thời để lại sức kéo vào beat sau, nhưng không được trả trước sự kiện cốt lõi của beat sau.",
              "6. The last chapter must complete the current beat's mustDeliver and leave a reading pull into the next beat — but must not pre-deliver the next beat's core event."),
          "",
          pick(lang, "五、章节推进质量要求", "V. Yêu cầu chất lượng lực đẩy chương", "V. Chapter-progression quality requirements"),
          pick(lang,
            "1. 每章 summary 都要体现核心视角角色的选择、试探、反击、隐忍、交换、布局、揭穿、妥协或承担代价，避免角色只是旁观外部事件。",
            "1. summary mỗi chương phải thể hiện lựa chọn, thăm dò, phản công, nhẫn nhịn, đánh đổi, bày thế, vạch trần, thỏa hiệp hoặc trả giá của nhân vật góc nhìn chính; tránh để nhân vật chỉ đứng nhìn sự kiện bên ngoài.",
            "1. Each chapter's summary must show the core POV character choosing, probing, countering, enduring, trading, positioning, exposing, compromising, or paying a price — the character must not merely observe external events."),
          pick(lang,
            "2. 每章 summary 应包含至少一种有效推进：新情报、风险升级、关系变化、资源得失、误判修正、对手后手、阶段兑现。",
            "2. summary mỗi chương phải có ít nhất một tiến triển hữu hiệu: tin mới, rủi ro leo thang, quan hệ thay đổi, được/mất nguồn lực, sửa phán đoán sai, nước đi sau của đối thủ, trả nợ giai đoạn.",
            "2. Each chapter's summary must contain at least one effective advance: new intel, escalated risk, relationship change, resource gain/loss, corrected misjudgment, the opponent's follow-up move, or a phased payoff."),
          pick(lang,
            "3. 不要把章节写成“发现问题—意识到危险—继续调查”的重复链条。",
            "3. Đừng viết các chương thành chuỗi lặp \"phát hiện vấn đề — nhận ra nguy hiểm — tiếp tục điều tra\".",
            "3. Do not write chapters as a repeating chain of \"find a problem — realize the danger — keep investigating\"."),
          pick(lang,
            "4. 可以制造或利用信息差、误判、反常发现、表面胜利下的暗中代价，但不要把完整因果句塞进标题。",
            "4. Có thể tạo hoặc tận dụng chênh lệch thông tin, phán đoán sai, phát hiện bất thường, cái giá ngầm dưới chiến thắng bề mặt — nhưng đừng nhét câu nhân quả đầy đủ vào tiêu đề.",
            "4. You may create or exploit information gaps, misjudgments, anomalous discoveries, or a hidden cost beneath a surface victory — but do not stuff a full cause-effect sentence into the title."),
          pick(lang,
            "5. 每章结尾应隐含新的问题、威胁、机会、误判或选择压力，使下一章有继续阅读的理由。",
            "5. Kết mỗi chương phải hàm chứa vấn đề, mối đe dọa, cơ hội, phán đoán sai hoặc áp lực lựa chọn mới, để chương sau có lý do đọc tiếp.",
            "5. Each chapter's ending should imply a new problem, threat, opportunity, misjudgment, or choice pressure — giving the next chapter a reason to keep reading."),
          pick(lang,
            "6. 当前 beat 内不能所有章节都只做铺垫；必须有实际推进、局面变化或阶段兑现。",
            "6. Trong beat hiện tại, không được để mọi chương chỉ dàn dựng; phải có tiến triển thực, biến chuyển cục diện hoặc trả nợ giai đoạn.",
            "6. Within the current beat, not every chapter can be setup — there must be real progression, situation change, or phased payoff."),
          "",
          pick(lang, "六、标题要求", "VI. Yêu cầu tiêu đề", "VI. Title requirements"),
          pick(lang,
            "1. 每章 title 必须像真实章名，优先体现事件锚点、地点、冲突、异常发现、局面变化、阶段兑现、关系异动或问题钩子。",
            "1. title mỗi chương phải giống tên chương thật, ưu tiên thể hiện mốc sự kiện, địa điểm, xung đột, phát hiện bất thường, biến chuyển cục diện, trả nợ giai đoạn, biến động quan hệ hoặc móc câu vấn đề.",
            "1. Each chapter title must read like a real chapter name — prioritize an event anchor, a place, a conflict, an anomalous discovery, a situation change, a phased payoff, a relationship shift, or a question hook."),
          pick(lang,
            "2. 标题默认使用客观表达，不使用“我 / 我的 / 我却 / 我用 / 替我 / 追杀我”等第一人称自述。",
            "2. Tiêu đề mặc định dùng cách diễn đạt khách quan, không dùng lối tự thuật ngôi thứ nhất (\"tôi / của tôi / tôi lại / tôi dùng...\").",
            "2. Titles default to objective phrasing — no first-person self-narration (\"I / my / I instead / I use...\")."),
          pick(lang,
            "3. 在开始写 chapters 之前，先在脑内完成一次“标题句法配比规划”，再按配比输出，不要边想边重复套模板。",
            "3. Trước khi bắt đầu viết chapters, hãy nhẩm một lần \"kế hoạch tỷ lệ cú pháp tiêu đề\", rồi xuất theo tỷ lệ đó; đừng vừa nghĩ vừa lặp khuôn mẫu.",
            "3. Before writing chapters, mentally plan a \"title-syntax mix ratio\" once, then output to that ratio — do not repeat a template as you go."),
          pick(lang,
            "4. 同一批标题必须主动混用动作推进型、冲突压迫型、异常发现型、结果兑现型、决断转向型、问题钩子型、关系异动型等不同句法。",
            "4. Cùng một loạt tiêu đề phải chủ động trộn các kiểu cú pháp khác nhau: đẩy hành động, ép xung đột, phát hiện bất thường, trả kết quả, quyết đoán chuyển hướng, móc câu vấn đề, biến động quan hệ.",
            "4. Within one batch, actively mix syntax types: action-drive, conflict-pressure, anomalous-discovery, result-payoff, decisive-pivot, question-hook, and relationship-shift."),
          pick(lang,
            "5. 标题核心字数不超过 16 个，推荐 4-12 个字；不要写成长句、完整因果句或剧情梗概。",
            "5. Phần lõi tiêu đề không quá ~16 từ, khuyến nghị 4-12 từ; không viết thành câu dài, câu nhân quả đầy đủ hay tóm tắt cốt truyện.",
            "5. The title's core is at most ~16 words, ideally 4-12; do not write a long sentence, a full cause-effect clause, or a plot synopsis."),
          pick(lang,
            "6. 标题可以有反差，但要短促，例如“密令失真”“阵眼裂缝”；不要写成“某人做了某事，所以某结果发生”。",
            "6. Tiêu đề có thể có tương phản nhưng phải ngắn gọn, ví dụ \"Mật lệnh sai lệch\", \"Vết nứt mắt trận\"; đừng viết thành \"ai đó làm gì, nên kết quả nào xảy ra\".",
            "6. Titles may hold contrast but must be terse, e.g. \"The Corrupted Order\", \"A Crack in the Array Eye\" — not \"someone did something, so a result happened\"."),
          pick(lang,
            "7. 避免只有抽象词（风暴、暗流、危机、真相、抉择、变局等），除非标题里同时有具体对象、动作或反差。",
            "7. Tránh tiêu đề chỉ có từ trừu tượng (bão tố, ngầm lưu, khủng hoảng, sự thật, quyết định, biến cục...), trừ khi tiêu đề có kèm đối tượng, hành động hoặc tương phản cụ thể.",
            "7. Avoid titles that are only abstract words (storm, undercurrent, crisis, truth, choice, upheaval...) unless the title also carries a concrete object, action, or contrast."),
          pick(lang,
            "8. 若当前节奏段有 6 章及以上：任何单一表层骨架都不要超过一半；不能大量重复“X的Y / X中的Y / 在X中Y”这类骨架，最多只占约三成。",
            "8. Nếu đoạn nhịp này có 6 chương trở lên: không khung bề mặt đơn lẻ nào vượt quá một nửa; không lặp nhiều kiểu khung “X的Y / X中的Y / 在X中Y” (Y của X), tối đa chỉ khoảng một phần ba.",
            "8. If this segment has 6+ chapters: no single surface template exceeds half; do not heavily repeat an “X的Y / X中的Y / 在X中Y” (\"X's Y\") template — at most about one third."),
          pick(lang,
            "9. 明确避免让大部分标题继续塌成“A，B / 四字动作，四字结果”并列模板。",
            "9. Tránh rõ ràng việc phần lớn tiêu đề đổ về khuôn song song “A，B / 四字动作，四字结果” (hành động, kết quả).",
            "9. Explicitly avoid most titles collapsing into an “A，B / 四字动作，四字结果” (action, result) parallel template."),
          pick(lang,
            "10. 相邻章节标题不要连续 3 章以上套用同一语法骨架。",
            "10. Tiêu đề các chương liền kề không dùng cùng một khung ngữ pháp quá 3 chương liên tiếp.",
            "10. Adjacent chapter titles must not use the same grammatical template for more than 3 chapters in a row."),
          pick(lang,
            "11. 标题要有推进感与可读性，避免空泛文学化、抽象抒情化、口号化或模板味过重。",
            "11. Tiêu đề phải có cảm giác đẩy và dễ đọc, tránh văn chương hóa sáo rỗng, trữ tình trừu tượng, khẩu hiệu hóa hoặc quá đậm mùi khuôn mẫu.",
            "11. Titles must have a sense of momentum and readability — avoid hollow literariness, abstract lyricism, sloganeering, or a heavy template flavor."),
          pick(lang,
            "12. 主角主动性、选择和代价主要写在 summary 中，不要为了体现主角行动把标题写成第一人称爽点句。",
            "12. Sự chủ động, lựa chọn và cái giá của nhân vật chính chủ yếu viết trong summary; đừng vì thể hiện hành động nhân vật mà viết tiêu đề thành câu \"đã đời\" ngôi thứ nhất.",
            "12. The protagonist's agency, choices, and costs go mainly in the summary — do not turn the title into a first-person gratification line to show the protagonist acting."),
          pick(lang,
            "13. 生成前先自检一遍：是否出现第一人称标题、标题过长、过多“的字结构”、过多逗号并列结构、或连续多章同骨架；若出现，先改再输出。",
            "13. Trước khi tạo hãy tự kiểm một lượt: có tiêu đề ngôi thứ nhất, tiêu đề quá dài, quá nhiều cấu trúc \"của\", quá nhiều cấu trúc song song dấu phẩy, hoặc nhiều chương liền cùng khung không; nếu có, sửa rồi mới xuất.",
            "13. Before generating, self-check once: are there first-person titles, over-long titles, too many possessive structures, too many comma-parallel structures, or many consecutive same-template chapters; if so, fix before output."),
          "",
          pick(lang, "七、摘要要求", "VII. Yêu cầu tóm tắt", "VII. Summary requirements"),
          pick(lang,
            "1. 每章 summary 必须写清本章具体推进了什么，以及它在当前目标 beat 中承担什么作用。",
            "1. summary mỗi chương phải nói rõ chương này đẩy cụ thể điều gì, và nó gánh vai trò gì trong beat mục tiêu hiện tại.",
            "1. Each chapter's summary must state concretely what the chapter advances and what role it plays in the current target beat."),
          pick(lang,
            "2. summary 必须体现新增信息、局面变化、冲突推进、关系变化、代价上升、风险转向或阶段兑现中的至少一种。",
            "2. summary phải thể hiện ít nhất một trong: tin mới, biến chuyển cục diện, đẩy xung đột, thay đổi quan hệ, cái giá tăng, rủi ro chuyển hướng, trả nợ giai đoạn.",
            "2. The summary must show at least one of: new information, situation change, conflict advance, relationship change, rising cost, risk pivot, or phased payoff."),
          pick(lang,
            "3. summary 必须体现本章造成的不可逆变化：人物判断改变、资源状态改变、敌我关系改变、风险等级改变、计划方向改变或读者认知改变。",
            "3. summary phải thể hiện thay đổi không thể đảo ngược do chương này gây ra: phán đoán nhân vật đổi, trạng thái nguồn lực đổi, quan hệ ta-địch đổi, cấp rủi ro đổi, hướng kế hoạch đổi, hoặc nhận thức người đọc đổi.",
            "3. The summary must show the irreversible change this chapter causes: a character's judgment, a resource state, the ally-enemy relationship, the risk level, the plan direction, or the reader's understanding."),
          pick(lang,
            "4. 不要把 summary 写成空泛口号，也不要写成详细剧情复述。",
            "4. Đừng viết summary thành khẩu hiệu chung chung, cũng đừng thành thuật lại tình tiết chi tiết.",
            "4. Do not write the summary as a vague slogan, nor as a detailed plot retelling."),
          pick(lang,
            "5. 相邻章节 summary 不能只是同义重复。",
            "5. summary các chương liền kề không được chỉ lặp lại đồng nghĩa.",
            "5. Adjacent chapters' summaries must not be mere synonymous repetition."),
          pick(lang,
            "6. 不要大量使用“进一步推动剧情”“局势更加复杂”“为后续埋下伏笔”等低信息密度表达。",
            "6. Đừng dùng nhiều các cụm mật độ thông tin thấp như \"đẩy cốt truyện thêm\", \"tình thế phức tạp hơn\", \"gài cài cho về sau\".",
            "6. Do not heavily use low-information phrases like \"advance the plot further\", \"the situation grows more complex\", \"planting foreshadowing for later\"."),
          "",
          pick(lang, "八、beat 承接要求", "VIII. Yêu cầu nối tiếp beat", "VIII. Beat follow-through requirements"),
          pick(lang,
            "1. 本次只覆盖当前目标 beat，不得为相邻 beats 生成章节。",
            "1. Lần này chỉ phủ beat mục tiêu hiện tại, không tạo chương cho các beat liền kề.",
            "1. This pass only covers the current target beat — do not generate chapters for adjacent beats."),
          pick(lang,
            "2. 开头章节要承接前序已生成章节状态，不能把已经发生的推进重新起一遍。",
            "2. Chương mở đầu phải tiếp nối trạng thái các chương đã tạo trước đó, không được khởi động lại tiến triển đã xảy ra.",
            "2. The opening chapter must pick up the state of previously generated chapters — do not restart progression that already happened."),
          pick(lang,
            "3. 中段章节要围绕当前 beat 的核心矛盾持续加压、试探、转折或兑现。",
            "3. Chương đoạn giữa phải xoay quanh xung đột cốt lõi của beat hiện tại để liên tục gia áp, thăm dò, chuyển hướng hoặc trả nợ.",
            "3. Middle chapters must revolve around the current beat's core conflict to keep pressuring, probing, pivoting, or paying off."),
          isBookFinale
            ? pick(lang,
              "4. 全书终章必须完成结局合同，不再要求下一阶段牵引。",
              "4. Các chương kết của cả sách phải hoàn thành hợp đồng kết truyện, không còn yêu cầu sức kéo giai đoạn sau.",
              "4. The book's finale chapters must complete the ending contract — no next-phase pull is required.")
            : pick(lang,
              "4. 结尾章节要把当前 beat 的 mustDeliver 落到位，但不要提前偷跑下一 beat 的核心兑现。",
              "4. Chương kết phải đưa mustDeliver của beat hiện tại vào đúng chỗ, nhưng đừng trả trước phần trả nợ cốt lõi của beat sau.",
              "4. The ending chapters must land the current beat's mustDeliver — but do not pre-run the next beat's core payoff."),
          "",
          pick(lang, "九、质量自检要求", "IX. Yêu cầu tự kiểm chất lượng", "IX. Quality self-check requirements"),
          pick(lang,
            "1. 输出前在脑内检查：章节数量是否精确、beatKey 是否一致、是否越界、是否有重复功能章。",
            "1. Trước khi xuất, nhẩm kiểm: số chương có chính xác, beatKey có nhất quán, có vượt ranh giới, có chương trùng chức năng.",
            "1. Before output, mentally check: is the chapter count exact, is beatKey consistent, is there boundary creep, are there repeated-function chapters."),
          pick(lang,
            "2. 输出前在脑内检查：标题是否过度同构，summary 是否有真实推进，结尾章是否有阶段兑现或阅读牵引。",
            "2. Trước khi xuất, nhẩm kiểm: tiêu đề có quá đồng dạng, summary có tiến triển thật, chương kết có trả nợ giai đoạn hoặc sức kéo đọc.",
            "2. Before output, mentally check: are titles over-homogeneous, do summaries have real progression, does the ending chapter have a phased payoff or reading pull."),
          pick(lang,
            "3. 若发现章节只是换说法、无新增推进、无主角行动、无局面变化，必须先改再输出。",
            "3. Nếu phát hiện chương chỉ đổi cách nói, không thêm tiến triển, không có hành động nhân vật chính, không biến chuyển cục diện, phải sửa rồi mới xuất.",
            "3. If a chapter merely rephrases with no added advance, no protagonist action, and no situation change, you must fix it before output."),
          "",
          buildRetryDirective(promptInput.retryReason, lang),
        ]
          .filter(Boolean)
          .join("\n"),
      ),

      new HumanMessage(
        [
          pick(lang,
            "请基于以下上下文，输出当前节奏段的章节块。",
            "Dựa trên ngữ cảnh dưới đây, hãy xuất khối chương của đoạn nhịp hiện tại.",
            "Based on the context below, output the chapter block for the current pacing segment."),
          "",
          pick(lang, "输出要求：", "Yêu cầu đầu ra:", "Output requirements:"),
          pick(lang, "- 只输出严格 JSON", "- Chỉ xuất JSON nghiêm ngặt", "- Output strict JSON only"),
          pick(lang,
            `- beatKey 必须严格等于 ${targetBeatKey}`,
            `- beatKey phải bằng đúng ${targetBeatKey}`,
            `- beatKey must be exactly ${targetBeatKey}`),
          pick(lang,
            `- beatLabel 必须严格等于 ${targetBeatLabel}`,
            `- beatLabel phải bằng đúng ${targetBeatLabel}`,
            `- beatLabel must be exactly ${targetBeatLabel}`),
          pick(lang,
            `- chapterCount 与 chapters.length 必须严格等于 ${targetChapterCount}`,
            `- chapterCount và chapters.length phải bằng đúng ${targetChapterCount}`,
            `- chapterCount and chapters.length must be exactly ${targetChapterCount}`),
          pick(lang,
            "- 每章只能包含 title、summary、beatKey",
            "- Mỗi chương chỉ chứa title, summary, beatKey",
            "- Each chapter contains only title, summary, beatKey"),
          pick(lang,
            "- 不得生成任何相邻 beat 的章节",
            "- Không tạo chương của bất kỳ beat liền kề nào",
            "- Do not generate any adjacent-beat chapters"),
          pick(lang,
            "- 先在脑内规划章节功能分配与标题骨架配比，再输出完整章节块",
            "- Nhẩm kế hoạch phân bổ chức năng chương và tỷ lệ khung tiêu đề trước, rồi mới xuất khối chương hoàn chỉnh",
            "- Mentally plan the chapter-function allocation and title-template ratio first, then output the full chapter block"),
          pick(lang,
            "- 优先保证章节推进感、节奏承接、标题结构分散、摘要中的角色主动性与结尾牵引",
            "- Ưu tiên bảo đảm: cảm giác đẩy, nối tiếp nhịp, khung tiêu đề phân tán, sự chủ động của nhân vật trong tóm tắt và sức kéo phần kết",
            "- Prioritize: sense of momentum, pacing follow-through, distributed title structure, character agency in the summaries, and ending pull"),
          pick(lang,
            "- 标题必须短促客观，不使用第一人称，不写成长句或剧情梗概",
            "- Tiêu đề phải ngắn gọn khách quan, không dùng ngôi thứ nhất, không viết thành câu dài hay tóm tắt cốt truyện",
            "- Titles must be terse and objective, no first person, not a long sentence or plot synopsis"),
          "",
          pick(lang, "当前卷拆章上下文：", "Ngữ cảnh tách chương của tập hiện tại:", "Current volume chapter-split context:"),
          renderSelectedContextBlocks(context),
        ].join("\n"),
      ),
    ];
    },

    postValidate: (output) => {
      if (output.beatKey !== targetBeatKey) {
        throw new Error(`beatKey 必须严格等于 ${targetBeatKey}。`);
      }

      if (output.beatLabel !== targetBeatLabel) {
        throw new Error(`beatLabel 必须严格等于 ${targetBeatLabel}。`);
      }

      if (
        output.chapterCount !== targetChapterCount ||
        output.chapters.length !== targetChapterCount
      ) {
        throw new Error(
          `chapterCount 与 chapters.length 必须严格等于 ${targetChapterCount}。`,
        );
      }

      output.chapters.forEach((chapter, index) => {
        if (chapter.beatKey !== targetBeatKey) {
          throw new Error(
            `第 ${index + 1} 条章节的 beatKey 必须严格等于 ${targetBeatKey}。`,
          );
        }
      });

      const titleDiversityIssue = getChapterTitleDiversityIssue(
        output.chapters.map((chapter) => chapter.title),
      );

      if (titleDiversityIssue) {
        throw new Error(titleDiversityIssue);
      }

      const titleCollisionIssue = getChapterTitleCollisionIssue(
        reservedChapterTitles,
        output.chapters.map((chapter) => chapter.title),
      );

      if (titleCollisionIssue) {
        throw new Error(titleCollisionIssue);
      }

      const chapterFunctionQualityIssue = getChapterFunctionQualityIssue(
        output.chapters,
      );

      if (chapterFunctionQualityIssue) {
        throw new Error(chapterFunctionQualityIssue);
      }

      return output;
    },

    postValidateFailureRecovery: ({ rawOutput, validationError }) => {
      if (isBlockingChapterTitleQualityIssue(validationError) || isChapterTitleDuplicateIssue(validationError)) {
        throw new Error(validationError);
      }

      if (isChapterTitleDiversityIssue(validationError) || isChapterFunctionQualityIssue(validationError)) {
        return rawOutput;
      }

      throw new Error(validationError);
    },
  };
}

export { buildVolumeChapterListContextBlocks };
