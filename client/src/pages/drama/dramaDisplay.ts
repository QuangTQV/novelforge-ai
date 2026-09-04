import { translateUi } from "../../i18n/legacy.ts";
import type { DramaSourceType } from "@/api/drama";

export const DRAMA_TRACK_OPTIONS = [
  { value: "counterattack", label: translateUi("逆袭") },
  { value: "rebirth_revenge", label: translateUi("重生复仇") },
  { value: "war_god", label: translateUi("战神归来") },
  { value: "live_in_son", label: translateUi("赘婿") },
  { value: "miracle_doctor", label: translateUi("神医") },
  { value: "rich_family", label: translateUi("豪门恩怨") },
  { value: "sweet_love", label: translateUi("甜宠") },
  { value: "hidden_identity", label: translateUi("马甲文") },
] as const;

export const DRAMA_SOURCE_LABELS: Record<DramaSourceType, string> = {
  novel_import: "小说导入",
  original: "原创短剧",
  text_import: "文本导入",
};

export function dramaTrackLabel(track?: string | null): string {
  if (!track) {
    return "未选择赛道";
  }
  return DRAMA_TRACK_OPTIONS.find((option) => option.value === track)?.label ?? track;
}
