import { SystemMessage, type BaseMessage } from "@langchain/core/messages";
import {
  DEFAULT_NOVEL_LANGUAGE,
  buildPromptLanguageDirective,
  buildOutputLanguageDirective,
  resolvePromptLanguage,
  resolveNovelLanguage,
} from "@ai-novel/shared/utils/novelLanguage";
import {
  DEFAULT_NOVEL_STYLE_FLAVOR,
  buildStyleFlavorDirective,
  resolveNovelStyleFlavor,
} from "@ai-novel/shared/utils/novelStyleFlavor";
import type { NovelLanguage, NovelStyleFlavor } from "@ai-novel/shared/types/novel";
import { prisma } from "../../db/prisma";

interface NovelPromptSettings {
  lang: NovelLanguage;
  styleFlavor: NovelStyleFlavor;
}

type Resolver = (novelId: string) => Promise<NovelPromptSettings>;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { settings: NovelPromptSettings; expiresAt: number }>();

async function defaultResolver(novelId: string): Promise<NovelPromptSettings> {
  const cached = cache.get(novelId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }
  let settings: NovelPromptSettings = { lang: DEFAULT_NOVEL_LANGUAGE, styleFlavor: DEFAULT_NOVEL_STYLE_FLAVOR };
  try {
    const row = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { novelLanguage: true, styleFlavor: true },
    });
    settings = {
      lang: resolveNovelLanguage(row?.novelLanguage ?? null),
      styleFlavor: resolveNovelStyleFlavor(row?.styleFlavor ?? null),
    };
  } catch {
    settings = { lang: DEFAULT_NOVEL_LANGUAGE, styleFlavor: DEFAULT_NOVEL_STYLE_FLAVOR };
  }
  cache.set(novelId, { settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}

let resolver: Resolver = defaultResolver;

/** Ngôn ngữ đầu ra của một novel. Không có `novelId` hoặc không tra được ⇒ mặc định (zh). */
export async function resolveNovelOutputLanguage(novelId?: string | null): Promise<NovelLanguage> {
  if (!novelId) {
    return DEFAULT_NOVEL_LANGUAGE;
  }
  return (await resolver(novelId)).lang;
}

/** Phong cách văn phong của một novel. Không có `novelId` hoặc không tra được ⇒ mặc định (manga). */
export async function resolveNovelStyleFlavorSetting(novelId?: string | null): Promise<NovelStyleFlavor> {
  if (!novelId) {
    return DEFAULT_NOVEL_STYLE_FLAVOR;
  }
  return (await resolver(novelId)).styleFlavor;
}

/** Gọi sau khi cập nhật `Novel.novelLanguage`/`Novel.styleFlavor` để cache runtime không phục vụ giá trị cũ. */
export function invalidateNovelOutputLanguage(novelId: string): void {
  cache.delete(novelId);
}

/**
 * Chèn chỉ thị ngôn ngữ đầu ra + phong cách văn phong (ưu tiên cao nhất) vào cuối
 * danh sách message. Đây là lưới an toàn phủ mọi prompt gắn novel.
 *
 * `explicitLanguage`/`explicitStyleFlavor` (từ `options.outputLanguage`/`options.styleFlavor`)
 * được ưu tiên hơn việc suy ra từ `novelId` — dùng cho luồng sinh nội dung trước khi novel tồn tại.
 */
export async function appendOutputLanguageDirective(
  messages: BaseMessage[],
  novelId?: string | null,
  explicitLanguage?: NovelLanguage | null,
  explicitStyleFlavor?: NovelStyleFlavor | null,
): Promise<BaseMessage[]> {
  const settings: NovelPromptSettings = novelId
    ? await resolver(novelId)
    : { lang: DEFAULT_NOVEL_LANGUAGE, styleFlavor: DEFAULT_NOVEL_STYLE_FLAVOR };

  const lang = resolveNovelLanguage(explicitLanguage ?? settings.lang);
  const styleFlavor = resolveNovelStyleFlavor(explicitStyleFlavor ?? settings.styleFlavor);
  const promptLanguage = resolvePromptLanguage(lang);
  const directive = buildOutputLanguageDirective(lang, promptLanguage);
  const promptDirective = buildPromptLanguageDirective(lang, promptLanguage);
  const styleDirective = buildStyleFlavorDirective(styleFlavor, promptLanguage);
  return [
    ...messages,
    new SystemMessage(promptDirective),
    ...(styleDirective ? [new SystemMessage(styleDirective)] : []),
    // Đặt chỉ thị ngôn ngữ sau style/context để nó có độ ưu tiên thực tế cao
    // hơn các profile hoặc ví dụ viết bằng tiếng Trung được đưa vào trước đó.
    ...(directive ? [new SystemMessage(directive)] : []),
  ];
}

export function setNovelOutputLanguageResolverForTests(next?: Resolver): void {
  resolver = next ?? defaultResolver;
  cache.clear();
}
