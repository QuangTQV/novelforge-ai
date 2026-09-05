import type { NovelStyleFlavor } from "../types/novel";
import type { PromptLanguage } from "./novelLanguage";

/** Mọi giá trị phong cách văn phong được hỗ trợ. Thứ tự dùng để render danh sách chọn. */
export const NOVEL_STYLE_FLAVOR_VALUES = ["manga", "manhwa", "manhua", "none"] as const;

/** Mặc định khi bản ghi không có giá trị (novel mới cũng mặc định phong cách này). */
export const DEFAULT_NOVEL_STYLE_FLAVOR: NovelStyleFlavor = "manga";

const NOVEL_STYLE_FLAVOR_VALUE_SET = new Set<string>(NOVEL_STYLE_FLAVOR_VALUES);

/** Chuẩn hóa giá trị tùy ý về một `NovelStyleFlavor` hợp lệ (rỗng/không hợp lệ ⇒ mặc định). */
export function resolveNovelStyleFlavor(value: string | null | undefined): NovelStyleFlavor {
  if (value && NOVEL_STYLE_FLAVOR_VALUE_SET.has(value)) {
    return value as NovelStyleFlavor;
  }
  return DEFAULT_NOVEL_STYLE_FLAVOR;
}

/**
 * Chỉ thị phong cách văn phong, chèn cùng chỉ thị ngôn ngữ đầu ra ở prompt runner.
 * Trả `null` khi phong cách là "none" (không áp overlay, giữ hành vi mặc định của prompt gốc).
 */
export function buildStyleFlavorDirective(flavor: NovelStyleFlavor, promptLanguage: PromptLanguage): string | null {
  if (flavor === "none") {
    return null;
  }

  const messages: Record<PromptLanguage, Record<Exclude<NovelStyleFlavor, "none">, string[]>> = {
    vi: {
      manga: [
        "【PHONG CÁCH VĂN PHONG: MANGA / LIGHT NOVEL NHẬT】",
        "Đoạn văn ngắn, nhịp nhanh; ưu tiên độc thoại nội tâm sát nhân vật, có thể xen hài hước nhẹ nếu hợp giọng truyện.",
        "Mô tả hành động như những lát cắt cảnh liên tiếp (đổi góc nhìn/khoảnh khắc nhanh), thoại ngắn và sắc.",
        "Mỗi chương kết bằng một chi tiết gây tò mò hoặc một twist nhỏ; tránh đoạn diễn giải dài dòng.",
        "Ưu tiên cảm giác đọc như đang xem storyboard manga: cảnh rõ, biểu cảm dễ hình dung, hành động nhìn thấy được, chuyển cảnh gọn.",
        "Không dùng công thức tiên hiệp/cung đấu/web novel Trung Quốc; không lạm dụng Hán-Việt, độc thoại tính toán kéo dài hoặc lời thoại giảng giải.",
        "Không biến ‘manga’ thành mô tả hình ảnh đơn thuần: vẫn phải là văn xuôi có cảnh, cảm xúc, mục tiêu và xung đột cụ thể.",
      ],
      manhwa: [
        "【PHONG CÁCH VĂN PHONG: MANHWA / WEB NOVEL HÀN】",
        "Nhịp độ rất nhanh, vào thẳng xung đột ngay từ đầu chương, hạn chế mở bài rườm rà.",
        "Nhấn mạnh khoảnh khắc nhân vật chính thể hiện bản lĩnh rõ rệt; thoại ngắn gọn, dứt khoát.",
        "Mỗi chương xây một đường căng thẳng tăng dần, kết thúc bằng cao trào hoặc cliffhanger rõ ràng.",
      ],
      manhua: [
        "【PHONG CÁCH VĂN PHONG: MANHUA / WEB NOVEL TRUNG】",
        "Nhịp độ ổn định; bối cảnh và thông tin nền được lồng tự nhiên vào mạch truyện thay vì liệt kê.",
        "Nội tâm nhân vật đan xen tính toán, suy luận; văn phong trau chuốt vừa phải, không quá thô ráp.",
        "Mỗi chương thường kết bằng một điểm nghi vấn hoặc một thông tin mới vừa hé lộ.",
      ],
    },
    zh: {
      manga: [
        "【文风：日式漫画 / 轻小说风格】",
        "段落短、节奏快；多用贴近角色的内心独白，语气允许时可穿插轻松幽默。",
        "动作描写像连续的分镜切换（视角/瞬间快速切换），对话短促有力。",
        "每章以一个引人好奇的细节或小反转收尾，避免冗长说明性段落。",
      ],
      manhwa: [
        "【文风：韩式漫画 / 韩国网文风格】",
        "节奏非常快，章节一开始就切入冲突，避免拖沓铺垫。",
        "着重刻画主角展现实力/气场的高光时刻；台词简短果断。",
        "每章构建一条逐步升级的张力线，以明确的高潮或悬念收尾。",
      ],
      manhua: [
        "【文风：国漫 / 中式网文风格】",
        "节奏平稳；世界观与背景信息自然融入情节，而不是罗列说明。",
        "角色内心穿插算计与推理；文字略加雕琢，但不过分堆砌辞藻。",
        "每章通常以一个疑点或刚揭示的新信息收尾。",
      ],
    },
    en: {
      manga: [
        "[PROSE STYLE: JAPANESE MANGA / LIGHT NOVEL]",
        "Short paragraphs, fast rhythm; favor close first-person-flavored internal monologue, with light humor when the tone allows.",
        "Write action like quick successive panel cuts (rapid shifts between viewpoint/moment); keep dialogue short and sharp.",
        "End each chapter on an intriguing detail or a small twist; avoid long expository passages.",
      ],
      manhwa: [
        "[PROSE STYLE: KOREAN MANHWA / WEB NOVEL]",
        "Very fast pacing — drop straight into conflict at the start of the chapter, minimize throat-clearing setup.",
        "Emphasize clear 'power/cool moment' beats for the protagonist; keep dialogue terse and decisive.",
        "Build one escalating tension line per chapter, ending on a clear climax or cliffhanger.",
      ],
      manhua: [
        "[PROSE STYLE: CHINESE MANHUA / WEB NOVEL]",
        "Steady, measured pacing; weave worldbuilding and background information naturally into the narrative instead of listing it.",
        "Interleave character interiority with scheming and deduction; moderately polished prose, not overly ornate.",
        "End each chapter, typically, on a lingering question or a newly revealed piece of information.",
      ],
    },
  };

  return messages[promptLanguage][flavor].join("\n");
}
