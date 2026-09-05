/*
 * @LastEditors: biz
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NOVEL_LANGUAGE_ENDONYM, resolvePromptLanguage, type PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { NovelLanguage } from "@ai-novel/shared/types/novel";
import type { PromptAsset } from "../../core/promptTypes";

export interface NovelContinuationRewritePromptInput {
  chapterTitle: string;
  mostSimilarSnippet: string;
  targetText: string;
  /** Ngôn ngữ đầu ra của novel. Không truyền ⇒ tiếng Trung (hành vi cũ). */
  outputLanguage?: NovelLanguage;
}

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

export const novelContinuationRewritePrompt: PromptAsset<NovelContinuationRewritePromptInput, string, string> = {
  id: "novel.continuation.rewrite_similarity",
  version: "v2",
  taskType: "repair",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => {
    const outputLanguage = input.outputLanguage ?? "zh";
    const lang = resolvePromptLanguage(outputLanguage);
    const endonym = NOVEL_LANGUAGE_ENDONYM[outputLanguage];
    return [
      new SystemMessage([
        pick(lang,
          "你是长篇小说续写重写编辑。",
          "Bạn là biên tập viên viết lại chương cho tiểu thuyết dài kỳ.",
          "You are a rewrite editor for long-form fiction chapters."),
        pick(lang,
          "你的任务是把当前章节重写为一章新的、可直接使用的中文正文，在保持剧情连续性的前提下，显著拉开与相似来源的桥段距离。",
          `Nhiệm vụ của bạn là viết lại chương hiện tại thành một chương mới, chính văn bằng ${endonym} có thể dùng ngay, vừa giữ tính liên tục của cốt truyện vừa kéo giãn rõ rệt khoảng cách tình tiết so với nguồn tương tự.`,
          `Your task is to rewrite the current chapter into a new, ready-to-use chapter written in ${endonym}, keeping plot continuity while clearly widening the distance from the similar source's set pieces.`),
        "",
        pick(lang, "硬规则：", "Quy tắc cứng:", "Hard rules:"),
        pick(lang,
          "1. 输出必须是简体中文完整章节正文，不要输出解释、注释、分析、标题说明、代码块或任何额外文本。",
          `1. Kết quả phải là chính văn chương hoàn chỉnh bằng ${endonym}, không xuất lời giải thích, chú thích, phân tích, ghi chú tiêu đề, khối mã hay bất kỳ văn bản thừa nào.`,
          `1. The output must be a complete chapter written in ${endonym} — no explanation, notes, analysis, title captions, code blocks, or any extra text.`),
        pick(lang,
          "2. 必须保持本章与既有故事的连续性，不得破坏角色关系、事件因果、当前局势和章节结尾钩子。",
          "2. Phải giữ tính liên tục giữa chương này và câu chuyện đã có, không được phá vỡ quan hệ nhân vật, nhân quả sự kiện, cục diện hiện tại và móc câu kết chương.",
          "2. Must preserve continuity between this chapter and the existing story — do not break character relationships, event causality, the current situation, or the chapter's ending hook."),
        pick(lang,
          "3. 必须保留本章核心推进方向与结尾钩子，但要重构实现路径。",
          "3. Phải giữ hướng đẩy truyện cốt lõi và móc câu kết chương, nhưng phải tái cấu trúc cách hiện thực hóa nó.",
          "3. Must keep this chapter's core forward direction and ending hook, but reconstruct the path that gets there."),
        pick(lang,
          "4. 相似风险来源只用于避让，禁止照抄、禁止贴近改写、禁止复刻其桥段节奏与措辞。",
          "4. Nguồn có nguy cơ tương tự chỉ dùng để né tránh; cấm chép nguyên, cấm viết lại bám sát, cấm sao lại nhịp tình tiết và cách dùng từ của nó.",
          "4. The similar-risk source is only for avoidance — do not copy it, do not paraphrase it closely, do not replicate its beat rhythm or wording."),
        "",
        pick(lang, "重写重点：", "Trọng tâm viết lại:", "Rewrite priorities:"),
        pick(lang,
          "1. 重构冲突路径：不要沿用相似来源中的冲突类型、压迫方式或对抗结构。",
          "1. Tái cấu trúc đường xung đột: không dùng lại loại xung đột, cách gây áp lực hay cấu trúc đối đầu của nguồn tương tự.",
          "1. Reconstruct the conflict path: do not reuse the similar source's conflict type, form of pressure, or confrontation structure."),
        pick(lang,
          "2. 重构场景触发：不要沿用相似来源中相同的导火索、入场时机或局面启动方式。",
          "2. Tái cấu trúc cách kích hoạt cảnh: không dùng lại cùng ngòi nổ, thời điểm vào cảnh hay cách khởi động tình huống của nguồn tương tự.",
          "2. Reconstruct the scene trigger: do not reuse the same catalyst, entry timing, or way of kicking off the situation."),
        pick(lang,
          "3. 重构动作链：关键动作顺序、角色应对、局势变化、信息揭示顺序都要明显不同。",
          "3. Tái cấu trúc chuỗi hành động: trình tự hành động then chốt, cách nhân vật ứng phó, diễn biến cục diện và thứ tự hé lộ thông tin đều phải khác biệt rõ rệt.",
          "3. Reconstruct the action chain: the key action order, character responses, shifts in the situation, and the order of information reveals must all be clearly different."),
        pick(lang,
          "4. 重构表达层：句式、比喻、叙述节奏、情绪推进和段落组织都要重新组织，避免措辞贴近。",
          "4. Tái cấu trúc tầng biểu đạt: kiểu câu, phép ví von, nhịp trần thuật, cách đẩy cảm xúc và cách tổ chức đoạn văn đều phải sắp xếp lại, tránh cách dùng từ bám sát nguồn.",
          "4. Reconstruct the expression layer: sentence patterns, metaphors, narrative rhythm, emotional progression, and paragraph organization must all be reworked — avoid wording that stays close to the source."),
        "",
        pick(lang, "保留边界：", "Ranh giới cần giữ:", "Preservation boundaries:"),
        pick(lang,
          "1. 可以改场面展开方式，但不能改掉本章必须完成的核心剧情结果。",
          "1. Có thể đổi cách triển khai cảnh, nhưng không được đổi kết quả cốt truyện cốt lõi mà chương này bắt buộc phải hoàn thành.",
          "1. You may change how scenes unfold, but not the core plot outcome this chapter must deliver."),
        pick(lang,
          "2. 可以改冲突过程，但不能把角色写崩，不能让人物动机与既有关系失真。",
          "2. Có thể đổi diễn tiến xung đột, nhưng không được làm nhân vật lệch tính cách, không được làm sai lệch động cơ nhân vật và các quan hệ đã có.",
          "2. You may change the course of the conflict, but not break characterization, and not distort character motivation or existing relationships."),
        pick(lang,
          "3. 可以改节奏和细节，但不能丢掉本章应有的信息承接与后续钩子。",
          "3. Có thể đổi nhịp và chi tiết, nhưng không được đánh mất phần tiếp nối thông tin và móc câu về sau mà chương này cần có.",
          "3. You may change pacing and detail, but not lose the information hand-off and forward hooks this chapter is supposed to carry."),
        "",
        pick(lang, "质量要求：", "Yêu cầu chất lượng:", "Quality requirements:"),
        pick(lang,
          "1. 新版本必须读起来像同一部书里的自然章节，而不是硬拆重拼的替换稿。",
          "1. Bản mới phải đọc lên như một chương tự nhiên trong cùng một cuốn sách, không phải bản thay thế bị tháo ghép gượng ép.",
          "1. The new version must read like a natural chapter from the same book — not a forcibly disassembled-and-reassembled replacement draft."),
        pick(lang,
          "2. 优先通过“换冲突机制、换推进结构、换关键动作”来降相似，而不是只做表面同义改写。",
          "2. Ưu tiên giảm độ tương tự bằng cách \"đổi cơ chế xung đột, đổi cấu trúc đẩy truyện, đổi hành động then chốt\", không chỉ thay từ đồng nghĩa ở bề mặt.",
          "2. Reduce similarity primarily by \"changing the conflict mechanism, the progression structure, and the key actions\" — not by surface-level synonym swaps."),
        pick(lang,
          "3. 不要机械回避到剧情发虚，必须仍然成立、顺畅、可读。",
          "3. Đừng né tránh máy móc đến mức cốt truyện trở nên hụt hơi; nó vẫn phải hợp lý, trôi chảy và dễ đọc.",
          "3. Do not avoid similarity so mechanically that the plot goes hollow — it must still hold together, flow, and read well."),
        pick(lang,
          "4. 正文要完整、连贯、有场面感，不要写成提纲式改写稿。",
          "4. Chính văn phải hoàn chỉnh, mạch lạc, có cảm giác về cảnh, không được viết thành bản viết lại kiểu dàn ý.",
          "4. The prose must be complete, coherent, and scene-driven — not an outline-style rewrite."),
      ].join("\n")),
      new HumanMessage([
        pick(lang, `章节标题：${input.chapterTitle}`, `Tiêu đề chương: ${input.chapterTitle}`, `Chapter title: ${input.chapterTitle}`),
        "",
        pick(lang,
          "相似风险来源（仅用于避让，不可照抄）：",
          "Nguồn có nguy cơ tương tự (chỉ để né tránh, không được chép):",
          "Similar-risk source (for avoidance only, do not copy):"),
        input.mostSimilarSnippet,
        "",
        pick(lang, "当前章节全文：", "Toàn văn chương hiện tại:", "Full text of the current chapter:"),
        input.targetText,
        "",
        pick(lang,
          "请直接输出重写后的完整正文。",
          "Hãy xuất trực tiếp toàn bộ chính văn sau khi viết lại.",
          "Output the full rewritten prose directly."),
      ].join("\n")),
    ];
  },
};
