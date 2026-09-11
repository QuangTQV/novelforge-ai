import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { resolveLLMClientOptions } from "../../../../llm/factory";
import { resolveReferenceNote } from "../../../../llm/nativeWebSearch";

const MAX_REFERENCE_NOTE_LENGTH = 1000;

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

/**
 * Diễn giải ghi chú tham khảo tự do của người dùng (VD: "muốn thế giới quan
 * giống Attack on Titan nhưng nhịp độ nhanh hơn như Chainsaw Man") — bằng
 * kiến thức sẵn có của model hoặc tool web search gốc của provider — rồi gói
 * lại thành một khối văn bản để chèn vào `productionFoundationPrompt` — cùng
 * quy ước với `referenceAnalysisPrompt` hiện có (chỉ mượn cơ chế cấu trúc,
 * cấm sao chép nguyên văn).
 */
export async function buildReferenceWorkContextBlock(
  note: string | undefined,
  routing: { provider?: LLMProvider; model?: string },
  lang: PromptLanguage,
): Promise<string> {
  const normalizedNote = note?.trim().slice(0, MAX_REFERENCE_NOTE_LENGTH);
  if (!normalizedNote) {
    return "";
  }

  let clientOptions;
  try {
    clientOptions = await resolveLLMClientOptions(routing.provider, {
      model: routing.model,
      taskType: "planner",
    });
  } catch (error) {
    console.warn("[referenceWorkResearch] Failed to resolve LLM client options:", error);
    return "";
  }

  const guidance = await resolveReferenceNote({
    provider: clientOptions.provider,
    apiKey: clientOptions.apiKey,
    baseURL: clientOptions.baseURL,
    model: clientOptions.model,
    note: normalizedNote,
    lang,
  });

  if (!guidance) {
    return "";
  }

  const heading = pick(
    lang,
    "结构参考：只借鉴以下参考说明中提到的结构机制、节奏和写法，禁止沿用其专名、角色、世界事实和具体剧情。",
    "Tham khảo cấu trúc: chỉ mượn cơ chế cấu trúc, nhịp độ và bút pháp theo ghi chú tham khảo dưới đây, cấm sao chép tên riêng, nhân vật, thiết lập thế giới hay các đoạn cốt truyện nguyên văn của tác phẩm được nhắc tới.",
    "Structural reference: only borrow the structural mechanisms, pacing, and craft described in the reference note below — do not reuse the mentioned works' proper nouns, characters, world facts, or specific plot beats.",
  );

  return [heading, guidance].join("\n");
}
