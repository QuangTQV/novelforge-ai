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

export const NO_USEFUL_REFERENCE_MARKER = "NO_USEFUL_REFERENCE";

const LOOKUP_TIMEOUT_MS = 20_000;

function buildReferenceNotePrompt(note: string, lang: PromptLanguage): string {
  const safeNote = note.trim();
  if (lang === "vi") {
    return [
      `Đây là ghi chú tham khảo của người dùng cho một truyện họ đang tạo: "${safeNote}"`,
      "Nếu ghi chú nhắc tới tác phẩm cụ thể (manga/anime/tiểu thuyết/phim...), hãy nhận diện chúng: nếu bạn có kiến thức đáng tin cậy thì trả lời trực tiếp; nếu không chắc, hãy tìm kiếm trên web trước khi trả lời.",
      "Tổng hợp lại thành một đoạn hướng dẫn tham khảo ngắn gọn (tối đa 150 từ): nên mượn điều gì (cấu trúc, nhịp độ, cơ chế, tông giọng...) từ tác phẩm nào, đúng theo cách người dùng mô tả muốn kết hợp/khác biệt. Nếu ghi chú không nhắc tác phẩm cụ thể mà chỉ mô tả cảm giác mong muốn, hãy giữ nguyên ý đó thành hướng dẫn.",
      `Nếu ghi chú trống hoặc không chứa thông tin tham khảo hữu ích nào, hãy trả lời chính xác: ${NO_USEFUL_REFERENCE_MARKER}`,
    ].join("\n");
  }
  if (lang === "en") {
    return [
      `This is a user's reference note for a story they are creating: "${safeNote}"`,
      "If the note mentions specific existing works (manga/anime/novel/film...), identify them: answer directly if you have reliable knowledge, or search the web first if unsure.",
      "Synthesize this into a short reference brief (at most 150 words): what to borrow (structure, pacing, mechanisms, tone...) from which work, exactly matching how the user describes wanting to combine or differentiate them. If the note doesn't mention a specific work and only describes a desired feeling, keep that intent as the brief.",
      `If the note is empty or contains no useful reference information, reply exactly: ${NO_USEFUL_REFERENCE_MARKER}`,
    ].join("\n");
  }
  return [
    `这是用户为正在创作的故事写的参考说明："${safeNote}"`,
    "如果说明中提到了具体作品（漫画/动画/小说/影视等），请识别它们：如果你有可靠知识就直接回答；如果不确定，请先联网搜索再回答。",
    "把结果整理成一段简短的参考指引（不超过 150 字）：应该从哪个作品借鉴什么（结构、节奏、机制、基调等），并严格按用户描述的组合/差异化方式来写。如果说明没有提到具体作品、只是描述了想要的感觉，请直接保留这个意图作为指引。",
    `如果说明为空或不包含任何有用的参考信息，请准确回复：${NO_USEFUL_REFERENCE_MARKER}`,
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
  note: string;
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
        input: buildReferenceNotePrompt(input.note, input.lang),
        tools: [{ type: "web_search_preview" }],
      }),
    });
    if (!response.ok) {
      console.warn(`[nativeWebSearch] OpenAI responses lookup failed (${response.status})`);
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
    console.warn("[nativeWebSearch] OpenAI responses lookup error:", error);
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
        messages: [{ role: "user", content: buildReferenceNotePrompt(input.note, input.lang) }],
      }),
    });
    if (!response.ok) {
      console.warn(`[nativeWebSearch] Anthropic tool lookup failed (${response.status})`);
      return null;
    }
    const payload = await response.json();
    const text = extractTextContent(payload).trim();
    return text || null;
  } catch (error) {
    console.warn("[nativeWebSearch] Anthropic tool lookup error:", error);
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
          contents: [{ role: "user", parts: [{ text: buildReferenceNotePrompt(input.note, input.lang) }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
    if (!response.ok) {
      console.warn(`[nativeWebSearch] Gemini native lookup failed (${response.status})`);
      return null;
    }
    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part) => part.text ?? "").join("").trim();
    return text || null;
  } catch (error) {
    console.warn("[nativeWebSearch] Gemini native lookup error:", error);
    return null;
  } finally {
    cancel();
  }
}

async function lookupViaPlainKnowledge(input: LookupInput): Promise<string | null> {
  try {
    const llm = await getLLM(input.provider, { model: input.model, apiKey: input.apiKey, baseURL: input.baseURL });
    const response = await llm.invoke([new HumanMessage(buildReferenceNotePrompt(input.note, input.lang))]);
    const text = typeof response.content === "string"
      ? response.content.trim()
      : Array.isArray(response.content)
        ? response.content.map((part) => (typeof part === "string" ? part : "text" in part ? String(part.text ?? "") : "")).join("").trim()
        : "";
    return text || null;
  } catch (error) {
    console.warn("[nativeWebSearch] Plain knowledge lookup error:", error);
    return null;
  }
}

function hasNoUsefulReference(result: string): boolean {
  return result.trim().toUpperCase().includes(NO_USEFUL_REFERENCE_MARKER);
}

/**
 * Diễn giải một ghi chú tham khảo tự do (có thể nhắc tới nhiều tác phẩm, hoặc
 * chỉ mô tả cảm giác mong muốn) thành một đoạn hướng dẫn tham khảo ngắn gọn.
 * Với provider/endpoint hỗ trợ tool tìm kiếm web gốc (OpenAI, Azure OpenAI
 * qua endpoint `/openai/v1`, Anthropic, Gemini), model tự quyết định có cần
 * tìm kiếm hay không dựa trên độ tự tin về kiến thức sẵn có. Nếu lệnh gọi
 * search gốc thất bại về mặt kỹ thuật (vd. deployment không bật tool này),
 * sẽ tự rơi về trả lời theo kiến thức sẵn có thay vì bỏ cuộc. Trả về `null`
 * nếu cả hai đều thất bại hoặc model xác nhận ghi chú không có thông tin
 * tham khảo hữu ích.
 */
export async function resolveReferenceNote(input: LookupInput): Promise<string | null> {
  const kind = getNativeWebSearchKind(input.provider, input.baseURL);
  const nativeResult = kind === "openai_responses" ? await lookupViaOpenAIResponses(input)
    : kind === "anthropic_tool" ? await lookupViaAnthropicTool(input)
      : kind === "gemini_native" ? await lookupViaGeminiNative(input)
        : null;

  const result = nativeResult ?? await lookupViaPlainKnowledge(input);
  if (!result || hasNoUsefulReference(result)) {
    return null;
  }
  return result;
}
