import { SystemMessage, type BaseMessage } from "@langchain/core/messages";
import {
  DEFAULT_NOVEL_LANGUAGE,
  buildOutputLanguageDirective,
  resolveNovelLanguage,
  type NovelLanguage,
} from "@ai-novel/shared";
import { prisma } from "../../db/prisma";

type Resolver = (novelId: string) => Promise<NovelLanguage>;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { lang: NovelLanguage; expiresAt: number }>();

async function defaultResolver(novelId: string): Promise<NovelLanguage> {
  const cached = cache.get(novelId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.lang;
  }
  let lang: NovelLanguage = DEFAULT_NOVEL_LANGUAGE;
  try {
    const row = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { novelLanguage: true },
    });
    lang = resolveNovelLanguage(row?.novelLanguage ?? null);
  } catch {
    lang = DEFAULT_NOVEL_LANGUAGE;
  }
  cache.set(novelId, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
  return lang;
}

let resolver: Resolver = defaultResolver;

/** Ngôn ngữ đầu ra của một novel. Không có `novelId` hoặc không tra được ⇒ mặc định (zh). */
export async function resolveNovelOutputLanguage(novelId?: string | null): Promise<NovelLanguage> {
  if (!novelId) {
    return DEFAULT_NOVEL_LANGUAGE;
  }
  return resolver(novelId);
}

/** Gọi sau khi cập nhật `Novel.novelLanguage` để cache runtime không phục vụ giá trị cũ. */
export function invalidateNovelOutputLanguage(novelId: string): void {
  cache.delete(novelId);
}

/**
 * Chèn chỉ thị ngôn ngữ đầu ra (ưu tiên cao nhất) vào cuối danh sách message, nếu
 * novel dùng ngôn ngữ khác tiếng Trung. Đây là lưới an toàn phủ mọi prompt gắn novel.
 */
export async function appendOutputLanguageDirective(
  messages: BaseMessage[],
  novelId?: string | null,
): Promise<BaseMessage[]> {
  const lang = await resolveNovelOutputLanguage(novelId);
  const directive = buildOutputLanguageDirective(lang);
  if (!directive) {
    return messages;
  }
  return [...messages, new SystemMessage(directive)];
}

export function setNovelOutputLanguageResolverForTests(next?: Resolver): void {
  resolver = next ?? defaultResolver;
  cache.clear();
}
