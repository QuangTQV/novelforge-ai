import { translateUi } from "@/i18n/legacy";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function parseAxiomList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function WorldAxiomsCard(props: {
  rawAxioms?: string | null;
  savePending: boolean;
  onSave: (axioms: string[]) => void;
}) {
  const { rawAxioms, savePending, onSave } = props;
  const parsedAxioms = useMemo(() => parseAxiomList(rawAxioms), [rawAxioms]);
  const [draftAxioms, setDraftAxioms] = useState<string[]>(parsedAxioms.length > 0 ? parsedAxioms : [""]);

  useEffect(() => {
    setDraftAxioms(parsedAxioms.length > 0 ? parsedAxioms : [""]);
  }, [parsedAxioms]);

  const normalizedDrafts = draftAxioms.map((item) => item.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{translateUi("核心规则（公理）")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">

          {translateUi("可以把它理解成“这个世界不能随便打破的底层规则”。后面的自动生成和手册体检都会参考这里。")}
        </div>
        {draftAxioms.map((axiom, index) => (
          <Input
            key={`${index}-${axiom}`}
            value={axiom}
            placeholder={translateUi("核心规则 {{value0}}", { value0: index + 1 })}
            onChange={(event) =>
              setDraftAxioms((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
            }
          />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setDraftAxioms((prev) => [...prev, ""])}>

            {translateUi("新增一条")}
          </Button>
          <Button
            type="button"
            onClick={() => onSave(normalizedDrafts)}
            disabled={savePending || normalizedDrafts.length === 0}
          >
            {savePending ? translateUi("保存中...") : translateUi("保存核心规则")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
