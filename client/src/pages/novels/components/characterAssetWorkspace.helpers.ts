import { translateUi } from "@/i18n/legacy";
import type { Character, CharacterCastRole, CharacterGender } from "@ai-novel/shared/types/novel";

const CAST_ROLE_LABELS: Record<CharacterCastRole, string> = {
  protagonist: translateUi("主角"),
  antagonist: translateUi("主对手"),
  ally: translateUi("同盟"),
  foil: translateUi("镜像角色"),
  mentor: translateUi("导师"),
  love_interest: translateUi("情感牵引"),
  pressure_source: translateUi("压力源"),
  catalyst: translateUi("催化者"),
};

const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  male: translateUi("男"),
  female: translateUi("女"),
  other: translateUi("其他"),
  unknown: translateUi("未知"),
};

export function getCastRoleLabel(castRole?: CharacterCastRole | null): string {
  if (!castRole) {
    return translateUi("未定义");
  }
  return CAST_ROLE_LABELS[castRole] ?? castRole;
}

export function getCharacterGenderLabel(gender?: CharacterGender | null): string {
  if (!gender) {
    return translateUi("未知");
  }
  return CHARACTER_GENDER_LABELS[gender] ?? gender;
}

export function isProtagonistCharacter(character?: Character | null): boolean {
  if (!character) {
    return false;
  }
  if (character.castRole) {
    return character.castRole === "protagonist";
  }
  const roleText = character.role ?? "";
  return /主角|男主|女主|主人公/.test(roleText);
}
