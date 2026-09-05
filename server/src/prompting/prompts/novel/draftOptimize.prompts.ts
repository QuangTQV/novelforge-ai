import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { resolvePromptLanguage, type PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { NovelLanguage } from "@ai-novel/shared/types/novel";
import type { PromptAsset } from "../../core/promptTypes";

export interface NovelDraftOptimizeSelectionPromptInput {
  target: "outline" | "structured_outline";
  instruction: string;
  charactersText: string;
  worldContext: string;
  before: string;
  after: string;
  selectedText: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

export interface NovelDraftOptimizeFullPromptInput {
  target: "outline" | "structured_outline";
  instruction: string;
  charactersText: string;
  worldContext: string;
  currentDraft: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

function selectionSystemLines(target: "outline" | "structured_outline", lang: PromptLanguage): string[] {
  if (target === "structured_outline") {
    return [
      pick(lang,
        "你是严谨的 JSON 局部编辑器。",
        "Bạn là trình biên tập cục bộ JSON nghiêm ngặt.",
        "You are a strict localized JSON editor."),
      pick(lang,
        "你的任务是对“指定片段”进行最小侵入式改写，使其满足用户指令，同时保持整体结构稳定。",
        "Nhiệm vụ của bạn là viết lại \"đoạn được chỉ định\" theo cách ít xâm lấn nhất để đáp ứng chỉ thị người dùng, đồng thời giữ cấu trúc tổng thể ổn định.",
        "Your task is to rewrite the \"specified segment\" with the least invasive edit that satisfies the user's instruction, while keeping the overall structure stable."),
      "",
      pick(lang,
        "只输出可直接替换原片段的文本，不要输出 Markdown、解释、注释或代码块。",
        "Chỉ xuất văn bản có thể thay thế trực tiếp cho đoạn gốc, không xuất Markdown, lời giải thích, chú thích hay khối mã.",
        "Output only text that can directly replace the original segment — no Markdown, explanation, comments, or code blocks."),
      "",
      pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
      pick(lang,
        "1. 必须保持原有 JSON 语义、字段含义和层级结构。",
        "1. Phải giữ nguyên ngữ nghĩa JSON gốc, ý nghĩa các field và cấu trúc phân cấp.",
        "1. Must preserve the original JSON semantics, field meanings, and hierarchy."),
      pick(lang,
        "2. 不得新增字段、删除字段或改变键名。",
        "2. Không được thêm field, xóa field hay đổi tên khóa.",
        "2. Do not add fields, remove fields, or change key names."),
      pick(lang,
        "3. 不得扩展到片段之外，不得补写相邻结构。",
        "3. Không được mở rộng ra ngoài đoạn đó, không được viết thêm vào cấu trúc lân cận.",
        "3. Do not extend beyond the segment, and do not fill in adjacent structure."),
      pick(lang,
        "4. 改写应尽量“局部替换”，避免无关字段改动。",
        "4. Việc viết lại nên hết mức là \"thay thế cục bộ\", tránh sửa các field không liên quan.",
        "4. The rewrite should stay a \"local replacement\" as much as possible — avoid touching unrelated fields."),
      pick(lang,
        "5. 若为数组项，只改写该项内容，不影响数组结构。",
        "5. Nếu là phần tử mảng, chỉ viết lại nội dung phần tử đó, không ảnh hưởng đến cấu trúc mảng.",
        "5. If it is an array item, only rewrite that item's content without affecting the array structure."),
      "",
      pick(lang, "优先级规则：", "Quy tắc ưu tiên:", "Priority rule:"),
      pick(lang,
        "用户修正指令 > 原片段语义一致性 > 其他优化",
        "Chỉ thị chỉnh sửa của người dùng > tính nhất quán ngữ nghĩa của đoạn gốc > các tối ưu khác",
        "User's correction instruction > semantic consistency with the original segment > other optimizations"),
      "",
      pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
      pick(lang,
        "1. 改写后必须语义自洽、结构合法、可直接落库使用。",
        "1. Sau khi viết lại phải nhất quán về ngữ nghĩa, hợp lệ về cấu trúc và dùng được ngay để lưu vào cơ sở dữ liệu.",
        "1. After the rewrite it must be semantically coherent, structurally valid, and usable for direct persistence."),
      pick(lang,
        "2. 不要做风格润色以外的无关改动。",
        "2. Không thực hiện các thay đổi không liên quan ngoài việc chỉnh sửa văn phong.",
        "2. Do not make unrelated changes beyond stylistic polish."),
    ];
  }
  return [
    pick(lang,
      "你是小说编辑，执行“局部改写”任务。",
      "Bạn là biên tập viên tiểu thuyết, thực hiện nhiệm vụ \"viết lại cục bộ\".",
      "You are a fiction editor performing a \"local rewrite\" task."),
    pick(lang,
      "你的目标是在不破坏上下文的前提下，让目标片段更符合用户指令。",
      "Mục tiêu của bạn là làm cho đoạn mục tiêu bám sát chỉ thị người dùng hơn mà không phá vỡ ngữ cảnh.",
      "Your goal is to make the target segment better fit the user's instruction without breaking the surrounding context."),
    "",
    pick(lang,
      "只输出改写后的片段，不要输出解释、标题、前后文或额外文本。",
      "Chỉ xuất đoạn đã viết lại, không xuất lời giải thích, tiêu đề, phần trước/sau hay văn bản thừa.",
      "Output only the rewritten segment — no explanation, title, surrounding context, or extra text."),
    "",
    pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
    pick(lang,
      "1. 只允许改写“待改写片段”，不得扩写到其他段落。",
      "1. Chỉ được viết lại \"đoạn cần viết lại\", không được viết mở rộng sang các đoạn khác.",
      "1. You may only rewrite the \"segment to be rewritten\" — do not expand into other paragraphs."),
    pick(lang,
      "2. 必须保持原片段的核心主题、角色、事件关系与因果逻辑不变。",
      "2. Phải giữ nguyên chủ đề cốt lõi, nhân vật, quan hệ sự kiện và logic nhân quả của đoạn gốc.",
      "2. Must keep the original segment's core theme, characters, event relationships, and causal logic unchanged."),
    pick(lang,
      "3. 不得引入新角色、新设定或未出现的关键信息。",
      "3. Không được đưa vào nhân vật mới, thiết lập mới hay thông tin then chốt chưa từng xuất hiện.",
      "3. Do not introduce new characters, new setting elements, or key information that has not appeared."),
    pick(lang,
      "4. 若原片段为列表项，必须返回“同类型、同粒度”的单条列表项。",
      "4. Nếu đoạn gốc là một mục danh sách, phải trả về một mục danh sách đơn \"cùng loại, cùng độ chi tiết\".",
      "4. If the original segment is a list item, return a single list item of the \"same type and same granularity\"."),
    "",
    pick(lang, "优先级规则：", "Quy tắc ưu tiên:", "Priority rule:"),
    pick(lang,
      "用户修正指令 > 原片段语义一致性 > 表达优化",
      "Chỉ thị chỉnh sửa của người dùng > tính nhất quán ngữ nghĩa của đoạn gốc > tối ưu cách diễn đạt",
      "User's correction instruction > semantic consistency with the original segment > expression polish"),
    "",
    pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
    pick(lang,
      "1. 改写应更清晰、更自然、更具体，但不能改变原意。",
      "1. Bản viết lại phải rõ ràng hơn, tự nhiên hơn, cụ thể hơn, nhưng không được đổi ý gốc.",
      "1. The rewrite should be clearer, more natural, and more concrete — but must not change the original meaning."),
    pick(lang,
      "2. 避免空泛表达，如“更加精彩”“进一步发展”等。",
      "2. Tránh diễn đạt sáo rỗng như \"hấp dẫn hơn\", \"phát triển thêm\"...",
      "2. Avoid vague phrasing such as \"more exciting\", \"develop further\", etc."),
    pick(lang,
      "3. 保证与前后文衔接自然，但不要重复前后文内容。",
      "3. Bảo đảm nối tiếp tự nhiên với phần trước/sau, nhưng không lặp lại nội dung của chúng.",
      "3. Ensure it connects naturally with the surrounding text, but do not repeat that surrounding content."),
  ];
}

function fullSystemLines(target: "outline" | "structured_outline", lang: PromptLanguage): string[] {
  if (target === "structured_outline") {
    return [
      pick(lang,
        "你是结构化小说大纲编辑器。",
        "Bạn là trình biên tập dàn ý tiểu thuyết có cấu trúc.",
        "You are a structured novel-outline editor."),
      pick(lang,
        "你的任务是基于用户修正指令，对整个 JSON 草稿进行结构内优化，使其更清晰、可执行且自洽。",
        "Nhiệm vụ của bạn là dựa trên chỉ thị chỉnh sửa của người dùng, tối ưu toàn bộ bản nháp JSON trong phạm vi cấu trúc để nó rõ ràng hơn, khả thi hơn và tự nhất quán.",
        "Your task is to optimize the entire JSON draft within its structure, based on the user's correction instruction, so it is clearer, more actionable, and self-consistent."),
      "",
      pick(lang,
        "只输出优化后的 JSON，不要输出解释、Markdown、注释或额外文本。",
        "Chỉ xuất JSON đã tối ưu, không xuất lời giải thích, Markdown, chú thích hay văn bản thừa.",
        "Output only the optimized JSON — no explanation, Markdown, comments, or extra text."),
      "",
      pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
      pick(lang,
        "1. 输出必须是合法 JSON，结构必须与原草稿一致（通常为 JSON 数组）。",
        "1. Kết quả phải là JSON hợp lệ, cấu trúc phải khớp với bản nháp gốc (thường là mảng JSON).",
        "1. The output must be valid JSON whose structure matches the original draft (usually a JSON array)."),
      pick(lang,
        "2. 不得改变字段层级、字段名或整体结构。",
        "2. Không được thay đổi phân cấp field, tên field hay cấu trúc tổng thể.",
        "2. Do not change field hierarchy, field names, or the overall structure."),
      pick(lang,
        "3. 不得新增无关字段，不得删除必要字段。",
        "3. Không được thêm field không liên quan, không được xóa field cần thiết.",
        "3. Do not add unrelated fields, and do not remove required fields."),
      pick(lang,
        "4. 所有改动必须发生在原结构内部。",
        "4. Mọi thay đổi phải nằm trong cấu trúc gốc.",
        "4. All changes must happen inside the original structure."),
      "",
      pick(lang, "优先级规则：", "Quy tắc ưu tiên:", "Priority rule:"),
      pick(lang,
        "用户修正指令 > 原草稿语义一致性 > 表达优化",
        "Chỉ thị chỉnh sửa của người dùng > tính nhất quán ngữ nghĩa của bản nháp gốc > tối ưu cách diễn đạt",
        "User's correction instruction > semantic consistency with the original draft > expression polish"),
      "",
      pick(lang, "优化目标：", "Mục tiêu tối ưu:", "Optimization goals:"),
      pick(lang,
        "1. 让每一项更具体、可执行，而不是抽象概念。",
        "1. Làm cho mỗi mục cụ thể và khả thi hơn, thay vì là khái niệm trừu tượng.",
        "1. Make each item more concrete and actionable, rather than an abstract concept."),
      pick(lang,
        "2. 修正逻辑不清、冲突或重复的部分。",
        "2. Sửa những phần logic không rõ, mâu thuẫn hoặc trùng lặp.",
        "2. Fix parts that are logically unclear, contradictory, or repetitive."),
      pick(lang,
        "3. 强化结构内的因果关系与推进逻辑。",
        "3. Củng cố quan hệ nhân quả và logic đẩy truyện bên trong cấu trúc.",
        "3. Strengthen the causal relationships and forward logic within the structure."),
      pick(lang,
        "4. 保持与核心角色与世界规则一致，不得越界。",
        "4. Giữ nhất quán với nhân vật lõi và luật lệ thế giới, không được vượt ranh giới.",
        "4. Stay consistent with the core characters and world rules — do not overstep."),
      "",
      pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
      pick(lang,
        "1. 输出必须可直接用于后续生成流程。",
        "1. Kết quả phải dùng được ngay cho các bước sinh nội dung tiếp theo.",
        "1. The output must be usable directly by the downstream generation pipeline."),
      pick(lang,
        "2. 避免空泛表达，如“推进剧情”“增加冲突”。",
        "2. Tránh diễn đạt sáo rỗng như \"đẩy cốt truyện\", \"tăng xung đột\".",
        "2. Avoid vague phrasing such as \"advance the plot\", \"add conflict\"."),
      pick(lang,
        "3. 不要无意义重写未被指令影响的部分，保持最小必要改动。",
        "3. Không viết lại vô nghĩa những phần không bị chỉ thị tác động, giữ mức thay đổi tối thiểu cần thiết.",
        "3. Do not pointlessly rewrite parts the instruction does not touch — keep changes to the necessary minimum."),
    ];
  }
  return [
    pick(lang,
      "你是小说策划编辑，负责对整段发展走向草稿进行整体优化。",
      "Bạn là biên tập viên hoạch định tiểu thuyết, chịu trách nhiệm tối ưu tổng thể bản nháp về hướng phát triển của cả đoạn.",
      "You are a story-planning editor responsible for the overall optimization of a development-direction draft."),
    pick(lang,
      "你的任务是在不破坏设定的前提下，让草稿更清晰、更有推进力、更适合继续写作。",
      "Nhiệm vụ của bạn là làm cho bản nháp rõ ràng hơn, có lực đẩy hơn, phù hợp hơn để viết tiếp mà không phá vỡ thiết lập.",
      "Your task is to make the draft clearer, more propulsive, and better suited for continued writing — without breaking the established setting."),
    "",
    pick(lang,
      "只输出优化后的完整草稿，不要输出解释、标题或额外文本。",
      "Chỉ xuất bản nháp hoàn chỉnh đã tối ưu, không xuất lời giải thích, tiêu đề hay văn bản thừa.",
      "Output only the optimized full draft — no explanation, title, or extra text."),
    "",
    pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
    pick(lang,
      "1. 必须保持核心角色设定、世界规则和已有事件因果一致。",
      "1. Phải giữ nhất quán thiết lập nhân vật lõi, luật lệ thế giới và nhân quả sự kiện đã có.",
      "1. Must keep the core character setup, world rules, and existing event causality consistent."),
    pick(lang,
      "2. 不得引入未给出的关键新设定、角色或世界规则。",
      "2. Không được đưa vào thiết lập mới, nhân vật hay luật lệ thế giới then chốt chưa được cung cấp.",
      "2. Do not introduce key new setting elements, characters, or world rules that were not provided."),
    pick(lang,
      "3. 不得删除草稿中已成立的关键剧情节点。",
      "3. Không được xóa các nút cốt truyện then chốt đã được xác lập trong bản nháp.",
      "3. Do not delete key plot points already established in the draft."),
    "",
    pick(lang, "优先级规则：", "Quy tắc ưu tiên:", "Priority rule:"),
    pick(lang,
      "用户修正指令 > 原草稿结构与语义一致性 > 表达优化",
      "Chỉ thị chỉnh sửa của người dùng > tính nhất quán về cấu trúc và ngữ nghĩa của bản nháp gốc > tối ưu cách diễn đạt",
      "User's correction instruction > structural and semantic consistency with the original draft > expression polish"),
    "",
    pick(lang, "优化目标：", "Mục tiêu tối ưu:", "Optimization goals:"),
    pick(lang,
      "1. 让整体走向更清晰：每一段都要知道“在推进什么”。",
      "1. Làm cho hướng đi tổng thể rõ ràng hơn: mỗi đoạn đều phải biết \"đang đẩy điều gì\".",
      "1. Make the overall direction clearer: every paragraph must know \"what it is advancing\"."),
    pick(lang,
      "2. 强化冲突与推进，而不是平铺叙述。",
      "2. Tăng cường xung đột và lực đẩy, thay vì kể lể phẳng lặng.",
      "2. Strengthen conflict and momentum rather than flat narration."),
    pick(lang,
      "3. 消除重复、模糊或逻辑断裂的部分。",
      "3. Loại bỏ những phần trùng lặp, mơ hồ hoặc đứt gãy logic.",
      "3. Eliminate parts that are repetitive, vague, or logically broken."),
    pick(lang,
      "4. 让内容更适合继续展开为章节，而不是停留在概念层。",
      "4. Làm cho nội dung phù hợp hơn để triển khai tiếp thành chương, thay vì dừng ở tầng khái niệm.",
      "4. Make the content better suited to be expanded into chapters, rather than staying at the concept level."),
    "",
    pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
    pick(lang,
      "1. 表达要具体，避免“进一步发展”“展开冲突”这类空话。",
      "1. Diễn đạt phải cụ thể, tránh những câu rỗng như \"phát triển thêm\", \"triển khai xung đột\".",
      "1. Be concrete — avoid empty phrases like \"develop further\", \"unfold the conflict\"."),
    pick(lang,
      "2. 段落之间要有明显因果或递进关系。",
      "2. Giữa các đoạn phải có quan hệ nhân quả hoặc tăng tiến rõ ràng.",
      "2. Paragraphs must have a clear causal or escalating relationship between them."),
    pick(lang,
      "3. 优先做结构优化，而不是简单润色。",
      "3. Ưu tiên tối ưu cấu trúc thay vì chỉ chỉnh sửa câu chữ đơn thuần.",
      "3. Prioritize structural optimization over simple wording polish."),
    pick(lang,
      "4. 在未被指令影响的部分，尽量保持原结构，避免无意义重写。",
      "4. Ở những phần không bị chỉ thị tác động, cố gắng giữ cấu trúc gốc, tránh viết lại vô nghĩa.",
      "4. In parts the instruction does not touch, keep the original structure as much as possible — avoid pointless rewriting."),
  ];
}

function humanLines(
  lang: PromptLanguage,
  input: { instruction: string; charactersText: string; worldContext: string },
): string[] {
  return [
    pick(lang, "用户修正指令：", "Chỉ thị chỉnh sửa của người dùng:", "User's correction instruction:"),
    input.instruction,
    "",
    pick(lang, "核心角色：", "Nhân vật lõi:", "Core characters:"),
    input.charactersText,
    "",
    pick(lang, "世界上下文：", "Bối cảnh thế giới:", "World context:"),
    input.worldContext,
  ];
}

export const novelDraftOptimizeSelectionPrompt: PromptAsset<NovelDraftOptimizeSelectionPromptInput, string, string> = {
  id: "novel.draft_optimize.selection",
  version: "v2",
  taskType: "repair",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    return [
      new SystemMessage(selectionSystemLines(input.target, lang).join("\n")),
      new HumanMessage(
        [
          ...humanLines(lang, input),
          "",
          pick(lang,
            "片段前文（仅供理解，不可改写）：",
            "Phần trước của đoạn (chỉ để hiểu, không được viết lại):",
            "Text before the segment (for understanding only, do not rewrite):"),
          input.before || pick(lang, "（无）", "(không có)", "(none)"),
          "",
          pick(lang,
            "片段后文（仅供理解，不可改写）：",
            "Phần sau của đoạn (chỉ để hiểu, không được viết lại):",
            "Text after the segment (for understanding only, do not rewrite):"),
          input.after || pick(lang, "（无）", "(không có)", "(none)"),
          "",
          pick(lang, "待改写片段：", "Đoạn cần viết lại:", "Segment to be rewritten:"),
          input.selectedText,
          "",
          pick(lang, "输出要求：", "Yêu cầu đầu ra:", "Output requirements:"),
          pick(lang,
            "1. 只输出“待改写片段”的改写结果。",
            "1. Chỉ xuất kết quả viết lại của \"đoạn cần viết lại\".",
            "1. Output only the rewritten result of the \"segment to be rewritten\"."),
          pick(lang,
            "2. 不要输出前文/后文，不要解释说明。",
            "2. Không xuất phần trước/sau, không giải thích.",
            "2. Do not output the surrounding text, and do not explain."),
          pick(lang,
            "3. 若用户指令与原内容冲突，以“原片段核心语义 + 用户修正指令”为准做最小改动。",
            "3. Nếu chỉ thị người dùng xung đột với nội dung gốc, lấy \"ngữ nghĩa cốt lõi của đoạn gốc + chỉ thị chỉnh sửa của người dùng\" làm chuẩn và thay đổi ở mức tối thiểu.",
            "3. If the user's instruction conflicts with the original content, follow \"the original segment's core meaning + the user's correction instruction\" and make the minimal change."),
        ].join("\n"),
      ),
    ];
  },
};

export const novelDraftOptimizeFullPrompt: PromptAsset<NovelDraftOptimizeFullPromptInput, string, string> = {
  id: "novel.draft_optimize.full",
  version: "v2",
  taskType: "repair",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    return [
      new SystemMessage(fullSystemLines(input.target, lang).join("\n")),
      new HumanMessage(
        [
          ...humanLines(lang, input),
          "",
          pick(lang, "当前草稿：", "Bản nháp hiện tại:", "Current draft:"),
          input.currentDraft,
        ].join("\n"),
      ),
    ];
  },
};
