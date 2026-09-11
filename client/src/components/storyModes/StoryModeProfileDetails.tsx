import { translateResourceText, translateUi } from "@/i18n/legacy";
import { BookOpen, CircleGauge, Workflow } from "lucide-react";
import type {
  NovelStoryMode,
  StoryModeProfile,
  StoryModeTwistMechanism,
} from "@ai-novel/shared/types/storyMode";
import { cn } from "@/lib/utils";

const conflictCeilingLabel = {
  low: translateUi("低强度"),
  medium: translateUi("中等强度"),
  high: translateUi("高强度"),
} as const;

const twistCadenceLabel: Record<StoryModeProfile["twistCadence"], string> = {
  none: translateUi("无反转（none）"),
  rare: translateUi("偶尔反转（rare）"),
  periodic: translateUi("阶段性反转（periodic）"),
  dense: translateUi("高密度反转（dense）"),
};

const twistIntensityLabel: Record<StoryModeProfile["twistIntensity"], string> = {
  mild: translateUi("轻微意外（mild）"),
  moderate: translateUi("中等改写（moderate）"),
  severe: translateUi("颠覆认知（severe）"),
};

const twistFairnessLabel: Record<StoryModeProfile["twistFairness"], string> = {
  clued: translateUi("提前埋线索（clued）"),
  mixed: translateUi("部分埋线索（mixed）"),
  blindside: translateUi("纯粹意外（blindside）"),
};

const twistScopeLabel: Record<StoryModeProfile["twistScope"], string> = {
  personal_secret: translateUi("个人秘密"),
  relationship_betrayal: translateUi("关系背叛"),
  faction_politics: translateUi("阵营/组织"),
  worldview_shattering: translateUi("世界观颠覆"),
};

const twistMechanismLabel: Record<StoryModeTwistMechanism, string> = {
  identity_concealment: translateUi("身份隐藏"),
  betrayal: translateUi("背叛倒戈"),
  hidden_motive: translateUi("隐藏动机"),
  unreliable_narrator: translateUi("叙述不可靠"),
  false_death: translateUi("诈死"),
  reality_break: translateUi("现实/时间线破坏"),
  other: translateUi("其他（AI 自由发挥）"),
};

function ContractList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-xs text-foreground">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

export default function StoryModeProfileDetails({
  node,
  eyebrow = translateUi("推进模式"),
  className,
  titleId,
}: {
  node: Pick<NovelStoryMode, "name" | "description" | "template" | "profile">;
  eyebrow?: string;
  className?: string;
  titleId?: string;
}) {
  const { profile } = node;

  return (
    <div className={cn("max-w-4xl", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">{eyebrow}</div>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{translateUi(node.name)}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <CircleGauge className="h-4 w-4" aria-hidden="true" />

          {translateUi("冲突上限：")}{conflictCeilingLabel[profile.conflictCeiling]}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        {node.description?.trim() ? translateResourceText(node.description) : translateResourceText(profile.coreDrive)}
      </p>

      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/70 md:grid-cols-2">
        <div className="bg-background p-4">
          <Workflow className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="mt-3 text-xs font-medium text-muted-foreground">{translateUi("核心驱动")}</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{translateResourceText(profile.coreDrive)}</div>
        </div>
        <div className="bg-background p-4">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="mt-3 text-xs font-medium text-muted-foreground">{translateUi("读者回报")}</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{translateResourceText(profile.readerReward)}</div>
        </div>
        <div className="bg-background p-4">
          <div className="text-xs font-medium text-muted-foreground">{translateUi("章节推进单位")}</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{translateResourceText(profile.chapterUnit)}</div>
        </div>
        <div className="bg-background p-4">
          <div className="text-xs font-medium text-muted-foreground">{translateUi("阶段回报")}</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{translateResourceText(profile.volumeReward)}</div>
        </div>
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-2">
        <ContractList title={translateUi("推进单元")} items={profile.progressionUnits.map((item) => translateResourceText(item)).filter(Boolean)} emptyText={translateUi("尚未定义推进单元")} />
        <ContractList title={translateUi("适合的冲突")} items={profile.allowedConflictForms.map((item) => translateResourceText(item)).filter(Boolean)} emptyText={translateUi("尚未定义适合的冲突")} />
        <ContractList title={translateUi("必须出现的信号")} items={profile.mandatorySignals.map((item) => translateResourceText(item)).filter(Boolean)} emptyText={translateUi("尚未定义必须信号")} />
        <ContractList title={translateUi("需要避免的信号")} items={profile.antiSignals.map((item) => translateResourceText(item)).filter(Boolean)} emptyText={translateUi("尚未定义规避信号")} />
      </div>

      <div className="mt-7 border-l-2 border-foreground/20 pl-4">
        <div className="text-sm font-semibold text-foreground">{translateUi("解决方式")}</div>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{translateResourceText(profile.resolutionStyle)}</p>
        {profile.forbiddenConflictForms.length > 0 ? (
          <p className="mt-3 text-xs leading-6 text-muted-foreground">

            {translateUi("不适合：")}{profile.forbiddenConflictForms.map((item) => translateResourceText(item)).filter(Boolean).join(translateUi("、"))}
          </p>
        ) : null}
      </div>

      <div className="mt-7 border-t border-border/70 pt-6">
        <div className="text-sm font-semibold text-foreground">{translateUi("情节反转设置")}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{translateUi("控制这个模式允许多强、多密、多公平的反转，以及可以用哪些反转手法。")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground">{translateUi("反转/揭示密度")}</div>
            <div className="mt-1 text-sm text-foreground">{twistCadenceLabel[profile.twistCadence]}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">{translateUi("反转力度")}</div>
            <div className="mt-1 text-sm text-foreground">{twistIntensityLabel[profile.twistIntensity]}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">{translateUi("反转公平度")}</div>
            <div className="mt-1 text-sm text-foreground">{twistFairnessLabel[profile.twistFairness]}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">{translateUi("反转波及层级")}</div>
            <div className="mt-1 text-sm text-foreground">{twistScopeLabel[profile.twistScope]}</div>
          </div>
        </div>
        <div className="mt-4">
          <ContractList
            title={translateUi("允许的反转手法")}
            items={profile.allowedTwistMechanisms.map((item) => twistMechanismLabel[item])}
            emptyText={translateUi("尚未定义反转手法")}
          />
        </div>
      </div>

      {node.template?.trim() ? (
        <div className="mt-7 border-t border-border/70 pt-6">
          <div className="text-sm font-semibold text-foreground">{translateUi("AI 使用补充")}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{translateResourceText(node.template)}</p>
        </div>
      ) : null}
    </div>
  );
}
