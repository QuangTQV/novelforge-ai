import type { LLMProvider, LLMReasoningEffort, LLMRotationStrategy } from "@ai-novel/shared/types/llm";
import { isLLMReasoningEffort, isLLMRotationStrategy } from "@ai-novel/shared/types/llm";
import type { ModelRouteRequestProtocol } from "@ai-novel/shared/types/novel";
import { ChatOpenAI } from "@langchain/openai";
import type { PromptInvocationMeta } from "../prompting/core/promptTypes";
import { secretStore } from "../services/settings/secretStore";
import { resolveModelTemperature } from "./capabilities";
import { createAnthropicLLM } from "./anthropicClient";
import { attachLLMDebugLogging } from "./debugLogging";
import { attachLLMRequestLimiter } from "./requestLimiter";
import { attachLLMRequestGuard } from "./requestGuard";
import { resolveProviderReasoningBehavior } from "./reasoning";
import {
  resolveStructuredOutputProfile,
  type StructuredExecutionMode,
  type StructuredOutputProfile,
  type StructuredOutputStrategy,
} from "./structuredOutput";
import { attachLLMUsageTracking } from "./usageTracking";
import { resolveModel, toStructuredOutputStrategy, type TaskType } from "./modelRouter";
import {
  getProviderEnvApiKey,
  getProviderEnvModel,
  isBuiltInProvider,
  providerRequiresApiKey,
  PROVIDERS,
  resolveProviderBaseUrl,
} from "./providers";
import {
  buildProviderKeyPool,
  candidateId,
  deprioritizeCandidatesInCooldown,
  orderKeyPool,
  type RotationCandidate,
} from "./providerRotation";
import { attachLLMRotationFailover } from "./rotationFailover";

interface LLMOptions {
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  timeoutMs?: number;
  reasoningEnabled?: boolean;
  /** Mức độ suy luận chuẩn hóa. Ưu tiên cao hơn `reasoningEnabled`; "none" tương đương reasoningEnabled=false. */
  reasoningEffort?: LLMReasoningEffort;
  executionMode?: StructuredExecutionMode;
  structuredStrategy?: StructuredOutputStrategy;
  requestProtocol?: ModelRouteRequestProtocol;
  modelKwargs?: Record<string, unknown>;
  fallbackProvider?: LLMProvider;
  taskType?: TaskType;
  promptMeta?: PromptInvocationMeta;
  modelRoute?: string;
  routeDegraded?: boolean;
}

export interface ProviderSecret {
  key?: string;
  model?: string;
  baseURL?: string;
  displayName?: string;
  reasoningEnabled?: boolean;
  reasoningEffort?: LLMReasoningEffort;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
  rotationStrategy?: LLMRotationStrategy;
  apiKeyWeight?: number;
  backupKeysJson?: string | null;
  cooldownSeconds?: number;
  fallbackOrder?: number | null;
}

export interface ResolvedLLMClientOptions {
  provider: LLMProvider;
  providerName: string;
  model: string;
  temperature: number;
  apiKey?: string;
  baseURL: string;
  maxTokens?: number;
  timeoutMs?: number;
  concurrencyLimit: number;
  requestIntervalMs: number;
  reasoningEnabled: boolean;
  reasoningEffort: LLMReasoningEffort;
  modelKwargs?: Record<string, unknown>;
  includeRawResponse: boolean;
  requestProtocol: ModelRouteRequestProtocol;
  executionMode: StructuredExecutionMode;
  structuredProfile?: StructuredOutputProfile | null;
  structuredStrategy?: StructuredOutputStrategy | null;
  reasoningForcedOff: boolean;
  taskType?: TaskType;
  promptMeta?: PromptInvocationMeta;
  modelRoute?: string;
  routeDegraded?: boolean;
}

const providerSecrets = new Map<LLMProvider, ProviderSecret>();
const RESOLVED_LLM_OPTIONS = Symbol("RESOLVED_LLM_OPTIONS");

type ChatOpenAIWithResolvedOptions = ChatOpenAI & {
  [RESOLVED_LLM_OPTIONS]?: ResolvedLLMClientOptions;
};

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2021"
  );
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeOptionalTimeoutMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeRotationStrategy(value: unknown): LLMRotationStrategy {
  return typeof value === "string" && isLLMRotationStrategy(value) ? value : "round_robin";
}

function normalizeReasoningEffort(value: unknown): LLMReasoningEffort {
  return typeof value === "string" && isLLMReasoningEffort(value) ? value : "medium";
}

function normalizeWeightValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeProviderSecret(secret: ProviderSecret): ProviderSecret {
  return {
    key: normalizeOptionalText(secret.key),
    model: normalizeOptionalText(secret.model),
    baseURL: normalizeOptionalText(secret.baseURL),
    displayName: normalizeOptionalText(secret.displayName),
    reasoningEnabled: secret.reasoningEnabled ?? true,
    reasoningEffort: normalizeReasoningEffort(secret.reasoningEffort),
    concurrencyLimit: normalizeLimitValue(secret.concurrencyLimit),
    requestIntervalMs: normalizeLimitValue(secret.requestIntervalMs),
    rotationStrategy: normalizeRotationStrategy(secret.rotationStrategy),
    apiKeyWeight: normalizeWeightValue(secret.apiKeyWeight, 1),
    backupKeysJson: normalizeOptionalText(secret.backupKeysJson ?? undefined) ?? null,
    cooldownSeconds: normalizeWeightValue(secret.cooldownSeconds, 60),
    fallbackOrder: typeof secret.fallbackOrder === "number" ? secret.fallbackOrder : null,
  };
}

function normalizeLimitValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function toProviderSecret(item: {
  key?: string | null;
  model?: string | null;
  baseURL?: string | null;
  displayName?: string | null;
  reasoningEnabled?: boolean | null;
  reasoningEffort?: string | null;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
  rotationStrategy?: string | null;
  apiKeyWeight?: number | null;
  backupKeysJson?: string | null;
  cooldownSeconds?: number | null;
  fallbackOrder?: number | null;
}): ProviderSecret {
  return normalizeProviderSecret({
    key: item.key ?? undefined,
    model: item.model ?? undefined,
    baseURL: item.baseURL ?? undefined,
    displayName: item.displayName ?? undefined,
    reasoningEnabled: item.reasoningEnabled ?? undefined,
    reasoningEffort: normalizeReasoningEffort(item.reasoningEffort),
    concurrencyLimit: normalizeLimitValue(item.concurrencyLimit),
    requestIntervalMs: normalizeLimitValue(item.requestIntervalMs),
    rotationStrategy: normalizeRotationStrategy(item.rotationStrategy),
    apiKeyWeight: normalizeWeightValue(item.apiKeyWeight, 1),
    backupKeysJson: item.backupKeysJson ?? null,
    cooldownSeconds: normalizeWeightValue(item.cooldownSeconds, 60),
    fallbackOrder: typeof item.fallbackOrder === "number" ? item.fallbackOrder : null,
  });
}

export async function loadProviderApiKeys(): Promise<void> {
  try {
    const keys = await secretStore.listProviders({ onlyActive: true });
    providerSecrets.clear();
    for (const item of keys) {
      providerSecrets.set(item.provider as LLMProvider, toProviderSecret(item));
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }
    throw error;
  }
}

export function setProviderSecretCache(provider: LLMProvider, secret: ProviderSecret | null): void {
  if (!secret) {
    providerSecrets.delete(provider);
    return;
  }
  providerSecrets.set(provider, normalizeProviderSecret(secret));
}

async function resolveProviderSecret(provider: LLMProvider): Promise<ProviderSecret | undefined> {
  const cached = providerSecrets.get(provider);
  if (cached) {
    return cached;
  }
  try {
    const secret = await secretStore.getProvider(provider);
    if (!secret || !secret.isActive) {
      return undefined;
    }
    const value = toProviderSecret(secret);
    providerSecrets.set(provider, value);
    return value;
  } catch (error) {
    if (isMissingTableError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function resolveLLMClientOptions(
  provider?: LLMProvider,
  rawOptions: LLMOptions = {},
): Promise<ResolvedLLMClientOptions> {
  const options: LLMOptions = { ...rawOptions };
  let resolvedProvider = provider ?? options.fallbackProvider ?? "deepseek";
  let resolvedModel = normalizeOptionalText(options.model);
  let resolvedTemperature: number | undefined = options.temperature;
  let resolvedMaxTokens: number | undefined = options.maxTokens;
  let resolvedModelRoute: string | undefined;
  let resolvedRouteDegraded = false;
  let routeReasoningEffort: LLMReasoningEffort | undefined;

  if (options.taskType) {
    const hasExplicitProvider = provider != null;
    const hasExplicitModel = options.model != null;
    const shouldUseRouteProvider = !hasExplicitProvider && !hasExplicitModel;
    const route = await resolveModel(options.taskType, {
      ...(shouldUseRouteProvider ? {} : { provider: resolvedProvider }),
      ...(options.model != null ? { model: options.model } : {}),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.maxTokens != null ? { maxTokens: options.maxTokens } : {}),
    });
    if (shouldUseRouteProvider) {
      resolvedProvider = route.provider;
    }
    if (options.model == null && shouldUseRouteProvider) {
      resolvedModel = normalizeOptionalText(route.model);
    }
    if (options.temperature == null) {
      resolvedTemperature = route.temperature;
    }
    if (options.maxTokens == null) {
      resolvedMaxTokens = route.maxTokens;
    }
    if (options.requestProtocol == null) {
      options.requestProtocol = route.requestProtocol;
    }
    if (options.structuredStrategy == null) {
      const routeStructuredStrategy = toStructuredOutputStrategy(route.structuredResponseFormat);
      if (routeStructuredStrategy) {
        options.structuredStrategy = routeStructuredStrategy;
      }
    }
    resolvedModelRoute = route.routeKey;
    resolvedRouteDegraded = route.routeDegraded;
    routeReasoningEffort = route.reasoningEffort;
  }

  const dbSecret = await resolveProviderSecret(resolvedProvider);
  const providerName = isBuiltInProvider(resolvedProvider)
    ? PROVIDERS[resolvedProvider].name
    : dbSecret?.displayName ?? resolvedProvider;
  const apiKey = normalizeOptionalText(options.apiKey)
    ?? dbSecret?.key
    ?? getProviderEnvApiKey(resolvedProvider);

  if (!apiKey && providerRequiresApiKey(resolvedProvider)) {
    throw new Error(`未配置 ${providerName} 的 API Key。`);
  }

  const model = resolvedModel
    ?? dbSecret?.model
    ?? getProviderEnvModel(resolvedProvider)
    ?? (isBuiltInProvider(resolvedProvider) ? PROVIDERS[resolvedProvider].defaultModel : undefined);
  if (!model) {
    throw new Error(`未配置 ${providerName} 的默认模型。`);
  }

  const baseURL = resolveProviderBaseUrl(
    resolvedProvider,
    options.baseURL ?? dbSecret?.baseURL,
    dbSecret?.baseURL,
  );
  if (!baseURL) {
    throw new Error(`未配置 ${providerName} 的 API URL。`);
  }

  const temperature = resolveModelTemperature(resolvedProvider, model, resolvedTemperature);
  const timeoutMs = normalizeOptionalTimeoutMs(options.timeoutMs);
  const concurrencyLimit = normalizeLimitValue(dbSecret?.concurrencyLimit);
  const requestIntervalMs = normalizeLimitValue(dbSecret?.requestIntervalMs);
  const requestProtocol = options.requestProtocol === "anthropic" ? "anthropic" : "openai_compatible";
  const structuredStrategy = options.structuredStrategy;
  const executionMode = options.executionMode ?? "plain";
  const structuredProfile = executionMode === "structured"
    ? resolveStructuredOutputProfile({
      provider: resolvedProvider,
      model,
      baseURL,
      executionMode,
      requestProtocol,
    })
    : null;
  const usesNativeStructured = structuredStrategy != null && structuredStrategy !== "prompt_json";
  const providerDefaultReasoningEffort: LLMReasoningEffort = dbSecret?.reasoningEnabled === false
    ? "none"
    : dbSecret?.reasoningEffort ?? "medium";
  const requestedReasoningEffort: LLMReasoningEffort = options.reasoningEffort
    ?? (options.reasoningEnabled === false ? "none" : undefined)
    ?? routeReasoningEffort
    ?? providerDefaultReasoningEffort;
  const requestedReasoningEnabled = requestedReasoningEffort !== "none";
  const shouldForceDisableReasoning = Boolean(
    structuredProfile
      && structuredProfile.requiresNonThinkingForStructured
      && structuredProfile.supportsReasoningToggle,
  );
  const reasoningEffort: LLMReasoningEffort = shouldForceDisableReasoning ? "none" : requestedReasoningEffort;
  const reasoningEnabled = reasoningEffort !== "none";
  let effectiveMaxTokens = resolvedMaxTokens;
  if (structuredProfile && usesNativeStructured && structuredProfile.omitMaxTokensForNativeStructured) {
    effectiveMaxTokens = undefined;
  } else if (
    structuredProfile
    && typeof structuredProfile.safeStructuredMaxTokens === "number"
    && typeof effectiveMaxTokens === "number"
  ) {
    effectiveMaxTokens = Math.min(effectiveMaxTokens, structuredProfile.safeStructuredMaxTokens);
  }
  const usesEnableThinkingFlag = Boolean(
    shouldForceDisableReasoning
      && structuredProfile?.family.includes("qwen"),
  );
  const baseModelKwargs: Record<string, unknown> = {
    ...(options.modelKwargs ?? {}),
    ...(usesEnableThinkingFlag ? { enable_thinking: false } : {}),
  };
  const reasoningBehavior = resolveProviderReasoningBehavior({
    provider: resolvedProvider,
    baseURL,
    model,
    reasoningEffort,
  });
  const modelKwargs = {
    ...(reasoningBehavior.modelKwargs ?? {}),
    ...baseModelKwargs,
  };

  return {
    provider: resolvedProvider,
    providerName,
    model,
    temperature,
    apiKey,
    baseURL,
    maxTokens: effectiveMaxTokens,
    timeoutMs,
    concurrencyLimit,
    requestIntervalMs,
    reasoningEnabled: reasoningBehavior.reasoningEnabled,
    reasoningEffort,
    modelKwargs: Object.keys(modelKwargs).length > 0 ? modelKwargs : undefined,
    includeRawResponse: reasoningBehavior.includeRawResponse,
    requestProtocol,
    executionMode,
    structuredProfile,
    structuredStrategy: structuredStrategy ?? null,
    reasoningForcedOff: shouldForceDisableReasoning && requestedReasoningEnabled,
    taskType: options.taskType,
    promptMeta: options.promptMeta,
    modelRoute: resolvedModelRoute,
    routeDegraded: resolvedRouteDegraded,
  };
}

export function createLLMFromResolvedOptions(resolved: ResolvedLLMClientOptions): ChatOpenAI {
  const llm = resolved.requestProtocol === "anthropic"
    ? createAnthropicLLM({
      apiKey: resolved.apiKey,
      model: resolved.model,
      baseURL: resolved.baseURL,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      timeoutMs: resolved.timeoutMs,
      reasoningEffort: resolved.reasoningEffort,
    }) as ChatOpenAI
    : new ChatOpenAI({
      apiKey: resolved.apiKey ?? "ollama",
      model: resolved.model,
      modelName: resolved.model,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      timeout: resolved.timeoutMs,
      modelKwargs: resolved.modelKwargs,
      __includeRawResponse: resolved.includeRawResponse,
      configuration: {
        baseURL: resolved.baseURL,
      },
    });
  const meta = {
    provider: resolved.provider,
    model: resolved.model,
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
    timeoutMs: resolved.timeoutMs,
    taskType: resolved.taskType,
    modelRoute: resolved.modelRoute,
    routeDegraded: resolved.routeDegraded,
    baseURL: resolved.baseURL,
    promptMeta: resolved.promptMeta,
  };
  const decorated = attachLLMDebugLogging(attachLLMUsageTracking(attachLLMRequestGuard(llm, meta), meta), meta);
  const limited = attachLLMRequestLimiter(decorated, {
    provider: resolved.provider,
    model: resolved.model,
    concurrencyLimit: resolved.concurrencyLimit,
    requestIntervalMs: resolved.requestIntervalMs,
  });
  (limited as ChatOpenAIWithResolvedOptions)[RESOLVED_LLM_OPTIONS] = resolved;
  return limited;
}

function dedupeCandidatesById(candidates: RotationCandidate[]): RotationCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) {
      return false;
    }
    seen.add(candidate.id);
    return true;
  });
}

interface RotationPlan {
  first: RotationCandidate;
  rest: RotationCandidate[];
  cooldownMs: number;
}

/**
 * Gộp pool key của provider chính (key chính + backup, xếp theo rotationStrategy của
 * provider đó) với chuỗi fallback liên-provider (các provider khác có `fallbackOrder`,
 * mỗi provider tự xếp pool key của nó theo rotationStrategy riêng). Candidate đang
 * cooldown bị đẩy xuống cuối chứ không loại bỏ hẳn, để luôn còn thứ để thử.
 */
async function buildRotationPlan(
  primaryProvider: LLMProvider,
  primaryApiKeyFromResolve: string | undefined,
): Promise<RotationPlan | null> {
  const primarySecret = await resolveProviderSecret(primaryProvider);
  const cooldownMs = (primarySecret?.cooldownSeconds ?? 60) * 1000;

  const candidates: RotationCandidate[] = [];
  const primaryPool = primarySecret ? buildProviderKeyPool(primarySecret) : [];
  if (primaryPool.length > 0) {
    const cursorId = `${primaryProvider}:${primaryPool.map((entry) => entry.key).join(",")}`;
    const ordered = orderKeyPool(primaryPool, primarySecret?.rotationStrategy ?? "round_robin", cursorId);
    for (const entry of ordered) {
      candidates.push({ id: candidateId(primaryProvider, entry.key), provider: primaryProvider, key: entry.key, isPrimaryProvider: true });
    }
  } else if (primaryApiKeyFromResolve) {
    // Không có row DB (VD chỉ dùng env var) nhưng vẫn resolve ra được key — vẫn cho
    // tham gia làm candidate đầu tiên để chuỗi fallback liên-provider phía sau còn tác dụng.
    candidates.push({
      id: candidateId(primaryProvider, primaryApiKeyFromResolve),
      provider: primaryProvider,
      key: primaryApiKeyFromResolve,
      isPrimaryProvider: true,
    });
  }

  const fallbackEntries = Array.from(providerSecrets.entries())
    .filter(([fbProvider, secret]) => fbProvider !== primaryProvider && typeof secret.fallbackOrder === "number")
    .sort((a, b) => (a[1].fallbackOrder ?? 0) - (b[1].fallbackOrder ?? 0));
  for (const [fbProvider, secret] of fallbackEntries) {
    const pool = buildProviderKeyPool(secret);
    if (pool.length === 0) {
      continue;
    }
    const cursorId = `${fbProvider}:${pool.map((entry) => entry.key).join(",")}`;
    const ordered = orderKeyPool(pool, secret.rotationStrategy ?? "round_robin", cursorId);
    for (const entry of ordered) {
      candidates.push({ id: candidateId(fbProvider, entry.key), provider: fbProvider, key: entry.key, isPrimaryProvider: false });
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  const ordered = deprioritizeCandidatesInCooldown(dedupeCandidatesById(candidates), (candidate) => candidate.id);
  const [first, ...rest] = ordered;
  return { first, rest, cooldownMs };
}

async function buildClientForCandidate(candidate: RotationCandidate, originalOptions: LLMOptions): Promise<ChatOpenAI> {
  const candidateOptions: LLMOptions = candidate.isPrimaryProvider
    ? { ...originalOptions, apiKey: candidate.key }
    : {
      ...originalOptions,
      apiKey: candidate.key,
      model: undefined,
      baseURL: undefined,
      requestProtocol: undefined,
      structuredStrategy: undefined,
      modelKwargs: undefined,
    };
  const resolved = await resolveLLMClientOptions(candidate.provider, candidateOptions);
  return createLLMFromResolvedOptions(resolved);
}

export async function getLLM(provider?: LLMProvider, options: LLMOptions = {}): Promise<ChatOpenAI> {
  const resolved = await resolveLLMClientOptions(provider, options);
  const primaryClient = createLLMFromResolvedOptions(resolved);

  // Một apiKey tường minh do caller truyền vào (VD kiểm tra key trong Settings) nghĩa
  // là họ muốn đúng key đó — không xoay tua sang key/provider khác.
  if (options.apiKey) {
    return primaryClient;
  }

  const plan = await buildRotationPlan(resolved.provider, resolved.apiKey);
  if (!plan || plan.rest.length === 0) {
    return primaryClient;
  }

  const primaryUsesChosenFirstKey = resolved.apiKey === plan.first.key;
  const startingClient = primaryUsesChosenFirstKey
    ? primaryClient
    : createLLMFromResolvedOptions({ ...resolved, apiKey: plan.first.key });

  return attachLLMRotationFailover(
    startingClient,
    plan.first,
    plan.rest,
    (candidate) => buildClientForCandidate(candidate, options),
    {
      cooldownMs: plan.cooldownMs,
      onRotate: ({ from, to, reason }) => {
        console.warn(`[llm.rotation] ${from.provider} → ${to.provider} (reason=${reason ?? "unknown"})`);
      },
    },
  );
}

export function getResolvedLLMClientOptionsFromInstance(llm: ChatOpenAI): ResolvedLLMClientOptions | undefined {
  return (llm as ChatOpenAIWithResolvedOptions)[RESOLVED_LLM_OPTIONS];
}
