import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { configureLegacyTranslator } from "./legacy.ts";
import { translateTaskProgressLabel } from "./taskProgressLabel.ts";

const root = dirname(fileURLToPath(import.meta.url));
const viLegacy = JSON.parse(readFileSync(join(root, "locales/vi/legacy.json"), "utf8"));

// Minimal translator: exact key lookup + {{x}} interpolation, else source string.
configureLegacyTranslator((source, vars) => {
  let out = viLegacy[source] ?? source;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return out;
});

test("exact static label", () => {
  assert.equal(translateTaskProgressLabel("正在创建小说项目"), "Đang tạo dự án tiểu thuyết");
});

test("interpolated volume label", () => {
  assert.equal(translateTaskProgressLabel("正在生成第 3 卷节奏板"), "Đang tạo bảng nhịp cho tập 3");
});

test("bare scope labels", () => {
  assert.equal(translateTaskProgressLabel("全书"), "Cả cuốn");
  assert.equal(translateTaskProgressLabel("第 12 章"), "Chương 12");
  assert.equal(translateTaskProgressLabel("第 3-5 章"), "Chương 3-5");
});

test("composed auto-exec label keeps the user's chapter title", () => {
  const out = translateTaskProgressLabel("正在自动执行第 2 卷 · 第五章 归乡 · 背景同步");
  assert.match(out, /Đang tự động thực thi/);
  assert.match(out, /归乡/);
});

test("unknown / dynamic strings pass through unchanged", () => {
  assert.equal(translateTaskProgressLabel("Error: connection reset by peer"), "Error: connection reset by peer");
  assert.equal(translateTaskProgressLabel(null), "");
  assert.equal(translateTaskProgressLabel(""), "");
});
