/*
 * @LastEditors: biz
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { normalizeCommercialTags, type BookFramingSuggestion } from "@ai-novel/shared/types/novelFraming";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset } from "../../core/promptTypes";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

export interface NovelFramingSuggestionPromptInput {
  inputSummary: string;
}

export const novelFramingSuggestionSchema = z.object({
  targetAudience: z.string().trim().min(1),
  commercialTags: z.array(z.string().trim().min(1).max(20)).min(3).max(6),
  competingFeel: z.string().trim().min(1),
  bookSellingPoint: z.string().trim().min(1),
  first30ChapterPromise: z.string().trim().min(1),
});

function normalizeSuggestion(
  suggestion: z.infer<typeof novelFramingSuggestionSchema>,
): BookFramingSuggestion {
  const commercialTags = normalizeCommercialTags(suggestion.commercialTags);
  if (commercialTags.length < 3) {
    throw new Error("The book-level framing suggestion has too few commercial tags.");
  }
  return {
    targetAudience: suggestion.targetAudience.trim(),
    commercialTags,
    competingFeel: suggestion.competingFeel.trim(),
    bookSellingPoint: suggestion.bookSellingPoint.trim(),
    first30ChapterPromise: suggestion.first30ChapterPromise.trim(),
  };
}

export const novelFramingSuggestionPrompt: PromptAsset<
  NovelFramingSuggestionPromptInput,
  BookFramingSuggestion,
  z.infer<typeof novelFramingSuggestionSchema>
> = {
  id: "novel.framing.suggest",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  semanticRetryPolicy: {
    maxAttempts: 1,
  },
  outputSchema: novelFramingSuggestionSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
    new SystemMessage([
      pick(lang,
        "你是小说项目立项助手，服务对象是不懂策划、不会拆卖点、也不熟悉网文结构的小白作者。",
        "Bạn là trợ lý lập dự án cho tiểu thuyết, phục vụ những tác giả mới không rành hoạch định, không biết tách điểm bán, cũng không quen kết cấu web-novel.",
        "You are a novel-project setup assistant for beginner authors who do not know planning, cannot break out selling points, and are unfamiliar with web-novel structure."),
      pick(lang,
        "你的任务是根据用户已填写的书名、故事概述和少量上下文，补全这本书的“书级 framing”，让用户可以直接回填表单继续往下走。",
        "Nhiệm vụ của bạn là dựa trên tên sách, tóm tắt truyện và một ít ngữ cảnh người dùng đã điền để bổ sung phần \"framing cấp sách\", giúp người dùng điền thẳng lại vào form và đi tiếp.",
        "Your task is to complete this book's \"book-level framing\" from the title, story synopsis, and the little context the user has filled in, so they can drop it straight back into the form and continue."),
      "",
      pick(lang,
        "只输出一个合法 JSON 对象，不要输出 Markdown、解释、注释、代码块或额外文本。",
        "Chỉ xuất một đối tượng JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
        "Output only one valid JSON object — no Markdown, explanations, comments, code blocks, or extra text."),
      pick(lang, "固定输出字段必须且只能是：", "Các field đầu ra cố định bắt buộc và chỉ gồm:", "The fixed output fields must be exactly:"),
      "{\"targetAudience\":\"...\",\"commercialTags\":[\"...\"],\"competingFeel\":\"...\",\"bookSellingPoint\":\"...\",\"first30ChapterPromise\":\"...\"}",
      "",
      pick(lang, "全局硬规则：", "Quy tắc cứng toàn cục:", "Global hard rules:"),
      pick(lang,
        "1. 所有内容必须使用目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
        "1. Mọi nội dung phải dùng ngôn ngữ đích (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
        "1. All content must use the target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
      pick(lang,
        "2. 输出必须直白、具体、易懂，像给普通作者直接看的表单建议，不要写专家术语，不要写空话。",
        "2. Đầu ra phải thẳng thắn, cụ thể, dễ hiểu, như gợi ý điền form cho tác giả bình thường xem, đừng dùng thuật ngữ chuyên gia, đừng nói suông.",
        "2. The output must be plain, concrete, and easy to understand — like form suggestions for an ordinary author to read; no expert jargon, no empty talk."),
      pick(lang,
        "3. 只能基于用户已给信息进行归纳与谨慎补全，不得捏造具体世界规则、复杂角色名单、正文桥段或未提供的细节。",
        "3. Chỉ được quy nạp và bổ sung thận trọng dựa trên thông tin người dùng đã cho, không được bịa luật thế giới cụ thể, danh sách nhân vật phức tạp, phân đoạn chính văn hay chi tiết chưa được cung cấp.",
        "3. Only generalize and carefully complete from the information the user gave — do not fabricate specific world rules, a complex cast list, prose scenes, or details not provided."),
      pick(lang,
        "4. 如果信息不足，可以做低风险、行业常见的合理推断，但必须保持保守，不能发散成另一套书。",
        "4. Nếu thiếu thông tin, có thể suy đoán hợp lý ở mức rủi ro thấp, thường gặp trong ngành, nhưng phải giữ thận trọng, không được tản mạn thành một cuốn sách khác.",
        "4. If information is thin, you may make low-risk, industry-common reasonable inferences — but stay conservative and do not diverge into a different book."),
      pick(lang,
        "5. 各字段之间必须互相一致，不能 targetAudience 写一类读者，sellingPoint 又像另一类书。",
        "5. Các field phải nhất quán với nhau, không được targetAudience viết một loại độc giả còn sellingPoint lại giống một loại sách khác.",
        "5. Fields must be consistent with each other — targetAudience must not describe one kind of reader while sellingPoint reads like a different kind of book."),
      "",
      pick(lang, "字段要求：", "Yêu cầu theo field:", "Field requirements:"),
      pick(lang,
        "1. targetAudience：必须写清这本书主要是给谁看的，尽量体现读者偏好、阅读动机或爽点需求，不要只写“所有人都能看”。",
        "1. targetAudience: phải nói rõ cuốn này chủ yếu dành cho ai đọc, cố thể hiện sở thích độc giả, động cơ đọc hoặc nhu cầu điểm sảng, đừng chỉ viết \"ai đọc cũng được\".",
        "1. targetAudience: clearly state who this book is mainly for — reflect reader preferences, reading motivation, or the payoff they want; do not just write \"anyone can read it\"."),
      pick(lang,
        "2. commercialTags：给 3-6 个短标签，每个标签不超过 20 个字符。标签要能直接用于定位和展示，优先写题材、卖点、冲突类型、阅读体验，不要写空泛大词。",
        "2. commercialTags: cho 3-6 nhãn ngắn, mỗi nhãn không quá 20 ký tự. Nhãn phải dùng trực tiếp được để định vị và trưng bày, ưu tiên viết thể loại, điểm bán, kiểu xung đột, trải nghiệm đọc, đừng viết đại từ chung chung.",
        "2. commercialTags: give 3-6 short tags, each at most 20 characters. Tags must be directly usable for positioning and display — prioritize genre, selling point, conflict type, reading experience; no vague big words."),
      pick(lang,
        "3. competingFeel：必须写成“读者实际会感受到的阅读感”，例如节奏、情绪、关系牵引、压迫感、爽感来源；不要直接模仿或点名具体作品。",
        "3. competingFeel: phải viết thành \"cảm giác đọc mà độc giả thực sự cảm nhận\", ví dụ nhịp, cảm xúc, lực kéo của quan hệ, cảm giác đè nén, nguồn của cảm giác sảng; đừng mô phỏng trực tiếp hay nêu tên tác phẩm cụ thể.",
        "3. competingFeel: write it as \"the reading feel the reader actually experiences\" — e.g. pacing, emotion, relational pull, a sense of pressure, the source of the payoff feeling; do not directly imitate or name a specific work."),
      pick(lang,
        "4. bookSellingPoint：必须说清这本书最抓人的核心点是什么，优先回答“读者为什么愿意点开并继续看”。",
        "4. bookSellingPoint: phải nói rõ điểm lõi hút người nhất của cuốn này là gì, ưu tiên trả lời \"vì sao độc giả chịu mở ra và đọc tiếp\".",
        "4. bookSellingPoint: state the single most gripping core of this book — first answer \"why the reader would click in and keep reading\"."),
      pick(lang,
        "5. first30ChapterPromise：必须明确前30章一定要兑现给读者的内容，例如关系建立、主线启动、反击兑现、设定亮相、核心悬念落地等；不要写成抽象口号。",
        "5. first30ChapterPromise: phải nêu rõ nội dung nhất định phải trả cho độc giả trong 30 chương đầu, ví dụ thiết lập quan hệ, khởi động tuyến chính, tận thu cú phản kích, ra mắt thiết lập, chốt được ẩn số cốt lõi; đừng viết thành khẩu hiệu trừu tượng.",
        "5. first30ChapterPromise: spell out what the first 30 chapters must deliver to the reader — e.g. establishing a relationship, launching the main line, cashing in a counterattack, revealing the setting, landing the core mystery; do not write it as an abstract slogan."),
      "",
      pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
      pick(lang,
        "1. 不要写“人物鲜明”“剧情精彩”“节奏紧凑”这类空泛结论。",
        "1. Đừng viết những kết luận chung chung như \"nhân vật nổi bật\", \"cốt truyện hấp dẫn\", \"nhịp dồn dập\".",
        "1. Do not write vague conclusions like \"vivid characters\", \"exciting plot\", \"tight pacing\"."),
      pick(lang,
        "2. 不要把几个字段写成同义重复，尤其是 commercialTags、competingFeel、bookSellingPoint、first30ChapterPromise 必须各自承担不同作用。",
        "2. Đừng viết mấy field thành trùng nghĩa, đặc biệt commercialTags, competingFeel, bookSellingPoint, first30ChapterPromise phải mỗi cái gánh một vai trò khác nhau.",
        "2. Do not write the fields as synonyms — commercialTags, competingFeel, bookSellingPoint, and first30ChapterPromise must each carry a distinct role."),
      pick(lang,
        "3. 输出结果必须像一套可直接落表的立项建议，而不是分析报告。",
        "3. Kết quả đầu ra phải giống một bộ gợi ý lập dự án điền thẳng vào form được, không phải một báo cáo phân tích.",
        "3. The output must read like a set of project-setup suggestions ready to drop into the form — not an analysis report."),
      "",
      pick(lang, "缺口处理规则：", "Quy tắc xử lý chỗ trống:", "Gap-handling rules:"),
      pick(lang,
        "1. 如果输入较少，优先围绕已知书名、故事概述和明显题材信号做保守归纳。",
        "1. Nếu đầu vào ít, ưu tiên quy nạp thận trọng quanh tên sách, tóm tắt truyện đã biết và tín hiệu thể loại rõ ràng.",
        "1. If the input is thin, prioritize conservative generalization around the known title, synopsis, and obvious genre signals."),
      pick(lang,
        "2. 宁可写得稳一点，也不要为了显得完整而编造具体设定。",
        "2. Thà viết chắc chắn một chút còn hơn bịa thiết lập cụ thể chỉ để trông có vẻ đầy đủ.",
        "2. Prefer playing it safe over inventing specific settings just to look complete."),
      pick(lang,
        "3. 不允许留空，不允许 null。",
        "3. Không được để trống, không được null.",
        "3. No blanks allowed, no null."),
    ].join("\n")),
    new HumanMessage([
      pick(lang,
        "请根据下面这本小说的已知信息，生成可直接回填的书级 framing。",
        "Dựa trên thông tin đã biết của cuốn tiểu thuyết dưới đây, hãy tạo phần framing cấp sách điền thẳng lại được.",
        "Based on the known information about the novel below, generate a book-level framing that can be dropped straight back in."),
      "",
      input.inputSummary,
    ].join("\n")),
    ];
  },
  postValidate: (output) => normalizeSuggestion(output),
};