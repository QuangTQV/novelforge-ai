import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset, PromptRenderContext } from "../../core/promptTypes";
import {
  chapterDynamicExtractionSchema,
  volumeDynamicsProjectionSchema,
} from "../../../services/novel/dynamics/characterDynamicsSchemas";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

const VOLUME_DYNAMICS_PROJECTION_TEMPLATE = `{
  "assignments": [
    {
      "characterName": "string",
      "volumeSortOrder": 1,
      "roleLabel": "string or null",
      "responsibility": "string",
      "plannedChapterOrders": [1, 2],
      "isCore": true,
      "absenceWarningThreshold": 3,
      "absenceHighRiskThreshold": 5
    }
  ],
  "factionTracks": [
    {
      "characterName": "string",
      "volumeSortOrder": 1,
      "factionLabel": "string",
      "stanceLabel": "string or null",
      "summary": "string or null"
    }
  ],
  "relationStages": [
    {
      "sourceCharacterName": "string",
      "targetCharacterName": "string",
      "volumeSortOrder": 1,
      "stageLabel": "string",
      "stageSummary": "string"
    }
  ]
}`;

export interface VolumeDynamicsProjectionPromptInput {
  novelTitle: string;
  description: string;
  targetAudience: string;
  sellingPoint: string;
  firstPromise: string;
  outline: string;
  structuredOutline: string;
  appliedCastOption: string;
  rosterText: string;
  relationText: string;
  volumePlansText: string;
}

export interface ChapterDynamicsExtractionPromptInput {
  novelTitle: string;
  targetAudience: string;
  sellingPoint: string;
  firstPromise: string;
  currentVolumeTitle: string;
  rosterText: string;
  relationText: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterContent: string;
}

export const volumeDynamicsProjectionPrompt: PromptAsset<
  VolumeDynamicsProjectionPromptInput,
  z.infer<typeof volumeDynamicsProjectionSchema>
> = {
  id: "novel.characterDynamics.volumeProjection",
  version: "v3",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  structuredOutputHint: {
    note: (_input: VolumeDynamicsProjectionPromptInput, context: PromptRenderContext) => pick(context.promptLanguage,
      "assignments 不能为空；每个输入分卷至少输出主角或该卷核心角色的卷级职责。 factionTracks 和 relationStages 中的 volumeSortOrder 必须填写对应分卷序号。 plannedChapterOrders 只能是正整数数组；拿不准就省略或输出空数组，不要输出 null、[null]、字符串数组。 roleLabel、stanceLabel、summary 等可选字段拿不准时优先省略，不要为了凑结构输出 null。 不要输出 confidence。",
      "assignments không được rỗng; mỗi tập đầu vào ít nhất phải xuất trách nhiệm cấp tập của nhân vật chính hoặc nhân vật cốt lõi của tập đó. volumeSortOrder trong factionTracks và relationStages phải điền đúng số thứ tự tập tương ứng. plannedChapterOrders chỉ được là mảng số nguyên dương; không chắc thì bỏ hoặc xuất mảng rỗng, đừng xuất null, [null], mảng chuỗi. Các field tuỳ chọn như roleLabel, stanceLabel, summary khi không chắc thì ưu tiên bỏ, đừng xuất null để đủ cấu trúc. Đừng xuất confidence.",
      "assignments must not be empty; for each input volume, output at least the volume-level responsibility of the protagonist or that volume's core character. volumeSortOrder in factionTracks and relationStages must carry the matching volume order number. plannedChapterOrders must be an array of positive integers; when unsure, omit it or output an empty array — never null, [null], or a string array. For optional fields like roleLabel, stanceLabel, summary, prefer omitting when unsure — do not output null just to fill the structure. Do not output confidence."),
  },
  outputSchema: volumeDynamicsProjectionSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
    new SystemMessage([
      pick(lang,
        "你是长篇中文网文的角色动态规划器。",
        "Bạn là bộ hoạch định động lực nhân vật cho tiểu thuyết mạng dài kỳ.",
        "You are a character-dynamics planner for long-form serialized web fiction."),
      pick(lang,
        "你的任务是基于小说定位、卖点、前 30 章承诺、角色名单、关系结构和分卷规划，生成可执行的“分卷角色动态投射”。",
        "Nhiệm vụ của bạn là dựa trên định vị tiểu thuyết, điểm bán, lời hứa 30 chương đầu, danh sách nhân vật, kết cấu quan hệ và hoạch định phân tập để sinh một \"bản phóng chiếu động lực nhân vật theo tập\" khả thi.",
        "Your task is to produce an executable \"per-volume character-dynamics projection\" from the novel's positioning, selling point, first-30-chapters promise, character roster, relationship structure, and volume plan."),
      "",
      pick(lang,
        "只输出一个合法 JSON 对象，不要输出 Markdown、解释、注释、代码块或任何额外文本。",
        "Chỉ xuất một đối tượng JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay bất kỳ văn bản thừa nào.",
        "Output only one valid JSON object — no Markdown, explanations, comments, code blocks, or any extra text."),
      pick(lang,
        "顶层只能包含 assignments、factionTracks、relationStages。",
        "Cấp trên cùng chỉ được gồm assignments, factionTracks, relationStages.",
        "The top level may contain only assignments, factionTracks, relationStages."),
      "",
      pick(lang, "全局硬规则：", "Quy tắc cứng toàn cục:", "Global hard rules:"),
      pick(lang,
        "1. 只能使用已知 roster 中存在的角色名称，禁止新增角色、改名或使用模糊代称。",
        "1. Chỉ được dùng tên nhân vật có trong roster đã biết, cấm thêm nhân vật, đổi tên hay dùng cách gọi mơ hồ.",
        "1. Use only character names present in the known roster — no new characters, renaming, or vague appellations."),
      pick(lang,
        "2. 所有安排都必须基于输入材料，不得虚构超出材料支持的新设定、新关系或新身份。",
        "2. Mọi sắp xếp phải dựa trên tài liệu đầu vào, không được bịa thiết lập, quan hệ hay thân phận mới vượt quá những gì tài liệu chống đỡ.",
        "2. Every arrangement must be based on the input materials — do not invent new settings, relationships, or identities beyond what the materials support."),
      pick(lang,
        "3. 材料不足时必须做保守推断，优先给低风险、能成立的安排，不要为了凑完整度硬补复杂动态。",
        "3. Khi tài liệu thiếu, phải suy đoán thận trọng, ưu tiên các sắp xếp rủi ro thấp và đứng vững được, đừng gượng thêm động lực phức tạp để đủ độ hoàn chỉnh.",
        "3. When materials are thin, infer conservatively — prefer low-risk, tenable arrangements; do not force complex dynamics just to look complete."),
      pick(lang,
        "4. 结果必须服务卷级推进，而不是写成人物卡或静态档案。",
        "4. Kết quả phải phục vụ sự đẩy cấp tập, không viết thành thẻ nhân vật hay hồ sơ tĩnh.",
        "4. The result must serve volume-level progression — not read like a character card or a static file."),
      pick(lang,
        "5. assignments 不能为空；每个输入分卷至少输出主角或该卷最核心角色的卷级职责。",
        "5. assignments không được rỗng; mỗi tập đầu vào ít nhất xuất trách nhiệm cấp tập của nhân vật chính hoặc nhân vật cốt lõi nhất của tập đó.",
        "5. assignments must not be empty; for each input volume, output at least the volume-level responsibility of the protagonist or that volume's most core character."),
      pick(lang,
        "6. factionTracks 和 relationStages 如有输出，必须填写对应的 volumeSortOrder，不允许省略或输出 null。",
        "6. Nếu có xuất factionTracks và relationStages thì phải điền volumeSortOrder tương ứng, không được bỏ hoặc xuất null.",
        "6. If you output factionTracks or relationStages, they must carry the matching volumeSortOrder — no omitting or null."),
      "",
      pick(lang, "阈值硬规则：", "Quy tắc cứng về ngưỡng:", "Threshold hard rules:"),
      pick(lang,
        "1. absenceWarningThreshold 和 absenceHighRiskThreshold 必须是 1-12 的整数。",
        "1. absenceWarningThreshold và absenceHighRiskThreshold phải là số nguyên 1-12.",
        "1. absenceWarningThreshold and absenceHighRiskThreshold must be integers from 1 to 12."),
      pick(lang,
        "2. 即使角色在卷末才集中出场，阈值也不得超过 12。",
        "2. Kể cả khi nhân vật tới cuối tập mới xuất hiện tập trung, ngưỡng cũng không được vượt 12.",
        "2. Even if a character only appears heavily at the end of the volume, the threshold must not exceed 12."),
      pick(lang,
        "3. absenceHighRiskThreshold 不得小于 absenceWarningThreshold。",
        "3. absenceHighRiskThreshold không được nhỏ hơn absenceWarningThreshold.",
        "3. absenceHighRiskThreshold must not be smaller than absenceWarningThreshold."),
      pick(lang,
        "4. 常规情况下优先使用 3 / 5；只有在叙事理由充分时才允许偏离。",
        "4. Trường hợp thông thường ưu tiên dùng 3 / 5; chỉ được lệch khi có lý do tự sự đầy đủ.",
        "4. In the normal case, prefer 3 / 5; deviate only when the narrative reason is strong."),
      "",
      pick(lang, "规划原则：", "Nguyên tắc hoạch định:", "Planning principles:"),
      pick(lang,
        "1. 核心角色不是平均分配，而是按该卷任务、卖点兑现和叙事功能分配。",
        "1. Nhân vật cốt lõi không phân bổ đều, mà phân theo nhiệm vụ của tập, việc tận thu điểm bán và chức năng tự sự.",
        "1. Core characters are not distributed evenly — allocate by the volume's task, its selling-point delivery, and narrative function."),
      pick(lang,
        "2. 同一角色跨卷可升温、降温、转位、退场或重新激活，但变化必须有逻辑。",
        "2. Cùng một nhân vật qua các tập có thể ấm lên, nguội đi, đổi vị trí, rời sân khấu hoặc được kích hoạt lại, nhưng thay đổi phải có logic.",
        "2. A character may warm up, cool down, shift position, exit, or be re-activated across volumes — but the change must be logical."),
      pick(lang,
        "3. 若某卷承担转折、升级、爆点或收束功能，角色配置必须同步反映这一点。",
        "3. Nếu một tập gánh chức năng bước ngoặt, nâng cấp, điểm bùng nổ hoặc khép tuyến, cấu hình nhân vật phải phản ánh điều đó đồng bộ.",
        "3. If a volume carries a turn, escalation, payoff, or resolution function, the character configuration must reflect that in step."),
      pick(lang,
        "4. plannedChapterOrders 只在角色需要稀疏、锚点式出场时填写；高频持续出场时可省略。",
        "4. plannedChapterOrders chỉ điền khi nhân vật cần xuất hiện thưa, kiểu điểm neo; khi xuất hiện liên tục tần suất cao thì có thể bỏ.",
        "4. Fill plannedChapterOrders only when a character needs sparse, anchor-style appearances; omit it for high-frequency continuous presence."),
      pick(lang,
        "5. plannedChapterOrders 如果填写，必须是正整数数组；拿不准时省略或输出空数组，绝不能输出 null、[null] 或字符串数组。",
        "5. Nếu điền plannedChapterOrders thì phải là mảng số nguyên dương; không chắc thì bỏ hoặc xuất mảng rỗng, tuyệt đối không xuất null, [null] hoặc mảng chuỗi.",
        "5. If you fill plannedChapterOrders, it must be an array of positive integers; when unsure, omit it or output an empty array — never null, [null], or a string array."),
      pick(lang,
        "6. roleLabel、stanceLabel、summary 等可选字段拿不准时优先省略，不要为了凑结构写 null。",
        "6. Các field tuỳ chọn như roleLabel, stanceLabel, summary khi không chắc thì ưu tiên bỏ, đừng viết null để đủ cấu trúc.",
        "6. For optional fields like roleLabel, stanceLabel, summary, prefer omitting when unsure — do not write null just to fill the structure."),
      "",
      pick(lang, "压缩输出规则：", "Quy tắc nén đầu ra:", "Compressed-output rules:"),
      pick(lang,
        "1. 只保留系统后续确实需要消费的最小结果，不要输出总述。",
        "1. Chỉ giữ kết quả tối thiểu mà hệ thống về sau thực sự cần tiêu thụ, đừng xuất phần tổng thuật.",
        "1. Keep only the minimal result the system will actually consume downstream — no summary narration."),
      pick(lang,
        "2. factionTracks 和 relationStages 只保留会影响写作决策的记录。",
        "2. factionTracks và relationStages chỉ giữ các bản ghi ảnh hưởng đến quyết định viết.",
        "2. factionTracks and relationStages: keep only records that affect writing decisions."),
      pick(lang,
        "3. 不要输出 confidence。",
        "3. Đừng xuất confidence.",
        "3. Do not output confidence."),
      "",
      pick(lang, "固定 JSON 结构如下：", "Cấu trúc JSON cố định như sau:", "The fixed JSON structure is:"),
      VOLUME_DYNAMICS_PROJECTION_TEMPLATE,
      "",
      pick(lang,
        "额外提醒：plannedChapterOrders 合法示例为 [4, 7] 或 []，不允许 [null]、[\"4\"]、[\"第4章\"]。",
        "Nhắc thêm: ví dụ hợp lệ của plannedChapterOrders là [4, 7] hoặc [], không cho phép [null], [\"4\"], [\"chương 4\"].",
        "Extra reminder: valid plannedChapterOrders examples are [4, 7] or []; [null], [\"4\"], [\"ch. 4\"] are not allowed."),
      pick(lang, "不要输出 confidence。", "Đừng xuất confidence.", "Do not output confidence."),
      "",
      pick(lang,
        "输出内容必须严格符合 volumeDynamicsProjectionSchema。",
        "Nội dung đầu ra phải tuân thủ nghiêm volumeDynamicsProjectionSchema.",
        "The output must strictly conform to volumeDynamicsProjectionSchema."),
    ].join("\n")),
    new HumanMessage([
      pick(lang, `小说：${input.novelTitle}`, `Tiểu thuyết: ${input.novelTitle}`, `Novel: ${input.novelTitle}`),
      pick(lang, `小说简介：${input.description}`, `Tóm tắt tiểu thuyết: ${input.description}`, `Novel synopsis: ${input.description}`),
      pick(lang, `目标读者：${input.targetAudience}`, `Độc giả mục tiêu: ${input.targetAudience}`, `Target audience: ${input.targetAudience}`),
      pick(lang, `核心卖点：${input.sellingPoint}`, `Điểm bán cốt lõi: ${input.sellingPoint}`, `Core selling point: ${input.sellingPoint}`),
      pick(lang, `前30章承诺：${input.firstPromise}`, `Lời hứa 30 chương đầu: ${input.firstPromise}`, `First-30-chapters promise: ${input.firstPromise}`),
      pick(lang, `大纲：${input.outline}`, `Đại cương: ${input.outline}`, `Outline: ${input.outline}`),
      pick(lang, `结构化大纲：${input.structuredOutline}`, `Đại cương có cấu trúc: ${input.structuredOutline}`, `Structured outline: ${input.structuredOutline}`),
      pick(lang, `已应用角色方案：${input.appliedCastOption}`, `Phương án nhân vật đã áp dụng: ${input.appliedCastOption}`, `Applied cast option: ${input.appliedCastOption}`),
      pick(lang, `已知角色名单：\n${input.rosterText}`, `Danh sách nhân vật đã biết:\n${input.rosterText}`, `Known character roster:\n${input.rosterText}`),
      pick(lang, `已知结构化关系：\n${input.relationText}`, `Quan hệ có cấu trúc đã biết:\n${input.relationText}`, `Known structured relationships:\n${input.relationText}`),
      pick(lang, `分卷规划：\n${input.volumePlansText}`, `Hoạch định phân tập:\n${input.volumePlansText}`, `Volume plan:\n${input.volumePlansText}`),
      "",
      pick(lang,
        "输出提醒：阈值只能是 1-12 整数，且 highRiskThreshold 不能小于 warningThreshold。",
        "Nhắc đầu ra: ngưỡng chỉ được là số nguyên 1-12, và highRiskThreshold không được nhỏ hơn warningThreshold.",
        "Output reminder: thresholds must be integers 1-12, and highRiskThreshold must not be smaller than warningThreshold."),
    ].join("\n\n")),
    ];
  },
};

export const chapterDynamicsExtractionPrompt: PromptAsset<
  ChapterDynamicsExtractionPromptInput,
  z.infer<typeof chapterDynamicExtractionSchema>
> = {
  id: "novel.characterDynamics.chapterExtract",
  version: "v1",
  taskType: "fact_extraction",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  structuredOutputHint: {
    note: (_input: ChapterDynamicsExtractionPromptInput, context: PromptRenderContext) => pick(context.promptLanguage,
      "confidence 是可选字段。 如果输出 confidence，必须是 0-1 数字。 不要输出 5、10、80、百分数、中文等级或字符串化置信度；拿不准就省略。",
      "confidence là field tuỳ chọn. Nếu xuất confidence thì phải là số 0-1. Đừng xuất 5, 10, 80, phần trăm, mức bằng chữ hay confidence dạng chuỗi; không chắc thì bỏ.",
      "confidence is optional. If you output confidence, it must be a number between 0 and 1. Do not output 5, 10, 80, percentages, word-level grades, or a stringified confidence — omit it when unsure."),
  },
  outputSchema: chapterDynamicExtractionSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    const exA = pick(lang, "老吴", "Lão Ngô", "Old Wu");
    const exB = pick(lang, "赵管事", "Quản sự Triệu", "Steward Zhao");
    const exC = pick(lang, "程秩", "Trình Trật", "Cheng Zhi");
    return [
    new SystemMessage([
      pick(lang,
        "你是长篇网文的角色动态信息提取器。",
        "Bạn là bộ trích thông tin động lực nhân vật cho tiểu thuyết mạng dài kỳ.",
        "You extract character-dynamics information for long-form serialized web fiction."),
      pick(lang,
        "你的任务是从给定章节里提取“会实际影响角色系统后续更新的事实级变化”。",
        "Nhiệm vụ của bạn là từ chương đã cho trích ra \"những thay đổi ở cấp sự thật thực sự ảnh hưởng đến các bản cập nhật hệ thống nhân vật về sau\".",
        "Your task is to extract from the given chapter \"fact-level changes that will actually affect downstream updates to the character system\"."),
      "",
      pick(lang,
        "只输出一个合法 JSON 对象，不要输出 Markdown、解释、注释、代码块或任何额外文本。",
        "Chỉ xuất một đối tượng JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay bất kỳ văn bản thừa nào.",
        "Output only one valid JSON object — no Markdown, explanations, comments, code blocks, or any extra text."),
      "",
      pick(lang, "抽取目标：", "Mục tiêu trích:", "Extraction goals:"),
      pick(lang,
        "1. 识别本章中影响角色结构的关键信息，包括新角色、阵营变化、关系变化等。",
        "1. Nhận diện thông tin then chốt trong chương ảnh hưởng đến kết cấu nhân vật, gồm nhân vật mới, thay đổi phe phái, thay đổi quan hệ...",
        "1. Identify key information in this chapter that affects character structure — new characters, faction changes, relationship changes, etc."),
      pick(lang,
        "2. 所有输出都必须是事实级抽取，而不是分析、评价或推测。",
        "2. Mọi đầu ra phải là trích ở cấp sự thật, không phải phân tích, đánh giá hay suy đoán.",
        "2. Everything you output must be a fact-level extraction — not analysis, evaluation, or speculation."),
      pick(lang,
        "3. 若本章存在显著的信息差（某角色知道其他人不知道的事，或某角色被蒙在鼓里），提取各主要角色的信息边界：本章结束时他们确认知晓的关键事实，以及尚未知晓的关键事实。无信息差时可省略此字段。",
        "3. Nếu chương có khoảng cách thông tin rõ (một nhân vật biết điều người khác không biết, hoặc một nhân vật bị bưng bít), hãy trích ranh giới thông tin của từng nhân vật chính: sự thật then chốt họ xác nhận biết khi chương kết thúc, và sự thật then chốt họ chưa biết. Không có khoảng cách thông tin thì có thể bỏ field này.",
        "3. If the chapter has a significant knowledge gap (a character knows something others do not, or a character is kept in the dark), extract each main character's information boundary: the key facts they are confirmed to know by the end of the chapter, and the key facts they do not yet know. Omit this field when there is no knowledge gap."),
      "",
      pick(lang, "全局规则：", "Quy tắc toàn cục:", "Global rules:"),
      pick(lang,
        "1. 只能基于本章正文抽取，不得补写未出现的设定或关系。",
        "1. Chỉ được trích dựa trên chính văn chương này, không được viết thêm thiết lập hay quan hệ chưa xuất hiện.",
        "1. Extract only from this chapter's prose — do not add settings or relationships that have not appeared."),
      pick(lang,
        "2. 不得把推测写成事实；信息不明确时不要输出该项。",
        "2. Không được viết suy đoán thành sự thật; khi thông tin không rõ thì đừng xuất mục đó.",
        "2. Do not write speculation as fact; when information is unclear, do not output that item."),
      pick(lang,
        "3. 不要复述剧情，不要写成长段总结，只抽取结构化变化点。",
        "3. Đừng thuật lại cốt truyện, đừng viết tổng kết dài, chỉ trích các điểm thay đổi có cấu trúc.",
        "3. Do not retell the plot or write a long summary — extract only structured change points."),
      pick(lang,
        "4. 所有角色必须使用明确姓名，不要使用“他”“她”“对方”等代词。",
        "4. Mọi nhân vật phải dùng tên rõ ràng, đừng dùng đại từ như \"anh ấy\", \"cô ấy\", \"đối phương\".",
        "4. Every character must be named explicitly — do not use pronouns like \"he\", \"she\", \"the other party\"."),
      pick(lang,
        "5. confidence 是可选字段；如果填写，必须是 0-1 数字，拿不准就省略。",
        "5. confidence là field tuỳ chọn; nếu điền thì phải là số 0-1, không chắc thì bỏ.",
        "5. confidence is optional; if filled, it must be a number between 0 and 1 — omit it when unsure."),
      pick(lang,
        "6. 不要输出 5、10、80、百分数、中文等级或字符串化置信度。",
        "6. Đừng xuất 5, 10, 80, phần trăm, mức bằng chữ hay confidence dạng chuỗi.",
        "6. Do not output 5, 10, 80, percentages, word-level grades, or a stringified confidence."),
      "",
      pick(lang,
        "最小合法示例（无信息差时省略 characterKnowledgeStates）：",
        "Ví dụ hợp lệ tối thiểu (không có khoảng cách thông tin thì bỏ characterKnowledgeStates):",
        "Minimal valid example (omit characterKnowledgeStates when there is no knowledge gap):"),
      pick(lang,
        `{"candidates":[{"proposedName":"${exA}","proposedRole":"杂役头目","summary":"负责监工后院杂役。","evidence":["${exA}负责监工"],"matchedCharacterName":"","confidence":0.8}],"factionUpdates":[],"relationStages":[{"sourceCharacterName":"${exB}","targetCharacterName":"${exC}","stageLabel":"监视升级","stageSummary":"${exB}开始持续盯防${exC}。","nextTurnPoint":"${exC}准备改换应对策略。","confidence":0.6}]}`,
        `{"candidates":[{"proposedName":"${exA}","proposedRole":"đầu mục tạp dịch","summary":"Coi sóc đám tạp dịch ở hậu viện.","evidence":["${exA} phụ trách giám sát"],"matchedCharacterName":"","confidence":0.8}],"factionUpdates":[],"relationStages":[{"sourceCharacterName":"${exB}","targetCharacterName":"${exC}","stageLabel":"nâng cấp giám sát","stageSummary":"${exB} bắt đầu để mắt liên tục tới ${exC}.","nextTurnPoint":"${exC} định đổi cách ứng phó.","confidence":0.6}]}`,
        `{"candidates":[{"proposedName":"${exA}","proposedRole":"head of the odd-job servants","summary":"Oversees the back-courtyard servants.","evidence":["${exA} is in charge of supervision"],"matchedCharacterName":"","confidence":0.8}],"factionUpdates":[],"relationStages":[{"sourceCharacterName":"${exB}","targetCharacterName":"${exC}","stageLabel":"surveillance escalation","stageSummary":"${exB} begins watching ${exC} continuously.","nextTurnPoint":"${exC} plans to switch tactics.","confidence":0.6}]}`),
      pick(lang,
        "含信息差的示例片段：",
        "Đoạn ví dụ có khoảng cách thông tin:",
        "Example fragment with a knowledge gap:"),
      pick(lang,
        `"characterKnowledgeStates":[{"characterName":"${exC}","knownFacts":["账册藏在西厢房"],"hiddenFacts":["${exB}已知晓账册位置"]}]`,
        `"characterKnowledgeStates":[{"characterName":"${exC}","knownFacts":["sổ sách giấu ở phòng tây"],"hiddenFacts":["${exB} đã biết vị trí sổ sách"]}]`,
        `"characterKnowledgeStates":[{"characterName":"${exC}","knownFacts":["the ledger is hidden in the west wing"],"hiddenFacts":["${exB} already knows where the ledger is"]}]`),
      "",
      pick(lang,
        "输出必须严格符合 chapterDynamicExtractionSchema。",
        "Đầu ra phải tuân thủ nghiêm chapterDynamicExtractionSchema.",
        "The output must strictly conform to chapterDynamicExtractionSchema."),
    ].join("\n")),
    new HumanMessage([
      pick(lang, `小说：${input.novelTitle}`, `Tiểu thuyết: ${input.novelTitle}`, `Novel: ${input.novelTitle}`),
      pick(lang, `目标读者：${input.targetAudience}`, `Độc giả mục tiêu: ${input.targetAudience}`, `Target audience: ${input.targetAudience}`),
      pick(lang, `核心卖点：${input.sellingPoint}`, `Điểm bán cốt lõi: ${input.sellingPoint}`, `Core selling point: ${input.sellingPoint}`),
      pick(lang, `前30章承诺：${input.firstPromise}`, `Lời hứa 30 chương đầu: ${input.firstPromise}`, `First-30-chapters promise: ${input.firstPromise}`),
      pick(lang, `当前卷：${input.currentVolumeTitle}`, `Tập hiện tại: ${input.currentVolumeTitle}`, `Current volume: ${input.currentVolumeTitle}`),
      pick(lang, `已知角色名单：\n${input.rosterText}`, `Danh sách nhân vật đã biết:\n${input.rosterText}`, `Known character roster:\n${input.rosterText}`),
      pick(lang, `已知结构化关系：\n${input.relationText}`, `Quan hệ có cấu trúc đã biết:\n${input.relationText}`, `Known structured relationships:\n${input.relationText}`),
      "",
      pick(lang,
        `章节 ${input.chapterOrder}：《${input.chapterTitle}》`,
        `Chương ${input.chapterOrder}: "${input.chapterTitle}"`,
        `Chapter ${input.chapterOrder}: "${input.chapterTitle}"`),
      input.chapterContent,
    ].join("\n\n")),
    ];
  },
};
