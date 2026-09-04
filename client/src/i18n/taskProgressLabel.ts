import { translateUi } from "./legacy.ts";

/**
 * Nhãn tiến độ tác vụ (`currentItemLabel`, `blockingReason`, `lastError`, tên bước
 * đạo diễn…) do worker phía server sinh ra và lưu thẳng vào DB dưới dạng chuỗi
 * tiếng Trung. Đây là dữ liệu phái sinh để hiển thị nên được dịch ở tầng UI theo
 * ngôn ngữ giao diện (không phải ngôn ngữ nội dung tiểu thuyết).
 *
 * Chiến lược:
 *  1. Tách theo " · " rồi dịch từng đoạn (tên chương do người dùng đặt sẽ tự lọt
 *     qua vì không có trong từ điển).
 *  2. Chuẩn hóa các họ chuỗi có nội suy (số tập/chương, tiến độ, tên trong「」)
 *     thành key `{{...}}` rồi tra `translateUi` kèm tham số.
 *  3. Không khớp ⇒ trả nguyên (chuỗi động / lỗi runtime chưa có từ điển).
 */

interface Rule {
  test: RegExp;
  key: string;
  params: (m: RegExpMatchArray) => Record<string, string | number>;
}

const RULES: Rule[] = [
  { test: /^正在继续生成第\s*(\d+)\s*卷节奏板与细化$/, key: "正在继续生成第 {{n}} 卷节奏板与细化", params: (m) => ({ n: m[1] }) },
  { test: /^正在生成第\s*(\d+)\s*卷节奏板$/, key: "正在生成第 {{n}} 卷节奏板", params: (m) => ({ n: m[1] }) },
  { test: /^正在生成第\s*(\d+)\s*卷章节列表$/, key: "正在生成第 {{n}} 卷章节列表", params: (m) => ({ n: m[1] }) },
  { test: /^第\s*(\d+)\s*卷章节列表已生成$/, key: "第 {{n}} 卷章节列表已生成", params: (m) => ({ n: m[1] }) },
  { test: /^正在\s*AI\s*修复第\s*(\d+)\s*卷章节标题$/, key: "正在 AI 修复第 {{n}} 卷章节标题", params: (m) => ({ n: m[1] }) },
  { test: /^正在续写完整作品（(\d+)\/(\d+)）$/, key: "正在续写完整作品（{{a}}/{{b}}）", params: (m) => ({ a: m[1], b: m[2] }) },
  { test: /^正在应用角色阵容「(.+)」$/, key: "正在应用角色阵容「{{name}}」", params: (m) => ({ name: m[1] }) },
  { test: /^正在自动执行(.+)$/, key: "正在自动执行{{scope}}", params: (m) => ({ scope: translateComposedScope(m[1]) }) },
  { test: /^正在自动审校(.+)$/, key: "正在自动审校{{scope}}", params: (m) => ({ scope: translateComposedScope(m[1]) }) },
  { test: /^正在自动修复(.+)$/, key: "正在自动修复{{scope}}", params: (m) => ({ scope: translateComposedScope(m[1]) }) },
  { test: /^(.+?)已完成，请检查后继续$/, key: "{{label}}已完成，请检查后继续", params: (m) => ({ label: translateSegment(m[1]) }) },
  { test: /^(.+?)已校准，请检查后继续$/, key: "{{label}}已校准，请检查后继续", params: (m) => ({ label: translateSegment(m[1]) }) },
  { test: /^(.+?)正文已完成，等待续拆下一段$/, key: "{{scope}}正文已完成，等待续拆下一段", params: (m) => ({ scope: translateScopePrefix(m[1]) }) },
  { test: /^(.+?)已可开写，等待选择创作界面$/, key: "{{scope}}已可开写，等待选择创作界面", params: (m) => ({ scope: translateScopePrefix(m[1]) }) },
  { test: /^(.+?)细化已完成，正在同步章节执行资源$/, key: "{{scope}}细化已完成，正在同步章节执行资源", params: (m) => ({ scope: translateScopePrefix(m[1]) }) },
  // bare scope labels
  { test: /^第\s*(\d+)\s*卷(?:\s*·\s*(.+))?$/, key: "第 {{n}} 卷", params: (m) => ({ n: m[1] }) },
  { test: /^第\s*(\d+)-(\d+)\s*章$/, key: "第 {{a}}-{{b}} 章", params: (m) => ({ a: m[1], b: m[2] }) },
  { test: /^第\s*(\d+)\s*章$/, key: "第 {{n}} 章", params: (m) => ({ n: m[1] }) },
];

function translateScopePrefix(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "全书" || trimmed === "全篇") {
    return translateUi("全书");
  }
  for (const rule of RULES.slice(-3)) {
    const m = trimmed.match(rule.test);
    if (m) {
      return translateUi(rule.key, rule.params(m));
    }
  }
  return translateUi(trimmed);
}

/** `全书` / `第 N 卷 · 卷名` / `第 N-M 章` phía trước các cụm ghép "正在自动…" */
function translateComposedScope(raw: string): string {
  // "第 3 卷 · 章名 · 背景同步" -> dịch từng đoạn, giữ tên chương do người dùng đặt
  const scopeMatch = raw.match(/^(全书|第\s*\d+\s*卷(?:\s*·\s*[^·]+)?|第\s*\d+(?:-\d+)?\s*章)/);
  if (!scopeMatch) {
    return translateSegment(raw);
  }
  const scopeText = translateScopePrefix(scopeMatch[1]);
  const rest = raw.slice(scopeMatch[0].length);
  return scopeText + rest.split(" · ").map((seg) => (seg ? ` · ${translateSegment(seg.trim())}` : "")).join("");
}

function translateSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    return segment;
  }
  for (const rule of RULES) {
    const m = trimmed.match(rule.test);
    if (m) {
      return translateUi(rule.key, rule.params(m));
    }
  }
  return translateUi(trimmed);
}

/** Dịch nhãn tiến độ tác vụ. Trả nguyên chuỗi nếu không có bản dịch. */
export function translateTaskProgressLabel(label: string | null | undefined): string {
  if (!label) {
    return label ?? "";
  }
  if (!label.includes(" · ")) {
    return translateSegment(label);
  }
  return label
    .split(" · ")
    .map((segment) => translateSegment(segment))
    .join(" · ");
}
