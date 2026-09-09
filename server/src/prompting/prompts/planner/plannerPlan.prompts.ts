import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StoryPlanLevel } from "@ai-novel/shared/types/novel";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset, PromptRenderContext } from "../../core/promptTypes";
import { normalizePlannerOutput, type PlannerOutput } from "../../../services/planner/plannerOutputNormalization";
import { plannerOutputSchema } from "../../../services/planner/plannerSchemas";

interface PlannerPlanPromptInput {
  scopeLabel: string;
}

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

function buildPlannerPlanAsset(input: {
  id: string;
  version: string;
  planLevel: StoryPlanLevel;
  includeScenes: boolean;
  maxTokensBudget: number;
}): PromptAsset<PlannerPlanPromptInput, PlannerOutput> {
  return {
    id: input.id,
    version: input.version,
    taskType: "planner",
    mode: "structured",
    language: "zh",
    contextPolicy: {
      maxTokensBudget: input.maxTokensBudget,
      requiredGroups:
        input.planLevel === "chapter"
          ? ["novel_overview", "chapter_target", "outline_source", "state_snapshot"]
          : undefined,
      preferredGroups:
        input.planLevel === "chapter"
          ? ["book_plan", "arc_plans", "volume_summary", "story_mode"]
          : ["story_mode", "book_bible"],
      dropOrder: [
        "recent_decisions",
        "character_dynamics",
        "plot_beats",
        "recent_summaries",
        "arc_plans",
        "book_plan",
        "volume_summary",
      ],
    },
    semanticRetryPolicy:
      input.planLevel === "chapter"
        ? { maxAttempts: 1 }
        : undefined,
    outputSchema: plannerOutputSchema,
    structuredOutputHint: {
      example: (_promptInput: PlannerPlanPromptInput, context: PromptRenderContext) => {
        const lang = context.promptLanguage;
        return {
          title: pick(lang, "示例标题", "Tiêu đề ví dụ", "Example title"),
          objective: pick(lang, "示例目标", "Mục tiêu ví dụ", "Example objective"),
          participants: [pick(lang, "示例参与方", "Bên tham gia ví dụ", "Example participant")],
          reveals: [pick(lang, "示例揭露", "Hé lộ ví dụ", "Example reveal")],
          riskNotes: [pick(lang, "示例风险", "Rủi ro ví dụ", "Example risk")],
          hookTarget: pick(lang, "示例悬念", "Móc câu ví dụ", "Example hook"),
          planRole: input.planLevel === "chapter" ? "progress" : "",
          phaseLabel: pick(lang, "示例阶段", "Giai đoạn ví dụ", "Example phase"),
          mustAdvance: [pick(lang, "示例推进项", "Hạng mục đẩy ví dụ", "Example advance item")],
          mustPreserve: [pick(lang, "示例保留项", "Hạng mục cần giữ ví dụ", "Example preserve item")],
          scenes: input.includeScenes
            ? [{
              title: pick(lang, "示例场景", "Cảnh ví dụ", "Example scene"),
              objective: pick(lang, "示例场景目标", "Mục tiêu cảnh ví dụ", "Example scene objective"),
              conflict: pick(lang, "示例冲突", "Xung đột ví dụ", "Example conflict"),
              reveal: pick(lang, "示例变化", "Thay đổi ví dụ", "Example change"),
              emotionBeat: pick(lang, "示例情绪节拍", "Nhịp cảm xúc ví dụ", "Example emotion beat"),
            }]
            : [],
        };
      },
      note: (_promptInput: PlannerPlanPromptInput, context: PromptRenderContext) => (input.includeScenes
        ? pick(context.promptLanguage,
          "当前层级必须返回可执行的 scenes 示例。",
          "Cấp hiện tại phải trả về ví dụ scenes khả thi.",
          "This level must return an executable scenes example.")
        : pick(context.promptLanguage,
          "当前层级的 scenes 必须保持为空数组。",
          "scenes của cấp hiện tại phải là mảng rỗng.",
          "scenes at this level must remain an empty array.")),
    },
    render: (promptInput, context) => {
      const lang = context.promptLanguage;
      const contextText = context.blocks.map((block) => block.content).join("\n\n");

      const systemPrompt = [
        pick(lang,
          "你是长篇小说规划助手，负责把当前层级的故事需求整理成可直接进入下一步写作或细化流程的结构化规划结果。",
          "Bạn là trợ lý hoạch định tiểu thuyết dài, chịu trách nhiệm chỉnh nhu cầu truyện ở cấp hiện tại thành kết quả hoạch định có cấu trúc, đưa thẳng vào bước viết hoặc bước tinh chỉnh tiếp theo được.",
          "You are a long-form novel-planning assistant; you turn this level's story needs into a structured planning result ready to enter the next writing or refinement step."),
        "",
        pick(lang,
          "只输出严格 JSON，不要输出 Markdown、解释、注释、代码块或额外文本。",
          "Chỉ xuất JSON nghiêm ngặt, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
          "Output strict JSON only — no Markdown, explanations, comments, code blocks, or extra text."),
        pick(lang, `当前规划层级：${input.planLevel}。`, `Cấp hoạch định hiện tại: ${input.planLevel}.`, `Current planning level: ${input.planLevel}.`),
        "",
        pick(lang, "输出必须包含以下字段：", "Đầu ra phải gồm các field sau:", "The output must contain these fields:"),
        "title, objective, participants, reveals, riskNotes, hookTarget, planRole, phaseLabel, mustAdvance, mustPreserve, scenes.",
        input.includeScenes
          ? pick(lang,
            "scenes 必须是非空数组，且每一项都必须包含：title、objective、conflict、reveal、emotionBeat。",
            "scenes phải là mảng không rỗng, và mỗi mục phải gồm: title, objective, conflict, reveal, emotionBeat.",
            "scenes must be a non-empty array, and each item must contain: title, objective, conflict, reveal, emotionBeat.")
          : pick(lang, "scenes 必须返回空数组。", "scenes phải trả về mảng rỗng.", "scenes must return an empty array."),
        input.planLevel === "chapter"
          ? pick(lang,
            "当规划层级为 chapter 时，planRole 必填，且只能是：setup、progress、pressure、turn、payoff、cooldown。",
            "Khi cấp hoạch định là chapter, planRole bắt buộc, và chỉ được là: setup, progress, pressure, turn, payoff, cooldown.",
            "When the planning level is chapter, planRole is required and may only be: setup, progress, pressure, turn, payoff, cooldown.")
          : pick(lang,
            "当规划层级为 book 或 arc 时，planRole 可为空字符串，但不得乱填无效值。",
            "Khi cấp hoạch định là book hoặc arc, planRole có thể là chuỗi rỗng, nhưng không được điền bừa giá trị không hợp lệ.",
            "When the planning level is book or arc, planRole may be an empty string, but do not fill in an invalid value."),
        "",
        pick(lang, "全局硬规则：", "Quy tắc cứng toàn cục:", "Global hard rules:"),
        pick(lang,
          "1. 所有内容必须使用目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
          "1. Mọi nội dung phải dùng ngôn ngữ đích (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
          "1. All content must use the target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
        pick(lang,
          "2. 只能基于给定上下文规划，不得补写上下文之外的关键设定、人物关系或重大剧情。",
          "2. Chỉ được hoạch định dựa trên ngữ cảnh đã cho, không được viết thêm thiết lập then chốt, quan hệ nhân vật hay cốt truyện lớn ngoài ngữ cảnh.",
          "2. Plan only from the given context — do not add key settings, character relationships, or major plot beyond it."),
        pick(lang,
          "3. 输出必须服务于后续创作执行，而不是写分析说明。",
          "3. Đầu ra phải phục vụ việc thực thi sáng tác về sau, không phải viết lời phân tích.",
          "3. The output must serve downstream execution — not be an analytical write-up."),
        pick(lang,
          "4. 各字段之间必须自洽，不得互相冲突。",
          "4. Các field phải tự nhất quán, không được xung đột lẫn nhau.",
          "4. Fields must be self-consistent and must not conflict."),
        pick(lang,
          "5. mustAdvance 和 mustPreserve 必须简短、具体、可直接用于后续写作。",
          "5. mustAdvance và mustPreserve phải ngắn, cụ thể, dùng thẳng cho việc viết về sau được.",
          "5. mustAdvance and mustPreserve must be short, concrete, and directly usable in downstream writing."),
        "",
        pick(lang, "字段要求：", "Yêu cầu theo field:", "Field requirements:"),
        pick(lang,
          "1. title：写当前层级规划条目的标题，简洁明确，不要占位词。",
          "1. title: viết tiêu đề của mục hoạch định ở cấp hiện tại, ngắn gọn rõ ràng, đừng dùng từ giữ chỗ.",
          "1. title: the title of this level's planning entry — concise and clear, no placeholders."),
        pick(lang,
          "2. objective：必须明确说明这一层规划最核心的推进目标，不能写成泛泛摘要。",
          "2. objective: phải nói rõ mục tiêu đẩy cốt lõi nhất của cấp hoạch định này, không được viết thành tóm tắt chung chung.",
          "2. objective: clearly state this level's most core progression goal — not a vague summary."),
        pick(lang,
          "3. participants：只列关键人物、关键势力或关键关系参与方，不要把所有人都塞进去。",
          "3. participants: chỉ liệt kê nhân vật then chốt, thế lực then chốt hoặc bên tham gia quan hệ then chốt, đừng nhét hết mọi người vào.",
          "3. participants: list only key characters, key factions, or key relationship parties — do not stuff everyone in."),
        pick(lang,
          "4. reveals：只写重要信息揭露、结构转折或关键认知变化，不要写普通过程。",
          "4. reveals: chỉ viết các hé lộ thông tin quan trọng, bước ngoặt kết cấu hoặc thay đổi nhận thức then chốt, đừng viết quá trình thông thường.",
          "4. reveals: write only important information reveals, structural turns, or key perception shifts — not ordinary process."),
        pick(lang,
          "5. riskNotes：写最容易失焦、变平、失真、跑偏或违背约束的风险点，必须具体。",
          "5. riskNotes: viết các điểm rủi ro dễ mất tiêu điểm, phẳng ra, méo đi, lạc hướng hoặc trái ràng buộc nhất, phải cụ thể.",
          "5. riskNotes: write the risk points where it is most likely to lose focus, go flat, distort, drift, or break constraints — must be concrete."),
        pick(lang,
          "6. hookTarget：写阶段尾部或章节尾部要留给读者的悬念、张力、期待或情绪牵引，不要写成空话。",
          "6. hookTarget: viết nút thắt, sự căng, kỳ vọng hoặc lực kéo cảm xúc cần để lại cho người đọc ở cuối giai đoạn hoặc cuối chương, đừng viết suông.",
          "6. hookTarget: the suspense, tension, expectation, or emotional pull to leave the reader at the end of the phase or chapter — no empty talk."),
        pick(lang,
          "7. phaseLabel：用短语概括当前阶段，例如“试探压迫期”“关系绑定期”“身份松动期”，不要太长。",
          "7. phaseLabel: dùng một cụm ngắn tóm tắt giai đoạn hiện tại, ví dụ \"giai đoạn thăm dò đè ép\", \"giai đoạn ràng buộc quan hệ\", \"giai đoạn lung lay thân phận\", đừng quá dài.",
          "7. phaseLabel: a short phrase summarizing the current phase, e.g. \"probing-pressure phase\", \"relationship-binding phase\", \"identity-loosening phase\" — not too long."),
        pick(lang,
          "8. mustAdvance：列出本层级绝不能缺席的推进项，必须是动作性、结果性或结构性推进。",
          "8. mustAdvance: liệt kê các hạng mục đẩy tuyệt đối không được thiếu ở cấp này, phải là đẩy mang tính hành động, kết quả hoặc kết cấu.",
          "8. mustAdvance: list the advance items this level must not miss — action-based, outcome-based, or structural progression."),
        pick(lang,
          "9. mustPreserve：列出不能破坏的连续性、世界规则、角色状态、语气边界或模式约束。",
          "9. mustPreserve: liệt kê tính liên tục, luật thế giới, trạng thái nhân vật, ranh giới giọng điệu hoặc ràng buộc mode không được phá.",
          "9. mustPreserve: list the continuity, world rules, character states, tone boundaries, or mode constraints that must not be broken."),
        input.includeScenes
          ? pick(lang,
            "10. scenes 必须按顺序组织，且每一项都要能直接给写作阶段使用，不要写成概念标签。",
            "10. scenes phải tổ chức theo thứ tự, và mỗi mục phải đưa thẳng cho bước viết dùng được, đừng viết thành nhãn khái niệm.",
            "10. scenes must be ordered, and each item must be directly usable by the writing step — not a conceptual label.")
          : pick(lang,
            "10. 由于当前层级不要求场景细化，scenes 必须为空数组。",
            "10. Vì cấp hiện tại không yêu cầu tinh chỉnh cảnh, scenes phải là mảng rỗng.",
            "10. Since this level does not require scene detailing, scenes must be an empty array."),
        "",
        pick(lang, "故事模式规则：", "Quy tắc story mode:", "Story-mode rules:"),
        pick(lang,
          "1. 当上下文存在故事模式约束时，primary mode 视为硬约束，secondary mode 只能作为轻量风味层。",
          "1. Khi ngữ cảnh có ràng buộc story mode, primary mode là ràng buộc cứng, secondary mode chỉ là lớp phong vị nhẹ.",
          "1. When the context has story-mode constraints, the primary mode is a hard constraint; the secondary mode is only a light flavor layer."),
        pick(lang,
          "2. 不得突破故事模式给出的冲突上限。",
          "2. Không được vượt trần xung đột mà story mode đưa ra.",
          "2. Do not exceed the conflict ceiling the story mode sets."),
        pick(lang,
          "3. 不得依赖被明确禁止的冲突形式。",
          "3. Không được dựa vào các dạng xung đột bị cấm rõ ràng.",
          "3. Do not rely on explicitly forbidden conflict forms."),
        "",
        pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
        pick(lang,
          "1. 输出必须像“可直接交给下一环节执行的规划结果”，而不是概念备忘录。",
          "1. Đầu ra phải giống \"kết quả hoạch định giao thẳng cho khâu sau thực thi\", không phải bản ghi nhớ khái niệm.",
          "1. The output must read like \"a planning result handed straight to the next step for execution\" — not a conceptual memo."),
        pick(lang,
          "2. 避免空泛表达，如“推进剧情”“增加冲突”“深化人物”。",
          "2. Tránh diễn đạt chung chung như \"đẩy cốt truyện\", \"tăng xung đột\", \"đào sâu nhân vật\".",
          "2. Avoid vague phrasing like \"advance the plot\", \"add conflict\", \"deepen the character\"."),
        pick(lang,
          "3. 所有数组项应使用短语或短句，避免冗长分析。",
          "3. Mọi mục trong mảng nên dùng cụm ngắn hoặc câu ngắn, tránh phân tích dài dòng.",
          "3. All array items should use short phrases or short sentences — avoid lengthy analysis."),
      ].join("\n");

      const userPrompt = [
        promptInput.scopeLabel,
        "",
        pick(lang, "上下文：", "Ngữ cảnh:", "Context:"),
        contextText || pick(lang, "无", "không có", "none"),
        "",
        pick(lang, "输出要求：", "Yêu cầu đầu ra:", "Output requirements:"),
        pick(lang,
          "1. objective 必须明确回答“这一层现在到底要推进什么”。",
          "1. objective phải trả lời rõ \"cấp này bây giờ rốt cuộc phải đẩy cái gì\".",
          "1. objective must clearly answer \"what exactly does this level need to advance right now\"."),
        pick(lang,
          "2. participants 只保留真正影响这一层推进的人物、势力或关系主体。",
          "2. participants chỉ giữ các nhân vật, thế lực hoặc chủ thể quan hệ thực sự ảnh hưởng đến sự đẩy ở cấp này.",
          "2. participants: keep only the characters, factions, or relationship subjects that genuinely affect this level's progression."),
        pick(lang,
          "3. reveals 只写关键揭露，不要把过程细节混进去。",
          "3. reveals chỉ viết các hé lộ then chốt, đừng trộn chi tiết quá trình vào.",
          "3. reveals: write only key reveals — do not mix in process details."),
        pick(lang,
          "4. riskNotes 要优先指出最容易让这一层写坏的地方。",
          "4. riskNotes phải ưu tiên chỉ ra chỗ dễ khiến cấp này bị viết hỏng nhất.",
          "4. riskNotes: prioritize pointing out where this level is most likely to be written badly."),
        pick(lang,
          "5. hookTarget 要能直接服务读者追更，而不是抽象写“制造悬念”。",
          "5. hookTarget phải phục vụ trực tiếp việc người đọc theo dõi tiếp, không phải viết trừu tượng \"tạo hồi hộp\".",
          "5. hookTarget must directly serve the reader's desire to keep reading — not an abstract \"create suspense\"."),
        pick(lang,
          "6. phaseLabel 必须短、准、可识别。",
          "6. phaseLabel phải ngắn, chính xác, nhận diện được.",
          "6. phaseLabel must be short, accurate, and recognizable."),
        pick(lang,
          "7. mustAdvance 必须列出不可缺席的推进项。",
          "7. mustAdvance phải liệt kê các hạng mục đẩy không thể thiếu.",
          "7. mustAdvance must list the advance items that cannot be missing."),
        pick(lang,
          "8. mustPreserve 必须列出不能破坏的连续性、语气和硬约束。",
          "8. mustPreserve phải liệt kê tính liên tục, giọng điệu và ràng buộc cứng không được phá.",
          "8. mustPreserve must list the continuity, tone, and hard constraints that must not be broken."),
        input.includeScenes
          ? pick(lang,
            "9. scenes 必须顺序清晰，且每个 scene 都应体现具体动作、冲突或变化。",
            "9. scenes phải rõ thứ tự, và mỗi scene phải thể hiện hành động, xung đột hoặc thay đổi cụ thể.",
            "9. scenes must be clearly ordered, and each scene must show a concrete action, conflict, or change.")
          : pick(lang, "9. scenes 返回空数组。", "9. scenes trả về mảng rỗng.", "9. scenes returns an empty array."),
      ].join("\n");

      return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
    },
    postValidate: (output) => {
      const normalized = normalizePlannerOutput(output);

      if (!normalized.title?.trim()) {
        throw new Error("Planner output is missing title.");
      }

      if (!normalized.objective?.trim()) {
        throw new Error("Planner output is missing objective.");
      }

      if (!normalized.phaseLabel?.trim()) {
        throw new Error("Planner output is missing phaseLabel.");
      }

      if ((normalized.mustAdvance ?? []).length === 0) {
        throw new Error("Planner output is missing mustAdvance.");
      }

      if ((normalized.mustPreserve ?? []).length === 0) {
        throw new Error("Planner output is missing mustPreserve.");
      }

      if (input.planLevel === "chapter") {
        if (!normalized.planRole) {
          throw new Error("Chapter planner output is missing planRole.");
        }
        if (!["setup", "progress", "pressure", "turn", "payoff", "cooldown"].includes(normalized.planRole)) {
          throw new Error("Chapter planner output has invalid planRole.");
        }
        if ((normalized.scenes ?? []).length === 0) {
          throw new Error("Chapter planner output is missing scenes.");
        }
      }

      if (!input.includeScenes && (normalized.scenes ?? []).length > 0) {
        throw new Error("Planner output should not include scenes for this plan level.");
      }

      if (input.includeScenes) {
        for (const scene of normalized.scenes ?? []) {
          if (!scene.title?.trim()) {
            throw new Error("Planner scene is missing title.");
          }
          if (!scene.objective?.trim()) {
            throw new Error("Planner scene is missing objective.");
          }
          if (!scene.conflict?.trim()) {
            throw new Error("Planner scene is missing conflict.");
          }
          if (!scene.reveal?.trim()) {
            throw new Error("Planner scene is missing reveal.");
          }
          if (!scene.emotionBeat?.trim()) {
            throw new Error("Planner scene is missing emotionBeat.");
          }
        }
      }

      return normalized;
    },
  };
}
export const plannerBookPlanPrompt = buildPlannerPlanAsset({
  id: "planner.book.plan",
  version: "v1",
  planLevel: "book",
  includeScenes: false,
  maxTokensBudget: 1800,
});

export const plannerArcPlanPrompt = buildPlannerPlanAsset({
  id: "planner.arc.plan",
  version: "v1",
  planLevel: "arc",
  includeScenes: false,
  maxTokensBudget: 1800,
});

export const plannerChapterPlanPrompt = buildPlannerPlanAsset({
  id: "planner.chapter.plan",
  version: "v1",
  planLevel: "chapter",
  includeScenes: true,
  maxTokensBudget: 2400,
});
