import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset } from "../../core/promptTypes";
import { renderSelectedContextBlocks } from "../../core/renderContextBlocks";
import {
  characterCastAutoResponseSchema,
  characterCastOptionResponseSchema,
  supplementalCharacterGenerationResponseSchema,
} from "./characterPreparation.promptSchemas";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

const CHARACTER_CAST_OPTION_RESPONSE_TEMPLATE = `{
  "options": [
    {
      "title": "string",
      "summary": "string",
      "whyItWorks": "string",
      "recommendedReason": "string",
      "members": [
        {
          "name": "string",
          "role": "string",
          "gender": "male",
          "castRole": "protagonist",
          "relationToProtagonist": "string",
          "storyFunction": "string",
          "shortDescription": "string",
          "personality": "string",
          "background": "string",
          "development": "string",
          "identityLabel": "string",
          "factionLabel": "string",
          "stanceLabel": "string",
          "powerLevel": "string",
          "realm": "string",
          "currentLocation": "string",
          "availability": "string",
          "prohibitions": ["string"],
          "outerGoal": "string",
          "innerNeed": "string",
          "fear": "string",
          "wound": "string",
          "misbelief": "string",
          "secret": "string",
          "moralLine": "string",
          "firstImpression": "string"
        }
      ],
      "relations": [
        {
          "sourceName": "string",
          "targetName": "string",
          "surfaceRelation": "string",
          "hiddenTension": "string",
          "conflictSource": "string",
          "secretAsymmetry": "string",
          "dynamicLabel": "string",
          "nextTurnPoint": "string"
        }
      ]
    }
  ]
}`;

const CHARACTER_CAST_AUTO_RESPONSE_TEMPLATE = `{
  "option": {
    "title": "string",
    "summary": "string",
    "whyItWorks": "string",
    "recommendedReason": "string",
    "members": [
      {
        "name": "string",
        "role": "string",
        "gender": "male",
        "castRole": "protagonist",
        "relationToProtagonist": "string",
        "storyFunction": "string",
        "shortDescription": "string",
        "personality": "string",
        "background": "string",
        "development": "string",
        "identityLabel": "string",
        "factionLabel": "string",
        "stanceLabel": "string",
        "powerLevel": "string",
        "realm": "string",
        "currentLocation": "string",
        "availability": "string",
        "prohibitions": ["string"],
        "outerGoal": "string",
        "innerNeed": "string",
        "fear": "string",
        "wound": "string",
        "misbelief": "string",
        "secret": "string",
        "moralLine": "string",
        "firstImpression": "string"
      }
    ],
    "relations": [
      {
        "sourceName": "string",
        "targetName": "string",
        "surfaceRelation": "string",
        "hiddenTension": "string",
        "conflictSource": "string",
        "secretAsymmetry": "string",
        "dynamicLabel": "string",
        "nextTurnPoint": "string"
      }
    ]
  }
}`;

const SUPPLEMENTAL_CHARACTER_RESPONSE_TEMPLATE = `{
  "mode": "linked",
  "recommendedCount": 2,
  "planningSummary": "string",
  "candidates": [
    {
      "name": "string",
      "role": "string",
      "gender": "female",
      "castRole": "ally",
      "summary": "string",
      "storyFunction": "string",
      "relationToProtagonist": "string",
      "personality": "string",
      "background": "string",
      "development": "string",
      "identityLabel": "string",
      "factionLabel": "string",
      "stanceLabel": "string",
      "powerLevel": "string",
      "realm": "string",
      "currentLocation": "string",
      "availability": "string",
      "prohibitions": ["string"],
      "outerGoal": "string",
      "innerNeed": "string",
      "fear": "string",
      "wound": "string",
      "misbelief": "string",
      "secret": "string",
      "moralLine": "string",
      "firstImpression": "string",
      "currentState": "string",
      "currentGoal": "string",
      "whyNow": "string",
      "relations": [
        {
          "sourceName": "string",
          "targetName": "string",
          "surfaceRelation": "string",
          "hiddenTension": "string",
          "conflictSource": "string",
          "dynamicLabel": "string",
          "nextTurnPoint": "string"
        }
      ]
    }
  ]
}`;

export interface CharacterCastOptionPromptInput {
  optionCount: number;
}

export interface CharacterCastOptionRepairPromptInput {
  payloadJson: string;
  failureReasons: string[];
}

export interface CharacterCastOptionNormalizePromptInput {
  payloadJson: string;
}

export interface CharacterCastAutoPromptInput {}

export interface CharacterCastAutoRepairPromptInput {
  payloadJson: string;
  failureReasons: string[];
}

export interface CharacterCastAutoNormalizePromptInput {
  payloadJson: string;
}

export interface SupplementalCharacterPromptInput {}

export interface SupplementalCharacterNormalizePromptInput {
  payloadJson: string;
}

function castSystemLines(lang: PromptLanguage, opts: { count: number | null; single: boolean; template: string }): string[] {
  const countPhrase = opts.single
    ? pick(lang,
      "你的任务是直接产出 1 套可自动落库、可直接进入正文规划的核心角色阵容，而不是提供多套待选方案。",
      "Nhiệm vụ của bạn là cho ra thẳng 1 bộ dàn nhân vật cốt lõi có thể tự động lưu vào và đưa thẳng vào bước lập kế hoạch chính văn, không phải đưa nhiều phương án để chọn.",
      "Your task is to produce exactly 1 core cast that can be auto-persisted and enter prose planning directly — not multiple options to choose from.")
    : pick(lang,
      "你的任务是为当前小说生成可直接进入正文规划的核心角色阵容，而不是输出抽象功能网络。",
      "Nhiệm vụ của bạn là sinh dàn nhân vật cốt lõi cho tiểu thuyết hiện tại, đưa thẳng vào bước lập kế hoạch chính văn, không phải xuất một mạng lưới chức năng trừu tượng.",
      "Your task is to generate a core cast for the current novel that can enter prose planning directly — not an abstract function network.");
  const countRule = opts.count != null
    ? pick(lang,
      `必须精确输出 ${opts.count} 套方案，不可少于或多于 ${opts.count} 套。`,
      `Phải xuất chính xác ${opts.count} phương án, không được ít hoặc nhiều hơn ${opts.count}.`,
      `You must output exactly ${opts.count} options — no fewer, no more.`)
    : "";
  return [
    pick(lang,
      "你是长篇中文网文的角色阵容策划师，服务对象是不懂写作流程的新手用户。",
      "Bạn là nhà hoạch định dàn nhân vật cho tiểu thuyết mạng dài kỳ, phục vụ những người dùng mới không rành quy trình viết.",
      "You are a cast planner for long-form serialized web fiction, serving beginner users unfamiliar with the writing pipeline."),
    countPhrase,
    "",
    pick(lang,
      "只返回严格 JSON，不要输出 Markdown、解释、注释、代码块或额外文本。",
      "Chỉ trả về JSON nghiêm ngặt, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
      "Return strict JSON only — no Markdown, explanations, comments, code blocks, or extra text."),
    countRule,
    "",
    pick(lang, "【结构硬规则】", "【Quy tắc cứng về cấu trúc】", "[Structure hard rules]"),
    pick(lang, "1. 必须严格遵守给定 JSON 结构。", "1. Phải tuân thủ nghiêm cấu trúc JSON đã cho.", "1. You must strictly follow the given JSON structure."),
    pick(lang,
      "2. 字段名必须保持英文；字段值使用目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
      "2. Tên field phải giữ tiếng Anh; giá trị field dùng ngôn ngữ đích (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
      "2. Field names must stay in English; field values use the target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
    opts.single
      ? pick(lang, "3. 阵容必须包含 3-6 个成员、2-12 条关系。", "3. Dàn nhân vật phải gồm 3-6 thành viên, 2-12 quan hệ.", "3. The cast must contain 3-6 members and 2-12 relations.")
      : pick(lang, "3. 每套方案必须包含 3-6 个成员、2-12 条关系。", "3. Mỗi phương án phải gồm 3-6 thành viên, 2-12 quan hệ.", "3. Each option must contain 3-6 members and 2-12 relations."),
    pick(lang,
      "4. 每个角色都必须输出 gender，允许值只有 male、female、other、unknown。",
      "4. Mỗi nhân vật phải xuất gender, giá trị cho phép chỉ là male, female, other, unknown.",
      "4. Every character must output gender; allowed values are only male, female, other, unknown."),
    pick(lang,
      "5. castRole 只能使用：protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst。",
      "5. castRole chỉ được dùng: protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst.",
      "5. castRole may only be: protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst."),
    pick(lang,
      "6. 每个角色必须输出 personality、background、development，不得只给 shortDescription。",
      "6. Mỗi nhân vật phải xuất personality, background, development, không được chỉ cho shortDescription.",
      "6. Every character must output personality, background, development — not just shortDescription."),
    pick(lang,
      "7. 每个角色必须输出角色硬事实字段：identityLabel、factionLabel、stanceLabel、powerLevel、realm、currentLocation、availability、prohibitions；拿不准可填空字符串或空数组，但不得编造超过书级设定的重大事实。",
      "7. Mỗi nhân vật phải xuất các field sự thật cứng: identityLabel, factionLabel, stanceLabel, powerLevel, realm, currentLocation, availability, prohibitions; không chắc thì để chuỗi rỗng hoặc mảng rỗng, nhưng không được bịa sự thật lớn vượt thiết lập cấp sách.",
      "7. Every character must output the hard-fact fields: identityLabel, factionLabel, stanceLabel, powerLevel, realm, currentLocation, availability, prohibitions; when unsure use an empty string or empty array, but do not fabricate major facts beyond the book-level settings."),
    "",
    pick(lang, "【命名硬规则】", "【Quy tắc cứng về đặt tên】", "[Naming hard rules]"),
    pick(lang,
      "1. name 只能写可直接进入正文的真实人物名、稳定称谓、历史官职称呼、宫廷称呼、江湖称号或阵营身份称呼。",
      "1. name chỉ được viết tên nhân vật thật đưa thẳng vào chính văn được, danh xưng ổn định, cách gọi theo chức quan lịch sử, cách gọi trong cung, ngoại hiệu giang hồ hoặc danh xưng theo thân phận phe phái.",
      "1. name may only be a real character name usable directly in prose, a stable appellation, a historical official title, a court address, a jianghu byname, or a faction-identity address."),
    pick(lang,
      "2. 绝对禁止把功能词写进 name，例如：谜团催化剂、知识导师位、外部威胁位、情感位、关系变量、功能位。",
      "2. Tuyệt đối cấm viết từ chức năng vào name, ví dụ: chất xúc tác bí ẩn, vai người dẫn dắt tri thức, vai đe doạ bên ngoài, vai cảm xúc, biến số quan hệ, vai chức năng.",
      "2. Absolutely do not put function words into name, e.g. \"mystery catalyst\", \"knowledge-mentor slot\", \"external-threat slot\", \"emotional slot\", \"relationship variable\", \"function slot\"."),
    pick(lang,
      "3. storyFunction 才负责写叙事职责，name 不负责承载功能描述。",
      "3. storyFunction mới lo viết trách nhiệm tự sự, name không gánh mô tả chức năng.",
      "3. storyFunction is what carries the narrative responsibility — name does not carry a function description."),
    opts.single
      ? pick(lang, "4. 同一套阵容内的角色名必须彼此可区分，不要出现一批抽象模板称谓。", "4. Tên nhân vật trong cùng một dàn phải phân biệt được với nhau, đừng có một loạt cách gọi khuôn mẫu trừu tượng.", "4. Character names within one cast must be distinguishable — no batch of abstract template appellations.")
      : pick(lang, "4. 同一方案内的角色名必须彼此可区分，不要出现一批抽象模板称呼。", "4. Tên nhân vật trong cùng một phương án phải phân biệt được với nhau, đừng có một loạt cách gọi khuôn mẫu trừu tượng.", "4. Character names within one option must be distinguishable — no batch of abstract template appellations."),
    "",
    pick(lang, "【阵容质量要求】", "【Yêu cầu chất lượng dàn nhân vật】", "[Cast quality requirements]"),
    opts.single
      ? pick(lang, "1. 必须有明确主角锚点，主角不能写成功能位。", "1. Phải có điểm neo nhân vật chính rõ ràng, nhân vật chính không được viết thành vai chức năng.", "1. There must be a clear protagonist anchor; the protagonist must not be written as a function slot.")
      : pick(lang, "1. 每套方案都必须有明确主角锚点，主角不能写成功能位。", "1. Mỗi phương án phải có điểm neo nhân vật chính rõ ràng, nhân vật chính không được viết thành vai chức năng.", "1. Each option must have a clear protagonist anchor; the protagonist must not be written as a function slot."),
    pick(lang,
      "2. 如果故事存在隐藏身份、历史真名、伪装身份或终局身份反转，这条线必须被角色阵容显式承接。",
      "2. Nếu câu chuyện có thân phận ẩn, tên thật lịch sử, thân phận nguỵ trang hoặc cú đảo thân phận cuối truyện, tuyến này phải được dàn nhân vật nối tiếp một cách rõ ràng.",
      "2. If the story has a hidden identity, a historical true name, a disguised identity, or an endgame identity reversal, the cast must explicitly carry that thread."),
    opts.single
      ? pick(lang, "3. 关系必须体现真实的人物动力、压力来源、成长代价和长期冲突，而不是角色说明书堆砌。", "3. Quan hệ phải thể hiện động lực nhân vật thật, nguồn áp lực, cái giá trưởng thành và xung đột dài hạn, không phải chồng chất bản mô tả nhân vật.", "3. Relations must show real character dynamics, pressure sources, growth costs, and long-term conflict — not a pile of character spec sheets.")
      : pick(lang, "3. 每套方案都要体现真正的人物关系动力、压力来源、成长代价和长期冲突，而不是角色说明书堆砌。", "3. Mỗi phương án phải thể hiện động lực quan hệ nhân vật thật, nguồn áp lực, cái giá trưởng thành và xung đột dài hạn, không phải chồng chất bản mô tả nhân vật.", "3. Each option must show real character-relationship dynamics, pressure sources, growth costs, and long-term conflict — not a pile of character spec sheets."),
    opts.single
      ? pick(lang, "4. 不要让多个角色承担几乎相同的 storyFunction。", "4. Đừng để nhiều nhân vật gánh storyFunction gần như giống hệt nhau.", "4. Do not have multiple characters carry nearly identical storyFunction.")
      : pick(lang, "4. 同一方案内不要让多个角色承担几乎相同的 storyFunction。", "4. Trong cùng một phương án, đừng để nhiều nhân vật gánh storyFunction gần như giống hệt nhau.", "4. Within one option, do not have multiple characters carry nearly identical storyFunction."),
    opts.single
      ? pick(lang, "5. 这套阵容必须能支撑长篇推进，而不是只服务开篇一次性爆点。", "5. Dàn nhân vật này phải chống đỡ được sự đẩy dài hơi, không chỉ phục vụ một điểm bùng nổ dùng một lần ở phần mở đầu.", "5. This cast must sustain long-form progression — not just serve a one-off opening payoff.")
      : pick(lang, "5. 角色组合必须能支撑长篇推进，而不是只服务开篇一次性爆点。", "5. Tổ hợp nhân vật phải chống đỡ được sự đẩy dài hơi, không chỉ phục vụ một điểm bùng nổ dùng một lần ở phần mở đầu.", "5. The character combination must sustain long-form progression — not just serve a one-off opening payoff."),
    pick(lang,
      "6. 角色硬事实要优先承接题材设定与阵营关系，例如身份、阵营、境界/战力、当前可出场状态，避免后续正文把阵营、修为或身份写反。",
      "6. Sự thật cứng của nhân vật phải ưu tiên nối tiếp thiết lập thể loại và quan hệ phe phái, ví dụ thân phận, phe phái, cảnh giới/chiến lực, trạng thái có thể xuất hiện hiện tại, tránh để chính văn về sau viết ngược phe phái, tu vi hay thân phận.",
      "6. Character hard facts should first carry the genre setting and faction relations — e.g. identity, faction, cultivation level / power, current availability — so later prose does not get the faction, cultivation, or identity backwards."),
    "",
    pick(lang, "【题材约束】", "【Ràng buộc thể loại】", "[Genre constraints]"),
    pick(lang,
      "如果上下文是历史、穿越、宫廷、官场或强制度环境题材，阵容必须体现时代身份、制度压迫、权力链条和身份反差，不能退化成通用功能网络。",
      "Nếu ngữ cảnh là thể loại lịch sử, xuyên không, cung đình, quan trường hoặc môi trường thể chế mạnh, dàn nhân vật phải thể hiện thân phận thời đại, sự đè ép của thể chế, chuỗi quyền lực và sự tương phản thân phận, không được thoái hoá thành mạng lưới chức năng chung chung.",
      "If the context is a historical, time-travel, court, officialdom, or strong-institution setting, the cast must reflect era-appropriate identity, institutional pressure, power chains, and identity contrast — it must not degrade into a generic function network."),
    "",
    pick(lang, "【表达要求】", "【Yêu cầu diễn đạt】", "[Expression requirements]"),
    pick(lang,
      "1. 所有描述必须具体，避免“人物鲜明”“关系复杂”“推动剧情”这类空话。",
      "1. Mọi mô tả phải cụ thể, tránh những lời sáo như \"nhân vật nổi bật\", \"quan hệ phức tạp\", \"đẩy cốt truyện\".",
      "1. All descriptions must be concrete — avoid filler like \"vivid characters\", \"complex relationships\", \"drives the plot\"."),
    pick(lang,
      "2. 除 summary、whyItWorks、recommendedReason 外，其余文本字段优先控制在短句或短词组。",
      "2. Ngoài summary, whyItWorks, recommendedReason, các field văn bản còn lại ưu tiên giữ trong câu ngắn hoặc cụm ngắn.",
      "2. Apart from summary, whyItWorks, recommendedReason, keep the other text fields to short sentences or short phrases."),
    pick(lang,
      "3. 如果拿不准 gender，填 unknown，不允许留空。",
      "3. Nếu không chắc gender, điền unknown, không được để trống.",
      "3. If unsure about gender, put unknown — do not leave it empty."),
    "",
    pick(lang, "固定模板如下：", "Mẫu cố định như sau:", "The fixed template is:"),
    opts.template,
  ];
}

function castOutputRequirementLines(lang: PromptLanguage, opts: { count: number | null; single: boolean }): string[] {
  return [
    pick(lang, "【输出要求】", "【Yêu cầu đầu ra】", "[Output requirements]"),
    opts.single
      ? pick(lang, "- 只输出 1 套角色阵容", "- Chỉ xuất 1 bộ dàn nhân vật", "- Output only 1 cast")
      : pick(lang, `- 精确输出 ${opts.count} 套方案`, `- Xuất chính xác ${opts.count} phương án`, `- Output exactly ${opts.count} options`),
    pick(lang, "- name 必须是可入戏角色名或稳定称谓", "- name phải là tên nhân vật vào truyện được hoặc danh xưng ổn định", "- name must be an in-story character name or a stable appellation"),
    pick(lang, "- storyFunction 负责写功能，name 不能写成功能位", "- storyFunction lo viết chức năng, name không được viết thành vai chức năng", "- storyFunction carries the function; name must not be written as a function slot"),
    pick(lang, "- 每个角色必须带 gender", "- Mỗi nhân vật phải có gender", "- Every character must carry gender"),
    pick(lang, "- 只输出严格 JSON", "- Chỉ xuất JSON nghiêm ngặt", "- Output strict JSON only"),
  ];
}

function castRepairSystemLines(lang: PromptLanguage, opts: { multi: boolean }): string[] {
  return [
    pick(lang,
      "你是中文网文角色策划修复编辑，负责把一份已经生成出来但质量不合格的角色阵容 JSON 修正为可直接入库的版本。",
      "Bạn là biên tập viên sửa hoạch định nhân vật cho tiểu thuyết mạng, chịu trách nhiệm chỉnh một JSON dàn nhân vật đã sinh ra nhưng chưa đạt chất lượng thành phiên bản lưu thẳng vào được.",
      "You are a cast-planning repair editor for serialized web fiction; you fix an already-generated but sub-quality cast JSON into a version ready to persist."),
    pick(lang,
      "你只能修正内容，不要改变整体故事方向。",
      "Bạn chỉ được sửa nội dung, đừng thay đổi hướng câu chuyện tổng thể.",
      "You may only fix the content — do not change the overall story direction."),
    "",
    pick(lang,
      "只输出一个合法 JSON，不要输出 Markdown、解释、注释或额外文本。",
      "Chỉ xuất một JSON hợp lệ, không xuất Markdown, giải thích, chú thích hay văn bản thừa.",
      "Output only one valid JSON — no Markdown, explanations, comments, or extra text."),
    "",
    pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
    opts.multi
      ? pick(lang, "1. 必须保留原 JSON 的最外层结构和 options 数量。", "1. Phải giữ cấu trúc lớp ngoài cùng của JSON gốc và số lượng options.", "1. You must keep the original JSON's outermost structure and the number of options.")
      : pick(lang, "1. 必须保留原 JSON 的最外层结构和 option 对象。", "1. Phải giữ cấu trúc lớp ngoài cùng của JSON gốc và đối tượng option.", "1. You must keep the original JSON's outermost structure and the option object."),
    opts.multi
      ? pick(lang, "2. 可以改写 title、summary、members、relations 的内容，但不能删除方案，也不能把 3 套改成别的数量。", "2. Được viết lại nội dung title, summary, members, relations, nhưng không được xoá phương án, cũng không được đổi 3 bộ thành số khác.", "2. You may rewrite the content of title, summary, members, relations, but do not delete an option and do not change 3 options to a different count.")
      : pick(lang, "2. 可以改写 title、summary、members、relations 的内容，但不能改成多套方案。", "2. Được viết lại nội dung title, summary, members, relations, nhưng không được đổi thành nhiều phương án.", "2. You may rewrite the content of title, summary, members, relations, but do not turn it into multiple options."),
    pick(lang,
      "3. 必须修正所有功能位式角色名，把它们改成真实可入戏的人名或稳定称谓。",
      "3. Phải sửa mọi tên nhân vật kiểu vai chức năng thành tên người thật vào truyện được hoặc danh xưng ổn định.",
      "3. You must fix every function-slot-style character name into a real in-story name or a stable appellation."),
    pick(lang,
      "4. 每个角色都必须有 gender，允许值只有 male、female、other、unknown。",
      "4. Mỗi nhân vật phải có gender, giá trị cho phép chỉ là male, female, other, unknown.",
      "4. Every character must have gender; allowed values are only male, female, other, unknown."),
    pick(lang,
      "5. 所有展示文本必须是自然的目标语言（默认简体中文，以末尾“输出语言指令”为准），不要保留明显的他语种残留。",
      "5. Mọi văn bản hiển thị phải là ngôn ngữ đích tự nhiên (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn), đừng để tồn dư ngôn ngữ khác rõ rệt.",
      "5. All display text must be in the natural target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence) — do not leave obvious residue of another language."),
    pick(lang,
      "6. 必须保持同一故事方向、主角锚点、核心冲突和隐藏身份线索，不要重写成另一套书。",
      "6. Phải giữ cùng hướng câu chuyện, điểm neo nhân vật chính, xung đột cốt lõi và manh mối thân phận ẩn, đừng viết lại thành một cuốn sách khác.",
      "6. You must keep the same story direction, protagonist anchor, core conflict, and hidden-identity clues — do not rewrite it into a different book."),
    "",
    pick(lang, "重点修复原则：", "Nguyên tắc sửa trọng điểm:", "Key repair principles:"),
    pick(lang,
      "1. name 不能再出现“某某位、催化剂、威胁源、功能位、关系变量”这类抽象槽位。",
      "1. name không được còn xuất hiện các ô trừu tượng như \"vai này vai kia, chất xúc tác, nguồn đe doạ, vai chức năng, biến số quan hệ\".",
      "1. name must no longer contain abstract slots like \"such-and-such slot, catalyst, threat source, function slot, relationship variable\"."),
    pick(lang,
      "2. 如果上下文存在主角当前身份或隐藏身份线索，至少要让主角方案显式承接这些线索。",
      "2. Nếu ngữ cảnh có thân phận hiện tại hoặc manh mối thân phận ẩn của nhân vật chính, ít nhất phải để phương án nhân vật chính nối tiếp các manh mối này một cách rõ ràng.",
      "2. If the context has the protagonist's current identity or hidden-identity clues, at least the protagonist entry must explicitly carry those clues."),
    opts.multi
      ? pick(lang, "3. 同一方案内避免多人承担同一故事功能。", "3. Trong cùng một phương án, tránh nhiều người gánh cùng một chức năng truyện.", "3. Within one option, avoid multiple people carrying the same story function.")
      : pick(lang, "3. 同一阵容内避免多人承担同一个故事功能。", "3. Trong cùng một dàn nhân vật, tránh nhiều người gánh cùng một chức năng truyện.", "3. Within one cast, avoid multiple people carrying the same story function."),
  ];
}

function castRepairUserLines(lang: PromptLanguage, failureReasons: string[], payloadJson: string, renderContext: string): string[] {
  return [
    pick(lang, "下面这份 JSON 需要修复。", "JSON dưới đây cần sửa.", "The JSON below needs repair."),
    "",
    pick(lang, "【分层上下文】", "【Ngữ cảnh phân tầng】", "[Layered context]"),
    renderContext,
    "",
    pick(lang, "【失败原因】", "【Nguyên nhân thất bại】", "[Failure reasons]"),
    failureReasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n") || pick(lang, "未提供", "không cung cấp", "not provided"),
    "",
    pick(lang, "【待修复 JSON】", "【JSON cần sửa】", "[JSON to repair]"),
    payloadJson,
    "",
    pick(lang, "请输出修复后的完整 JSON。", "Hãy xuất toàn bộ JSON sau khi sửa.", "Output the complete repaired JSON."),
  ];
}

function castNormalizeSystemLines(lang: PromptLanguage, opts: { arrayLen: boolean }): string[] {
  return [
    pick(lang,
      "你是中文小说角色策划编辑，负责对角色阵容 JSON 做语言归一化。",
      "Bạn là biên tập viên hoạch định nhân vật tiểu thuyết, chịu trách nhiệm chuẩn hoá ngôn ngữ cho JSON dàn nhân vật.",
      "You are a novel cast-planning editor responsible for language normalization of the cast JSON."),
    pick(lang,
      "你的任务是把所有面向用户展示的文本值改写为自然、流畅、可直接阅读的目标语言表达。",
      "Nhiệm vụ của bạn là viết lại mọi giá trị văn bản hiển thị cho người dùng thành cách diễn đạt tự nhiên, trôi chảy, đọc thẳng được bằng ngôn ngữ đích.",
      "Your task is to rewrite every user-facing text value into natural, fluent, directly readable target-language expression."),
    "",
    pick(lang,
      "只输出一个合法 JSON，不要输出 Markdown、解释、注释、代码块或额外文本。",
      "Chỉ xuất một JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
      "Output only one valid JSON — no Markdown, explanations, comments, code blocks, or extra text."),
    "",
    pick(lang, "结构硬规则：", "Quy tắc cứng về cấu trúc:", "Structure hard rules:"),
    opts.arrayLen
      ? pick(lang, "1. 必须严格保留原有 JSON 结构、字段名、层级关系与数组长度。", "1. Phải giữ nghiêm cấu trúc JSON gốc, tên field, quan hệ tầng và độ dài mảng.", "1. You must strictly keep the original JSON structure, field names, hierarchy, and array lengths.")
      : pick(lang, "1. 必须严格保留原有 JSON 结构、字段名、层级关系与对象顺序。", "1. Phải giữ nghiêm cấu trúc JSON gốc, tên field, quan hệ tầng và thứ tự đối tượng.", "1. You must strictly keep the original JSON structure, field names, hierarchy, and object order."),
    pick(lang, "2. 不得新增字段、删除字段、重命名字段或调整字段顺序。", "2. Không được thêm, xoá, đổi tên field hay điều chỉnh thứ tự field.", "2. Do not add, remove, rename, or reorder fields."),
    opts.arrayLen
      ? pick(lang, "3. 不得新增或删除数组元素，只允许改写内容。", "3. Không được thêm hoặc xoá phần tử mảng, chỉ được viết lại nội dung.", "3. Do not add or remove array elements — only rewrite content.")
      : pick(lang, "3. 不得补出第二套方案，只能改写现有 option 的内容。", "3. Không được bịa thêm phương án thứ hai, chỉ được viết lại nội dung của option hiện có.", "3. Do not invent a second option — only rewrite the existing option's content."),
    "",
    pick(lang, "内容改写规则：", "Quy tắc viết lại nội dung:", "Content-rewrite rules:"),
    pick(lang,
      "1. 所有展示文本必须改写为自然的目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
      "1. Mọi văn bản hiển thị phải được viết lại thành ngôn ngữ đích tự nhiên (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
      "1. All display text must be rewritten into the natural target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
    pick(lang,
      "2. 保留原有语义、关系含义和角色功能，不得改变设定逻辑。",
      "2. Giữ ngữ nghĩa, ý nghĩa quan hệ và chức năng nhân vật gốc, không được đổi logic thiết lập.",
      "2. Keep the original semantics, relationship meaning, and character function — do not change the setting logic."),
    pick(lang,
      "3. castRole 和 gender 枚举值必须保持原样，不得翻译或改写。",
      "3. Giá trị enum castRole và gender phải giữ nguyên, không được dịch hay viết lại.",
      "3. The castRole and gender enum values must stay unchanged — do not translate or rewrite them."),
    pick(lang,
      "4. 已有人名和称谓应尽量保持稳定，不要擅自换名。",
      "4. Các tên người và danh xưng đã có nên giữ ổn định, đừng tự ý đổi tên.",
      "4. Keep existing names and appellations stable — do not change names on your own."),
    pick(lang,
      "5. 不得补写新的剧情、世界设定或关系。",
      "5. Không được viết thêm cốt truyện, thiết lập thế giới hay quan hệ mới.",
      "5. Do not write in new plot, world settings, or relationships."),
  ];
}

function castNormalizeUserText(lang: PromptLanguage, payloadJson: string): string {
  return pick(lang,
    `请将下面 JSON 中所有展示给用户的文本内容改写为自然的目标语言，并保持结构与含义不变：\n${payloadJson}`,
    `Hãy viết lại mọi nội dung văn bản hiển thị cho người dùng trong JSON dưới đây thành ngôn ngữ đích tự nhiên, giữ nguyên cấu trúc và ý nghĩa:\n${payloadJson}`,
    `Rewrite every user-facing text value in the JSON below into the natural target language, keeping the structure and meaning unchanged:\n${payloadJson}`);
}

export const characterCastOptionPrompt: PromptAsset<
  CharacterCastOptionPromptInput,
  z.infer<typeof characterCastOptionResponseSchema>
> = {
  id: "novel.character.castOptions",
  version: "v2",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
    requiredGroups: ["idea_seed", "protagonist_anchor", "output_policy"],
    preferredGroups: [
      "hidden_identity_anchor",
      "project_context",
      "book_contract",
      "macro_constraints",
      "world_stage",
      "forbidden_names",
    ],
  },
  repairPolicy: {
    maxAttempts: 2,
  },
  outputSchema: characterCastOptionResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castSystemLines(lang, {
        count: input.optionCount,
        single: false,
        template: CHARACTER_CAST_OPTION_RESPONSE_TEMPLATE,
      }).join("\n")),
      new HumanMessage([
        pick(lang, "请基于以下上下文生成角色阵容方案。", "Dựa trên ngữ cảnh dưới đây, hãy sinh các phương án dàn nhân vật.", "Based on the context below, generate the cast options."),
        "",
        pick(lang, "【分层上下文】", "【Ngữ cảnh phân tầng】", "[Layered context]"),
        renderSelectedContextBlocks(context),
        "",
        ...castOutputRequirementLines(lang, { count: input.optionCount, single: false }),
      ].join("\n")),
    ];
  },
};

export const characterCastOptionRepairPrompt: PromptAsset<
  CharacterCastOptionRepairPromptInput,
  z.infer<typeof characterCastOptionResponseSchema>
> = {
  id: "novel.character.castOptions.repair",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: characterCastOptionResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castRepairSystemLines(lang, { multi: true }).join("\n")),
      new HumanMessage(castRepairUserLines(lang, input.failureReasons, input.payloadJson, renderSelectedContextBlocks(context)).join("\n")),
    ];
  },
};

export const characterCastOptionNormalizePrompt: PromptAsset<
  CharacterCastOptionNormalizePromptInput,
  z.infer<typeof characterCastOptionResponseSchema>
> = {
  id: "novel.character.castOptions.zhNormalize",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: characterCastOptionResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castNormalizeSystemLines(lang, { arrayLen: true }).join("\n")),
      new HumanMessage(castNormalizeUserText(lang, input.payloadJson)),
    ];
  },
};

export const characterCastAutoPrompt: PromptAsset<
  CharacterCastAutoPromptInput,
  z.infer<typeof characterCastAutoResponseSchema>
> = {
  id: "novel.character.castAuto",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
    requiredGroups: ["idea_seed", "protagonist_anchor", "output_policy"],
    preferredGroups: [
      "hidden_identity_anchor",
      "project_context",
      "book_contract",
      "macro_constraints",
      "world_stage",
      "forbidden_names",
    ],
  },
  repairPolicy: {
    maxAttempts: 2,
  },
  outputSchema: characterCastAutoResponseSchema,
  render: (_input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castSystemLines(lang, {
        count: null,
        single: true,
        template: CHARACTER_CAST_AUTO_RESPONSE_TEMPLATE,
      }).join("\n")),
      new HumanMessage([
        pick(lang,
          "请基于以下上下文生成自动导演要直接采用的角色阵容。",
          "Dựa trên ngữ cảnh dưới đây, hãy sinh dàn nhân vật để Auto Director dùng thẳng.",
          "Based on the context below, generate the cast the Auto Director will adopt directly."),
        "",
        pick(lang, "【分层上下文】", "【Ngữ cảnh phân tầng】", "[Layered context]"),
        renderSelectedContextBlocks(context),
        "",
        ...castOutputRequirementLines(lang, { count: null, single: true }),
      ].join("\n")),
    ];
  },
};

export const characterCastAutoRepairPrompt: PromptAsset<
  CharacterCastAutoRepairPromptInput,
  z.infer<typeof characterCastAutoResponseSchema>
> = {
  id: "novel.character.castAuto.repair",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: characterCastAutoResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castRepairSystemLines(lang, { multi: false }).join("\n")),
      new HumanMessage(castRepairUserLines(lang, input.failureReasons, input.payloadJson, renderSelectedContextBlocks(context)).join("\n")),
    ];
  },
};

export const characterCastAutoNormalizePrompt: PromptAsset<
  CharacterCastAutoNormalizePromptInput,
  z.infer<typeof characterCastAutoResponseSchema>
> = {
  id: "novel.character.castAuto.zhNormalize",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: characterCastAutoResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage(castNormalizeSystemLines(lang, { arrayLen: false }).join("\n")),
      new HumanMessage(castNormalizeUserText(lang, input.payloadJson)),
    ];
  },
};

export const supplementalCharacterPrompt: PromptAsset<
  SupplementalCharacterPromptInput,
  z.infer<typeof supplementalCharacterGenerationResponseSchema>
> = {
  id: "novel.character.supplemental",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: supplementalCharacterGenerationResponseSchema,
  render: (_input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage([
        pick(lang,
          "你是长篇中文小说项目的补充角色策划师。",
          "Bạn là nhà hoạch định nhân vật bổ sung cho dự án tiểu thuyết dài.",
          "You are a supplemental-character planner for a long-form novel project."),
        pick(lang,
          "你的任务不是重建整套阵容，而是在现有角色系统基础上，精准补足人物压力、情感张力、关系牵引或功能缺口。",
          "Nhiệm vụ của bạn không phải dựng lại cả dàn nhân vật, mà là bổ sung chính xác lỗ hổng về áp lực nhân vật, sự căng cảm xúc, lực kéo quan hệ hoặc chức năng trên nền hệ thống nhân vật hiện có.",
          "Your task is not to rebuild the whole cast, but to precisely fill gaps in character pressure, emotional tension, relational pull, or function on top of the existing character system."),
        "",
        pick(lang,
          "只返回严格 JSON，不要输出 Markdown、解释、注释、代码块或额外文本。",
          "Chỉ trả về JSON nghiêm ngặt, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
          "Return strict JSON only — no Markdown, explanations, comments, code blocks, or extra text."),
        "",
        pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
        pick(lang,
          "1. 候选角色必须能直接进入正文使用，不得写成功能占位词。",
          "1. Nhân vật ứng viên phải dùng thẳng vào chính văn được, không được viết thành từ giữ chỗ chức năng.",
          "1. Candidate characters must be usable directly in prose — not written as function placeholders."),
        pick(lang,
          "2. 每个候选都必须输出 gender；拿不准时填 unknown，不得省略。",
          "2. Mỗi ứng viên phải xuất gender; không chắc thì điền unknown, không được bỏ.",
          "2. Every candidate must output gender; when unsure put unknown — do not omit it."),
        pick(lang,
          "3. 所有展示文本值必须使用自然、流畅的目标语言。",
          "3. Mọi giá trị văn bản hiển thị phải dùng ngôn ngữ đích tự nhiên, trôi chảy.",
          "3. All display text values must use natural, fluent target-language."),
        pick(lang,
          "4. 禁止复用 forbidden names 里的现有角色名。",
          "4. Cấm dùng lại tên nhân vật đã có trong forbidden names.",
          "4. Do not reuse an existing character name from forbidden names."),
        pick(lang,
          "5. castRole 只能使用：protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst。",
          "5. castRole chỉ được dùng: protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst.",
          "5. castRole may only be: protagonist, antagonist, ally, foil, mentor, love_interest, pressure_source, catalyst."),
        pick(lang,
          "6. 每个候选都必须输出 personality、background、development 和角色硬事实字段：identityLabel、factionLabel、stanceLabel、powerLevel、realm、currentLocation、availability、prohibitions。",
          "6. Mỗi ứng viên phải xuất personality, background, development và các field sự thật cứng: identityLabel, factionLabel, stanceLabel, powerLevel, realm, currentLocation, availability, prohibitions.",
          "6. Every candidate must output personality, background, development, and the hard-fact fields: identityLabel, factionLabel, stanceLabel, powerLevel, realm, currentLocation, availability, prohibitions."),
        "",
        pick(lang, "补位要求：", "Yêu cầu bổ khuyết:", "Gap-filling requirements:"),
        pick(lang,
          "1. 候选角色必须真正补足现有阵容缺口，而不是机械再造一个同功能位。",
          "1. Nhân vật ứng viên phải thực sự lấp lỗ hổng của dàn nhân vật hiện có, không phải máy móc tái tạo một vai cùng chức năng.",
          "1. Candidate characters must genuinely fill a gap in the existing cast — not mechanically recreate a same-function slot."),
        pick(lang,
          "2. mode=linked 时优先形成可持续关系推进；mode=independent 时优先承担独立但高价值的故事职责。",
          "2. Khi mode=linked, ưu tiên tạo sự tiến triển quan hệ bền vững; khi mode=independent, ưu tiên gánh một trách nhiệm truyện độc lập nhưng giá trị cao.",
          "2. When mode=linked, prioritize forming sustainable relational progression; when mode=independent, prioritize carrying an independent but high-value story responsibility."),
        pick(lang,
          "3. 生成结果要服务长篇推进，而不是一次性工具人。",
          "3. Kết quả sinh ra phải phục vụ sự đẩy dài hơi, không phải nhân vật công cụ dùng một lần.",
          "3. The result must serve long-form progression — not a one-off tool character."),
        pick(lang,
          "4. 硬事实必须能帮助后续正文避免身份、阵营、境界、所在地或可出场状态写错；拿不准时填空字符串或空数组。",
          "4. Sự thật cứng phải giúp chính văn về sau tránh viết sai thân phận, phe phái, cảnh giới, nơi ở hay trạng thái có thể xuất hiện; không chắc thì để chuỗi rỗng hoặc mảng rỗng.",
          "4. The hard facts must help later prose avoid getting identity, faction, cultivation level, location, or availability wrong; when unsure use an empty string or empty array."),
        "",
        pick(lang, "固定模板如下：", "Mẫu cố định như sau:", "The fixed template is:"),
        SUPPLEMENTAL_CHARACTER_RESPONSE_TEMPLATE,
      ].join("\n")),
      new HumanMessage([
        pick(lang, "请基于以下上下文生成补充角色候选。", "Dựa trên ngữ cảnh dưới đây, hãy sinh các ứng viên nhân vật bổ sung.", "Based on the context below, generate supplemental character candidates."),
        "",
        pick(lang, "【分层上下文】", "【Ngữ cảnh phân tầng】", "[Layered context]"),
        renderSelectedContextBlocks(context),
        "",
        pick(lang, "【输出要求】", "【Yêu cầu đầu ra】", "[Output requirements]"),
        pick(lang, "- 角色名必须是具体人名或稳定称谓", "- Tên nhân vật phải là tên người cụ thể hoặc danh xưng ổn định", "- The character name must be a concrete personal name or a stable appellation"),
        pick(lang, "- 每个角色必须带 gender", "- Mỗi nhân vật phải có gender", "- Every character must carry gender"),
        pick(lang, "- 只输出严格 JSON", "- Chỉ xuất JSON nghiêm ngặt", "- Output strict JSON only"),
      ].join("\n")),
    ];
  },
};

export const supplementalCharacterNormalizePrompt: PromptAsset<
  SupplementalCharacterNormalizePromptInput,
  z.infer<typeof supplementalCharacterGenerationResponseSchema>
> = {
  id: "novel.character.supplemental.zhNormalize",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  outputSchema: supplementalCharacterGenerationResponseSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
      new SystemMessage([
        pick(lang,
          "你是中文小说角色策划编辑，负责对补充角色 JSON 做语言归一化与润色。",
          "Bạn là biên tập viên hoạch định nhân vật tiểu thuyết, chịu trách nhiệm chuẩn hoá ngôn ngữ và trau chuốt JSON nhân vật bổ sung.",
          "You are a novel cast-planning editor responsible for language normalization and polish of the supplemental-character JSON."),
        pick(lang,
          "你的任务是把所有展示给用户的文本值改写为自然、流畅、可直接阅读的目标语言表达。",
          "Nhiệm vụ của bạn là viết lại mọi giá trị văn bản hiển thị cho người dùng thành cách diễn đạt tự nhiên, trôi chảy, đọc thẳng được bằng ngôn ngữ đích.",
          "Your task is to rewrite every user-facing text value into natural, fluent, directly readable target-language expression."),
        "",
        pick(lang,
          "只输出一个合法 JSON，不要输出 Markdown、解释、注释、代码块或额外文本。",
          "Chỉ xuất một JSON hợp lệ, không xuất Markdown, giải thích, chú thích, khối mã hay văn bản thừa.",
          "Output only one valid JSON — no Markdown, explanations, comments, code blocks, or extra text."),
        "",
        pick(lang, "结构硬规则：", "Quy tắc cứng về cấu trúc:", "Structure hard rules:"),
        pick(lang, "1. 必须严格保留原有 JSON 结构、字段名、层级关系与数组长度。", "1. Phải giữ nghiêm cấu trúc JSON gốc, tên field, quan hệ tầng và độ dài mảng.", "1. You must strictly keep the original JSON structure, field names, hierarchy, and array lengths."),
        pick(lang, "2. 不得新增字段、删除字段、重命名字段或调整字段顺序。", "2. Không được thêm, xoá, đổi tên field hay điều chỉnh thứ tự field.", "2. Do not add, remove, rename, or reorder fields."),
        pick(lang, "3. 不得新增或删除数组元素，只允许改写内容。", "3. Không được thêm hoặc xoá phần tử mảng, chỉ được viết lại nội dung.", "3. Do not add or remove array elements — only rewrite content."),
        "",
        pick(lang, "内容改写规则：", "Quy tắc viết lại nội dung:", "Content-rewrite rules:"),
        pick(lang,
          "1. 所有展示文本必须改写为自然的目标语言（默认简体中文，以末尾“输出语言指令”为准）。",
          "1. Mọi văn bản hiển thị phải được viết lại thành ngôn ngữ đích tự nhiên (mặc định tiếng Trung giản thể, lấy \"chỉ thị ngôn ngữ đầu ra\" ở cuối làm chuẩn).",
          "1. All display text must be rewritten into the natural target language (default Simplified Chinese; the \"output-language directive\" at the end takes precedence)."),
        pick(lang,
          "2. 改写时必须保留原有语义、角色功能、关系含义和冲突指向，不得改变设定逻辑。",
          "2. Khi viết lại phải giữ ngữ nghĩa, chức năng nhân vật, ý nghĩa quan hệ và hướng xung đột gốc, không được đổi logic thiết lập.",
          "2. When rewriting, keep the original semantics, character function, relationship meaning, and conflict direction — do not change the setting logic."),
        pick(lang,
          "3. castRole 和 gender 枚举值必须保持原样，不得翻译或改写。",
          "3. Giá trị enum castRole và gender phải giữ nguyên, không được dịch hay viết lại.",
          "3. The castRole and gender enum values must stay unchanged — do not translate or rewrite them."),
        pick(lang,
          "4. 不得补写新的设定、剧情或关系。",
          "4. Không được viết thêm thiết lập, cốt truyện hay quan hệ mới.",
          "4. Do not write in new settings, plot, or relationships."),
      ].join("\n")),
      new HumanMessage(castNormalizeUserText(lang, input.payloadJson)),
    ];
  },
};
