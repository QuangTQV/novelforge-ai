import { translateUi } from "@/i18n/legacy";
import { MapPinned, Plus } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WorldLocation, WorldStructuredData } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandbookField, HandbookTextarea, SectionHeader } from "./HandbookPrimitives";
import { makeId, removeItem, updateItem } from "./handbookEditorUtils";

export default function WorldHandbookLocationSection(props: {
  draftStructure: WorldStructuredData;
  setDraftStructure: Dispatch<SetStateAction<WorldStructuredData | null>>;
}) {
  const { draftStructure, setDraftStructure } = props;

  const addLocation = () => {
    setDraftStructure((prev) =>
      prev
        ? {
          ...prev,
          locations: [
            ...prev.locations,
            {
              id: makeId("location", prev.locations.length),
              name: "",
              terrain: "",
              summary: "",
              narrativeFunction: "",
              risk: "",
              entryConstraint: "",
              exitCost: "",
              controllingForceIds: [],
            },
          ],
        }
        : prev,
    );
  };

  return (
    <section className="rounded-md border p-4">
      <SectionHeader
        icon={MapPinned}
        title={translateUi("故事舞台")}
        description={translateUi("把世界转换成可落地的地点：开局在哪里、哪里适合升级、哪里适合冲突爆发。")}
        count={draftStructure.locations.length}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {draftStructure.locations.map((location: WorldLocation, index) => (
          <div key={location.id || index} className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">{translateUi("地点")} {index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraftStructure((prev) =>
                    prev ? { ...prev, locations: removeItem(prev.locations, index) } : prev,
                  )
                }
              >

                {translateUi("移除")}
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              <HandbookField title={translateUi("地点名称")} hint={translateUi("后续地图、势力控制区和章节发生地会围绕这些地点展开。")}>
                <Input
                  value={location.name}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { name: event.target.value }) } : prev,
                    )
                  }
                  placeholder={translateUi("北境冰原、星墟城、黑潮港")}
                />
              </HandbookField>
              <HandbookField title={translateUi("环境特征")} hint={translateUi("让地点有可被读者记住的空间感，而不是只作为名称出现。")}>
                <Input
                  value={location.terrain}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? { ...prev, locations: updateItem(prev.locations, index, { terrain: event.target.value }) }
                        : prev,
                    )
                  }
                  placeholder={translateUi("雪原边境、浮空都市、地下矿脉、海上要塞")}
                />
              </HandbookField>
              <HandbookField title={translateUi("读者第一印象")} hint={translateUi("写清这个地点的画面、秩序、危险或奇观。")}>
                <HandbookTextarea
                  value={location.summary}
                  onChange={(value) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { summary: value }) } : prev,
                    )
                  }
                  placeholder={translateUi("这个地点给读者的第一印象是什么？")}
                  minRows={3}
                />
              </HandbookField>
              <HandbookField title={translateUi("适合承担的剧情功能")} hint={translateUi("帮助章节规划判断这里适合开局、试炼、转折还是决战。")}>
                <Input
                  value={location.narrativeFunction}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev
                        ? {
                          ...prev,
                          locations: updateItem(prev.locations, index, { narrativeFunction: event.target.value }),
                        }
                        : prev,
                    )
                  }
                  placeholder={translateUi("开局、试炼、转折、决战、揭露真相")}
                />
              </HandbookField>
              <HandbookField title={translateUi("进入这里的风险")} hint={translateUi("风险会变成角色行动的阻力和章节冲突。")}>
                <Input
                  value={location.risk}
                  onChange={(event) =>
                    setDraftStructure((prev) =>
                      prev ? { ...prev, locations: updateItem(prev.locations, index, { risk: event.target.value }) } : prev,
                    )
                  }
                  placeholder={translateUi("被追捕、资源耗尽、身份暴露、规则失效")}
                />
              </HandbookField>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" className="mt-3" variant="outline" onClick={addLocation}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />

        {translateUi("增加故事地点")}
      </Button>
    </section>
  );
}
