import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { BuiltinLLMProvider, LLMBackupApiKey, LLMProvider, LLMReasoningEffort, LLMRotationStrategy } from "@ai-novel/shared/types/llm";
import { LLM_ROTATION_STRATEGIES } from "@ai-novel/shared/types/llm";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { setProviderSecretCache } from "../llm/factory";
import { parseBackupKeys, serializeBackupKeys } from "../llm/providerRotation";
import { evictSharedLimiters } from "../llm/requestLimiter";
import { refreshProviderModels } from "../llm/modelCatalog";
import { llmProviderSchema } from "../llm/providerSchema";
import {
  getProviderEnvApiKey,
  getProviderEnvBaseUrl,
  getProviderEnvModel,
  isBuiltInProvider,
  providerRequiresApiKey,
  PROVIDERS,
  SUPPORTED_PROVIDERS,
} from "../llm/providers";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { ragServices } from "../services/rag";
import { providerBalanceService } from "../services/settings/ProviderBalanceService";
import { secretStore } from "../services/settings/secretStore";
import { embeddingSecretProvider } from "../services/settings/embeddingSecret";
import {
  getDefaultImageModel,
  getImageModelOptions,
  getProviderImageModelMap,
  saveProviderImageModel,
} from "../services/settings/ProviderImageSettingsService";
import { getRagEmbeddingModelOptions } from "../services/settings/RagEmbeddingModelService";
import { getLLMSelectionSettings } from "../services/settings/LLMSelectionSettingsService";
import {
  getRagEmbeddingProviders,
  getRagEmbeddingSettings,
  saveRagEmbeddingSettings,
} from "../services/settings/RagSettingsService";
import {
  getRagRuntimeSettings,
  saveRagRuntimeSettings,
} from "../services/settings/RagRuntimeSettingsService";
import {
  getStyleEngineRuntimeSettings,
  MAX_STYLE_EXTRACTION_TIMEOUT_MS,
  MIN_STYLE_EXTRACTION_TIMEOUT_MS,
  saveStyleEngineRuntimeSettings,
} from "../services/settings/StyleEngineRuntimeSettingsService";
import { registerCustomProviderRoutes } from "./settings/customProviderRoutes";
import { registerLLMSelectionRoutes } from "./settings/llmSelectionRoutes";

const router = Router();
const MAX_PROVIDER_CONCURRENCY_LIMIT = 100;
const MAX_PROVIDER_REQUEST_INTERVAL_MS = 3_600_000;

const providerSchema = z.object({
  provider: llmProviderSchema,
});

const MAX_BACKUP_API_KEYS = 20;
const MAX_COOLDOWN_SECONDS = 3600;

const backupApiKeySchema = z.object({
  key: z.string().trim().min(1),
  weight: z.coerce.number().positive().max(1000).optional(),
  isActive: z.boolean().optional(),
  label: z.string().trim().max(60).optional(),
});

const upsertApiKeySchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  key: z.string().trim().optional(),
  model: z.string().trim().optional(),
  imageModel: z.string().trim().optional(),
  baseURL: z.union([z.string().trim().url("API URL 格式不正确。"), z.literal("")]).optional(),
  isActive: z.boolean().optional(),
  reasoningEnabled: z.boolean().optional(),
  // Mức độ khi reasoningEnabled=true — "none" không hợp lệ ở đây, dùng reasoningEnabled=false để tắt hẳn.
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  concurrencyLimit: z.coerce.number().int().min(0).max(MAX_PROVIDER_CONCURRENCY_LIMIT).optional(),
  requestIntervalMs: z.coerce.number().int().min(0).max(MAX_PROVIDER_REQUEST_INTERVAL_MS).optional(),
  rotationStrategy: z.enum(LLM_ROTATION_STRATEGIES).optional(),
  apiKeyWeight: z.coerce.number().positive().max(1000).optional(),
  backupKeys: z.array(backupApiKeySchema).max(MAX_BACKUP_API_KEYS).optional(),
  cooldownSeconds: z.coerce.number().int().min(1).max(MAX_COOLDOWN_SECONDS).optional(),
  fallbackOrder: z.union([z.coerce.number().int().min(0).max(1000), z.null()]).optional(),
});

const ragEmbeddingProviderSchema = z.object({
  provider: z.string().trim().min(1).max(120),
});

const ragSettingsSchema = z.object({
  embeddingProvider: z.string().trim().min(1).max(120),
  embeddingModel: z.string().trim().min(1),
  embeddingApiKey: z.string().trim().min(1).optional(),
  embeddingBaseURL: z.string().trim().url("向量服务 API 地址格式不正确。").optional(),
  collectionMode: z.enum(["auto", "manual"]),
  collectionName: z.string().trim().min(1),
  collectionTag: z.string().trim().min(1),
  autoReindexOnChange: z.boolean(),
  embeddingBatchSize: z.coerce.number().int().min(1).max(256),
  embeddingTimeoutMs: z.coerce.number().int().min(5000).max(300000),
  embeddingMaxRetries: z.coerce.number().int().min(0).max(8),
  embeddingRetryBaseMs: z.coerce.number().int().min(100).max(10000),
  embeddingConcurrency: z.coerce.number().int().min(1).max(16),
  enabled: z.boolean(),
  qdrantUrl: z.string().trim().min(1),
  qdrantApiKey: z.string().optional(),
  clearQdrantApiKey: z.boolean().optional(),
  qdrantTimeoutMs: z.coerce.number().int().min(1000).max(300000),
  qdrantUpsertMaxBytes: z.coerce.number().int().min(1024 * 1024).max(64 * 1024 * 1024),
  qdrantUpsertConcurrency: z.coerce.number().int().min(1).max(16),
  chunkSize: z.coerce.number().int().min(200).max(4000),
  chunkOverlap: z.coerce.number().int().min(0).max(1000),
  vectorCandidates: z.coerce.number().int().min(1).max(200),
  keywordCandidates: z.coerce.number().int().min(1).max(200),
  finalTopK: z.coerce.number().int().min(1).max(50),
  workerPollMs: z.coerce.number().int().min(200).max(60000),
  workerMaxAttempts: z.coerce.number().int().min(1).max(20),
  workerRetryBaseMs: z.coerce.number().int().min(1000).max(300000),
  httpTimeoutMs: z.coerce.number().int().min(1000).max(300000),
});

const styleEngineRuntimeSettingsSchema = z.object({
  styleExtractionTimeoutMs: z.coerce
    .number()
    .int()
    .min(MIN_STYLE_EXTRACTION_TIMEOUT_MS)
    .max(MAX_STYLE_EXTRACTION_TIMEOUT_MS),
});

type APIKeyRecordLike = {
  provider: string;
  displayName: string | null;
  key: string | null;
  model: string | null;
  baseURL: string | null;
  isActive: boolean;
  reasoningEnabled?: boolean | null;
  reasoningEffort?: string | null;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
  rotationStrategy?: string | null;
  apiKeyWeight?: number | null;
  backupKeysJson?: string | null;
  cooldownSeconds?: number | null;
  fallbackOrder?: number | null;
};

type BuiltInProviderStatus = {
  provider: BuiltinLLMProvider;
  kind: "builtin";
  name: string;
  displayName?: string;
  currentModel: string;
  currentImageModel: string | null;
  currentBaseURL: string;
  models: string[];
  imageModels: string[];
  defaultModel: string;
  defaultImageModel: string | null;
  defaultBaseURL: string;
  requiresApiKey: boolean;
  isConfigured: boolean;
  isActive: boolean;
  reasoningEnabled: boolean;
  reasoningEffort: LLMReasoningEffort;
  concurrencyLimit: number;
  requestIntervalMs: number;
  supportsImageGeneration: boolean;
  rotationStrategy: LLMRotationStrategy;
  apiKeyWeight: number;
  backupKeys: LLMBackupApiKey[];
  cooldownSeconds: number;
  fallbackOrder: number | null;
};

type CustomProviderStatus = {
  provider: string;
  kind: "custom";
  name: string;
  displayName?: string;
  currentModel: string;
  currentImageModel: string | null;
  currentBaseURL: string;
  models: string[];
  imageModels: string[];
  defaultModel: string;
  defaultImageModel: null;
  defaultBaseURL: string;
  requiresApiKey: boolean;
  isConfigured: boolean;
  isActive: boolean;
  reasoningEnabled: boolean;
  reasoningEffort: LLMReasoningEffort;
  concurrencyLimit: number;
  requestIntervalMs: number;
  supportsImageGeneration: boolean;
  rotationStrategy: LLMRotationStrategy;
  apiKeyWeight: number;
  backupKeys: LLMBackupApiKey[];
  cooldownSeconds: number;
  fallbackOrder: number | null;
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeProviderLimit(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function getFallbackModels(provider: LLMProvider, currentModel?: string): string[] {
  const models = isBuiltInProvider(provider) ? PROVIDERS[provider].models : [];
  return Array.from(new Set([...models, currentModel ?? ""].filter(Boolean)));
}

function normalizeRotationStrategy(value: string | null | undefined): LLMRotationStrategy {
  return value === "random" || value === "sequential" ? value : "round_robin";
}

/** Chuẩn hóa mức suy luận lưu trong DB — chỉ low/medium/high, "none" biểu diễn qua reasoningEnabled=false riêng. */
function normalizeStoredReasoningEffort(value: string | null | undefined): "low" | "medium" | "high" {
  return value === "low" || value === "high" ? value : "medium";
}

/** Gộp `reasoningEnabled` (bật/tắt) + `reasoningEffort` (mức khi bật) lưu trong DB thành 1 giá trị cho client. */
function combineReasoningEffort(
  reasoningEnabled: boolean | null | undefined,
  reasoningEffort: string | null | undefined,
): LLMReasoningEffort {
  if (reasoningEnabled === false) {
    return "none";
  }
  return reasoningEffort === "low" || reasoningEffort === "high" ? reasoningEffort : "medium";
}

function buildBuiltInProviderStatus(
  provider: BuiltinLLMProvider,
  item: {
    displayName?: string | null;
    key?: string | null;
    model?: string | null;
    baseURL?: string | null;
    isActive?: boolean;
    reasoningEnabled?: boolean | null;
    reasoningEffort?: string | null;
    concurrencyLimit?: number | null;
    requestIntervalMs?: number | null;
    rotationStrategy?: string | null;
    apiKeyWeight?: number | null;
    backupKeysJson?: string | null;
    cooldownSeconds?: number | null;
    fallbackOrder?: number | null;
  } | undefined,
  imageModel: string | undefined,
): BuiltInProviderStatus {
  const savedKey = normalizeOptionalText(item?.key);
  const envKey = getProviderEnvApiKey(provider);
  const effectiveKey = savedKey ?? envKey;
  const savedBaseURL = normalizeOptionalText(item?.baseURL);
  const configuredModel = normalizeOptionalText(item?.model) ?? getProviderEnvModel(provider);
  const currentBaseURL = savedBaseURL
    ?? getProviderEnvBaseUrl(provider)
    ?? PROVIDERS[provider].baseURL;
  const requiresApiKey = providerRequiresApiKey(provider);
  const models = getFallbackModels(provider, configuredModel);
  const currentModel = configuredModel ?? models[0] ?? "";
  const currentImageModel = imageModel ?? getDefaultImageModel(provider) ?? null;
  const isConfigured = requiresApiKey ? Boolean(effectiveKey && currentModel) : Boolean(currentModel && currentBaseURL);

  return {
    provider,
    kind: "builtin",
    name: PROVIDERS[provider].name,
    displayName: undefined,
    currentModel,
    currentImageModel,
    currentBaseURL,
    models,
    imageModels: Array.from(new Set([...getImageModelOptions(provider), currentImageModel ?? ""].filter(Boolean))),
    defaultModel: PROVIDERS[provider].defaultModel,
    defaultImageModel: getDefaultImageModel(provider) ?? null,
    defaultBaseURL: PROVIDERS[provider].baseURL,
    requiresApiKey,
    isConfigured,
    isActive: item?.isActive ?? isConfigured,
    reasoningEnabled: item?.reasoningEnabled ?? true,
    reasoningEffort: combineReasoningEffort(item?.reasoningEnabled, item?.reasoningEffort),
    concurrencyLimit: normalizeProviderLimit(item?.concurrencyLimit),
    requestIntervalMs: normalizeProviderLimit(item?.requestIntervalMs),
    supportsImageGeneration: Boolean(currentImageModel),
    rotationStrategy: normalizeRotationStrategy(item?.rotationStrategy),
    apiKeyWeight: item?.apiKeyWeight && item.apiKeyWeight > 0 ? item.apiKeyWeight : 1,
    backupKeys: parseBackupKeys(item?.backupKeysJson),
    cooldownSeconds: item?.cooldownSeconds && item.cooldownSeconds > 0 ? item.cooldownSeconds : 60,
    fallbackOrder: typeof item?.fallbackOrder === "number" ? item.fallbackOrder : null,
  };
}

function buildCustomProviderStatus(item: {
  provider: string;
  displayName: string | null;
  key: string | null;
  model: string | null;
  baseURL: string | null;
  isActive: boolean;
  reasoningEnabled?: boolean | null;
  reasoningEffort?: string | null;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
  rotationStrategy?: string | null;
  apiKeyWeight?: number | null;
  backupKeysJson?: string | null;
  cooldownSeconds?: number | null;
  fallbackOrder?: number | null;
}, imageModel: string | undefined): CustomProviderStatus {
  const currentModel = normalizeOptionalText(item.model) ?? "";
  const currentBaseURL = normalizeOptionalText(item.baseURL) ?? "";
  const models = currentModel ? [currentModel] : [];
  return {
    provider: item.provider,
    kind: "custom",
    name: normalizeOptionalText(item.displayName) ?? item.provider,
    displayName: normalizeOptionalText(item.displayName) ?? item.provider,
    currentModel,
    currentImageModel: imageModel ?? null,
    currentBaseURL,
    models,
    imageModels: imageModel ? [imageModel] : [],
    defaultModel: currentModel,
    defaultImageModel: null,
    defaultBaseURL: currentBaseURL,
    requiresApiKey: false,
    isConfigured: Boolean(currentModel && currentBaseURL),
    isActive: item.isActive,
    reasoningEnabled: item.reasoningEnabled ?? true,
    reasoningEffort: combineReasoningEffort(item.reasoningEnabled, item.reasoningEffort),
    concurrencyLimit: normalizeProviderLimit(item.concurrencyLimit),
    requestIntervalMs: normalizeProviderLimit(item.requestIntervalMs),
    supportsImageGeneration: Boolean(imageModel),
    rotationStrategy: normalizeRotationStrategy(item.rotationStrategy),
    apiKeyWeight: item.apiKeyWeight && item.apiKeyWeight > 0 ? item.apiKeyWeight : 1,
    backupKeys: parseBackupKeys(item.backupKeysJson),
    cooldownSeconds: item.cooldownSeconds && item.cooldownSeconds > 0 ? item.cooldownSeconds : 60,
    fallbackOrder: typeof item.fallbackOrder === "number" ? item.fallbackOrder : null,
  };
}

router.use(authMiddleware);
registerCustomProviderRoutes(router);
registerLLMSelectionRoutes(router);

router.get("/style-engine-runtime", async (_req, res, next) => {
  try {
    const data = await getStyleEngineRuntimeSettings();
    res.status(200).json({
      success: true,
      data,
      message: "写法引擎运行设置读取成功。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/style-engine-runtime",
  validate({ body: styleEngineRuntimeSettingsSchema }),
  async (req, res, next) => {
    try {
      const data = await saveStyleEngineRuntimeSettings(req.body as z.infer<typeof styleEngineRuntimeSettingsSchema>);
      res.status(200).json({
        success: true,
        data,
        message: "写法引擎运行设置保存成功。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/rag", async (_req, res, next) => {
  try {
    const [embeddingSettings, runtimeSettings, providers] = await Promise.all([
      getRagEmbeddingSettings(),
      getRagRuntimeSettings(),
      getRagEmbeddingProviders(),
    ]);
    const data = {
      ...embeddingSettings,
      ...runtimeSettings,
      providers,
    };
    res.status(200).json({
      success: true,
      data,
      message: "Loaded RAG settings.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/rag",
  validate({ body: ragSettingsSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof ragSettingsSchema>;
      if (body.embeddingApiKey || body.embeddingBaseURL) {
        // Credential embedding lưu ở không gian riêng ("embedding:<provider>") để không
        // đè lên cấu hình LLM cùng nhà cung cấp.
        const embeddingSecretKey = embeddingSecretProvider(body.embeddingProvider);
        const existing = await secretStore.getProvider(embeddingSecretKey);
        const record = await secretStore.upsertProvider(embeddingSecretKey, {
          key: body.embeddingApiKey ?? existing?.key ?? null,
          baseURL: body.embeddingBaseURL
            ?? existing?.baseURL
            ?? (isBuiltInProvider(body.embeddingProvider) ? PROVIDERS[body.embeddingProvider].baseURL : null),
          isActive: true,
        });
        setProviderSecretCache(embeddingSecretKey, record.isActive ? {
          displayName: record.displayName ?? undefined,
          key: record.key ?? undefined,
          model: record.model ?? undefined,
          baseURL: record.baseURL ?? undefined,
          reasoningEnabled: record.reasoningEnabled ?? true,
          concurrencyLimit: record.concurrencyLimit ?? 0,
          requestIntervalMs: record.requestIntervalMs ?? 0,
        } : null);
        evictSharedLimiters(embeddingSecretKey);
      }
      const [embeddingResult, runtimeResult] = await Promise.all([
        saveRagEmbeddingSettings({
          embeddingProvider: body.embeddingProvider,
          embeddingModel: body.embeddingModel,
          collectionMode: body.collectionMode,
          collectionName: body.collectionName,
          collectionTag: body.collectionTag,
          autoReindexOnChange: body.autoReindexOnChange,
          embeddingBatchSize: body.embeddingBatchSize,
          embeddingTimeoutMs: body.embeddingTimeoutMs,
          embeddingMaxRetries: body.embeddingMaxRetries,
          embeddingRetryBaseMs: body.embeddingRetryBaseMs,
          embeddingConcurrency: body.embeddingConcurrency,
        }),
        saveRagRuntimeSettings({
          enabled: body.enabled,
          qdrantUrl: body.qdrantUrl,
          qdrantApiKey: body.qdrantApiKey,
          clearQdrantApiKey: body.clearQdrantApiKey,
          qdrantTimeoutMs: body.qdrantTimeoutMs,
          qdrantUpsertMaxBytes: body.qdrantUpsertMaxBytes,
          qdrantUpsertConcurrency: body.qdrantUpsertConcurrency,
          chunkSize: body.chunkSize,
          chunkOverlap: body.chunkOverlap,
          vectorCandidates: body.vectorCandidates,
          keywordCandidates: body.keywordCandidates,
          finalTopK: body.finalTopK,
          workerPollMs: body.workerPollMs,
          workerMaxAttempts: body.workerMaxAttempts,
          workerRetryBaseMs: body.workerRetryBaseMs,
          httpTimeoutMs: body.httpTimeoutMs,
        }),
      ]);

      if (runtimeResult.settings.enabled) {
        ragServices.ragWorker.start();
      } else {
        ragServices.ragWorker.stop();
      }

      const shouldReindex = (embeddingResult.shouldReindex || runtimeResult.shouldReindex)
        && embeddingResult.settings.autoReindexOnChange
        && runtimeResult.settings.enabled;

      let reindexQueuedCount = 0;
      let message = "Saved RAG settings.";
      if (shouldReindex) {
        const reindexResult = await ragServices.ragIndexService.enqueueReindex("all");
        reindexQueuedCount = reindexResult.count;
        message = `Saved RAG settings and queued ${reindexQueuedCount} reindex job(s).`;
      } else if ((embeddingResult.shouldReindex || runtimeResult.shouldReindex) && !runtimeResult.settings.enabled) {
        message = "Saved RAG settings. Reindex was skipped because RAG is currently disabled.";
      }

      const providers = await getRagEmbeddingProviders();
      const data = {
        ...embeddingResult.settings,
        ...runtimeResult.settings,
        reindexQueuedCount,
        providers,
      };
      res.status(200).json({
        success: true,
        data,
        message,
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/rag/models/:provider",
  validate({ params: ragEmbeddingProviderSchema }),
  async (req, res, next) => {
    try {
      const { provider } = req.params as z.infer<typeof ragEmbeddingProviderSchema>;
      const data = await getRagEmbeddingModelOptions(provider);
      res.status(200).json({
        success: true,
        data,
        message: "Loaded embedding models.",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/api-keys", async (_req, res, next) => {
  try {
    const keys = await secretStore.listProviders();
    const keyMap = new Map(keys.map((item) => [item.provider, item]));
    const allProviders = Array.from(new Set([
      ...SUPPORTED_PROVIDERS,
      ...keys.map((item) => item.provider),
    ]));
    const imageModelMap = await getProviderImageModelMap(allProviders);
    const builtInProviders = SUPPORTED_PROVIDERS.map((provider) =>
      buildBuiltInProviderStatus(provider, keyMap.get(provider), imageModelMap.get(provider)),
    );
    const customProviders = keys
      .filter((item) => !isBuiltInProvider(item.provider))
      .map((item) => buildCustomProviderStatus(item, imageModelMap.get(item.provider)));
    const data = [...builtInProviders, ...customProviders];
    res.status(200).json({
      success: true,
      data,
      message: "厂商配置已加载。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.get("/api-keys/balances", async (_req, res, next) => {
  try {
    const keys = await secretStore.listProviders({ providers: SUPPORTED_PROVIDERS });
    const keyMap = new Map(
      SUPPORTED_PROVIDERS.map((provider) => {
        const record = keys.find((item) => item.provider === provider);
        return [provider, normalizeOptionalText(record?.key) ?? getProviderEnvApiKey(provider)] as const;
      }),
    );
    const data = await providerBalanceService.listBalances(keyMap);
    res.status(200).json({
      success: true,
      data,
      message: "Loaded provider balances.",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/api-keys/:provider",
  validate({ params: providerSchema, body: upsertApiKeySchema }),
  async (req, res, next) => {
    try {
      const { provider } = req.params as z.infer<typeof providerSchema>;
      const body = req.body as z.infer<typeof upsertApiKeySchema>;
      const existing = await secretStore.getProvider(provider);
      const existingRecord = existing as APIKeyRecordLike | null;
      if (!isBuiltInProvider(provider) && !existing) {
        throw new AppError("没有找到这个自定义厂商。", 404);
      }

      const nextKey = normalizeOptionalText(body.key) ?? normalizeOptionalText(existingRecord?.key);
      const envKey = getProviderEnvApiKey(provider);
      const effectiveKey = nextKey ?? envKey;
      const nextModel = normalizeOptionalText(body.model) ?? normalizeOptionalText(existingRecord?.model);
      const nextBaseURL = body.baseURL !== undefined
        ? normalizeOptionalText(body.baseURL)
        : normalizeOptionalText(existingRecord?.baseURL);
      const nextDisplayName = !isBuiltInProvider(provider)
        ? normalizeOptionalText(body.displayName) ?? normalizeOptionalText(existingRecord?.displayName) ?? provider
        : undefined;
      const nextReasoningEnabled = body.reasoningEnabled ?? existingRecord?.reasoningEnabled ?? true;
      const nextReasoningEffort = body.reasoningEffort ?? normalizeStoredReasoningEffort(existingRecord?.reasoningEffort);
      const nextConcurrencyLimit = body.concurrencyLimit ?? normalizeProviderLimit(existingRecord?.concurrencyLimit);
      const nextRequestIntervalMs = body.requestIntervalMs ?? normalizeProviderLimit(existingRecord?.requestIntervalMs);
      const nextRotationStrategy = body.rotationStrategy ?? normalizeRotationStrategy(existingRecord?.rotationStrategy);
      const nextApiKeyWeight = body.apiKeyWeight ?? (existingRecord?.apiKeyWeight && existingRecord.apiKeyWeight > 0 ? existingRecord.apiKeyWeight : 1);
      const nextBackupKeysJson = body.backupKeys !== undefined
        ? serializeBackupKeys(body.backupKeys.map((item) => ({
          key: item.key,
          weight: item.weight ?? 1,
          isActive: item.isActive ?? true,
          ...(item.label ? { label: item.label } : {}),
        })))
        : existingRecord?.backupKeysJson ?? null;
      const nextCooldownSeconds = body.cooldownSeconds ?? (existingRecord?.cooldownSeconds && existingRecord.cooldownSeconds > 0 ? existingRecord.cooldownSeconds : 60);
      const nextFallbackOrder = body.fallbackOrder !== undefined ? body.fallbackOrder : existingRecord?.fallbackOrder ?? null;
      const requiresApiKey = providerRequiresApiKey(provider);

      if (body.isActive === false) {
        const [routeInUse, selection, ragSettings, ragRuntimeSettings] = await Promise.all([
          prisma.modelRouteConfig.findFirst({ where: { provider }, select: { taskType: true } }),
          getLLMSelectionSettings(),
          getRagEmbeddingSettings(),
          getRagRuntimeSettings(),
        ]);
        if (routeInUse) {
          throw new AppError(`模型路由 ${routeInUse.taskType} 正在使用这个厂商，请先改用其他厂商。`, 400);
        }
        if (selection?.provider === provider) {
          throw new AppError("顶部默认模型正在使用这个厂商，请先切换默认模型。", 400);
        }
        if (ragRuntimeSettings.enabled && ragSettings.embeddingProvider === provider) {
          throw new AppError("知识库正在使用这个向量服务，请先切换向量服务或暂停资料检索。", 400);
        }
      }

      if (requiresApiKey && !effectiveKey) {
        throw new AppError("请先填写 API Key。", 400);
      }
      if (!isBuiltInProvider(provider) && !nextModel) {
        throw new AppError("请先为自定义厂商选择或填写默认模型。", 400);
      }
      if (!isBuiltInProvider(provider) && !nextBaseURL) {
        throw new AppError("请先填写自定义厂商的 API URL。", 400);
      }

      const data = (isBuiltInProvider(provider)
        ? await secretStore.upsertProvider(provider, {
          key: nextKey ?? null,
          model: nextModel ?? null,
          baseURL: nextBaseURL ?? null,
          isActive: body.isActive ?? true,
          reasoningEnabled: nextReasoningEnabled,
          reasoningEffort: nextReasoningEffort,
          concurrencyLimit: nextConcurrencyLimit,
          requestIntervalMs: nextRequestIntervalMs,
          rotationStrategy: nextRotationStrategy,
          apiKeyWeight: nextApiKeyWeight,
          backupKeysJson: nextBackupKeysJson,
          cooldownSeconds: nextCooldownSeconds,
          fallbackOrder: nextFallbackOrder,
        })
        : await secretStore.updateProvider(provider, {
          displayName: nextDisplayName,
          key: nextKey ?? null,
          model: nextModel ?? null,
          baseURL: nextBaseURL ?? null,
          isActive: body.isActive ?? existingRecord?.isActive ?? true,
          reasoningEnabled: nextReasoningEnabled,
          reasoningEffort: nextReasoningEffort,
          concurrencyLimit: nextConcurrencyLimit,
          requestIntervalMs: nextRequestIntervalMs,
          rotationStrategy: nextRotationStrategy,
          apiKeyWeight: nextApiKeyWeight,
          backupKeysJson: nextBackupKeysJson,
          cooldownSeconds: nextCooldownSeconds,
          fallbackOrder: nextFallbackOrder,
        })) as APIKeyRecordLike;

      const currentImageModel = body.imageModel !== undefined
        ? await saveProviderImageModel(provider, body.imageModel)
        : await getProviderImageModelMap([provider]).then((map) => map.get(provider) ?? null);
      const imageModels = Array.from(new Set([
        ...getImageModelOptions(provider),
        currentImageModel ?? "",
      ].filter(Boolean)));

      setProviderSecretCache(provider, data.isActive ? {
        displayName: data.displayName ?? undefined,
        key: data.key ?? undefined,
        model: data.model ?? undefined,
        baseURL: data.baseURL ?? undefined,
        reasoningEnabled: data.reasoningEnabled ?? true,
        reasoningEffort: normalizeStoredReasoningEffort(data.reasoningEffort),
        concurrencyLimit: data.concurrencyLimit ?? 0,
        requestIntervalMs: data.requestIntervalMs ?? 0,
        rotationStrategy: normalizeRotationStrategy(data.rotationStrategy),
        apiKeyWeight: data.apiKeyWeight ?? 1,
        backupKeysJson: data.backupKeysJson ?? null,
        cooldownSeconds: data.cooldownSeconds ?? 60,
        fallbackOrder: data.fallbackOrder ?? null,
      } : null);
      evictSharedLimiters(provider);

      let models = getFallbackModels(provider, data.model ?? undefined);
      let message = "厂商配置已保存。";
      try {
        models = await refreshProviderModels(provider, effectiveKey, nextBaseURL ?? getProviderEnvBaseUrl(provider));
      } catch {
        message = "厂商配置已保存，但模型列表刷新失败。可以稍后在厂商卡片中刷新。";
      }

      res.status(200).json({
        success: true,
        data: {
          provider: data.provider,
          displayName: data.displayName,
          model: data.model,
          imageModel: currentImageModel ?? null,
          baseURL: data.baseURL,
          isActive: data.isActive,
          reasoningEnabled: data.reasoningEnabled ?? true,
          reasoningEffort: combineReasoningEffort(data.reasoningEnabled, data.reasoningEffort),
          concurrencyLimit: normalizeProviderLimit(data.concurrencyLimit),
          requestIntervalMs: normalizeProviderLimit(data.requestIntervalMs),
          models,
          imageModels,
          supportsImageGeneration: Boolean(currentImageModel),
          rotationStrategy: normalizeRotationStrategy(data.rotationStrategy),
          apiKeyWeight: data.apiKeyWeight && data.apiKeyWeight > 0 ? data.apiKeyWeight : 1,
          backupKeys: parseBackupKeys(data.backupKeysJson),
          cooldownSeconds: data.cooldownSeconds && data.cooldownSeconds > 0 ? data.cooldownSeconds : 60,
          fallbackOrder: data.fallbackOrder ?? null,
        },
        message,
      } satisfies ApiResponse<{
        provider: string;
        displayName: string | null;
        model: string | null;
        imageModel: string | null;
        baseURL: string | null;
        isActive: boolean;
        reasoningEnabled: boolean;
        reasoningEffort: LLMReasoningEffort;
        concurrencyLimit: number;
        requestIntervalMs: number;
        models: string[];
        imageModels: string[];
        supportsImageGeneration: boolean;
        rotationStrategy: LLMRotationStrategy;
        apiKeyWeight: number;
        backupKeys: LLMBackupApiKey[];
        cooldownSeconds: number;
        fallbackOrder: number | null;
      }>);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/api-keys/:provider/refresh-balance",
  validate({ params: providerSchema }),
  async (req, res, next) => {
    try {
      const { provider } = req.params as z.infer<typeof providerSchema>;
      if (!isBuiltInProvider(provider)) {
        throw new AppError("自定义厂商暂不支持刷新余额。", 400);
      }
      const keyConfig = await secretStore.getProvider(provider);
      const data = await providerBalanceService.getProviderBalance({
        provider,
        apiKey: normalizeOptionalText(keyConfig?.key) ?? getProviderEnvApiKey(provider),
      });
      res.status(200).json({
        success: true,
        data,
        message: data.status === "available" ? "Refreshed provider balance." : data.message,
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/api-keys/:provider/refresh-models",
  validate({ params: providerSchema }),
  async (req, res, next) => {
    try {
      const { provider } = req.params as z.infer<typeof providerSchema>;
      const keyConfig = await secretStore.getProvider(provider);
      const effectiveKey = normalizeOptionalText(keyConfig?.key) ?? getProviderEnvApiKey(provider);
      if (providerRequiresApiKey(provider) && !effectiveKey) {
        throw new AppError("请先配置 API Key，再刷新模型列表。", 400);
      }
      const models = await refreshProviderModels(
        provider,
        effectiveKey,
        normalizeOptionalText(keyConfig?.baseURL) ?? getProviderEnvBaseUrl(provider),
      );
      const currentModel = normalizeOptionalText(keyConfig?.model)
        ?? getProviderEnvModel(provider)
        ?? (isBuiltInProvider(provider) ? PROVIDERS[provider].defaultModel : "");
      res.status(200).json({
        success: true,
        data: {
          provider,
          models,
          currentModel,
        },
        message: "模型列表已刷新。",
      } satisfies ApiResponse<{
        provider: string;
        models: string[];
        currentModel: string;
      }>);
    } catch (error) {
      if (error instanceof Error && /failed|empty/i.test(error.message)) {
        next(new AppError(error.message, 400));
        return;
      }
      next(error);
    }
  },
);

export default router;
