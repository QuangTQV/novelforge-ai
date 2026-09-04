import { translateUi } from "@/i18n/legacy";
import { GitBranch } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { listToText, textToList } from "./handbookEditorUtils";

export default function WorldHandbookTensionSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
  onOpenDeepening: () => void;
  onOpenLayers: () => void;
  onOpenAdvanced: () => void;
}) {
  const { draftStructure, setDraftStructure, onOpenDeepening, onOpenLayers, onOpenAdvanced } = props;

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={GitBranch}
        title={translateUi("关键张力")}
        description={translateUi("把世界设定压缩成能持续推动剧情的问题，避免世界只是背景资料。")}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <HandbookField title={translateUi("世界核心冲突")} hint={translateUi("资源、秩序、力量体系或阵营目标之间的长期矛盾。")}>
          <HandbookTextarea
            value={draftStructure.profile.coreConflict}
            onChange={(value) =>
              setDraftStructure((prev) => (prev ? { ...prev, profile: { ...prev.profile, coreConflict: value } } : prev))
            }
            placeholder={translateUi("例如：资源枯竭、秩序崩塌、两套力量体系互相排斥。")}
          />
        </HandbookField>
        <HandbookField title={translateUi("共同后果")} hint={translateUi("一行一条，写出世界规则带来的长期代价。")}>
          <HandbookTextarea
            value={listToText(draftStructure.rules.sharedConsequences)}
            onChange={(value) =>
              setDraftStructure((prev) =>
                prev ? { ...prev, rules: { ...prev.rules, sharedConsequences: textToList(value) } } : prev,
              )
            }
            placeholder={translateUi("力量越强越接近异化&#10;城市越繁荣越依赖危险资源")}
          />
        </HandbookField>
        <HandbookField title={translateUi("禁忌组合")} hint={translateUi("一行一条，明确哪些角色背景、力量用法或剧情解法不能出现。")}>
          <HandbookTextarea
            value={listToText(draftStructure.rules.taboo)}
            onChange={(value) =>
              setDraftStructure((prev) => (prev ? { ...prev, rules: { ...prev.rules, taboo: textToList(value) } } : prev))
            }
            placeholder={translateUi("凡人不能无代价操控星核&#10;朝廷密探不能公开加入异魔阵营")}
          />
        </HandbookField>
        <div className="rounded-md border border-dashed p-3 text-sm leading-6 text-muted-foreground">

          {translateUi("需要细调势力关系、地点控制权、导入结构数据时，再进入高级字段维护。普通作者只需要维护本页的手册内容。")}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onOpenDeepening}>

              {translateUi("问答补齐")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLayers}>

              {translateUi("分层草稿")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onOpenAdvanced}>

              {translateUi("高级字段维护")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
