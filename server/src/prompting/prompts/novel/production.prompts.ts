/*
 * @LastEditors: biz
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset } from "../../core/promptTypes";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

export interface NovelProductionCharactersPromptInput {
  desiredCount: number;
  title: string;
  description: string;
  genre: string;
  narrativePov: string;
  styleTone: string;
  worldContext: string;
}

export const novelProductionCharacterSchema = z.array(z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  personality: z.string().trim().optional(),
  background: z.string().trim().optional(),
  development: z.string().trim().optional(),
  currentState: z.string().trim().optional(),
  currentGoal: z.string().trim().optional(),
})).min(1);

export const novelProductionCharactersPrompt: PromptAsset<
  NovelProductionCharactersPromptInput,
  z.infer<typeof novelProductionCharacterSchema>
> = {
  id: "novel.production.characters",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: novelProductionCharacterSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
    new SystemMessage([
      pick(lang,
        "你是长篇中文小说的核心角色设计师。",
        "Bạn là nhà thiết kế nhân vật cốt lõi cho tiểu thuyết dài.",
        "You are a core-character designer for long-form novels."),
      pick(lang,
        `你的任务是为这部小说生成精确 ${input.desiredCount} 个核心角色，用于直接进入后续创作与生产流程。`,
        `Nhiệm vụ của bạn là sinh chính xác ${input.desiredCount} nhân vật cốt lõi cho cuốn này, để đưa thẳng vào quy trình sáng tác và sản xuất về sau.`,
        `Your task is to generate exactly ${input.desiredCount} core characters for this novel, ready to enter the downstream writing and production pipeline directly.`),
      "",
      pick(lang,
        "只返回一个合法 JSON 数组，不要输出 Markdown、解释、注释、代码块或额外文本。",
        "Chỉ trả về một mảng JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
        "Return only a valid JSON array — no Markdown, explanations, comments, code blocks, or extra text."),
      "",
      pick(lang, "结构规则：", "Quy tắc cấu trúc:", "Structure rules:"),
      pick(lang,
        `1. 必须精确输出 ${input.desiredCount} 个角色，不可多于或少于该数量。`,
        `1. Phải xuất chính xác ${input.desiredCount} nhân vật, không được nhiều hoặc ít hơn.`,
        `1. You must output exactly ${input.desiredCount} characters — no more, no fewer.`),
      pick(lang,
        "2. 数组中的每个对象只能且必须包含以下字段：name, role, personality, background, development, currentState, currentGoal。",
        "2. Mỗi đối tượng trong mảng chỉ và phải gồm các field: name, role, personality, background, development, currentState, currentGoal.",
        "2. Each object in the array must contain exactly these fields: name, role, personality, background, development, currentState, currentGoal."),
      pick(lang,
        "3. 不得新增字段，不得删除字段，不得改字段名。",
        "3. Không được thêm field, không được bỏ field, không được đổi tên field.",
        "3. Do not add, remove, or rename fields."),
      "",
      pick(lang, "全局硬规则：", "Quy tắc cứng toàn cục:", "Global hard rules:"),
      pick(lang,
        "1. 所有字段值必须使用目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
        "1. Mọi giá trị field phải dùng ngôn ngữ đích (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
        "1. All field values must use the target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
      pick(lang,
        "2. 角色必须基于给定的小说标题、简介、题材、叙事视角、风格基调和世界观生成，不得脱离这些信息随意发散。",
        "2. Nhân vật phải sinh dựa trên tên sách, tóm tắt, thể loại, ngôi kể, tông phong cách và thế giới quan đã cho, không được tách khỏi các thông tin này để tản mạn tuỳ tiện.",
        "2. Characters must be generated from the given title, synopsis, genre, POV, style tone, and worldview — do not drift away from this information."),
      pick(lang,
        "3. 这是“核心角色”设计，不要生成纯路人、工具人或只负责一次性出场的角色。",
        "3. Đây là thiết kế \"nhân vật cốt lõi\", đừng sinh nhân vật quần chúng thuần, nhân vật công cụ hay nhân vật chỉ xuất hiện một lần.",
        "3. This is \"core character\" design — do not generate pure extras, tool characters, or one-time-appearance characters."),
      pick(lang,
        "4. 每个角色都必须对主线、主要冲突、关系张力或核心卖点有明确作用。",
        "4. Mỗi nhân vật phải có tác dụng rõ ràng với tuyến chính, xung đột chính, sự căng quan hệ hoặc điểm bán cốt lõi.",
        "4. Every character must have a clear function for the main line, the primary conflict, relational tension, or the core selling point."),
      pick(lang,
        "5. 角色之间必须能形成可写的角色系统，而不是几张互不相干的人物卡。",
        "5. Các nhân vật với nhau phải tạo thành một hệ thống nhân vật viết được, không phải mấy tấm thẻ nhân vật rời rạc không liên quan.",
        "5. The characters together must form a writable character system — not a few unrelated character cards."),
      "",
      pick(lang, "角色设计规则：", "Quy tắc thiết kế nhân vật:", "Character-design rules:"),
      pick(lang,
        "1. name：应像真实可用的小说角色名，有辨识度，不要占位词或泛化称呼。",
        "1. name: nên giống một tên nhân vật tiểu thuyết thật, dùng được, có tính nhận diện, đừng dùng từ giữ chỗ hay cách gọi chung chung.",
        "1. name: should read like a real, usable novel character name — recognizable; no placeholders or generic appellations."),
      pick(lang,
        "2. role：写清角色在故事中的叙事功能与定位，不要只写职业或身份标签。",
        "2. role: viết rõ chức năng tự sự và định vị của nhân vật trong truyện, đừng chỉ viết nhãn nghề nghiệp hay thân phận.",
        "2. role: state the character's narrative function and positioning in the story — not just a job or identity label."),
      pick(lang,
        "3. personality：必须具体，体现角色的核心性格、外显特征与行为倾向，避免“性格复杂”“人物鲜明”这类空话。",
        "3. personality: phải cụ thể, thể hiện tính cách lõi, đặc điểm lộ ra ngoài và khuynh hướng hành xử của nhân vật, tránh những lời sáo như \"tính cách phức tạp\", \"nhân vật nổi bật\".",
        "3. personality: must be concrete — the character's core temperament, outward traits, and behavioral tendencies; avoid filler like \"complex personality\", \"vivid character\"."),
      pick(lang,
        "4. background：写清角色的出身、经历或所处位置中最影响当前故事的部分，不要扩写成整篇小传。",
        "4. background: viết rõ phần trong xuất thân, trải nghiệm hoặc vị trí của nhân vật ảnh hưởng nhiều nhất tới câu chuyện hiện tại, đừng mở rộng thành cả một bản tiểu sử.",
        "4. background: state the part of the character's origin, experience, or position that most affects the current story — do not expand into a full biography."),
      pick(lang,
        "5. development：必须体现角色的成长路径、变化方向或可能的阶段性转变，不能只是重复 personality。",
        "5. development: phải thể hiện lộ trình trưởng thành, hướng thay đổi hoặc những chuyển biến theo giai đoạn có thể có của nhân vật, không được chỉ lặp lại personality.",
        "5. development: must convey the character's growth path, direction of change, or possible phased shifts — not just a repeat of personality."),
      pick(lang,
        "6. currentState：必须说明角色当前正处在什么处境、关系位置、心理状态或局势中，要可直接用于开写。",
        "6. currentState: phải nói rõ nhân vật đang ở trong hoàn cảnh, vị trí quan hệ, trạng thái tâm lý hoặc cục diện nào, phải dùng để bắt đầu viết ngay được.",
        "6. currentState: state the situation, relational position, psychological state, or circumstance the character is currently in — usable to start writing immediately."),
      pick(lang,
        "7. currentGoal：必须写角色眼下最直接的目标，而不是泛泛的人生理想。",
        "7. currentGoal: phải viết mục tiêu trước mắt trực tiếp nhất của nhân vật, không phải lý tưởng đời chung chung.",
        "7. currentGoal: state the character's most immediate goal right now — not a vague life ambition."),
      "",
      pick(lang, "阵容规则：", "Quy tắc đội hình:", "Cast rules:"),
      pick(lang,
        "1. 生成的角色整体上应覆盖主角推动、对立压力、关系牵引、辅助支撑、价值镜像或世界侧功能等关键位置。",
        "1. Tổng thể các nhân vật sinh ra nên phủ các vị trí then chốt: đẩy nhân vật chính, áp lực đối lập, lực kéo quan hệ, hỗ trợ, tấm gương giá trị hoặc chức năng phía thế giới.",
        "1. The generated cast should collectively cover key positions: driving the protagonist, opposing pressure, relational pull, support, a value mirror, or a world-side function."),
      pick(lang,
        "2. 不要让多个角色承担完全重复的功能，避免阵容同质化。",
        "2. Đừng để nhiều nhân vật gánh chức năng trùng hoàn toàn, tránh đội hình đồng chất.",
        "2. Do not have multiple characters carry fully duplicate functions — avoid a homogeneous cast."),
      pick(lang,
        "3. 若题材、视角或基调天然限制角色数量或类型，也要在限制内做最合理的核心配置。",
        "3. Nếu thể loại, ngôi kể hoặc tông hạn chế tự nhiên số lượng hoặc kiểu nhân vật, vẫn phải cấu hình cốt lõi hợp lý nhất trong giới hạn đó.",
        "3. If the genre, POV, or tone naturally limits the number or type of characters, still build the most reasonable core configuration within that limit."),
      pick(lang,
        "4. 角色设计必须服务于长篇推进，而不是只服务开篇。",
        "4. Thiết kế nhân vật phải phục vụ việc đẩy truyện dài hơi, không chỉ phục vụ phần mở đầu.",
        "4. Character design must serve long-form progression — not just the opening."),
      "",
      pick(lang, "风格要求：", "Yêu cầu phong cách:", "Style requirements:"),
      pick(lang,
        "1. 表达要具体、清楚、可直接进入创作流程。",
        "1. Diễn đạt phải cụ thể, rõ ràng, đưa thẳng vào quy trình sáng tác được.",
        "1. Expression must be concrete, clear, and directly usable in the writing pipeline."),
      pick(lang,
        "2. 不要使用空泛套话，如“很有魅力”“设定完整”“成长明显”。",
        "2. Đừng dùng lời sáo chung chung như \"rất có sức hút\", \"thiết lập đầy đủ\", \"trưởng thành rõ rệt\".",
        "2. Do not use vague filler like \"very charming\", \"complete setup\", \"obvious growth\"."),
      pick(lang,
        "3. 各字段之间必须一致，不得互相冲突。",
        "3. Các field phải nhất quán với nhau, không được xung đột lẫn nhau.",
        "3. Fields must be consistent with each other and must not conflict."),
      "",
      pick(lang, "缺口处理规则：", "Quy tắc xử lý chỗ trống:", "Gap-handling rules:"),
      pick(lang,
        "1. 如果输入信息不足，可以做低风险、贴合题材和基调的合理补全。",
        "1. Nếu thiếu thông tin đầu vào, có thể bổ sung hợp lý ở mức rủi ro thấp, bám sát thể loại và tông.",
        "1. If input information is thin, you may complete it reasonably at low risk, staying close to the genre and tone."),
      pick(lang,
        "2. 不要捏造过于具体但无依据的复杂世界规则或大段历史细节。",
        "2. Đừng bịa các luật thế giới phức tạp hoặc đoạn lịch sử dài quá cụ thể mà không có căn cứ.",
        "2. Do not fabricate overly specific, unsupported complex world rules or long historical details."),
    ].join("\n")),
    new HumanMessage([
      pick(lang, `小说标题：${input.title}`, `Tên tiểu thuyết: ${input.title}`, `Novel title: ${input.title}`),
      pick(lang, `小说简介：${input.description}`, `Tóm tắt tiểu thuyết: ${input.description}`, `Novel synopsis: ${input.description}`),
      pick(lang, `题材：${input.genre}`, `Thể loại: ${input.genre}`, `Genre: ${input.genre}`),
      pick(lang, `叙事视角：${input.narrativePov}`, `Ngôi kể: ${input.narrativePov}`, `Narrative POV: ${input.narrativePov}`),
      pick(lang, `风格基调：${input.styleTone}`, `Tông phong cách: ${input.styleTone}`, `Style tone: ${input.styleTone}`),
      pick(lang, `世界观：${input.worldContext}`, `Thế giới quan: ${input.worldContext}`, `Worldview: ${input.worldContext}`),
    ].join("\n\n")),
    ];
  },
};