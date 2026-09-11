import { HumanMessage } from "@langchain/core/messages";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { extractTextContent, normalizeBaseURL as normalizeAnthropicBaseURL } from "./anthropicClient";
import { getLLM } from "./factory";

export type NativeWebSearchKind = "openai_responses" | "anthropic_tool" | "gemini_native";

const NATIVE_WEB_SEARCH_KIND_BY_PROVIDER: Partial<Record<LLMProvider, NativeWebSearchKind>> = {
  openai: "openai_responses",
  anthropic: "anthropic_tool",
  gemini: "gemini_native",
};

/**
 * Azure OpenAI (qua endpoint hợp nhất mới `.../openai/v1`, ví dụ dạng
 * `https://<resource>.services.ai.azure.com/openai/v1` hoặc
 * `https://<resource>.openai.azure.com/openai/v1`) tương thích trực tiếp với
 * Responses API + tool `web_search_preview` của OpenAI (cùng dạng
 * `${baseURL}/responses`, xác thực Bearer) — miễn resource có bật Grounding
 * with Bing Search. Đây thường là "custom provider" người dùng tự khai báo,
 * không phải provider tên "openai", nên phải nhận diện qua baseURL.
 */
function isAzureOpenAIBaseUrl(baseURL: string): boolean {
  try {
    const host = new URL(baseURL).hostname.toLowerCase();
    return host.endsWith(".azure.com");
  } catch {
    return false;
  }
}

export function getNativeWebSearchKind(provider: LLMProvider, baseURL: string): NativeWebSearchKind | null {
  const byProvider = NATIVE_WEB_SEARCH_KIND_BY_PROVIDER[provider];
  if (byProvider) {
    return byProvider;
  }
  return isAzureOpenAIBaseUrl(baseURL) ? "openai_responses" : null;
}

export const UNKNOWN_REFERENCE_WORK_MARKER = "UNKNOWN_WORK";

const LOOKUP_TIMEOUT_MS = 20_000;

function buildLookupPrompt(title: string, lang: PromptLanguage): string {
  const safeTitle = title.trim();
  if (lang === "vi") {
    return [
      `Bạn có kiến thức đáng tin cậy về tác phẩm (manga/anime/tiểu thuyết/phim...) có tên "${safeTitle}" không?`,
      "Nếu có, hãy trả lời trực tiếp từ kiến thức bạn đã có (không cần tìm kiếm).",
      "Nếu không chắc chắn, hãy tìm kiếm trên web trước khi trả lời.",
      "Tóm tắt trong tối đa 120 từ: thể loại, tiền đề cốt truyện cốt lõi, cơ chế/mấu chốt cấu trúc đáng chú ý, và tông giọng chung. Không cần liệt kê chi tiết toàn bộ cốt truyện.",
      `Nếu bạn không thể tìm thấy hoặc không đủ tin cậy để nhận diện đúng tác phẩm này, hãy trả lời chính xác: ${UNKNOWN_REFERENCE_WORK_MARKER}`,
    ].join("\n");
  }
  if (lang === "en") {
    return [
      `Do you have reliable knowledge of the work (manga/anime/novel/film...) titled "${safeTitle}"?`,
      "If yes, answer directly from what you already know (no need to search).",
      "If you are not confident, search the web first before answering.",
      "Summarize in at most 120 words: genre, core premise, notable structural hooks/mechanisms, and overall tone. No need to list the full plot.",
      `If you cannot find or are not confident enough to correctly identify this work, reply exactly: ${UNKNOWN_REFERENCE_WORK_MARKER}`,
    ].join("\n");
  }
  return [
    `你是否掌握名为《${safeTitle}》的作品（漫画/动画/小说/影视等）的可靠信息？`,
    "如果掌握，请直接基于已有知识回答（无需搜索）。",
    "如果不确定，请先联网搜索再回答。",
    "请在 120 字以内概括：题材类型、核心故事前提、值得注意的结构机制/看点，以及整体基调。无需列出完整剧情。",
    `如果你找不到或没有足够把握准确识别这个作品，请准确回复：${UNKNOWN_REFERENCE_WORK_MARKER}`,
  ].join("\n");
}

function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Native web search lookup timed out.")), ms);
  signal?.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
}

interface LookupInput {
  provider: LLMProvider;
  apiKey?: string;
  baseURL: string;
  model: string;
  title: string;
  lang: PromptLanguage;
}

async function lookupViaOpenAIResponses(input: LookupInput): Promise<string | null> {
  const { signal, cancel } = withTimeout(undefined, LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${input.baseURL}/responses`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey ?? ""}`,
      },
      body: JSON.stringify({
        model: input.model,
        input: buildLookupPrompt(input.title, input.lang),
        tools: [{ type: "web_search_preview" }],
      }),
    });
    if (!response.ok) {
      console.warn(`[nativeWebSearch] OpenAI responses lookup failed (${response.status}) for "${input.title}"`);
      return null;
    }
    const payload = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
    const messageItem = (payload.output ?? []).find((item) => item.type === "message");
    const text = (messageItem?.content ?? [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    console.warn(`[nativeWebSearch] OpenAI responses lookup error for "${input.title}":`, error);
    return null;
  } finally {
    cancel();
  }
}

async function lookupViaAnthropicTool(input: LookupInput): Promise<string | null> {
  const { signal, cancel } = withTimeout(undefined, LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${normalizeAnthropicBaseURL(input.baseURL)}/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey ?? "",
        "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 1024,
        temperature: 0.3,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: buildLookupPrompt(input.title, input.lang) }],
      }),
    });
    if (!response.ok) {
      console.warn(`[nativeWebSearch] Anthropic tool lookup failed (${response.status}) for "${input.title}"`);
      return null;
    }
    const payload = await response.json();
    const text = extractTextContent(payload).trim();
    return text || null;
  } catch (error) {
    console.warn(`[nativeWebSearch] Anthropic tool lookup error for "${input.title}":`, error);
    return null;
  } finally {
    cancel();
  }
}

async function lookupViaGeminiNative(input: LookupInput): Promise<string | null> {
  const { signal, cancel } = withTimeout(undefined, LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey ?? "")}`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildLookupPrompt(input.title, input.lang) }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
    if (!response.ok) {
      console.warn(`[nativeWebSearch] Gemini native lookup failed (${response.status}) for "${input.title}"`);
      return null;
    }
    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part) => part.text ?? "").join("").trim();
    return text || null;
  } catch (error) {
    console.warn(`[nativeWebSearch] Gemini native lookup error for "${input.title}":`, error);
    return null;
  } finally {
    cancel();
  }
}

async function lookupViaPlainKnowledge(input: LookupInput): Promise<string | null> {
  try {
    const llm = await getLLM(input.provider, { model: input.model, apiKey: input.apiKey, baseURL: input.baseURL });
    const response = await llm.invoke([new HumanMessage(buildLookupPrompt(input.title, input.lang))]);
    const text = typeof response.content === "string"
      ? response.content.trim()
      : Array.isArray(response.content)
        ? response.content.map((part) => (typeof part === "string" ? part : "text" in part ? String(part.text ?? "") : "")).join("").trim()
        : "";
    return text || null;
  } catch (error) {
    console.warn(`[nativeWebSearch] Plain knowledge lookup error for "${input.title}":`, error);
    return null;
  }
}

function isUnknownWorkAnswer(result: string): boolean {
  return result.trim().toUpperCase().includes(UNKNOWN_REFERENCE_WORK_MARKER);
}

/**
 * Tra cứu một tác phẩm tham khảo. Với các provider/endpoint hỗ trợ tool tìm
 * kiếm web gốc (OpenAI, Azure OpenAI qua endpoint `/openai/v1`, Anthropic,
 * Gemini), model tự quyết định có cần tìm kiếm hay không dựa trên độ tự tin
 * về kiến thức sẵn có. Nếu lệnh gọi search gốc thất bại về mặt kỹ thuật (vd.
 * deployment không bật tool này), sẽ tự rơi về trả lời theo kiến thức sẵn có
 * thay vì bỏ cuộc. Trả về `null` nếu cả hai đều thất bại hoặc model xác nhận
 * không nhận diện được tác phẩm.
 */
export async function lookupReferenceWork(input: LookupInput): Promise<string | null> {
  const kind = getNativeWebSearchKind(input.provider, input.baseURL);
  const nativeResult = kind === "openai_responses" ? await lookupViaOpenAIResponses(input)
    : kind === "anthropic_tool" ? await lookupViaAnthropicTool(input)
      : kind === "gemini_native" ? await lookupViaGeminiNative(input)
        : null;

  const result = nativeResult ?? await lookupViaPlainKnowledge(input);
  if (!result || isUnknownWorkAnswer(result)) {
    return null;
  }
  return result;
}
