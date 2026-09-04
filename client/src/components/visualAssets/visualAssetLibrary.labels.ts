import { translateUi } from "@/i18n/legacy";
import type {
  VisualAssetKind,
  VisualAssetOrigin,
  VisualAssetScopeKind,
  VisualAssetSourceDomain,
} from "@ai-novel/shared/types/visualAsset";

const KIND_LABELS: Record<VisualAssetKind, string> = {
  character: translateUi("角色形象"),
  cover: translateUi("小说封面"),
  illustration: translateUi("插图"),
  comic_character_sheet: translateUi("漫画角色设定"),
  comic_character_asset: translateUi("漫画角色素材"),
  comic_scene: translateUi("漫画场景"),
  comic_panel: translateUi("漫画分镜"),
  drama_character_sheet: translateUi("短剧角色设定"),
  drama_shot_keyframe: translateUi("短剧镜头关键帧"),
};

const SOURCE_LABELS: Record<VisualAssetSourceDomain, string> = {
  image_asset: translateUi("图片创作"),
  comic: translateUi("漫画创作"),
  drama: translateUi("短剧创作"),
};

const ORIGIN_LABELS: Record<VisualAssetOrigin, string> = {
  generated: translateUi("AI 生成"),
  uploaded: translateUi("已上传"),
  imported: translateUi("已导入"),
  unknown: translateUi("来源待确认"),
};

const SCOPE_LABELS: Record<VisualAssetScopeKind, string> = {
  global: translateUi("全部作品"),
  novel: translateUi("小说"),
  book_analysis: translateUi("拆书分析"),
  comic_project: translateUi("漫画项目"),
  drama_project: translateUi("短剧项目"),
};

export function getVisualAssetKindLabel(kind: VisualAssetKind) {
  return KIND_LABELS[kind];
}

export function getVisualAssetSourceLabel(source: VisualAssetSourceDomain) {
  return SOURCE_LABELS[source];
}

export function getVisualAssetOriginLabel(origin: VisualAssetOrigin) {
  return ORIGIN_LABELS[origin];
}

export function getVisualAssetScopeLabel(kind: VisualAssetScopeKind) {
  return SCOPE_LABELS[kind];
}

export function formatVisualAssetDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return translateUi("日期未记录");
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
