export const CHAPTER_PROSE_QUALITY_RULES = [
  "避免使用破折号、省略号或连续连字符制造模型化停顿；需要停顿时改用句号、逗号、动作或人物反应。",
  "避免高频‘不是……而是……’‘却是……’‘反而是……’否定翻转句；改用具体动作、感官细节或角色判断。",
  "禁止出现 AI 自述、拒绝话术、占位符、任务单、Prompt、Schema、上下文包等工程说明。",
  "优先使用具体动作、对话和可感知细节，避免空泛总结、机械排比和连续碎片短句。",
] as const;

const CHAPTER_PROSE_QUALITY_RULES_VI = [
  "Tránh dùng gạch ngang, dấu ba chấm hoặc chuỗi gạch nối liên tiếp để tạo khoảng ngắt kiểu máy; khi cần ngắt nhịp hãy dùng dấu chấm, dấu phẩy, hành động hoặc phản ứng của nhân vật.",
  "Tránh lạm dụng câu phủ định-đảo chiều kiểu \"không phải... mà là...\", \"nhưng lại là...\", \"trái lại là...\"; thay bằng hành động cụ thể, chi tiết giác quan hoặc phán đoán của nhân vật.",
  "Cấm xuất hiện lời tự nhận là AI, câu từ chối, placeholder, task sheet, Prompt, Schema, context package hoặc các thuật ngữ kỹ thuật khác.",
  "Ưu tiên hành động cụ thể, đối thoại và chi tiết cảm nhận được; tránh tóm tắt chung chung, liệt kê máy móc và chuỗi câu ngắn rời rạc.",
] as const;

const CHAPTER_PROSE_QUALITY_RULES_EN = [
  "Avoid em dashes, ellipses, or chained hyphens to fake a beat; use a period, comma, action, or character reaction instead.",
  "Avoid overusing negation-flip sentences like \"not X, but Y\", \"yet it was\", \"instead it was\"; replace with concrete action, sensory detail, or a character's judgment.",
  "Never include AI self-references, refusal phrasing, placeholders, task sheets, prompts, schemas, context packages, or other engineering artifacts.",
  "Favor concrete action, dialogue, and perceptible detail; avoid vague summaries, mechanical parallelism, and runs of choppy fragment sentences.",
] as const;

export function getChapterProseQualityRules(lang: "zh" | "vi" | "en"): readonly string[] {
  if (lang === "vi") return CHAPTER_PROSE_QUALITY_RULES_VI;
  if (lang === "en") return CHAPTER_PROSE_QUALITY_RULES_EN;
  return CHAPTER_PROSE_QUALITY_RULES;
}

export const CHAPTER_PROSE_QUALITY_AUDIT_RULES = [
  "必须检查破折号、省略号、连续连字符、否定翻转句、AI 自述、占位符、工程术语泄漏和机械碎句。",
  "上述表达风险属于正文质量问题；证据必须指向正文中的具体句子，不得只根据任务单或写作意图推断。",
] as const;
