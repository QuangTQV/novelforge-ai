import type { LLMBackupApiKey, LLMProvider, LLMRotationStrategy } from "@ai-novel/shared/types/llm";

/** Một API key hợp lệ trong pool xoay tua của một provider, đã gộp key chính + backup. */
export interface KeyPoolEntry {
  key: string;
  weight: number;
}

/** Một candidate đầy đủ để thử gọi LLM: provider + key cụ thể (có thể khác provider chính khi fallback liên-provider). */
export interface RotationCandidate {
  /** Định danh ổn định dùng để theo dõi cooldown, không đổi giữa các lần gọi. */
  id: string;
  provider: LLMProvider;
  key: string;
  /** true nếu đây là candidate của chính provider được yêu cầu ban đầu (không phải fallback sang provider khác). */
  isPrimaryProvider: boolean;
}

export function candidateId(provider: LLMProvider, key: string): string {
  return `${provider}::${key}`;
}

// ─── Parse / serialize backup key pool (lưu dạng JSON trên APIKey.backupKeysJson) ───

export function parseBackupKeys(json: string | null | undefined): LLMBackupApiKey[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const result: LLMBackupApiKey[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key.trim() : "";
      if (!key) {
        continue;
      }
      const weight = typeof record.weight === "number" && Number.isFinite(record.weight) && record.weight > 0
        ? record.weight
        : 1;
      const isActive = record.isActive !== false;
      const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : undefined;
      result.push({ key, weight, isActive, ...(label ? { label } : {}) });
    }
    return result;
  } catch {
    return [];
  }
}

export function serializeBackupKeys(keys: LLMBackupApiKey[]): string {
  return JSON.stringify(keys.map((item) => ({
    key: item.key,
    weight: item.weight > 0 ? item.weight : 1,
    isActive: item.isActive !== false,
    ...(item.label ? { label: item.label } : {}),
  })));
}

// ─── Xây dựng và sắp xếp pool key của MỘT provider ───

export function buildProviderKeyPool(secret: {
  key?: string | null;
  apiKeyWeight?: number | null;
  backupKeysJson?: string | null;
}): KeyPoolEntry[] {
  const entries: KeyPoolEntry[] = [];
  const primaryKey = secret.key?.trim();
  if (primaryKey) {
    const weight = typeof secret.apiKeyWeight === "number" && secret.apiKeyWeight > 0 ? secret.apiKeyWeight : 1;
    entries.push({ key: primaryKey, weight });
  }
  for (const backup of parseBackupKeys(secret.backupKeysJson)) {
    if (backup.isActive) {
      entries.push({ key: backup.key, weight: backup.weight });
    }
  }
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) {
      return false;
    }
    seen.add(entry.key);
    return true;
  });
}

/** Xáo trộn có trọng số toàn phần (weighted permutation) — key trọng số cao vẫn có xu hướng đứng đầu, nhưng không cố định. */
export function weightedShuffle<T extends { weight: number }>(items: T[]): T[] {
  const pool = items.slice();
  const result: T[] = [];
  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + Math.max(item.weight, 0.0001), 0);
    let roll = Math.random() * totalWeight;
    let pickIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= Math.max(pool[i].weight, 0.0001);
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }
    result.push(pool[pickIndex]);
    pool.splice(pickIndex, 1);
  }
  return result;
}

const roundRobinCursors = new Map<string, number>();

function nextRoundRobinOffset(cursorId: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  const current = roundRobinCursors.get(cursorId) ?? 0;
  roundRobinCursors.set(cursorId, (current + 1) % length);
  return current % length;
}

function rotateArray<T>(items: T[], offset: number): T[] {
  if (items.length === 0) {
    return items;
  }
  const n = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

/**
 * Sắp xếp pool key theo chiến thuật xoay tua. `cursorId` phải ổn định cho cùng một
 * provider + tập key (để round_robin luân phiên đúng qua nhiều request liên tiếp).
 */
export function orderKeyPool(
  pool: KeyPoolEntry[],
  strategy: LLMRotationStrategy,
  cursorId: string,
): KeyPoolEntry[] {
  if (pool.length <= 1) {
    return pool;
  }
  if (strategy === "random") {
    return weightedShuffle(pool);
  }
  if (strategy === "round_robin") {
    return rotateArray(pool, nextRoundRobinOffset(cursorId, pool.length));
  }
  return pool;
}

export function resetRoundRobinCursorsForTests(): void {
  roundRobinCursors.clear();
}

// ─── Cooldown: tạm ẩn một candidate vừa lỗi rate-limit/hết quota trong T giây ───

const cooldownExpiryByCandidateId = new Map<string, number>();

export function isCandidateInCooldown(id: string, now: number = Date.now()): boolean {
  const expiresAt = cooldownExpiryByCandidateId.get(id);
  if (expiresAt === undefined) {
    return false;
  }
  if (now >= expiresAt) {
    cooldownExpiryByCandidateId.delete(id);
    return false;
  }
  return true;
}

export function markCandidateCooldown(id: string, ms: number, now: number = Date.now()): void {
  if (ms <= 0) {
    return;
  }
  const existing = cooldownExpiryByCandidateId.get(id);
  const expiresAt = now + ms;
  if (existing === undefined || expiresAt > existing) {
    cooldownExpiryByCandidateId.set(id, expiresAt);
  }
}

export function clearCandidateCooldown(id: string): void {
  cooldownExpiryByCandidateId.delete(id);
}

export function resetCooldownsForTests(): void {
  cooldownExpiryByCandidateId.clear();
}

/** Đẩy các candidate đang cooldown xuống cuối danh sách, giữ nguyên thứ tự tương đối còn lại. */
export function deprioritizeCandidatesInCooldown<T>(items: T[], idOf: (item: T) => string): T[] {
  const available: T[] = [];
  const cooling: T[] = [];
  for (const item of items) {
    if (isCandidateInCooldown(idOf(item))) {
      cooling.push(item);
    } else {
      available.push(item);
    }
  }
  return [...available, ...cooling];
}

// ─── Phân loại lỗi: có nên xoay sang candidate kế tiếp không, và cooldown bao lâu ───

export type RotationTriggerReason =
  | "rate_limit"
  | "insufficient_quota"
  | "invalid_key"
  | "content_filter"
  | "server_error"
  | "timeout"
  | null;

export interface RotationTriggerResult {
  shouldRotate: boolean;
  cooldownMs: number;
  reason: RotationTriggerReason;
}

const RATE_LIMIT_PATTERNS = [/rate[\s_-]?limit/i, /too many requests/i, /\b429\b/];
const QUOTA_PATTERNS = [
  /insufficient[\s_-]?quota/i,
  /insufficient[\s_-]?balance/i,
  /exceeded.*quota/i,
  /account.*balance.*(low|insufficient|exhausted)/i,
  /\b402\b/,
];
const AUTH_PATTERNS = [
  /invalid api key/i,
  /incorrect api key/i,
  /invalid_api_key/i,
  /unauthorized/i,
  /permission denied/i,
  /\b401\b/,
  /\b403\b/,
];
const CONTENT_FILTER_PATTERNS = [/content[\s_-]?filter/i, /content management policy/i, /safety system/i, /blocked by/i];
const SERVER_ERROR_PATTERNS = [/\b50[234]\b/, /bad gateway/i, /service unavailable/i, /gateway timeout/i];
const TIMEOUT_PATTERNS = [/timed?[\s_-]?out/i, /ETIMEDOUT/, /ECONNRESET/, /ECONNREFUSED/, /ENOTFOUND/];

const DEFAULT_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_RETRY_AFTER_MS = 15 * 60 * 1000;

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const direct = record.status ?? record.statusCode;
  if (typeof direct === "number") {
    return direct;
  }
  const response = record.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === "number") {
    return response.status;
  }
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${String((error as { cause?: unknown }).cause ?? "")}`;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const headers = (error as { headers?: Record<string, string> }).headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) {
    return undefined;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  return undefined;
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

/**
 * Quyết định một lỗi gọi LLM có nên kích hoạt chuyển sang candidate (key/provider) kế
 * tiếp hay không, và nếu có thì tạm cooldown candidate lỗi trong bao lâu. Lỗi 400 do
 * payload sai (VD sai tên model) không kích hoạt xoay tua vì đổi key không giải quyết
 * được gì — cần sửa cấu hình.
 */
export function classifyRotationTrigger(error: unknown, defaultCooldownMs: number): RotationTriggerResult {
  const status = extractStatusCode(error);
  const message = extractErrorMessage(error);

  if (status === 429 || matchesAny(message, RATE_LIMIT_PATTERNS)) {
    return {
      shouldRotate: true,
      cooldownMs: extractRetryAfterMs(error) ?? defaultCooldownMs,
      reason: "rate_limit",
    };
  }
  if (status === 402 || matchesAny(message, QUOTA_PATTERNS)) {
    return { shouldRotate: true, cooldownMs: Math.max(defaultCooldownMs, DEFAULT_QUOTA_COOLDOWN_MS), reason: "insufficient_quota" };
  }
  if (status === 401 || status === 403 || matchesAny(message, AUTH_PATTERNS)) {
    return { shouldRotate: true, cooldownMs: Math.max(defaultCooldownMs, DEFAULT_QUOTA_COOLDOWN_MS), reason: "invalid_key" };
  }
  if (matchesAny(message, CONTENT_FILTER_PATTERNS)) {
    return { shouldRotate: true, cooldownMs: defaultCooldownMs, reason: "content_filter" };
  }
  if ((typeof status === "number" && status >= 500) || matchesAny(message, SERVER_ERROR_PATTERNS)) {
    return { shouldRotate: true, cooldownMs: defaultCooldownMs, reason: "server_error" };
  }
  if (matchesAny(message, TIMEOUT_PATTERNS)) {
    return { shouldRotate: true, cooldownMs: defaultCooldownMs, reason: "timeout" };
  }
  return { shouldRotate: false, cooldownMs: 0, reason: null };
}
