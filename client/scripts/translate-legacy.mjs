import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/i18n/locales/vi/legacy.json", import.meta.url);
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const entries = Object.entries(source);
const marker = "\n__I18N_ITEM__\n";
const targets = ["vi", "en"];
const LOCAL_TERMS = {
  vi: [
    ["正在", "Đang "], ["已完成", "Đã hoàn thành"], ["已保存", "Đã lưu"], ["等待", "Đang chờ"], ["恢复", "khôi phục"], ["自动导演", "đạo diễn tự động"], ["自动执行", "thực thi tự động"], ["当前", "hiện tại"], ["显示", "Hiển thị"], ["查看", "Xem"], ["点击", "nhấp"], ["详情", "chi tiết"], ["最近", "gần đây"], ["进展", "cập nhật"], ["进度", "tiến độ"], ["更新", "cập nhật"], ["版本", "phiên bản"], ["下载", "tải xuống"], ["桌面版", "bản máy tính"], ["准备完成", "đã sẵn sàng"], ["第", "chương "], ["章", "chương"], ["集", "tập"], ["页", "trang"], ["步", "bước"], ["条", "mục"], ["项", "mục"], ["个", " mục"], ["位", " người"], ["卷", "quyển"], ["字", " ký tự"], ["次", " lần"], ["生成", "tạo"], ["失败", "thất bại"], ["错误", "lỗi"], ["保存", "lưu"], ["删除", "xóa"], ["确认", "xác nhận"], ["选择", "chọn"], ["编辑", "chỉnh sửa"], ["封面", "bìa"], ["角色", "nhân vật"], ["资源", "tài nguyên"], ["资产", "tài sản"], ["模型", "mô hình"], ["任务", "tác vụ"], ["章节", "chương"], ["故事", "câu chuyện"], ["风险", "rủi ro"], ["规则", "quy tắc"], ["状态", "trạng thái"], ["推荐", "đề xuất"], ["范围", "phạm vi"], ["内容", "nội dung"], ["结果", "kết quả"], ["来源", "nguồn"], ["已", "Đã "], ["可", "có thể "], ["中", "đang "], ["待", "chờ "], ["未", "chưa "], ["不", "không "], ["和", " và "], ["或", " hoặc "], ["的", " của "], ["：", ":"], ["。", "."], ["，", ","], ["（", " ("], ["）", ")"], ["「", "“"], ["」", "”"], ["《", "“"], ["》", "”"], ["·", "·"],
  ],
  en: [
    ["正在", "正在"], ["已完成", "Completed"], ["已保存", "Saved"], ["等待", "Waiting to "], ["恢复", "resume"], ["自动导演", "automatic directing"], ["自动执行", "automatic execution"], ["当前", "Current"], ["显示", "Show"], ["查看", "View"], ["点击", "click"], ["详情", "details"], ["最近", "recent"], ["进展", "updates"], ["进度", "progress"], ["更新", "updates"], ["版本", "version"], ["下载", "download"], ["桌面版", "desktop version"], ["准备完成", "ready"], ["第", "Chapter "], ["章", "chapter"], ["集", "episode"], ["页", "page"], ["步", "step"], ["条", "items"], ["项", "items"], ["个", " items"], ["位", " people"], ["卷", "volume"], ["字", " characters"], ["次", " times"], ["生成", "Generate"], ["失败", "failed"], ["错误", "error"], ["保存", "Save"], ["删除", "Delete"], ["确认", "Confirm"], ["选择", "Select"], ["编辑", "Edit"], ["封面", "cover"], ["角色", "characters"], ["资源", "resources"], ["资产", "assets"], ["模型", "model"], ["任务", "task"], ["章节", "chapters"], ["故事", "story"], ["风险", "risk"], ["规则", "rules"], ["状态", "status"], ["推荐", "recommended"], ["范围", "range"], ["内容", "content"], ["结果", "results"], ["来源", "source"], ["已", ""], ["可", "can "], ["中", "in progress"], ["待", "pending "], ["未", "not "], ["不", "not "], ["和", " and "], ["或", " or "], ["的", " of "], ["：", ":"], ["。", "."], ["，", ","], ["（", " ("], ["）", ")"], ["「", "\""], ["」", "\""], ["《", "\""], ["》", "\""], ["·", "·"],
  ],
};

function protect(value) {
  const placeholders = [];
  const protectedValue = value.replace(/\{\{[^{}]+\}\}/g, (token) => {
    const replacement = `__I18N_VAR_${placeholders.length}__`;
    placeholders.push([replacement, token]);
    return replacement;
  });
  return { protectedValue, placeholders };
}

function restore(value, placeholders) {
  return placeholders.reduce((result, [token, original]) => result.replaceAll(token, original), value.trim());
}

function translateLocally(value, target) {
  let result = value;
  for (const [source, replacement] of LOCAL_TERMS[target]) result = result.replaceAll(source, replacement);
  return result.replace(/[\u3400-\u9fff]+/g, target === "vi" ? "nội dung" : "text");
}

async function translate(text, target) {
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${target}&dt=t&q=${encodeURIComponent(text)}`);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  return payload[0].map((part) => part[0]).join("");
}

for (const target of targets) {
  const targetPath = new URL(`../src/i18n/locales/${target}/legacy.json`, import.meta.url);
  let output = {};
  try {
    output = JSON.parse(await readFile(targetPath, "utf8"));
  } catch {
    output = {};
  }
  // The object key is the immutable source text. Values may already be translated
  // from a previous run, so never use the current Vietnamese value as source text.
  const pending = entries.filter(([key, value]) => (
    /[\u3400-\u9fff]/.test(key)
    && (/[\u3400-\u9fff]/.test(value) || /[\u3400-\u9fff]/.test(output[key] ?? ""))
  ));
  for (let offset = 0; offset < pending.length; offset += 30) {
    const batch = pending.slice(offset, offset + 30);
    const protectedItems = batch.map(([key]) => ({ key, ...protect(key) }));
    let translated;
    try {
      translated = await translate(protectedItems.map((item) => item.protectedValue).join(marker), target);
    } catch {
      translated = protectedItems.map((item) => translateLocally(item.protectedValue, target)).join(marker);
    }
    const parts = translated.split(marker);
    if (parts.length !== batch.length) {
      throw new Error(`Batch boundary mismatch for ${target}: expected ${batch.length}, got ${parts.length}`);
    }
    parts.forEach((value, index) => {
      output[batch[index][0]] = restore(value, protectedItems[index].placeholders);
    });
    console.log(`${target}: ${Math.min(offset + batch.length, pending.length)}/${pending.length}`);
  }
  for (const [key, value] of entries) {
    if (!(key in output)) output[key] = value;
  }
  await writeFile(targetPath, `${JSON.stringify(output, null, 2)}\n`);
}
