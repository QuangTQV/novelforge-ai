import { translateUi } from "@/i18n/legacy";
import type { AntiAiEffectiveRulesResult, StyleProfile } from "@ai-novel/shared/types/styleEngine";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EffectiveRuleList from "./EffectiveRuleList";

interface AntiAiEffectivePreviewCardProps {
  profiles: StyleProfile[];
  styleProfileId: string;
  effective?: AntiAiEffectiveRulesResult;
  loading: boolean;
  onStyleProfileChange: (styleProfileId: string) => void;
}

export default function AntiAiEffectivePreviewCard(props: AntiAiEffectivePreviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <SlidersHorizontal className="h-5 w-5" />

          {translateUi("生效预览")}
        </CardTitle>
        <CardDescription>

          {translateUi("查看正文生成会拿到的全局规则，以及选中写法后叠加的专属规则。")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={props.styleProfileId || "__global__"}
          onValueChange={(value) => props.onStyleProfileChange(value === "__global__" ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={translateUi("选择预览上下文")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__global__">{translateUi("只看全局默认")}</SelectItem>
            {props.profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>{translateUi(profile.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {props.loading ? (
          <div className="text-sm text-muted-foreground">{translateUi("正在计算生效规则...")}</div>
        ) : null}

        {props.effective ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">{translateUi("全局基线")}</div>
                <div className="mt-1 font-semibold">{props.effective.usesGlobalAntiAiBaseline ? translateUi("应用") : translateUi("未应用")}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">{translateUi("生效规则")}</div>
                <div className="mt-1 font-semibold">{props.effective.effectiveRules.length}</div>
              </div>
            </div>
            <EffectiveRuleList
              title={translateUi("全局默认规则")}
              rules={props.effective.globalBaselineRules}
              empty={translateUi("没有全局默认规则。")}
            />
            <EffectiveRuleList
              title={translateUi("写法专属规则")}
              rules={props.effective.styleSpecificRules}
              empty={translateUi("预览上下文没有叠加写法专属规则。")}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
