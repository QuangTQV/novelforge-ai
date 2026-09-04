import { translateUi } from "@/i18n/legacy";
import type { Character } from "@ai-novel/shared/types/novel";
import AiButton from "@/components/common/AiButton";
import { Button } from "@/components/ui/button";
import { StatusRail, StepActionBar, StepHero } from "../workspaceShell";

interface CharacterPreparationHeroProps {
  characters: Character[];
  coreCharacterCount: number;
  selectedCharacter?: Character;
  baseCharacterCount: number;
  pendingCharacterResourceCount: number;
  onOpenCreateDialog: () => void;
  onOpenSupplementalDialog: () => void;
  onEvolveCharacter: () => void;
  isEvolvingCharacter: boolean;
  selectedCharacterId: string;
}

export default function CharacterPreparationHero(props: CharacterPreparationHeroProps) {
  const {
    characters,
    coreCharacterCount,
    selectedCharacter,
    baseCharacterCount,
    pendingCharacterResourceCount,
    onOpenCreateDialog,
    onOpenSupplementalDialog,
    onEvolveCharacter,
    isEvolvingCharacter,
    selectedCharacterId,
  } = props;
  const recommendedAction = getRecommendedAction({
    characterCount: characters.length,
    coreCharacterCount,
    selectedCharacter,
    pendingCharacterResourceCount,
  });

  return (
    <StepHero
      eyebrow={translateUi("角色阵容")}
      title={translateUi("角色准备")}
      description={translateUi("把人物当作可持续运行的叙事资产来维护：先补齐阵容，再切换查看档案、外显、资源、时间线和关系。")}
      className="border border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] shadow-sm"
    >
      <StatusRail
        items={[
          {
            label: translateUi("已建角色"),
            value: characters.length,
            description: characters.length > 0 ? translateUi("阵容已开始成形。") : translateUi("先创建主角或导入基础角色。"),
            tone: characters.length > 0 ? "success" : "warning",
          },
          {
            label: translateUi("核心角色"),
            value: coreCharacterCount,
            description: coreCharacterCount > 0 ? translateUi("继续补足对手、同盟和压力源。") : translateUi("至少明确主角与主要对手。"),
            tone: coreCharacterCount > 0 ? "success" : "warning",
          },
          {
            label: translateUi("当前焦点"),
            value: selectedCharacter?.name ?? translateUi("尚未选择角色"),
            description: selectedCharacter?.role || translateUi("{{value0}} 个基础角色可导入", { value0: baseCharacterCount }),
            tone: selectedCharacter ? "info" : "neutral",
          },
        ]}
      />
      <StepActionBar
        className="mt-4 border border-border/60 bg-background/80"
        label={translateUi("下一步建议")}
        description={recommendedAction}
        actions={(
          <>
            <Button onClick={onOpenCreateDialog}>{translateUi("新增角色")}</Button>
            <AiButton variant="outline" onClick={onOpenSupplementalDialog}>

              {translateUi("补充角色")}
            </AiButton>
            <AiButton
              variant="secondary"
              onClick={onEvolveCharacter}
              disabled={isEvolvingCharacter || !selectedCharacterId}
            >
              {isEvolvingCharacter ? translateUi("演进中...") : translateUi("AI 演进当前状态")}
            </AiButton>
          </>
        )}
      />
    </StepHero>
  );
}

function getRecommendedAction(input: {
  characterCount: number;
  coreCharacterCount: number;
  selectedCharacter?: Character;
  pendingCharacterResourceCount: number;
}): string {
  if (input.characterCount === 0) {
    return translateUi("先建立主角或导入基础角色，让后续世界、卷规划和章节生成有明确行动主体。");
  }
  if (input.coreCharacterCount === 0) {
    return translateUi("把主角、主要对手或关键同盟标记清楚，避免后续章节缺少稳定压力源。");
  }
  if (input.pendingCharacterResourceCount > 0) {
    return translateUi("有 {{v0}} 条资源变更等待确认，建议到“资源”页核对。", { v0: input.pendingCharacterResourceCount });
  }
  if (!input.selectedCharacter) {
    return translateUi("从左侧选择一个角色，进入档案、外显、资源和时间线的切换式维护。");
  }
  return translateUi("优先检查当前目标、最近出场和关键资源，再决定是否让 AI 演进状态。");
}
