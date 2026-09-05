import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChapterPatchRepairPlan } from "@ai-novel/shared/types/chapterPatchRepair";
import { chapterPatchRepairPlanSchema } from "@ai-novel/shared/types/chapterPatchRepair";
import { resolvePromptLanguage, type PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { NovelLanguage } from "@ai-novel/shared/types/novel";
import type { PromptAsset } from "../../core/promptTypes";
import { renderSelectedContextBlocks } from "../../core/renderContextBlocks";
import { NOVEL_PROMPT_BUDGETS } from "./promptBudgetProfiles";

export interface ChapterPatchRepairPromptInput {
  novelTitle: string;
  chapterTitle: string;
  chapterContent: string;
  issuesJson: string;
  modeHint?: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

export const chapterPatchRepairPrompt: PromptAsset<
  ChapterPatchRepairPromptInput,
  ChapterPatchRepairPlan
> = {
  id: "novel.review.patch",
  version: "v3",
  taskType: "repair",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: NOVEL_PROMPT_BUDGETS.chapterRepair,
    preferredGroups: [
      "repair_issues",
      "chapter_mission",
      "reader_experience",
      "repair_boundaries",
      "world_rules",
    ],
    dropOrder: [
      "recent_chapters",
      "participant_subset",
      "continuation_constraints",
    ],
  },
  outputSchema: chapterPatchRepairPlanSchema,
  slots: [
    {
      kind: "append" as const,
      key: "patch.customConstraints",
      label: "自定义补丁补充要求",
      description: "追加对局部补丁生成的额外约束，作为上下文块注入。留空则不追加。",
      anchor: "repair_issues",
      default: "",
      maxLength: 2000,
      placeholderHint: "例如：每个补丁块不得超过 3 句；优先修复节奏问题，结构问题标记但不修……",
    },
  ],
  render: (input, context) => {
    const lang = resolvePromptLanguage(input.outputLanguage ?? "zh");
    return [
      new SystemMessage([
        pick(lang,
          "你是网络小说局部修文编辑。",
          "Bạn là biên tập viên sửa văn cục bộ cho tiểu thuyết mạng.",
          "You are a localized copy-editor for web-novel prose."),
        pick(lang,
          "当前任务不是整章重写，而是输出可以被程序安全应用的局部补丁计划。",
          "Nhiệm vụ hiện tại không phải viết lại cả chương, mà là xuất ra một kế hoạch vá cục bộ để chương trình có thể áp dụng an toàn.",
          "The current task is not to rewrite the whole chapter, but to output a localized patch plan that a program can apply safely."),
        pick(lang,
          "只输出严格 JSON，不要 Markdown、解释或正文全文。",
          "Chỉ xuất JSON hợp lệ, không kèm Markdown, lời giải thích hay toàn văn chính văn.",
          "Output strict JSON only — no Markdown, no explanation, no full prose."),
        "",
        pick(lang, "【补丁原则】", "【NGUYÊN TẮC VÁ】", "【PATCH PRINCIPLES】"),
        pick(lang,
          "1. strategy 默认必须是 patch_first。",
          "1. strategy mặc định bắt buộc là patch_first.",
          "1. strategy must default to patch_first."),
        pick(lang,
          "2. patches 中每个 targetExcerpt 必须逐字摘自当前正文，并且应足够长，确保在正文里只出现一次。",
          "2. Mỗi targetExcerpt trong patches phải được trích nguyên văn từ chính văn hiện tại và phải đủ dài để chỉ xuất hiện đúng một lần trong chính văn.",
          "2. Every targetExcerpt in patches must be quoted verbatim from the current prose and be long enough to occur exactly once in it."),
        pick(lang,
          "3. replacement 只替换 targetExcerpt 对应片段，不要改写无关段落；如果修复目标是删除重复片段，replacement 可以是空字符串。",
          "3. replacement chỉ thay thế đúng đoạn tương ứng với targetExcerpt, không được sửa các đoạn không liên quan; nếu mục tiêu sửa là xóa đoạn trùng lặp, replacement có thể là chuỗi rỗng.",
          "3. replacement only replaces the segment matching targetExcerpt — do not rewrite unrelated passages; if the fix is to delete a duplicated segment, replacement may be an empty string."),
        pick(lang,
          "4. 优先修复问题清单中影响主线推进、连续性、人物动机、节奏和结尾钩子的关键问题。",
          "4. Ưu tiên sửa các vấn đề then chốt trong danh sách vấn đề có ảnh hưởng đến tiến triển mạch chính, tính liên tục, động cơ nhân vật, nhịp truyện và móc câu kết chương.",
          "4. Prioritize the issues in the issue list that affect main-plot progression, continuity, character motivation, pacing, and the ending hook."),
        pick(lang,
          "4a. 若问题涉及读者体验合同，只修改能补齐 promisedReward、主角主动性、关键转折、净变化或旧钩子承接的必要片段，并保留已经有效的读者回报。",
          "4a. Nếu vấn đề liên quan đến hợp đồng trải nghiệm đọc, chỉ sửa những đoạn cần thiết để bù đắp promisedReward, tính chủ động của nhân vật chính, bước ngoặt then chốt, thay đổi ròng hoặc việc tiếp nối móc câu cũ, đồng thời giữ lại phần hồi đáp cho người đọc vốn đã hiệu quả.",
          "4a. If the issue touches the reader-experience contract, only edit the segments needed to deliver promisedReward, protagonist agency, the key turn, the net change, or follow-through on old hooks — and keep the reader payoff that already works."),
        pick(lang,
          "5. 不得新增重大设定、核心角色或与章节任务冲突的剧情转向。",
          "5. Không được thêm thiết lập lớn mới, nhân vật lõi mới hoặc bước ngoặt cốt truyện xung đột với nhiệm vụ chương.",
          "5. Do not add major new setting elements, new core characters, or plot turns that conflict with the chapter brief."),
        pick(lang,
          "6. 局部补丁只处理正文中能定位到完整句段的问题；审校系统不可用、结构化判断缺失、评分不足等系统风险不属于正文片段修复。",
          "6. Vá cục bộ chỉ xử lý những vấn đề có thể định vị được thành câu/đoạn hoàn chỉnh trong chính văn; các rủi ro hệ thống như hệ thống thẩm định không khả dụng, thiếu phán đoán cấu trúc, điểm số không đạt... không thuộc phạm vi sửa đoạn văn.",
          "6. Localized patches only handle issues that can be pinned to a complete sentence or paragraph in the prose; system-level risks (the review system being unavailable, missing structured judgment, an insufficient score, etc.) are not prose-segment fixes."),
        pick(lang,
          "7. targetExcerpt 必须是正文里的完整短句或段落，不得是单个词语、称谓、标点或过短短语。",
          "7. targetExcerpt phải là một câu ngắn hoặc đoạn hoàn chỉnh trong chính văn, không được là một từ đơn, cách xưng hô, dấu câu hay cụm từ quá ngắn.",
          "7. targetExcerpt must be a complete short sentence or paragraph from the prose — never a single word, a form of address, a punctuation mark, or an overly short phrase."),
        pick(lang,
          "8. 如果找不到至少 6 个字符且在正文中唯一出现的原文片段，不要输出 patch；requiresFullRewrite 设为 true，并说明 escalationReason。",
          "8. Nếu không tìm được đoạn nguyên văn dài ít nhất 6 ký tự và chỉ xuất hiện một lần trong chính văn, đừng xuất patch; đặt requiresFullRewrite là true và nêu escalationReason.",
          "8. If you cannot find a source excerpt of at least 6 characters that occurs uniquely in the prose, do not output a patch; set requiresFullRewrite to true and explain escalationReason."),
        pick(lang,
          "9. 如果确实无法用局部补丁安全修复，requiresFullRewrite 设为 true，并说明 escalationReason。",
          "9. Nếu thực sự không thể sửa an toàn bằng vá cục bộ, đặt requiresFullRewrite là true và nêu escalationReason.",
          "9. If the problem genuinely cannot be fixed safely with localized patches, set requiresFullRewrite to true and explain escalationReason."),
        input.modeHint
          ? pick(lang,
              `10. 修复重点：${input.modeHint}`,
              `10. Trọng tâm sửa: ${input.modeHint}`,
              `10. Repair focus: ${input.modeHint}`)
          : "",
      ].filter((line) => line !== "").join("\n")),
      new HumanMessage([
        pick(lang, `小说：${input.novelTitle}`, `Tiểu thuyết: ${input.novelTitle}`, `Novel: ${input.novelTitle}`),
        pick(lang, `章节：${input.chapterTitle}`, `Chương: ${input.chapterTitle}`, `Chapter: ${input.chapterTitle}`),
        "",
        pick(lang, "【分层上下文】", "【BỐI CẢNH PHÂN TẦNG】", "【LAYERED CONTEXT】"),
        renderSelectedContextBlocks(context),
        "",
        pick(lang, "【当前正文】", "【CHÍNH VĂN HIỆN TẠI】", "【CURRENT PROSE】"),
        input.chapterContent,
        "",
        pick(lang, "【问题清单】", "【DANH SÁCH VẤN ĐỀ】", "【ISSUE LIST】"),
        input.issuesJson,
        "",
        pick(lang, "请输出局部补丁 JSON。", "Hãy xuất JSON kế hoạch vá cục bộ.", "Output the localized patch plan JSON."),
      ].join("\n")),
    ];
  },
};
