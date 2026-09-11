import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { resolveLLMClientOptions } from "../../../../llm/factory";
import { lookupReferenceWork } from "../../../../llm/nativeWebSearch";

const MAX_REFERENCE_WORK_TITLES = 5;

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

function normalizeTitles(titles: string[] | undefined): string[] {
  if (!titles || titles.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of titles) {
    const title = raw.trim();
    if (!title || seen.has(title.toLowerCase())) {
      continue;
    }
    seen.add(title.toLowerCase());
    normalized.push(title);
    if (normalized.length >= MAX_REFERENCE_WORK_TITLES) {
      break;
    }
  }
  return normalized;
}

/**
 * Tra cứu (bằng kiến thức sẵn có của model hoặc tool web search gốc của
 * provider) các tác phẩm mà người dùng muốn AI tham khảo cấu trúc/tông giọng
 * khi sinh ý tưởng truyện, rồi gói lại thành một khối văn bản để chèn vào
 * `productionFoundationPrompt` — cùng quy ước với `referenceAnalysisPrompt`
 * hiện có (chỉ mượn cơ chế cấu trúc, cấm sao chép nguyên văn).
 */
export async function buildReferenceWorkContextBlock(
  titles: string[] | undefined,
  routing: { provider?: LLMProvider; model?: string },
  lang: PromptLanguage,
): Promise<string> {
  const normalizedTitles = normalizeTitles(titles);
  if (normalizedTitles.length === 0) {
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

  const results = await Promise.allSettled(
    normalizedTitles.map((title) => lookupReferenceWork({
      provider: clientOptions.provider,
      apiKey: clientOptions.apiKey,
      baseURL: clientOptions.baseURL,
      model: clientOptions.model,
      title,
      lang,
    })),
  );

  const resolved: Array<{ title: string; summary: string }> = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      resolved.push({ title: normalizedTitles[index], summary: result.value });
    }
  });

  if (resolved.length === 0) {
    return "";
  }

  const heading = pick(
    lang,
    "结构参考：只借鉴以下作品的结构机制、节奏和写法，禁止沿用其专名、角色、世界事实和具体剧情。",
    "Tham khảo cấu trúc: chỉ mượn cơ chế cấu trúc, nhịp độ và bút pháp của các tác phẩm dưới đây, cấm sao chép tên riêng, nhân vật, thiết lập thế giới hay các đoạn cốt truyện nguyên văn của chúng.",
    "Structural reference: only borrow the structural mechanisms, pacing, and craft of the works below — do not reuse their proper nouns, characters, world facts, or specific plot beats.",
  );

  const lines = resolved.map((item) => `- ${item.title}: ${item.summary}`);
  return [heading, ...lines].join("\n");
}
