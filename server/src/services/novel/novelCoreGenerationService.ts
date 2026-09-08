import type { BaseMessageChunk } from "@langchain/core/messages";
import { resolveNovelLanguage, resolvePromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { prisma } from "../../db/prisma";
import {
  runStructuredPrompt,
  runTextPrompt,
  streamStructuredPrompt,
  streamTextPrompt,
} from "../../prompting/core/promptRunner";
import {
  novelBeatPrompt,
  novelBiblePrompt,
  novelChapterHookPrompt,
  novelOutlinePrompt,
  novelStructuredOutlinePrompt,
  novelStructuredOutlineRepairPrompt,
} from "../../prompting/prompts/novel/coreGeneration.prompts";
import { novelReferenceService } from "./NovelReferenceService";
import {
  parseStrictStructuredOutline,
  stringifyStructuredOutline,
  toOutlineChapterRows,
} from "./structuredOutline";
import { titleGenerationService } from "../title/TitleGenerationService";
import { WorldContextGateway, type WorldContextPurpose } from "./worldContext/WorldContextGateway";
import { normalizeNovelBiblePayload } from "./novelBiblePersistence";
import { buildStoryModePromptBlock, normalizeStoryModeOutput } from "../storyMode/storyModeProfile";
import {
  ChapterGenerateOptions,
  DEFAULT_ESTIMATED_CHAPTER_COUNT,
  GenerateBeatOptions,
  HookGenerateOptions,
  LLMGenerateOptions,
  normalizeBeatOrder,
  normalizeBeatStatus,
  OutlineGenerateOptions,
  StructuredOutlineGenerateOptions,
  TitleGenerateOptions,
  briefSummary,
} from "./novelCoreShared";
import { ensureNovelCharacters, queueRagUpsert } from "./novelCoreSupport";

export interface ChapterStreamProductionPort {
  createChapterStream(
    novelId: string,
    chapterId: string,
    options?: ChapterGenerateOptions,
  ): Promise<{
    stream: AsyncIterable<BaseMessageChunk>;
    onDone: (fullContent: string) => Promise<void>;
  }>;
}

const sharedChapterStreamProductionPort: ChapterStreamProductionPort = {
  async createChapterStream(novelId, chapterId, options = {}) {
    const { getSharedNovelServices } = await import("./application/sharedNovelServices");
    return getSharedNovelServices().createChapterStream(novelId, chapterId, options);
  },
};

type NovelCharacterRow = {
  name: string;
  role: string;
  personality?: string | null;
  storyFunction?: string | null;
  relationToProtagonist?: string | null;
  outerGoal?: string | null;
  innerNeed?: string | null;
  fear?: string | null;
  wound?: string | null;
  misbelief?: string | null;
};

/**
 * Khối ngữ cảnh nhân vật cho các prompt lập kế hoạch (outline / structured outline).
 * Bơm đủ động cơ (mục tiêu, nỗi sợ, vết thương, quan hệ) để hướng phát triển bám nhân vật,
 * thay vì chỉ có tên + vai trò khiến model viết chung chung.
 */
function buildPlanningCharacterText(characters: NovelCharacterRow[]): string {
  if (characters.length === 0) {
    return "暂无";
  }
  const clip = (value: string | null | undefined, max: number): string =>
    (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return characters
    .map((character) => {
      const parts: string[] = [`- ${character.name}（${character.role}）`];
      const detail: string[] = [];
      const fn = clip(character.storyFunction, 80);
      const relation = clip(character.relationToProtagonist, 80);
      const personality = clip(character.personality, 100);
      const goal = clip(character.outerGoal, 90);
      const need = clip(character.innerNeed, 90);
      const fear = clip(character.fear, 70);
      const wound = clip(character.wound, 90);
      const misbelief = clip(character.misbelief, 90);
      if (fn) detail.push(`作用：${fn}`);
      if (relation) detail.push(`与主角关系：${relation}`);
      if (personality) detail.push(`性格：${personality}`);
      if (goal) detail.push(`外在目标：${goal}`);
      if (need) detail.push(`内在需求：${need}`);
      if (fear) detail.push(`恐惧：${fear}`);
      if (wound) detail.push(`创伤：${wound}`);
      if (misbelief) detail.push(`误信：${misbelief}`);
      if (detail.length > 0) {
        parts.push(`\n  ${detail.join("；")}`);
      }
      return parts.join("");
    })
    .join("\n");
}

type StoryModeRow = Parameters<typeof normalizeStoryModeOutput>[0];

/**
 * Khối ràng buộc story mode (流派模式) cho các prompt lập kế hoạch: trần xung đột,
 * tín hiệu bắt buộc lặp lại, dạng xung đột cấm. Rỗng khi novel chưa chọn story mode.
 */
function buildNovelStoryModeContext(novel: {
  novelLanguage?: string | null;
  primaryStoryMode?: StoryModeRow | null;
  secondaryStoryMode?: StoryModeRow | null;
}): string {
  return buildStoryModePromptBlock({
    primary: novel.primaryStoryMode ? normalizeStoryModeOutput(novel.primaryStoryMode) : null,
    secondary: novel.secondaryStoryMode ? normalizeStoryModeOutput(novel.secondaryStoryMode) : null,
    lang: resolvePromptLanguage(resolveNovelLanguage(novel.novelLanguage)),
  });
}

export class NovelCoreGenerationService {
  private readonly worldContextGateway = new WorldContextGateway();

  constructor(
    private readonly chapterProduction: ChapterStreamProductionPort = sharedChapterStreamProductionPort,
  ) {}

  private async getWorldContextText(
    novelId: string,
    input: {
      purpose: WorldContextPurpose;
      storyInput?: string;
      provider?: LLMGenerateOptions["provider"];
      model?: string;
      temperature?: number;
    },
  ): Promise<string> {
    const block = await this.worldContextGateway.getWorldContextBlock(novelId, {
      purpose: input.purpose,
      storyInput: input.storyInput,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
    });
    return block?.promptBlock ?? "本书世界上下文：暂无。请根据小说基础信息推进，不要凭空新增复杂世界规则。";
  }

  async createOutlineStream(novelId: string, options: OutlineGenerateOptions = {}) {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: { world: true, characters: true, primaryStoryMode: true, secondaryStoryMode: true },
    });
    if (!novel) {
      throw new Error("小说不存在");
    }

    const [worldContext, referenceContext] = await Promise.all([
      this.getWorldContextText(novelId, {
        purpose: "outline",
        storyInput: options.initialPrompt?.trim() || novel.description || "",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      }),
      novelReferenceService.buildReferenceForStage(novelId, "outline"),
    ]);

    const charactersText = buildPlanningCharacterText(novel.characters);
    const initialPrompt = options.initialPrompt?.trim() ?? "";
    const streamed = await streamTextPrompt({
      asset: novelOutlinePrompt,
      promptInput: {
        title: novel.title,
        description: novel.description ?? "",
        charactersText,
        worldContext,
        referenceContext: referenceContext.trim() || undefined,
        initialPrompt: initialPrompt || undefined,
        storyModeContext: buildNovelStoryModeContext(novel) || undefined,
        outputLanguage: resolveNovelLanguage(novel.novelLanguage),
      },
      options: {
        novelId: novelId,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      },
    });

    return {
      stream: streamed.stream as AsyncIterable<BaseMessageChunk>,
      onDone: async (fullContent: string) => {
        const completed = await streamed.complete;
        await prisma.novel.update({
          where: { id: novelId },
          data: { outline: completed.output.trim() || fullContent },
        });
        queueRagUpsert("novel", novelId);
      },
    };
  }

  async createStructuredOutlineStream(novelId: string, options: StructuredOutlineGenerateOptions = {}) {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: { world: true, characters: true, primaryStoryMode: true, secondaryStoryMode: true },
    });
    if (!novel) {
      throw new Error("小说不存在");
    }

    await ensureNovelCharacters(novelId, "生成结构化大纲");
    if (!novel.outline) {
      throw new Error("请先生成小说发展走向");
    }

    const [worldContext, referenceContext] = await Promise.all([
      this.getWorldContextText(novelId, {
        purpose: "outline",
        storyInput: novel.outline ?? novel.description ?? "",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      }),
      novelReferenceService.buildReferenceForStage(novelId, "structured_outline"),
    ]);

    const charactersText = buildPlanningCharacterText(novel.characters);
    const totalChapters = options.totalChapters
      ?? novel.estimatedChapterCount
      ?? DEFAULT_ESTIMATED_CHAPTER_COUNT;

    const streamed = await streamTextPrompt({
      asset: novelStructuredOutlinePrompt,
      promptInput: {
        charactersText,
        worldContext,
        outline: novel.outline,
        referenceContext: referenceContext.trim() || undefined,
        totalChapters,
        storyModeContext: buildNovelStoryModeContext(novel) || undefined,
        outputLanguage: resolveNovelLanguage(novel.novelLanguage),
      },
      options: {
        novelId: novelId,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.2,
      },
    });

    return {
      stream: streamed.stream as AsyncIterable<BaseMessageChunk>,
      onDone: async (fullContent: string) => {
        const completed = await streamed.complete;
        const rawOutput = completed.output.trim() || fullContent;
        let normalized: ReturnType<typeof parseStrictStructuredOutline>;
        try {
          normalized = parseStrictStructuredOutline(rawOutput, totalChapters);
        } catch (error) {
          const repaired = await this.repairStructuredOutlineOutput(
            novelId,
            rawOutput,
            totalChapters,
            options,
            error instanceof Error ? error.message : "invalid structured outline",
          );
          normalized = parseStrictStructuredOutline(repaired, totalChapters);
        }
        const structuredOutline = stringifyStructuredOutline(normalized);
        await prisma.novel.update({ where: { id: novelId }, data: { structuredOutline } });

        const chapters = toOutlineChapterRows(normalized);
        if (chapters.length > 0) {
          await this.syncChaptersFromOutline(novelId, chapters);
        }
        queueRagUpsert("novel", novelId);
      },
    };
  }

  private async repairStructuredOutlineOutput(
    novelId: string,
    rawContent: string,
    totalChapters: number,
    options: StructuredOutlineGenerateOptions,
    reason: string,
  ): Promise<string> {
    const result = await runTextPrompt({
      asset: novelStructuredOutlineRepairPrompt,
      promptInput: {
        rawContent,
        totalChapters,
        reason,
      },
      options: {
        novelId,
        provider: options.provider,
        model: options.model,
        temperature: 0.1,
      },
    });
    return result.output;
  }

  private async syncChaptersFromOutline(
    novelId: string,
    chapters: Array<{ order: number; title: string; summary: string }>,
  ) {
    const existing = await prisma.chapter.findMany({
      where: { novelId },
      select: { id: true, order: true },
    });
    const existingByOrder = new Map(existing.map((chapter) => [chapter.order, chapter.id]));

    await Promise.all(
      chapters.map((chapter) => {
        const existingId = existingByOrder.get(chapter.order);
        if (existingId) {
          return prisma.chapter.update({
            where: { id: existingId },
            data: { title: chapter.title, expectation: chapter.summary },
          });
        }
        return prisma.chapter.create({
          data: {
            novelId,
            title: chapter.title,
            order: chapter.order,
            content: "",
            expectation: chapter.summary,
            generationState: "planned",
          },
        });
      }),
    );
  }

  async createChapterStream(novelId: string, chapterId: string, options: ChapterGenerateOptions = {}) {
    return this.chapterProduction.createChapterStream(novelId, chapterId, options);
  }

  async generateTitles(novelId: string, options: TitleGenerateOptions = {}) {
    return titleGenerationService.generateNovelTitles(novelId, options);
  }

  async createBibleStream(novelId: string, options: LLMGenerateOptions = {}) {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: { characters: true, genre: true, world: true, primaryStoryMode: true, secondaryStoryMode: true },
    });
    if (!novel) {
      throw new Error("小说不存在");
    }

    await ensureNovelCharacters(novelId, "生成作品圣经");
    const [worldContext, referenceContext] = await Promise.all([
      this.getWorldContextText(novelId, {
        purpose: "bible",
        storyInput: novel.outline ?? novel.description ?? "",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      }),
      novelReferenceService.buildReferenceForStage(novelId, "bible"),
    ]);

    const streamed = await streamStructuredPrompt({
      asset: novelBiblePrompt,
      promptInput: {
        title: novel.title,
        genreName: novel.genre?.name ?? "未分类",
        description: novel.description ?? "",
        charactersText: buildPlanningCharacterText(novel.characters),
        worldContext,
        referenceContext: referenceContext.trim() || undefined,
        storyModeContext: buildNovelStoryModeContext(novel) || undefined,
        outputLanguage: resolveNovelLanguage(novel.novelLanguage),
      },
      options: {
        novelId: novelId,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.6,
      },
    });

    return {
      stream: streamed.stream as AsyncIterable<BaseMessageChunk>,
      onDone: async (_fullContent: string) => {
        const completed = await streamed.complete;
        const persisted = normalizeNovelBiblePayload(completed.output as Record<string, unknown>, novel.title);
        await prisma.novelBible.upsert({
          where: { novelId },
          update: {
            coreSetting: persisted.coreSetting,
            forbiddenRules: persisted.forbiddenRules,
            mainPromise: persisted.mainPromise,
            characterArcs: persisted.characterArcs,
            worldRules: persisted.worldRules,
            rawContent: persisted.rawContent,
          },
          create: {
            novelId,
            coreSetting: persisted.coreSetting,
            forbiddenRules: persisted.forbiddenRules,
            mainPromise: persisted.mainPromise,
            characterArcs: persisted.characterArcs,
            worldRules: persisted.worldRules,
            rawContent: persisted.rawContent,
          },
        });
        queueRagUpsert("bible", novelId);
      },
    };
  }

  async createBeatStream(novelId: string, options: GenerateBeatOptions = {}) {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: { bible: true, chapters: true, world: true, primaryStoryMode: true, secondaryStoryMode: true },
    });
    if (!novel) {
      throw new Error("小说不存在");
    }

    await ensureNovelCharacters(novelId, "生成剧情拍点");
    const [worldContext, referenceContext] = await Promise.all([
      this.getWorldContextText(novelId, {
        purpose: "outline",
        storyInput: novel.outline ?? novel.description ?? "",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
      }),
      novelReferenceService.buildReferenceForStage(novelId, "beats"),
    ]);

    const targetChapters = options.targetChapters
      ?? Math.max(
        novel.estimatedChapterCount ?? DEFAULT_ESTIMATED_CHAPTER_COUNT,
        novel.chapters.length || 0,
        1,
      );

    const streamed = await streamStructuredPrompt({
      asset: novelBeatPrompt,
      promptInput: {
        title: novel.title,
        description: novel.description ?? "",
        worldContext,
        bibleRawContent: novel.bible?.rawContent ?? "暂无",
        targetChapters,
        referenceContext: referenceContext.trim() || undefined,
        storyModeContext: buildNovelStoryModeContext(novel) || undefined,
        outputLanguage: resolveNovelLanguage(novel.novelLanguage),
      },
      options: {
        novelId: novelId,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? 0.7,
      },
    });

    return {
      stream: streamed.stream as AsyncIterable<BaseMessageChunk>,
      onDone: async (_fullContent: string) => {
        const completed = await streamed.complete;
        const normalizedBeats = completed.output.map((item, index) => ({
          novelId,
          chapterOrder: normalizeBeatOrder(item.chapterOrder, index + 1),
          beatType: String(item.beatType ?? "main").slice(0, 120),
          title: String(item.title ?? `拍点 ${index + 1}`).slice(0, 200),
          content: String(item.content ?? ""),
          status: normalizeBeatStatus(item.status),
        }));

        await prisma.$transaction(async (tx) => {
          await tx.plotBeat.deleteMany({ where: { novelId } });
          if (normalizedBeats.length > 0) {
            await tx.plotBeat.createMany({ data: normalizedBeats });
          }
        });
      },
    };
  }

  async generateChapterHook(novelId: string, options: HookGenerateOptions = {}) {
    const chapter = options.chapterId
      ? await prisma.chapter.findFirst({ where: { id: options.chapterId, novelId } })
      : await prisma.chapter.findFirst({ where: { novelId }, orderBy: { order: "desc" } });
    if (!chapter) {
      throw new Error("未找到可生成钩子的章节");
    }

    const result = await runStructuredPrompt({
      asset: novelChapterHookPrompt,
      promptInput: {
        title: chapter.title,
        content: (chapter.content ?? "").slice(-1800),
      },
      options: {
        novelId: novelId,
        provider: options.provider ?? "deepseek",
        model: options.model,
        temperature: options.temperature ?? 0.8,
      },
    });
    const payload = result.output;
    const hook = payload.hook ?? "";
    const expectation = payload.nextExpectation ?? "";

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { hook, expectation },
    });
    await prisma.chapterSummary.upsert({
      where: { chapterId: chapter.id },
      update: { hook },
      create: { novelId, chapterId: chapter.id, summary: briefSummary(chapter.content ?? ""), hook },
    });

    queueRagUpsert("chapter", chapter.id);
    queueRagUpsert("chapter_summary", chapter.id);
    return { chapterId: chapter.id, hook, nextExpectation: expectation };
  }
}
