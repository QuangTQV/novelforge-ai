import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src");
const UI_PROPERTY_NAMES = new Set(["label", "title", "description", "summary", "hint", "fallback", "placeholder", "searchPlaceholder", "emptyText", "error", "message", "reason", "confirmText", "alt", "ariaLabel", "aria-label", "tooltip", "eyebrow", "actionLabel", "actionText", "statusLabel", "sectionLabel", "emptyLabel"]);
const EXCLUDE = [/\/i18n\//, /\.test\.(ts|tsx|mjs|js)$/, /\/tests?\//, /\/api\//, /prompt/i, /Prompt/, /\.d\.ts$/];
const CJK = /[㐀-鿿豈-﫿　-〿＀-￯]/;
const files = ts.sys.readDirectory(SRC, [".ts", ".tsx"], undefined, ["**/*"]).filter((file) => !EXCLUDE.some((pattern) => pattern.test(file)));
const entries = new Map();

function isUiString(node) {
  if (ts.isJsxText(node)) return true;
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const expression = current.expression;
      if (ts.isIdentifier(expression) && expression.text === "translateUi") return false;
      if (ts.isIdentifier(expression) && ["confirm", "prompt", "alert"].includes(expression.text)) return true;
      if (ts.isPropertyAccessExpression(expression) && ["confirm", "error", "success", "warning", "info"].includes(expression.name.text)) return true;
    }
    if (ts.isJsxAttribute(current) || ts.isJsxExpression(current)) return true;
    if (ts.isPropertyAssignment(current)) {
      const name = current.name;
      if ((ts.isIdentifier(name) || ts.isStringLiteral(name)) && UI_PROPERTY_NAMES.has(name.text)) return true;
      return false;
    }
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return false;
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const replacements = [];
  function visit(node) {
    if (ts.isNoSubstitutionTemplateLiteral(node) && CJK.test(node.text) && isUiString(node)) {
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: `translateUi(${JSON.stringify(node.text)})` });
      entries.set(node.text, node.text);
    } else if (ts.isTemplateExpression(node) && CJK.test(node.getText(sourceFile)) && isUiString(node)) {
      let key = node.head.text;
      const variables = [];
      node.templateSpans.forEach((span, index) => {
        const name = `value${index}`;
        key += `{{${name}}}${span.literal.text}`;
        variables.push(`${name}: ${span.expression.getText(sourceFile)}`);
      });
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: `translateUi(${JSON.stringify(key)}, { ${variables.join(", ")} })`,
      });
      entries.set(key, key);
    } else if (ts.isStringLiteral(node) && CJK.test(node.text) && isUiString(node)) {
      const parent = node.parent;
      const replacement = ts.isJsxAttribute(parent) ? `{translateUi(${JSON.stringify(node.text)})}` : `translateUi(${JSON.stringify(node.text)})`;
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement });
      entries.set(node.text, node.text);
    } else if (ts.isJsxText(node) && CJK.test(node.text) && isUiString(node)) {
      const leading = node.text.match(/^\s*/)?.[0] ?? "";
      const trailing = node.text.match(/\s*$/)?.[0] ?? "";
      const value = node.text.slice(leading.length, node.text.length - trailing.length || undefined);
      if (value && CJK.test(value)) {
        replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: `${leading}{translateUi(${JSON.stringify(value)})}${trailing}` });
        entries.set(value, value);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!replacements.length) continue;
  let output = source;
  for (const item of replacements.sort((a, b) => b.start - a.start)) output = output.slice(0, item.start) + item.replacement + output.slice(item.end);
  if (!/from ["']@\/i18n\/legacy["']/.test(output)) output = `import { translateUi } from "@/i18n/legacy";\n${output}`;
  writeFileSync(file, output);
  console.log(`${relative(SRC, file)}: ${replacements.length}`);
}

const legacyPath = resolve(SRC, "i18n/locales/vi/legacy.json");
const existingLegacy = JSON.parse(readFileSync(legacyPath, "utf8"));
// Existing translations must win; the codemod only contributes newly discovered source keys.
writeFileSync(legacyPath, `${JSON.stringify({ ...Object.fromEntries(entries), ...existingLegacy }, null, 2)}\n`);
console.log(`legacy entries: ${entries.size}`);
