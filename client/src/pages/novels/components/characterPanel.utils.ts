import { translateUi } from "@/i18n/legacy";
import type { Character, CharacterTimeline } from "@ai-novel/shared/types/novel";

const RELATION_POSITIVE_KEYWORDS = [translateUi("伙伴"), translateUi("盟友"), translateUi("信任"), translateUi("守护"), translateUi("亲密"), translateUi("喜欢"), translateUi("合作")];
const RELATION_NEGATIVE_KEYWORDS = [translateUi("敌对"), translateUi("对立"), translateUi("怀疑"), translateUi("背叛"), translateUi("利用"), translateUi("冲突"), translateUi("压制")];
const TREND_UP_KEYWORDS = [translateUi("升温"), translateUi("缓和"), translateUi("靠近"), translateUi("修复"), translateUi("合作加深"), translateUi("信任增加")];
const TREND_DOWN_KEYWORDS = [translateUi("恶化"), translateUi("破裂"), translateUi("紧张"), translateUi("决裂"), translateUi("冲突升级"), translateUi("敌意加深")];

function compactText(input: string | null | undefined): string {
  return (input ?? "").trim();
}

function joinSegments(segments: Array<string | null | undefined>): string {
  return segments
    .map((segment) => compactText(segment))
    .filter((segment) => segment.length > 0)
    .join("；");
}

function countHits(source: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (source.includes(keyword) ? count + 1 : count), 0);
}

export interface QuickCharacterCreatePayload {
  name: string;
  role: string;
  relationToProtagonist?: string;
  storyFunction?: string;
  keywords?: string;
  autoGenerateProfile?: boolean;
}

export interface CharacterRelationRow {
  targetCharacterId: string;
  targetCharacterName: string;
  currentRelation: string;
  trend: string;
  lastChangedChapter: number | null;
  evidence: string;
}

interface GeneratedCharacterProfile {
  personality?: string;
  background?: string;
  development?: string;
  currentState?: string;
  currentGoal?: string;
}

export function buildCharacterProfileFromWizard(payload: QuickCharacterCreatePayload): GeneratedCharacterProfile {
  if (!payload.autoGenerateProfile) {
    return {};
  }

  const keywordList = (payload.keywords ?? "")
    .split(/[，,\s]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const keywordText = keywordList.length > 0 ? keywordList.join("、") : translateUi("待补充");

  const personality = translateUi("核心特征：{{v0}}", { v0: keywordText });
  const background = joinSegments([
    payload.relationToProtagonist ? translateUi("与主角关系：{{v0}}", { v0: payload.relationToProtagonist }) : "",
    payload.storyFunction ? translateUi("故事作用：{{v0}}", { v0: payload.storyFunction }) : "",
  ]);
  const development = joinSegments([
    payload.storyFunction ? translateUi("角色成长主轴：围绕“{{v0}}”推进。", { v0: payload.storyFunction }) : "",
    keywordList.length > 0 ? translateUi("潜在冲突点：{{v0}}", { v0: keywordList.slice(0, 3).join("、") }) : "",
    keywordList.length > 0 ? translateUi("可埋伏笔点：{{v0}}", { v0: keywordList.slice(-2).join("、") }) : "",
    keywordList.length > 0 ? translateUi("说话风格建议：偏向{{v0}}语气。", { v0: keywordList[0] }) : "",
  ]);

  return {
    personality: personality || undefined,
    background: background || undefined,
    development: development || undefined,
    currentState: payload.relationToProtagonist ? translateUi("关系推进中（{{v0}}）", { v0: payload.relationToProtagonist }) : translateUi("待上场"),
    currentGoal: payload.storyFunction || translateUi("推动主线关键节点"),
  };
}

function inferCurrentRelation(source: string): string {
  if (!source) {
    return translateUi("待定义");
  }
  const positiveHits = countHits(source, RELATION_POSITIVE_KEYWORDS);
  const negativeHits = countHits(source, RELATION_NEGATIVE_KEYWORDS);
  if (positiveHits > negativeHits) {
    return translateUi("合作 / 亲近");
  }
  if (negativeHits > positiveHits) {
    return translateUi("对立 / 紧张");
  }
  return translateUi("复杂 / 待观察");
}

function inferTrend(source: string): string {
  if (!source) {
    return translateUi("待观察");
  }
  const upHits = countHits(source, TREND_UP_KEYWORDS);
  const downHits = countHits(source, TREND_DOWN_KEYWORDS);
  if (upHits > downHits) {
    return translateUi("升温");
  }
  if (downHits > upHits) {
    return translateUi("恶化");
  }
  return translateUi("平稳");
}

function includesCharacterName(source: string, characterName: string): boolean {
  if (!source || !characterName) {
    return false;
  }
  return source.includes(characterName);
}

function buildLatestEvidence(event?: CharacterTimeline): string {
  if (!event) {
    return translateUi("暂无章节证据");
  }
  const excerpt = compactText(event.content).slice(0, 36);
  return excerpt.length > 0 ? excerpt : event.title;
}

export function buildCharacterRelationRows(
  selectedCharacter: Character | undefined,
  characters: Character[],
  timelineEvents: CharacterTimeline[],
): CharacterRelationRow[] {
  if (!selectedCharacter) {
    return [];
  }

  const selectedText = joinSegments([
    selectedCharacter.background,
    selectedCharacter.development,
    selectedCharacter.currentState,
    selectedCharacter.currentGoal,
    selectedCharacter.personality,
  ]);

  return characters
    .filter((character) => character.id !== selectedCharacter.id)
    .map((character) => {
      const relatedEvents = timelineEvents
        .filter((event) => includesCharacterName(`${event.title} ${event.content}`, character.name))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestEvent = relatedEvents[0];
      const relationSource = joinSegments([
        selectedText,
        ...relatedEvents.slice(0, 3).map((event) => `${event.title} ${event.content}`),
      ]);

      return {
        targetCharacterId: character.id,
        targetCharacterName: character.name,
        currentRelation: inferCurrentRelation(relationSource),
        trend: inferTrend(relationSource),
        lastChangedChapter: latestEvent?.chapterOrder ?? null,
        evidence: buildLatestEvidence(latestEvent),
      };
    });
}

export function getLastAppearanceChapter(timelineEvents: CharacterTimeline[]): number | null {
  return timelineEvents.reduce<number | null>((latest, event) => {
    if (typeof event.chapterOrder !== "number") {
      return latest;
    }
    if (latest === null || event.chapterOrder > latest) {
      return event.chapterOrder;
    }
    return latest;
  }, null);
}
