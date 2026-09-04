/**
 * 扫描仍然硬编码在源码里的中文/非拉丁界面字符串。
 * Quét các chuỗi giao diện còn hardcode (chữ Hán / phi Latin) trong mã nguồn.
 * Scans for UI strings still hardcoded (CJK / non-Latin) in the source.
 *
 * 用法 / Cách dùng / Usage:
 *   node scripts/i18n-scan.mjs                # 汇总表 / bảng tổng hợp / summary table
 *   node scripts/i18n-scan.mjs --list         # 逐条列出 / liệt kê từng dòng / list every occurrence
 *   node scripts/i18n-scan.mjs --json > i18n-todo.json
 *
 * 目的：把「全量迁移」变成可核对、可分批的机械流程。
 * Mục đích: biến việc "dịch toàn bộ" thành quy trình cơ học, chia lô, kiểm tra được.
 * Purpose: turn "translate everything" into a checkable, batchable, mechanical process.
 *
 * 依赖 typescript（已是 devDependency）/ phụ thuộc typescript (đã có sẵn) / relies on typescript (already a devDependency).
 */
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src");

const args = new Set(process.argv.slice(2));
const MODE = args.has("--json") ? "json" : args.has("--list") ? "list" : "summary";
const UI_ONLY = args.has("--ui") || !args.has("--all");

// 这些路径下的中文是「数据/提示词」，发送给 LLM 或属于后端契约，绝不能变成 UI 翻译键。
// Chữ Hán trong các đường dẫn này là "dữ liệu / prompt" gửi cho LLM hoặc thuộc hợp đồng backend — KHÔNG được biến thành key dịch UI.
// CJK under these paths is data / prompt text sent to the LLM or part of a backend contract — must NOT become UI keys.
const EXCLUDE = [
  /\/i18n\//,
  /\.test\.(ts|tsx|mjs|js)$/,
  /\/tests?\//,
  /\/api\//,
  /promptWorkbench\/hooks\/usePromptPreview/,
  /promptWorkbench\/promptWorkbenchLabels/,
  /\.d\.ts$/,
];

const CJK = /[㐀-鿿豈-﫿　-〿＀-￯]/;

function shouldScan(file) {
  return !EXCLUDE.some((pattern) => pattern.test(file));
}

const files = globSync("**/*.{ts,tsx}", { cwd: SRC })
  .map((f) => resolve(SRC, f))
  .filter(shouldScan);

const findings = [];

const UI_PROPERTY_NAMES = new Set([
  "label", "title", "description", "summary", "hint", "fallback", "placeholder", "searchPlaceholder", "emptyText",
  "eyebrow", "actionLabel", "actionText", "statusLabel", "sectionLabel", "emptyLabel",
  // `prompt` values are assistant instructions/data contracts, not visible UI copy.
  // Giá trị `prompt` là chỉ dẫn cho trợ lý/hợp đồng dữ liệu, không phải nội dung UI.
  "error", "message", "reason", "confirmText", "title", "alt", "ariaLabel", "aria-label", "tooltip",
]);

function isUiString(node) {
  if (!UI_ONLY) return true;
  if (ts.isJsxText(node)) return true;
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const expression = current.expression;
      if (ts.isIdentifier(expression) && expression.text === "translateUi") return false;
      if (ts.isIdentifier(expression) && ["confirm", "prompt", "alert"].includes(expression.text)) return true;
      if (ts.isPropertyAccessExpression(expression) && ["confirm", "error", "success", "warning", "info"].includes(expression.name.text)) return true;
    }
    if (ts.isJsxAttribute(current)) return true;
    if (ts.isJsxExpression(current)) return true;
    if (ts.isPropertyAssignment(current)) {
      const name = current.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return UI_PROPERTY_NAMES.has(name.text);
      }
    }
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return false;
}

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(SRC, file);

  const record = (node, value, kind) => {
    if (!CJK.test(value)) return;
    if (!isUiString(node)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ file: rel, line: line + 1, kind, text: value.trim().replace(/\s+/g, " ").slice(0, 80) });
  };

  const visit = (node) => {
    if (ts.isStringLiteral(node)) {
      record(node, node.text, "string");
    } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      record(node, node.text, "template");
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.head.text + node.templateSpans.map((s) => s.literal.text).join("");
      record(node, raw, "template");
    } else if (ts.isJsxText(node)) {
      record(node, node.text, "jsx-text");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

if (MODE === "json") {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(0);
}

if (MODE === "list") {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  [${f.kind}]  ${f.text}`);
  }
}

const byFile = new Map();
for (const f of findings) {
  byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
}
const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

console.log("");
console.log(`硬编码字符串 / chuỗi hardcode / hardcoded strings: ${findings.length}`);
console.log(`涉及文件 / số file / files affected: ${byFile.size}`);
console.log("");
for (const [file, count] of sorted.slice(0, MODE === "list" ? sorted.length : 40)) {
  console.log(`  ${String(count).padStart(4)}  ${file}`);
}
if (MODE !== "list" && sorted.length > 40) {
  console.log(`  ... 其余 ${sorted.length - 40} 个文件，用 --list 查看全部 / dùng --list để xem tất cả`);
}
