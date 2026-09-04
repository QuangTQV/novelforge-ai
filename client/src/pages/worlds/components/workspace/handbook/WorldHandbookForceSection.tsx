import { translateUi } from "@/i18n/legacy";
import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Castle, Plus } from "lucide-react";
import type { WorldForce, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { makeId, removeItem, updateItem } from "./handbookEditorUtils";

export default function WorldHandbookForceSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
}) {
  const { draftStructure, setDraftStructure } = props;
  const forceSummary = useMemo(() => {
    const forceNames = draftStructure.forces.map((force) => force.name).filter(Boolean).slice(0, 4);
    return forceNames.length > 0 ? forceNames.join(" / ") : "补充主要势力后，角色身份、阵营冲突和章节压力会更稳定。";
  }, [draftStructure.forces]);

  const addForce = () => {
    setDraftStructure((prev) =>
      prev
        ? {
          ...prev,
          forces: [
            ...prev.forces,
            {
              id: makeId("force", prev.forces.length),
              name: "",
              type: "",
              factionId: null,
              summary: "",
              baseOfPower: "",
              currentObjective: "",
              pressure: "",
              leader: null,
              narrativeRole: "",
            },
          ],
        }
        : prev,
    );
  };

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={Castle}
        title={translateUi("主要势力")}
        description={translateUi("让作者先看懂谁在争夺资源、谁会制造阻力、角色可能从哪里来。{{value0}}", { value0: forceSummary })}
        count={draftStructure.forces.length}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {draftStructure.forces.map((force: WorldForce, index) => (
          <div key={force.id || index} className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">{translateUi("势力")} {index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraftStructure((prev) => (prev ? { ...prev, forces: removeItem(prev.forces, index) } : prev))
                }
              >

                {translateUi("移除")}
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              <HandbookField title={translateUi("势力名称")} hint={translateUi("角色可能出身、投靠、背叛或对抗的组织。")}>
                <Input
                  value={force.name}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { name: event.target.value }) } : prev,
                    )
                  }
                  placeholder={translateUi("星皇朝廷、天机阁、异魔联盟")}
                />
              </HandbookField>
              <HandbookField title={translateUi("势力类型")} hint={translateUi("帮助 AI 判断它的行动方式和组织质感。")}>
                <Input
                  value={force.type}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { type: event.target.value }) } : prev,
                    )
                  }
                  placeholder={translateUi("王朝、宗门、公司、地下组织...")}
                />
              </HandbookField>
              <HandbookField title={translateUi("它在世界里代表什么")} hint={translateUi("写清它的立场、资源和读者应当记住的特征。")}>
                <HandbookTextarea
                  value={force.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { summary: value }) } : prev,
                    )
                  }
                  placeholder={translateUi("这个势力在世界中代表什么？")}
                  minRows={3}
                />
              </HandbookField>
              <HandbookField title={translateUi("当前目标")} hint={translateUi("目标会转化为章节事件和角色冲突。")}>
                <Input
                  value={force.currentObjective}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? { ...prev, forces: updateItem(prev.forces, index, { currentObjective: event.target.value }) }
                        : prev,
                    )
                  }
                  placeholder={translateUi("争夺矿脉、封锁真相、寻找失落继承人")}
                />
              </HandbookField>
              <HandbookField title={translateUi("给故事带来的压力")} hint={translateUi("主角或其他势力会因此被迫选择、逃亡、交易或开战。")}>
                <Input
                  value={force.pressure}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, forces: updateItem(prev.forces, index, { pressure: event.target.value }) } : prev,
                    )
                  }
                  placeholder={translateUi("追捕主角、控制资源、制造战争、引发信任危机")}
                />
              </HandbookField>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" className="mt-3" variant="outline" onClick={addForce}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />

        {translateUi("增加主要势力")}
      </Button>
    </section>
  );
}
