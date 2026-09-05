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

// Runtime messages may have been persisted before the i18n key was added.
// Translate their stable Chinese fragments while preserving dynamic values
// such as chapter counts, IDs, and user-authored titles.
const RUNTIME_FRAGMENT_TRANSLATIONS: string[] = [
  "推进任务：",
  "最近进展：",
  "当前阶段：",
  "下一步：",
  "缺少规划资源",
  "执行章节生成批次",
  "章节留存约定已纳入自动导演记录",
  "读者承诺已纳入自动导演记录",
  "生成目标卷节奏板完成",
  "章节规划已完成，可以开始章节执行",
  "已有草稿",
  "章节",
  "自动导演记录",
];

function translateKnownRuntimeFragments(value: string): string {
  return RUNTIME_FRAGMENT_TRANSLATIONS.reduce(
    (result, source) => result.split(source).join(translateUi(source)),
    value,
  );
}

const RULES: Rule[] = [
  { test: /^推进任务：(.+)$/, key: "推进任务：{{label}}", params: (m) => ({ label: translateSegment(m[1]) }) },
  { test: /^最近进展：(.+)$/, key: "最近进展：{{label}}", params: (m) => ({ label: translateSegment(m[1]) }) },
  { test: /^当前阶段：(.+)$/, key: "当前阶段：{{label}}", params: (m) => ({ label: translateSegment(m[1]) }) },
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
  { test: /^第\s*(\d+)\s*轮已生成\s*(\d+)\s*套书级方向，并完成每套书名组。?$/, key: "第 {{round}} 轮已生成 {{count}} 套书级方向，并完成每套书名组。", params: (m) => ({ round: m[1], count: m[2] }) },
  { test: /^第\s*(\d+)\s*轮已根据修正意见生成\s*(\d+)\s*套新方向，并完成标题组增强。?$/, key: "第 {{round}} 轮已根据修正意见生成 {{count}} 套新方向，并完成标题组增强。", params: (m) => ({ round: m[1], count: m[2] }) },
  { test: /^《(.+?)》已完成前期准备，请选择创作界面。?$/, key: "《{{title}}》已完成前期准备，请选择创作界面。", params: (m) => ({ title: m[1] }) },
  { test: /^第\s*(\d+)-(\d+)\s*章已可进入章节执行。?$/, key: "第 {{start}}-{{end}} 章已可进入章节执行", params: (m) => ({ start: m[1], end: m[2] }) },
  { test: /^AI 已自动通过「(.+?)」，并继续推进。(?:([\s\S]+))?$/, key: "AI 已自动通过「{{label}}」，并继续推进。{{summary}}", params: (m) => ({ label: m[1], summary: m[2] ? translateTaskProgressLabel(m[2]) : "" }) },
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
      return translateKnownRuntimeFragments(translateUi(rule.key, rule.params(m)));
    }
  }
  const translated = translateUi(trimmed);
  return translateKnownRuntimeFragments(translated);
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
      return translateKnownRuntimeFragments(translateUi(rule.key, rule.params(m)));
    }
  }
  return translateKnownRuntimeFragments(translateUi(trimmed));
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
