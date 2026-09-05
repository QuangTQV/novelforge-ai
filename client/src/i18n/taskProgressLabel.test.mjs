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

test("persisted runtime messages translate stable Chinese fragments", () => {
  const out = translateTaskProgressLabel("当前阶段：has_chapter_plan，章节 0/8 已有草稿，下一步：章节规划已完成，可以开始章节执行。");
  assert.match(out, /Giai đoạn hiện tại/);
  assert.match(out, /chương 0\/8/);
  assert.match(out, /Bước tiếp theo/);
});

test("persisted follow-up summaries translate dynamic Chinese messages", () => {
  assert.equal(
    translateTaskProgressLabel("任务已取消，如仍需继续，可从最近检查点恢复。"),
    "Tác vụ đã bị hủy. Nếu vẫn muốn tiếp tục, hãy khôi phục từ điểm kiểm tra gần nhất.",
  );
  assert.equal(
    translateTaskProgressLabel("第 1 轮已生成 2 套书级方向，并完成每套书名组。"),
    "Vòng 1 đã tạo 2 hướng cấp sách và hoàn tất nhóm tên sách cho từng hướng.",
  );
  assert.equal(
    translateTaskProgressLabel("《炮臺最後在地球》已完成前期准备，请选择创作界面。"),
    "“炮臺最後在地球” đã hoàn tất khâu chuẩn bị ban đầu. Hãy chọn giao diện sáng tác.",
  );
  assert.equal(translateTaskProgressLabel("第 1-10 章已可进入章节执行"), "Chương 1-10 đã sẵn sàng để thực thi.");
  assert.equal(
    translateTaskProgressLabel("AI 已自动通过「章节执行」，并继续推进。"),
    "AI đã tự động thông qua “chương执行” và tiếp tục triển khai.",
  );
});

test("unknown / dynamic strings pass through unchanged", () => {
  assert.equal(translateTaskProgressLabel("Error: connection reset by peer"), "Error: connection reset by peer");
  assert.equal(translateTaskProgressLabel(null), "");
  assert.equal(translateTaskProgressLabel(""), "");
});
