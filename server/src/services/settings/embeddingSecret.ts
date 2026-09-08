/**
 * Credential của embedding model được lưu tách khỏi credential LLM, dù cùng "nhà cung cấp".
 *
 * Cả hai đều dùng bảng `APIKey` (unique theo `provider`), nên embedding secret được
 * đặt tên có tiền tố `embedding:` để không đè lên dòng LLM cùng tên.
 * Ví dụ: LLM `openai` ⇒ dòng `openai`; embedding `openai` ⇒ dòng `embedding:openai`.
 */
export const EMBEDDING_SECRET_PREFIX = "embedding:";

/** Tên dòng `APIKey` dùng để lưu credential embedding của một provider. */
export function embeddingSecretProvider(provider: string): string {
  return provider.startsWith(EMBEDDING_SECRET_PREFIX)
    ? provider
    : `${EMBEDDING_SECRET_PREFIX}${provider}`;
}

/** True nếu `provider` là một khóa credential embedding (đã có tiền tố). */
export function isEmbeddingSecretProvider(provider: string): boolean {
  return provider.startsWith(EMBEDDING_SECRET_PREFIX);
}

/** Bỏ tiền tố `embedding:` để lấy lại tên provider gốc. */
export function stripEmbeddingSecretPrefix(provider: string): string {
  return provider.startsWith(EMBEDDING_SECRET_PREFIX)
    ? provider.slice(EMBEDDING_SECRET_PREFIX.length)
    : provider;
}
