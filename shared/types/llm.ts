export const LLM_PROVIDERS = [
  "deepseek",
  "siliconflow",
  "openai",
  "anthropic",
  "grok",
  "kimi",
  "minimax",
  "glm",
  "qwen",
  "gemini",
  "ollama",
] as const;

export type BuiltinLLMProvider = typeof LLM_PROVIDERS[number];
export type LLMProvider = BuiltinLLMProvider | (string & {});

export function isBuiltinLLMProvider(provider: string): provider is BuiltinLLMProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(provider);
}

export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderConfig {
  name: string;
  provider: LLMProvider;
  baseURL: string;
  defaultModel: string;
  models: string[];
  envKey: string;
}

/** Chiến thuật chọn candidate (key/provider) khi có nhiều lựa chọn để xoay tua. */
export const LLM_ROTATION_STRATEGIES = ["round_robin", "random", "sequential"] as const;
export type LLMRotationStrategy = typeof LLM_ROTATION_STRATEGIES[number];

export function isLLMRotationStrategy(value: string): value is LLMRotationStrategy {
  return (LLM_ROTATION_STRATEGIES as readonly string[]).includes(value);
}

/** Một API key dự phòng trong pool xoay tua của một provider (ngoài key chính). */
export interface LLMBackupApiKey {
  key: string;
  weight: number;
  isActive: boolean;
  label?: string;
}

/**
 * Mức độ suy luận (reasoning effort) chuẩn hóa, độc lập với cách đặt tên riêng của
 * từng hãng. "none" tắt hẳn suy luận. Model/hãng không hỗ trợ phân mức chỉ dùng được
 * none (tắt) và một mức "bật" duy nhất (áp dụng cho bất kỳ giá trị khác none nào).
 */
export const LLM_REASONING_EFFORT_LEVELS = ["none", "low", "medium", "high"] as const;
export type LLMReasoningEffort = typeof LLM_REASONING_EFFORT_LEVELS[number];

export function isLLMReasoningEffort(value: string): value is LLMReasoningEffort {
  return (LLM_REASONING_EFFORT_LEVELS as readonly string[]).includes(value);
}
