import { translateUi } from "@/i18n/legacy";
import type {
  CharacterCastRole,
  CharacterGender,
  SupplementalCharacterCandidate,
  SupplementalCharacterGenerationMode,
} from "@ai-novel/shared/types/novel";

export const CAST_ROLE_LABELS: Record<CharacterCastRole, string> = {
  protagonist: translateUi("主角"),
  antagonist: translateUi("主对手"),
  ally: translateUi("同盟"),
  foil: translateUi("镜像角色"),
  mentor: translateUi("导师"),
  love_interest: translateUi("情感牵引"),
  pressure_source: translateUi("压力源"),
  catalyst: translateUi("催化者"),
};

export const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  male: translateUi("男"),
  female: translateUi("女"),
  other: translateUi("其他"),
  unknown: translateUi("未知"),
};

export const SUPPLEMENTAL_MODE_LABELS: Record<SupplementalCharacterGenerationMode, string> = {
  auto: translateUi("AI 判断"),
  linked: translateUi("关系补位"),
  independent: translateUi("独立补位"),
};

export function getCastRoleLabel(castRole?: CharacterCastRole | "auto" | null): string {
  if (!castRole || castRole === "auto") {
    return translateUi("AI 判断");
  }
  return CAST_ROLE_LABELS[castRole] ?? castRole;
}

export function getCharacterGenderLabel(gender?: CharacterGender | null): string {
  if (!gender) {
    return translateUi("未知");
  }
  return CHARACTER_GENDER_LABELS[gender] ?? gender;
}

export function getSupplementalRelationLabel(
  candidate: SupplementalCharacterCandidate,
  relation: SupplementalCharacterCandidate["relations"][number],
): string {
  if (relation.sourceName === candidate.name) {
    return relation.targetName;
  }
  if (relation.targetName === candidate.name) {
    return relation.sourceName;
  }
  return `${relation.sourceName} -> ${relation.targetName}`;
}
