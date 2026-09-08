import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { resolvePromptLanguage, type PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { NovelLanguage } from "@ai-novel/shared/types/novel";
import type { PromptAsset } from "../../core/promptTypes";
import { novelBiblePayloadSchema } from "../../../services/novel/novelCoreSchemas";

/** Chọn biến thể theo ngôn ngữ instruction. Không có bộ prompt riêng ⇒ tiếng Anh. */
function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

/**
 * Chèn khối "story mode / 流派模式" (do buildStoryModePromptBlock tạo) như ràng buộc
 * cứng về kiến trúc tự sự: trần xung đột, tín hiệu bắt buộc lặp lại, dạng xung đột cấm.
 * Trả mảng rỗng khi không có story mode.
 */
function storyModeBlockLines(lang: PromptLanguage, storyModeContext?: string): string[] {
  const text = storyModeContext?.trim();
  if (!text) {
    return [];
  }
  return [
    "",
    pick(lang,
      "【流派模式约束（硬约束：决定这本书的叙事密度与冲突上限，优先级高于泛化叙事习惯）】",
      "【Ràng buộc Story Mode (ràng buộc cứng: quyết định mật độ tự sự và trần xung đột của sách này, ưu tiên hơn thói quen kể chuyện chung chung)】",
      "[Story-mode constraints (hard constraint: sets this book's narrative density and conflict ceiling — overrides generic narrative habits)]"),
    text,
  ];
}

export interface NovelOutlinePromptInput {
  title: string;
  description: string;
  charactersText: string;
  worldContext: string;
  referenceContext?: string;
  initialPrompt?: string;
  /** Khối ràng buộc story mode (buildStoryModePromptBlock). Không truyền ⇒ bỏ qua. */
  storyModeContext?: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

export interface NovelStructuredOutlinePromptInput {
  charactersText: string;
  worldContext: string;
  outline: string;
  referenceContext?: string;
  totalChapters: number;
  /** Khối ràng buộc story mode (buildStoryModePromptBlock). Không truyền ⇒ bỏ qua. */
  storyModeContext?: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

export interface NovelStructuredOutlineRepairPromptInput {
  rawContent: string;
  totalChapters: number;
  reason: string;
}

export interface NovelBiblePromptInput {
  title: string;
  genreName: string;
  description: string;
  charactersText: string;
  worldContext: string;
  referenceContext?: string;
  /** Khối ràng buộc story mode (buildStoryModePromptBlock). Không truyền ⇒ bỏ qua. */
  storyModeContext?: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

export interface NovelBeatPromptInput {
  title: string;
  description: string;
  worldContext: string;
  bibleRawContent: string;
  targetChapters: number;
  referenceContext?: string;
  /** Khối ràng buộc story mode (buildStoryModePromptBlock). Không truyền ⇒ bỏ qua. */
  storyModeContext?: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

export interface NovelChapterHookPromptInput {
  title: string;
  content: string;
}

const novelBeatPayloadSchema = z.array(
  z.object({
    chapterOrder: z.union([z.number(), z.string()]).optional(),
    beatType: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
);

const novelChapterHookSchema = z.object({
  hook: z.string().optional(),
  nextExpectation: z.string().optional(),
}).passthrough();

function buildStructuredOutlineSystemPrompt(totalChapters: number): string {
  return [
    "You are a structured novel outline planning engine.",
    "Your task is to generate a chapter-by-chapter outline for a novel as strict structured data, not prose.",
    "",
    "[Task Boundary]",
    "Output exactly one JSON array and nothing else.",
    `The array must contain exactly ${totalChapters} objects.`,
    "Do not output markdown, code fences, comments, explanations, or any text before or after the JSON.",
    "",
    "[Schema Requirements]",
    "Each object must contain exactly these keys, with no additional keys:",
    "- chapter: positive integer",
    "- title: string",
    "- summary: string",
    "- key_events: string[]",
    "- roles: string[]",
    "",
    "[Hard Constraints]",
    `Chapter numbers must be continuous integers from 1 to ${totalChapters}.`,
    "The value of chapter must match the chapter's actual position in the array.",
    "title must be a non-empty string and should feel like a real chapter title, not a placeholder.",
    "summary must be a non-empty string that explains what newly advances in that chapter and why the chapter matters in the story flow.",
    "key_events must contain 1-5 non-empty strings describing concrete developments, turns, reveals, conflicts, or decisions.",
    "roles must contain the major participating characters or forces that are materially involved in that chapter.",
    "",
    "[Quality Requirements]",
    "Each chapter must create real forward movement and should not feel like filler.",
    "Adjacent chapters must not repeat the same function, event pattern, or summary in different wording.",
    "The outline should show progression, escalation, turning points, and payoff rhythm across the full chapter sequence.",
    "Do not write vague generic summaries such as 'the plot continues' or 'tension rises'.",
    "Do not use placeholder role names unless they already exist in the provided context.",
    "",
    "[Consistency Rules]",
    "Do not introduce contradictions with the provided setting, characters, or prior constraints.",
    "Do not invent major new core characters, world rules, or premise shifts unless the user context explicitly supports them.",
    "Maintain continuity across chapters so later chapters feel like natural consequences of earlier ones.",
    "",
    "[Output Reminder]",
    "Return only the JSON array.",
  ].join("\n");
}

function buildStructuredOutlineRepairSystemPrompt(totalChapters: number): string {
  return [
    "You are a strict JSON repair engine.",
    "Your task is to transform the given input into a valid JSON array that strictly follows the required schema.",
    "",
    "[Task Boundary]",
    "Output exactly one JSON array and nothing else.",
    `The array must contain exactly ${totalChapters} objects.`,
    "Do not output markdown, code fences, comments, explanations, or any extra text.",
    "",
    "[Schema Requirements]",
    "Each object must contain exactly these keys (no more, no less):",
    "- chapter: positive integer",
    "- title: string",
    "- summary: string",
    "- key_events: string[]",
    "- roles: string[]",
    "",
    "[Hard Constraints]",
    `Chapter numbers must be continuous from 1 to ${totalChapters}.`,
    "The value of chapter must match its position in the array.",
    "All string fields must be non-empty.",
    "key_events must contain 1-5 non-empty strings.",
    "roles must contain at least 1 non-empty string.",
    "",
    "[Repair Rules]",
    "If the input contains extra fields, remove them.",
    "If required fields are missing, infer and fill them conservatively based on the input.",
    "If chapter count is incorrect, trim or expand to match the required count.",
    "If structure is broken, reconstruct it into valid JSON.",
    "If text contains non-JSON content, extract and convert it into valid JSON.",
    "",
    "[Consistency Rules]",
    "Preserve as much original content as possible while fixing structure.",
    "Do not invent major new plot elements or characters unless necessary to complete missing fields.",
    "Maintain logical continuity across chapters when possible.",
    "",
    "[Output Reminder]",
    "Return only the JSON array.",
  ].join("\n");
}

export const novelOutlinePrompt: PromptAsset<NovelOutlinePromptInput, string, string> = {
  id: "novel.outline.generate",
  version: "v1",
  taskType: "planner",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    const referenceBlock = input.referenceContext?.trim()
      ? "\n\n" + pick(lang,
        "【参考资料（仅作技法参考，不得照搬结构或剧情）】",
        "【Tư liệu tham khảo (chỉ tham khảo kỹ thuật, không sao chép cấu trúc hay tình tiết)】",
        "[Reference material (technique reference only — do not copy structure or plot)]") + "\n" + input.referenceContext
      : "";

    const initialPrompt = input.initialPrompt?.trim() ?? "";
    const initialPromptBlock = initialPrompt
      ? "\n\n" + pick(lang,
        "【用户补充要求（优先参考，但不得违背既有角色与世界设定）】",
        "【Yêu cầu bổ sung của người dùng (ưu tiên tham khảo, nhưng không được trái với nhân vật và thiết lập thế giới đã có)】",
        "[Additional user requirements (prioritize these, but never contradict the existing characters and world setup)]") + "\n" + initialPrompt.slice(0, 2000)
      : "";

    return [
      new SystemMessage([
        pick(lang,
          "你是长篇连载小说发展走向策划师。",
          "Bạn là nhà hoạch định hướng phát triển tổng thể cho tiểu thuyết dài kỳ.",
          "You are a story-development planner for long-form serialized fiction."),
        pick(lang,
          "你的任务不是写正文，而是基于已有设定，输出一份具有可写性、可扩展性和长期连载潜力的整体发展走向。",
          "Nhiệm vụ của bạn không phải viết nội dung truyện, mà dựa trên thiết lập đã có để xuất ra một hướng phát triển tổng thể: khả thi để viết, có không gian mở rộng và có tiềm năng ra chương dài kỳ.",
          "Your task is not to write prose but to produce an overall story-development direction that is writable, expandable, and sustainable over a long serialized run — based on the existing setup."),
        "",
        pick(lang, "【任务边界】", "【Ranh giới nhiệm vụ】", "[Task boundary]"),
        pick(lang,
          "只输出小说发展走向，不写正文，不写对白，不写具体章节划分。",
          "Chỉ xuất hướng phát triển của truyện; không viết nội dung, không viết hội thoại, không chia chương cụ thể.",
          "Output only the story-development direction — no prose, no dialogue, no chapter-by-chapter breakdown."),
        pick(lang,
          "不得输出解释、Markdown 或额外说明。",
          "Không xuất lời giải thích, Markdown hay phần chú thích thừa.",
          "Do not output explanations, Markdown, or extra notes."),
        "",
        pick(lang, "【核心约束】", "【Ràng buộc cốt lõi】", "[Core constraints]"),
        pick(lang,
          "1. 必须严格使用给定核心角色，不得新增、替换或忽略关键角色。",
          "1. Phải dùng đúng các nhân vật cốt lõi đã cho; không thêm, thay hay bỏ qua nhân vật then chốt.",
          "1. Use exactly the given core characters — do not add, replace, or ignore key characters."),
        pick(lang,
          "2. 必须服从已有世界设定，不得引入冲突规则或越界设定。",
          "2. Phải tuân theo thiết lập thế giới đã có; không đưa vào luật lệ mâu thuẫn hay thiết lập vượt ranh giới.",
          "2. Obey the established world setup — do not introduce conflicting rules or out-of-bounds setting."),
        pick(lang,
          "3. 不得无依据扩展大量世界观细节，重点放在剧情推进与结构设计。",
          "3. Không mở rộng ồ ạt chi tiết thế giới quan khi không có căn cứ; trọng tâm là lực đẩy cốt truyện và thiết kế cấu trúc.",
          "3. Do not bloat worldbuilding detail without basis — focus on plot momentum and structural design."),
        pick(lang,
          "4. 每个阶段都必须由给定角色的目标、恐惧、创伤、误信与关系张力驱动，把这些当作冲突引擎，而不是脱离角色空谈局势。",
          "4. Mỗi giai đoạn phải được dẫn dắt bởi mục tiêu, nỗi sợ, vết thương, niềm tin sai lệch và quan hệ của các nhân vật đã cho — coi đó là động cơ xung đột, không bàn tình thế tách rời nhân vật.",
          "4. Every phase must be driven by the given characters' goals, fears, wounds, misbeliefs, and relationship tensions — treat those as the conflict engine, not abstract situation-talk detached from the characters."),
        pick(lang,
          "5. 如提供了流派模式约束，必须严格服从其冲突上限、必须反复出现的信号和禁止的冲突形式：高压悬念题材要让走向密集地制造未知、反转与信息代价；日常/治愈/恋爱喜剧题材不得靠不断加码生死危机推进，要靠关系、情绪与低烈度变化维持吸引力。",
          "5. Nếu có ràng buộc story mode, phải tuân nghiêm trần xung đột, các tín hiệu bắt buộc lặp lại và dạng xung đột bị cấm: đề tài hồi hộp cao áp thì hướng đi phải liên tục tạo ẩn số, đảo chiều và cái giá của thông tin; đề tài đời thường/chữa lành/romcom thì không được đẩy truyện bằng cách chồng thêm nguy hiểm sinh tử, mà giữ sức hút bằng quan hệ, cảm xúc và các biến chuyển nhẹ.",
          "5. If a story-mode constraint is provided, strictly obey its conflict ceiling, mandatory recurring signals, and forbidden conflict forms: high-tension suspense stories must keep the direction dense with unknowns, reversals, and the cost of information; slice-of-life / healing / romcom stories must not advance by piling on life-or-death stakes — they hold attention through relationships, emotion, and low-intensity change."),
        "",
        pick(lang, "【输出目标】", "【Mục tiêu đầu ra】", "[Output goal]"),
        pick(lang,
          "生成一份“可持续连载”的发展走向，而不是一次性完整剧透。需要同时具备：开局抓力、中段扩展空间、后段升级潜力。",
          "Tạo ra hướng phát triển \"đủ sức đi dài kỳ\", không phải một bản spoil trọn vẹn một lần. Cần đồng thời có: lực hút ở đoạn mở đầu, không gian mở rộng ở đoạn giữa, tiềm năng nâng cấp ở đoạn sau.",
          "Produce a direction that can sustain a long serialized run, not a one-shot full spoiler. It must simultaneously have: opening pull, mid-run expansion space, and late-run escalation potential."),
        "",
        pick(lang, "【结构要求】", "【Yêu cầu cấu trúc】", "[Structure requirements]"),
        pick(lang, "发展走向必须包含以下层次：", "Hướng phát triển phải gồm các tầng sau:", "The direction must contain the following layers:"),
        pick(lang,
          "1. 起始局面：主角当前处境、核心困境与初始驱动力。",
          "1. Tình thế khởi đầu: hoàn cảnh hiện tại của nhân vật chính, thế bí cốt lõi và động lực ban đầu.",
          "1. Starting situation: the protagonist's current predicament, core dilemma, and initial drive."),
        pick(lang,
          "2. 主线驱动：贯穿全书的核心目标或问题。",
          "2. Động lực tuyến chính: mục tiêu hoặc câu hỏi cốt lõi xuyên suốt cả truyện.",
          "2. Main-line driver: the core goal or question that runs through the whole book."),
        pick(lang,
          "3. 冲突演化路径：从初级冲突 → 扩展冲突 → 复杂冲突的升级方式。",
          "3. Đường tiến hóa xung đột: cách leo thang từ xung đột sơ cấp → xung đột mở rộng → xung đột phức tạp.",
          "3. Conflict evolution path: how it escalates from primary conflict → expanded conflict → complex conflict."),
        pick(lang,
          "4. 阶段性推进：明确多个阶段，每个阶段要有不同目标、压力来源与局面变化。",
          "4. Tiến triển theo giai đoạn: nêu rõ nhiều giai đoạn, mỗi giai đoạn có mục tiêu, nguồn áp lực và biến chuyển tình thế khác nhau.",
          "4. Phased progression: define multiple phases, each with a different goal, pressure source, and change in the situation."),
        pick(lang,
          "5. 关键转折：至少设计数个会改变局面的关键节点（认知变化 / 关系变化 / 规则揭示 / 局势反转）。",
          "5. Bước ngoặt then chốt: thiết kế ít nhất vài nút quan trọng làm đổi cục diện (thay đổi nhận thức / thay đổi quan hệ / hé lộ luật lệ / đảo chiều tình thế).",
          "5. Key turning points: design at least several pivotal nodes that change the situation (shift in understanding / shift in relationships / rule reveal / reversal of the balance)."),
        pick(lang,
          "6. 成长与变化：主角在不同阶段的能力、认知或立场变化。",
          "6. Trưởng thành và thay đổi: năng lực, nhận thức hoặc lập trường của nhân vật chính thay đổi qua từng giai đoạn.",
          "6. Growth and change: how the protagonist's capability, understanding, or stance changes across phases."),
        pick(lang,
          "7. 高层走向：整体发展方向与可能的终局趋势（但不要写死所有细节）。",
          "7. Hướng đi tầm cao: chiều phát triển tổng thể và xu hướng kết cục khả dĩ (nhưng đừng chốt chết mọi chi tiết).",
          "7. High-level trajectory: the overall direction and a plausible endgame tendency (but do not lock down every detail)."),
        "",
        pick(lang, "【连载导向要求】", "【Yêu cầu định hướng dài kỳ】", "[Serialization requirements]"),
        pick(lang,
          "1. 前期必须快速建立核心吸引力与阅读钩子，避免长时间铺垫。",
          "1. Đoạn đầu phải nhanh chóng xác lập điểm hấp dẫn cốt lõi và móc câu người đọc, tránh dàn trải lâu.",
          "1. The opening must quickly establish the core appeal and a reading hook — avoid long setup."),
        pick(lang,
          "2. 中期必须不断引入新变化（新压力 / 新关系 / 新局面），避免重复同一模式。",
          "2. Đoạn giữa phải liên tục đưa vào biến chuyển mới (áp lực mới / quan hệ mới / cục diện mới), tránh lặp lại cùng một khuôn.",
          "2. The middle must keep introducing new change (new pressure / new relationships / new situations) — avoid repeating one pattern."),
        pick(lang,
          "3. 后期必须具备升级空间，避免过早封顶或提前透支高潮。",
          "3. Đoạn sau phải còn không gian nâng cấp, tránh chạm trần quá sớm hay vắt kiệt cao trào trước hạn.",
          "3. The later run must retain room to escalate — avoid capping out early or spending the climax prematurely."),
        pick(lang,
          "4. 整体走向要保留可调整空间，不要把所有发展路径写死。",
          "4. Hướng đi tổng thể phải chừa khoảng điều chỉnh, đừng chốt chết mọi lối phát triển.",
          "4. Keep the overall direction adjustable — do not hard-lock every development path."),
        "",
        pick(lang, "【质量要求】", "【Yêu cầu chất lượng】", "[Quality requirements]"),
        pick(lang,
          "1. 每个阶段都要体现“为什么值得写”，而不是泛泛推进。",
          "1. Mỗi giai đoạn phải cho thấy \"vì sao đáng viết\", không phải đẩy truyện chung chung.",
          "1. Every phase must show \"why it is worth writing\" — not generic forward motion."),
        pick(lang,
          "2. 避免重复同类冲突或同一套路循环。",
          "2. Tránh lặp lại cùng loại xung đột hay xoay vòng cùng một mô-típ.",
          "2. Avoid repeating the same kind of conflict or cycling the same trope."),
        pick(lang,
          "3. 优先强化人物处境、选择压力与情绪推动，而不是堆叠设定。",
          "3. Ưu tiên tô đậm hoàn cảnh nhân vật, áp lực lựa chọn và lực đẩy cảm xúc, thay vì chồng chất thiết lập.",
          "3. Prioritize the characters' predicament, the pressure of their choices, and emotional momentum over piling on setting."),
        pick(lang,
          "4. 具体、可执行；禁止“进一步发展”“冲突升级”“局势变得复杂”这类空话，必须写清是什么在推进、被谁推进、后果是什么。",
          "4. Cụ thể, khả thi; cấm những câu rỗng như \"phát triển thêm\", \"xung đột leo thang\", \"tình thế trở nên phức tạp\" — phải nói rõ điều gì đang tiến triển, do ai, hệ quả ra sao.",
          "4. Be concrete and actionable; ban empty phrases like \"develops further\", \"conflict escalates\", \"the situation grows complex\" — state what advances, driven by whom, with what consequence."),
        pick(lang,
          "5. 在信息不足时允许合理补强，但必须克制、连贯。",
          "5. Khi thiếu thông tin, được phép bổ sung hợp lý, nhưng phải tiết chế và mạch lạc.",
          "5. When information is missing, reasonable reinforcement is allowed, but it must stay restrained and coherent."),
        "",
        pick(lang, "【最终自检】", "【Tự kiểm tra cuối】", "[Final self-check]"),
        pick(lang,
          "输出前逐阶段核对：每个阶段是否较上一阶段有升级或转向、是否由角色驱动、是否避免了空话；若某阶段不达标，先改写再输出。",
          "Trước khi xuất, rà từng giai đoạn: có leo thang hoặc chuyển hướng so với giai đoạn trước không, có do nhân vật dẫn dắt không, có tránh được câu rỗng không; nếu giai đoạn nào chưa đạt, hãy viết lại trước khi xuất.",
          "Before output, check each phase in turn: does it escalate or pivot versus the previous phase, is it character-driven, does it avoid empty phrasing; if any phase falls short, rewrite it before returning the result."),
      ].join("\n")),
      new HumanMessage([
        pick(lang, `小说标题：${input.title}`, `Tên truyện: ${input.title}`, `Novel title: ${input.title}`),
        pick(lang, `小说简介：${input.description}`, `Tóm tắt truyện: ${input.description}`, `Novel synopsis: ${input.description}`),
        "",
        pick(lang,
          "【核心角色（必须使用，不得替换或忽略）】",
          "【Nhân vật cốt lõi (bắt buộc dùng, không được thay thế hay bỏ qua)】",
          "[Core characters (must be used — do not replace or ignore)]"),
        input.charactersText,
        "",
        pick(lang, "【世界上下文】", "【Bối cảnh thế giới】", "[World context]"),
        input.worldContext,
        ...storyModeBlockLines(lang, input.storyModeContext),
        referenceBlock,
        initialPromptBlock,
        "",
        pick(lang, "请输出完整的发展走向。", "Hãy xuất hướng phát triển đầy đủ.", "Output the complete story-development direction."),
      ].join("\n")),
    ];
  },
};

export const novelStructuredOutlinePrompt: PromptAsset<
  NovelStructuredOutlinePromptInput,
  string,
  string
> = {
  id: "novel.structuredOutline.generate",
  version: "v1",
  taskType: "planner",
  mode: "text",
  language: "en",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    const referenceBlock = input.referenceContext?.trim()
      ? "\n\n" + pick(lang,
        "【参考资料（仅作技法参考，不得照搬剧情或结构）】",
        "【Tư liệu tham khảo (chỉ tham khảo kỹ thuật, không sao chép tình tiết hay cấu trúc)】",
        "[Reference material (technique reference only — do not copy plot or structure)]") + "\n" + input.referenceContext
      : "";

    return [
      new SystemMessage([
        buildStructuredOutlineSystemPrompt(input.totalChapters),
        "",
        "[Content Requirements]",
        "The outline must reflect clear progression, escalation, and turning points across chapters.",
        "Each chapter must introduce meaningful change (event, decision, reveal, conflict, or consequence).",
        "Every chapter's developments must be driven by the given characters' goals, wounds, and relationships — not generic situation-talk.",
        "Avoid filler chapters or repeated patterns across adjacent chapters.",
        "Ban vague summaries such as \"the plot advances\", \"tension rises\", \"things get complicated\" — state concretely what changes and why it matters.",
        "",
        "[Continuity Rules]",
        "All chapters must follow the provided story-development direction and remain consistent with characters and world context.",
        "Do not introduce new core characters unless clearly implied by the context.",
        "Do not contradict established setting or prior developments.",
        "",
        "[Chapter Function Guidance]",
        "Early chapters must establish hook, situation, and main conflict.",
        "Middle chapters must expand, complicate, and escalate.",
        "Later chapters must intensify pressure and deliver partial or major payoffs.",
        "If a story-mode constraint is provided, its conflict ceiling, mandatory recurring signals, and forbidden conflict forms outrank the generic guidance above: a low-ceiling healing/romance/comedy mode must NOT escalate toward life-or-death stakes — pace it through relationship, emotion, and small reversals; a high-ceiling suspense/gambit mode must keep reveals, reversals, and information cost dense across the chapter sequence.",
        "",
        pick(lang,
          "[Output Language] title 与 summary、key_events 的自然语言内容必须使用简体中文。",
          "[Output Language] Nội dung ngôn ngữ tự nhiên trong title, summary và key_events phải viết bằng tiếng Việt tự nhiên, không mang dấu vết dịch máy.",
          "[Output Language] The natural-language content of title, summary, and key_events must be written in English."),
      ].join("\n")),
      new HumanMessage([
        pick(lang,
          "【核心角色（必须使用，不得替换或忽略）】",
          "【Nhân vật cốt lõi (bắt buộc dùng, không được thay thế hay bỏ qua)】",
          "[Core characters (must be used — do not replace or ignore)]"),
        input.charactersText,
        "",
        pick(lang, "【世界上下文】", "【Bối cảnh thế giới】", "[World context]"),
        input.worldContext,
        ...storyModeBlockLines(lang, input.storyModeContext),
        "",
        pick(lang,
          "【发展走向（必须严格承接，不得偏离主线）】",
          "【Hướng phát triển (phải bám sát tuyệt đối, không được lệch tuyến chính)】",
          "[Story-development direction (follow strictly — do not deviate from the main line)]"),
        input.outline,
        referenceBlock,
        "",
        pick(lang,
          `请基于以上内容，生成 ${input.totalChapters} 章的结构化章节规划。`,
          `Dựa trên nội dung trên, hãy tạo kế hoạch chương có cấu trúc cho ${input.totalChapters} chương.`,
          `Based on the above, generate a structured chapter plan for ${input.totalChapters} chapters.`),
        "",
        "[Output requirements (strict)]",
        "1. Only output a JSON array.",
        "2. Each object must contain exactly: chapter, title, summary, key_events, roles.",
        "3. chapter must be continuous from 1.",
        "4. key_events and roles must be non-empty string arrays.",
        "5. No explanations, no extra text.",
      ].join("\n")),
    ];
  },
};

export const novelStructuredOutlineRepairPrompt: PromptAsset<
  NovelStructuredOutlineRepairPromptInput,
  string,
  string
> = {
  id: "novel.structuredOutline.repair",
  version: "v1",
  taskType: "planner",
  mode: "text",
  language: "en",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => [
    new SystemMessage(
      [
        buildStructuredOutlineRepairSystemPrompt(input.totalChapters),
        "",
        "[Priority]",
        "Fix structural validity first (JSON shape, keys, count, types).",
        "Then ensure minimal semantic correctness while preserving original content.",
        "",
        "[Strict Enforcement]",
        "If input is partially valid, do not re-generate everything; repair in place.",
        "Do not add explanations or comments.",
      ].join("\n"),
    ),
    new HumanMessage(
      [
        "请将下面内容修正为严格结构化 JSON 数组（优先修结构，其次补语义）：",
        "",
        `【校验失败原因】`,
        input.reason,
        "",
        "【原始内容】",
        input.rawContent,
        "",
        "【输出要求（必须严格遵守）】",
        `- 必须输出 ${input.totalChapters} 个对象`,
        "- 每个对象只能包含：chapter, title, summary, key_events, roles",
        "- chapter 必须从 1 连续递增",
        "- 不允许输出任何解释或额外文本",
      ].join("\n"),
    ),
  ],
};

export const novelBiblePrompt: PromptAsset<
  NovelBiblePromptInput,
  typeof novelBiblePayloadSchema._output
> = {
  id: "novel.bible.generate",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: novelBiblePayloadSchema,
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    const referenceBlock = input.referenceContext?.trim()
      ? "\n\n" + pick(lang,
        "【参考资料（仅作技法与方向参考，不得照搬剧情或结构）】",
        "【Tư liệu tham khảo (chỉ tham khảo kỹ thuật và định hướng, không sao chép tình tiết hay cấu trúc)】",
        "[Reference material (technique and direction reference only — do not copy plot or structure)]") + "\n" + input.referenceContext
      : "";

    return [
      new SystemMessage([
        pick(lang,
          "你是连载小说作品圣经规划助手。",
          "Bạn là trợ lý hoạch định \"story bible\" cho tiểu thuyết dài kỳ.",
          "You are a planning assistant that builds a story bible for long-form serialized fiction."),
        pick(lang,
          "你的任务不是写正文，也不是扩写大纲，而是基于给定信息生成一份可供后续长期创作使用的作品圣经。",
          "Nhiệm vụ của bạn không phải viết nội dung, cũng không phải mở rộng dàn ý, mà là dựa trên thông tin đã cho để tạo ra một story bible dùng cho việc sáng tác lâu dài về sau.",
          "Your task is not to write prose or expand an outline, but to produce a story bible — based on the given information — that will constrain long-term writing."),
        "",
        pick(lang, "【任务边界】", "【Ranh giới nhiệm vụ】", "[Task boundary]"),
        pick(lang,
          "只输出符合 schema 的严格 JSON。",
          "Chỉ xuất JSON nghiêm ngặt đúng schema.",
          "Output only strict JSON matching the schema."),
        pick(lang,
          "不要输出 Markdown、解释、注释、代码块或任何额外文本。",
          "Không xuất Markdown, lời giải thích, chú thích, khối mã hay bất kỳ văn bản thừa nào.",
          "Do not output Markdown, explanations, comments, code fences, or any extra text."),
        pick(lang,
          "不得新增 schema 之外的字段，不得缺漏已有字段。",
          "Không thêm field ngoài schema, không thiếu field đã có.",
          "Do not add fields outside the schema, and do not omit existing fields."),
        "",
        pick(lang, "【输出字段要求】", "【Yêu cầu các field đầu ra】", "[Output field requirements]"),
        pick(lang, "必须输出以下字段：", "Bắt buộc xuất các field sau:", "You must output the following fields:"),
        pick(lang,
          "1. coreSetting: 作品最核心的设定抓手，说明这本书最本质的世界/题材/冲突基础是什么。",
          "1. coreSetting: điểm tựa thiết lập cốt lõi nhất của tác phẩm — nền tảng thế giới / đề tài / xung đột bản chất nhất của cuốn sách này là gì.",
          "1. coreSetting: the work's most essential setting anchor — what the most fundamental world / subject / conflict basis of this book is."),
        pick(lang,
          "2. forbiddenRules: 创作中不得违背的硬规则、禁区或冲突边界，重点写“不能发生什么设定冲突”。",
          "2. forbiddenRules: luật cứng, vùng cấm hoặc ranh giới xung đột không được vi phạm khi sáng tác — tập trung vào \"mâu thuẫn thiết lập nào không được phép xảy ra\".",
          "2. forbiddenRules: hard rules, forbidden zones, or conflict boundaries that must never be violated while writing — focus on \"what setting contradictions must not happen\"."),
        pick(lang,
          "3. mainPromise: 本书持续向读者提供的主线阅读承诺，说明读者为什么会追下去。",
          "3. mainPromise: lời hứa đọc chính mà cuốn sách liên tục trao cho người đọc — vì sao người đọc sẽ theo dõi tiếp.",
          "3. mainPromise: the main-line reading promise the book keeps delivering — why the reader keeps following."),
        pick(lang,
          "4. characterArcs: 核心角色的成长主轴与变化方向，强调阶段性变化，不要泛泛而谈。",
          "4. characterArcs: trục trưởng thành và chiều thay đổi của các nhân vật cốt lõi — nhấn mạnh thay đổi theo giai đoạn, không nói chung chung.",
          "4. characterArcs: the growth spine and direction of change for the core characters — emphasize phased change, not vague statements."),
        pick(lang,
          "5. worldRules: 世界运行规则、基本秩序、关键限制与因果边界，要求能约束后续创作。",
          "5. worldRules: luật vận hành của thế giới, trật tự cơ bản, giới hạn then chốt và ranh giới nhân quả — phải đủ sức ràng buộc việc sáng tác về sau.",
          "5. worldRules: how the world operates, its basic order, key limits, and causal boundaries — must be able to constrain later writing."),
        "",
        pick(lang, "【核心约束】", "【Ràng buộc cốt lõi】", "[Core constraints]"),
        pick(lang,
          "1. 必须严格基于输入的标题、类型、简介、角色与世界上下文生成。",
          "1. Phải tạo dựa chặt chẽ trên tiêu đề, thể loại, tóm tắt, nhân vật và bối cảnh thế giới đầu vào.",
          "1. Must be generated strictly from the input title, genre, synopsis, characters, and world context."),
        pick(lang,
          "2. 不得脱离上下文臆造与主线无关的大设定。",
          "2. Không được bịa ra thiết lập lớn xa rời ngữ cảnh và không liên quan tuyến chính.",
          "2. Do not invent large setting elements detached from context and unrelated to the main line."),
        pick(lang,
          "3. 不得忽略已给角色或把角色功能模糊化到无法指导后续写作。",
          "3. Không được bỏ qua nhân vật đã cho hay làm mờ chức năng nhân vật đến mức không định hướng được việc viết sau này.",
          "3. Do not ignore the given characters or blur their function to the point where it cannot guide later writing."),
        pick(lang,
          "4. forbiddenRules 与 worldRules 必须真正可约束后续内容，不能写成空话。",
          "4. forbiddenRules và worldRules phải thực sự ràng buộc được nội dung về sau, không được viết thành câu rỗng.",
          "4. forbiddenRules and worldRules must genuinely constrain later content — not be empty phrasing."),
        pick(lang,
          "5. mainPromise 必须体现持续连载价值，不能只写主题口号。",
          "5. mainPromise phải thể hiện giá trị đọc dài kỳ, không chỉ là khẩu hiệu chủ đề.",
          "5. mainPromise must express sustained serialized value — not just a thematic slogan."),
        "",
        pick(lang, "【质量要求】", "【Yêu cầu chất lượng】", "[Quality requirements]"),
        pick(lang,
          "1. coreSetting 要抓“这本书最不可替代的骨头”，不能只是题材复述。",
          "1. coreSetting phải nắm được \"khúc xương không thể thay thế của cuốn sách\", không chỉ nhắc lại thể loại.",
          "1. coreSetting must capture \"the book's irreplaceable bone\" — not just restate the genre."),
        pick(lang,
          "2. forbiddenRules 要具体、清晰、可执行，避免“保持一致性”这类空泛表达。",
          "2. forbiddenRules phải cụ thể, rõ ràng, khả thi; tránh những câu chung chung như \"giữ nhất quán\".",
          "2. forbiddenRules must be concrete, clear, and actionable — avoid vague phrasing like \"stay consistent\"."),
        pick(lang,
          "3. characterArcs 要体现角色在长期连载中的成长或变化方向，而不是静态标签。",
          "3. characterArcs phải thể hiện chiều trưởng thành hoặc thay đổi của nhân vật trong suốt chặng dài kỳ, không phải nhãn tĩnh.",
          "3. characterArcs must show each character's direction of growth or change over the long run — not a static label."),
        pick(lang,
          "4. worldRules 要写出真正影响剧情推进的规则，而不是背景介绍。",
          "4. worldRules phải nêu ra những luật thực sự ảnh hưởng đến lực đẩy cốt truyện, không phải phần giới thiệu bối cảnh.",
          "4. worldRules must state rules that genuinely affect plot momentum — not background exposition."),
        pick(lang,
          "5. 整体内容要服务长期创作稳定性，适合作为后续分卷、拆章、续写的约束基础。",
          "5. Toàn bộ nội dung phải phục vụ sự ổn định khi sáng tác lâu dài, đủ để làm nền ràng buộc cho việc chia tập, tách chương, viết tiếp về sau.",
          "5. The whole thing must serve long-term writing stability — suitable as the constraint basis for later volume splits, chapter breakdowns, and continuation."),
        "",
        pick(lang, "【生成原则】", "【Nguyên tắc tạo sinh】", "[Generation principle]"),
        pick(lang,
          "信息不足时可以做保守补全，但必须克制、连贯，并优先保证设定稳定性。",
          "Khi thiếu thông tin, được bổ sung một cách dè dặt, nhưng phải tiết chế, mạch lạc và ưu tiên sự ổn định của thiết lập.",
          "When information is missing, conservative filling is allowed, but it must stay restrained, coherent, and prioritize setting stability."),
      ].join("\n")),
      new HumanMessage([
        pick(lang, `小说标题：${input.title}`, `Tên truyện: ${input.title}`, `Novel title: ${input.title}`),
        pick(lang, `类型：${input.genreName}`, `Thể loại: ${input.genreName}`, `Genre: ${input.genreName}`),
        pick(lang, `简介：${input.description}`, `Tóm tắt: ${input.description}`, `Synopsis: ${input.description}`),
        "",
        pick(lang, "【角色】", "【Nhân vật】", "[Characters]"),
        input.charactersText,
        "",
        pick(lang, "【世界上下文】", "【Bối cảnh thế giới】", "[World context]"),
        input.worldContext,
        ...storyModeBlockLines(lang, input.storyModeContext),
        referenceBlock,
        "",
        pick(lang, "请输出作品圣经 JSON。", "Hãy xuất JSON story bible.", "Output the story-bible JSON."),
      ].join("\n")),
    ];
  },
};

export const novelBeatPrompt: PromptAsset<
  NovelBeatPromptInput,
  z.infer<typeof novelBeatPayloadSchema>
> = {
  id: "novel.beat.generate",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: novelBeatPayloadSchema,
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    const referenceBlock = input.referenceContext?.trim()
      ? "\n\n" + pick(lang,
        "【参考资料（仅作技法与节奏参考，不得照搬剧情或结构）】",
        "【Tư liệu tham khảo (chỉ tham khảo kỹ thuật và nhịp truyện, không sao chép tình tiết hay cấu trúc)】",
        "[Reference material (technique and pacing reference only — do not copy plot or structure)]") + "\n" + input.referenceContext
      : "";

    return [
      new SystemMessage([
        pick(lang,
          "你是连载小说剧情节拍规划助手。",
          "Bạn là trợ lý hoạch định nhịp truyện (beat) cho tiểu thuyết dài kỳ.",
          "You are a story-beat planning assistant for long-form serialized fiction."),
        pick(lang,
          "你的任务不是写正文，也不是输出散文式大纲，而是基于作品圣经与目标章节数，生成可供后续章节规划与写作使用的剧情 beat 列表。",
          "Nhiệm vụ của bạn không phải viết nội dung, cũng không phải xuất dàn ý dạng văn xuôi, mà là dựa trên story bible và số chương mục tiêu để tạo ra danh sách beat dùng cho việc lập kế hoạch chương và viết về sau.",
          "Your task is not to write prose or a prose-style outline, but — based on the story bible and target chapter count — to produce a list of story beats usable for later chapter planning and writing."),
        "",
        pick(lang, "【任务边界】", "【Ranh giới nhiệm vụ】", "[Task boundary]"),
        pick(lang,
          "只输出符合 schema 的严格 JSON。",
          "Chỉ xuất JSON nghiêm ngặt đúng schema.",
          "Output only strict JSON matching the schema."),
        pick(lang,
          "不要输出 Markdown、解释、注释、代码块或任何额外文本。",
          "Không xuất Markdown, lời giải thích, chú thích, khối mã hay bất kỳ văn bản thừa nào.",
          "Do not output Markdown, explanations, comments, code fences, or any extra text."),
        pick(lang,
          "不得新增 schema 之外的字段，不得缺漏字段。",
          "Không thêm field ngoài schema, không thiếu field.",
          "Do not add fields outside the schema, and do not omit fields."),
        "",
        pick(lang, "【输出要求】", "【Yêu cầu đầu ra】", "[Output requirements]"),
        pick(lang,
          "输出必须是 JSON 数组。每一项必须完整包含以下字段：",
          "Đầu ra phải là mảng JSON. Mỗi phần tử phải chứa đầy đủ các field sau:",
          "The output must be a JSON array. Each item must fully contain the following fields:"),
        "- chapterOrder",
        "- beatType",
        "- title",
        "- content",
        "- status",
        "",
        pick(lang, "【字段约束】", "【Ràng buộc field】", "[Field constraints]"),
        pick(lang,
          "1. chapterOrder 必须对应章节顺序，按 1 开始连续递增，且覆盖目标章节数。",
          "1. chapterOrder phải tương ứng thứ tự chương, tăng liên tục từ 1 và phủ hết số chương mục tiêu.",
          "1. chapterOrder must match chapter order, increment continuously from 1, and cover the full target chapter count."),
        pick(lang,
          "2. beatType 必须准确表达该章的主要节拍功能，例如开局建立、冲突升级、信息揭示、关系变化、局面反转、高潮兑现、尾部钩子等。",
          "2. beatType phải diễn đạt chính xác chức năng nhịp chính của chương đó, ví dụ: thiết lập mở đầu, leo thang xung đột, hé lộ thông tin, thay đổi quan hệ, đảo chiều tình thế, trả cao trào, móc câu cuối chương...",
          "2. beatType must precisely express that chapter's primary beat function, e.g. opening setup, conflict escalation, information reveal, relationship shift, situation reversal, climax payoff, end hook, etc."),
        pick(lang,
          "3. title 必须像真实可用的节拍标题，清晰体现该章核心推进，不要写成空泛标签。",
          "3. title phải giống một tiêu đề beat dùng được thật, thể hiện rõ điểm đẩy cốt lõi của chương, không viết thành nhãn chung chung.",
          "3. title must read like a real, usable beat title that clearly conveys the chapter's core advance — not a vague label."),
        pick(lang,
          "4. content 必须写清本章具体推进了什么、改变了什么、它在整体节奏中的作用是什么。",
          "4. content phải nói rõ chương này đẩy được cụ thể điều gì, thay đổi điều gì, và vai trò của nó trong nhịp tổng thể.",
          "4. content must state concretely what this chapter advances, what it changes, and its role in the overall pacing."),
        pick(lang,
          "5. status 必须用于表示该 beat 当前所处状态，保持全数组语义一致，不得乱用。",
          "5. status dùng để biểu thị trạng thái hiện tại của beat, giữ ngữ nghĩa nhất quán trên toàn mảng, không dùng tùy tiện.",
          "5. status must represent the beat's current state, stay semantically consistent across the whole array, and not be misused."),
        "",
        pick(lang, "【核心约束】", "【Ràng buộc cốt lõi】", "[Core constraints]"),
        pick(lang,
          "1. 必须严格承接小说简介、世界上下文与作品圣经，不得偏离主线承诺。",
          "1. Phải bám chặt tóm tắt truyện, bối cảnh thế giới và story bible, không lệch khỏi lời hứa tuyến chính.",
          "1. Must strictly follow the synopsis, world context, and story bible — do not deviate from the main-line promise."),
        pick(lang,
          "2. 不得脱离上下文擅自发明新的核心角色、重大世界规则或主线方向。",
          "2. Không được tự ý phát minh nhân vật cốt lõi mới, luật thế giới lớn hay hướng tuyến chính mới ngoài ngữ cảnh.",
          "2. Do not invent new core characters, major world rules, or new main-line directions beyond the context."),
        pick(lang,
          "3. 每一章都必须有实质推进，不能出现纯填充、纯气氛、纯复述型 beat。",
          "3. Mỗi chương phải có tiến triển thực chất; không được có beat kiểu thuần lấp chỗ, thuần không khí hay thuần kể lại.",
          "3. Every chapter must have substantive advance — no pure-filler, pure-atmosphere, or pure-recap beats."),
        pick(lang,
          "4. 相邻章节的 beat 不能只是同义重复，必须体现推进、变化、升级、转向或兑现中的至少一种。",
          "4. Beat của các chương liền kề không được chỉ lặp lại đồng nghĩa; phải thể hiện ít nhất một trong: tiến triển, thay đổi, nâng cấp, chuyển hướng hoặc trả nợ.",
          "4. Adjacent chapters' beats must not be synonymous repeats — each must show at least one of: advance, change, escalation, pivot, or payoff."),
        pick(lang,
          "5. 整体 beat 序列必须形成清晰节奏：前段立钩子与局面，中段扩展与升级，后段压迫与兑现。",
          "5. Chuỗi beat tổng thể phải tạo nhịp rõ ràng: đoạn đầu dựng móc câu và cục diện, đoạn giữa mở rộng và leo thang, đoạn sau dồn ép và trả nợ.",
          "5. The overall beat sequence must form a clear rhythm: early — set hooks and situation; middle — expand and escalate; late — pressure and payoff."),
        pick(lang,
          "6. 如提供流派模式约束，beat 的冲突烈度、必须反复出现的信号和禁止的冲突形式必须服从该模式：低冲突上限的治愈/恋爱/喜剧模式不得用生死危机推进节奏，改用关系、情绪与小反转做每章推进单位；高冲突上限的悬念/博弈模式要让揭示、反转与信息代价在整条 beat 线上保持高密度。",
          "6. Nếu có ràng buộc story mode, cường độ xung đột của beat, các tín hiệu bắt buộc lặp lại và dạng xung đột bị cấm phải theo mode đó: mode chữa lành/tình cảm/hài có trần xung đột thấp thì không dùng nguy hiểm sinh tử để đẩy nhịp, mà lấy quan hệ, cảm xúc và đảo chiều nhỏ làm đơn vị đẩy mỗi chương; mode hồi hộp/đấu trí có trần xung đột cao thì giữ hé lộ, đảo chiều và cái giá thông tin ở mật độ cao suốt chuỗi beat.",
          "6. If a story-mode constraint is provided, the beats' conflict intensity, mandatory recurring signals, and forbidden conflict forms must follow that mode: a low-ceiling healing/romance/comedy mode must not use life-or-death stakes to drive pacing — use relationship, emotion, and small reversals as the per-chapter unit of advance; a high-ceiling suspense/gambit mode must keep reveals, reversals, and information cost dense across the whole beat line."),
        "",
        pick(lang, "【质量要求】", "【Yêu cầu chất lượng】", "[Quality requirements]"),
        pick(lang,
          "1. 前几章必须快速建立主局面、主冲突或核心吸引力，避免迟迟不进入故事。",
          "1. Vài chương đầu phải nhanh chóng dựng cục diện chính, xung đột chính hoặc điểm hấp dẫn cốt lõi, tránh mãi không vào truyện.",
          "1. The first few chapters must quickly establish the main situation, main conflict, or core appeal — avoid taking too long to enter the story."),
        pick(lang,
          "2. 中段必须不断引入新变量、新压力、新选择或新后果，避免线性重复加码。",
          "2. Đoạn giữa phải liên tục đưa vào biến số mới, áp lực mới, lựa chọn mới hoặc hệ quả mới, tránh cộng dồn lặp lại theo kiểu tuyến tính.",
          "2. The middle must keep introducing new variables, pressures, choices, or consequences — avoid linear repetitive stacking."),
        pick(lang,
          "3. 后段必须体现阶段性回报、局势收束或更大悬念，而不是平推结束。",
          "3. Đoạn sau phải thể hiện phần thưởng theo giai đoạn, sự thu gọn tình thế hoặc nghi vấn lớn hơn, chứ không phải kết thúc phẳng lì.",
          "3. The late run must show phased rewards, tightening of the situation, or a larger suspense — not a flat wind-down."),
        pick(lang,
          "4. content 要强调“本章为什么值得存在”，而不是泛泛概括剧情。",
          "4. content phải nhấn mạnh \"vì sao chương này đáng tồn tại\", không phải tóm tắt cốt truyện chung chung.",
          "4. content must emphasize \"why this chapter deserves to exist\" — not a generic plot summary."),
        pick(lang,
          "5. 参考资料只能借鉴技法、节奏、组织方式，不能照搬角色关系、剧情结构或桥段。",
          "5. Tư liệu tham khảo chỉ được học hỏi kỹ thuật, nhịp và cách tổ chức; không được bê nguyên quan hệ nhân vật, cấu trúc cốt truyện hay tình huống.",
          "5. Reference material may only inform technique, pacing, and organization — do not lift character relationships, plot structure, or set pieces."),
        "",
        pick(lang, "【生成原则】", "【Nguyên tắc tạo sinh】", "[Generation principle]"),
        pick(lang,
          "信息不足时允许保守补全，但必须保持连贯、克制，并优先保证节奏稳定性与可写性。",
          "Khi thiếu thông tin, được bổ sung dè dặt, nhưng phải giữ mạch lạc, tiết chế và ưu tiên sự ổn định của nhịp cùng tính khả thi để viết.",
          "When information is missing, conservative filling is allowed, but it must stay coherent, restrained, and prioritize pacing stability and writability."),
      ].join("\n")),
      new HumanMessage([
        pick(lang, `小说标题：${input.title}`, `Tên truyện: ${input.title}`, `Novel title: ${input.title}`),
        pick(lang, `小说简介：${input.description}`, `Tóm tắt truyện: ${input.description}`, `Novel synopsis: ${input.description}`),
        "",
        pick(lang, "【世界上下文】", "【Bối cảnh thế giới】", "[World context]"),
        input.worldContext,
        ...storyModeBlockLines(lang, input.storyModeContext),
        "",
        pick(lang, "【作品圣经】", "【Story bible】", "[Story bible]"),
        input.bibleRawContent,
        "",
        pick(lang, `【目标章节数】${input.targetChapters}`, `【Số chương mục tiêu】${input.targetChapters}`, `[Target chapter count] ${input.targetChapters}`),
        referenceBlock,
        "",
        pick(lang,
          "请输出对应的剧情 beat JSON 数组。",
          "Hãy xuất mảng JSON beat tương ứng.",
          "Output the corresponding story-beat JSON array."),
      ].join("\n")),
    ];
  },
};

export const novelChapterHookPrompt: PromptAsset<
  NovelChapterHookPromptInput,
  z.infer<typeof novelChapterHookSchema>
> = {
  id: "novel.chapterHook.generate",
  version: "v2",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: novelChapterHookSchema,
  render: (input) => [
    new SystemMessage([
      "你是网文章节钩子规划助手。",
      "你的任务不是改写正文，而是基于当前章节内容，提炼一个有效的章节末钩子与下章期待点。",
      "",
      "【任务边界】",
      "只输出符合 schema 的严格 JSON。",
      "不要输出 Markdown、解释、注释、代码块或任何额外文本。",
      "不得新增 schema 之外的字段，不得缺漏字段。",
      "",
      "【输出格式】",
      '必须输出：{"hook":"章节末钩子","nextExpectation":"下章期待点"}',
      "",
      "【字段要求】",
      "1. hook 必须像真实网文章节末尾会形成的追读钩子，优先体现悬念、突发变化、未完成决策、风险升级、信息揭示后的余波或局面骤变。",
      "2. nextExpectation 必须明确说明读者自然会期待下一章看到什么推进，不能空泛写成“后续发展”“接下来会怎样”。",
      "",
      "【核心约束】",
      "1. 必须严格基于当前章节标题与章节内容生成，不得脱离内容臆造重大事件。",
      "2. hook 必须承接本章已发生的推进结果，像从正文自然延伸出来，而不是凭空加一个外来悬念。",
      "3. nextExpectation 必须与 hook 构成连续关系，说明下一章最值得看的兑现方向。",
      "4. 不要重复本章正文的大段原句，要做提炼与重组。",
      "5. 不要把 hook 写成总结句、主题句、抒情句或空泛感叹句。",
      "",
      "【质量要求】",
      "1. 优先让 hook 具备即时追读力，而不是宽泛概括剧情。",
      "2. 如果本章结尾是决策前夜，hook 应突出决策压力；如果本章结尾是异常暴露，hook 应突出后果或真相入口；如果本章结尾是局面逆转，hook 应突出新的不稳定状态。",
      "3. nextExpectation 要具体到‘下一章大概率会推进什么’，而不是抽象情绪。",
      "4. 信息不足时也要给出保守但有效的钩子，不要写空话。",
    ].join("\n")),
    new HumanMessage([
      `章节标题：${input.title}`,
      "",
      "【章节内容】",
      input.content,
      "",
      "请输出章节末钩子 JSON。",
    ].join("\n")),
  ],
};