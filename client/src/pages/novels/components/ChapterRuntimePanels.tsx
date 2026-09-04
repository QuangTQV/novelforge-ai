import { translateUi } from "@/i18n/legacy";
import type { ChapterRuntimePackage } from "@ai-novel/shared/types/chapterRuntime";
import type { AuditReport, ReplanRecommendation, ReplanResult, StoryPlan, StoryStateSnapshot } from "@ai-novel/shared/types/novel";
import i18n from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildReplanRecommendationFromAuditReports } from "../chapterPlanning.shared";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`chapterRuntime:${key}`, options);

function parseStringArray(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function buildPlanView(runtimePackage: ChapterRuntimePackage | null, chapterPlan: StoryPlan | null | undefined) {
  if (runtimePackage?.context.plan) {
    return runtimePackage.context.plan;
  }
  if (!chapterPlan) {
    return null;
  }
  return {
    id: chapterPlan.id,
    chapterId: chapterPlan.chapterId ?? null,
    planRole: chapterPlan.planRole ?? null,
    phaseLabel: chapterPlan.phaseLabel ?? null,
    title: chapterPlan.title,
    objective: chapterPlan.objective,
    participants: parseStringArray(chapterPlan.participantsJson),
    reveals: parseStringArray(chapterPlan.revealsJson),
    riskNotes: parseStringArray(chapterPlan.riskNotesJson),
    mustAdvance: parseStringArray(chapterPlan.mustAdvanceJson),
    mustPreserve: parseStringArray(chapterPlan.mustPreserveJson),
    sourceIssueIds: parseStringArray(chapterPlan.sourceIssueIdsJson),
    replannedFromPlanId: chapterPlan.replannedFromPlanId ?? null,
    hookTarget: chapterPlan.hookTarget ?? null,
    rawPlanJson: chapterPlan.rawPlanJson ?? null,
    scenes: chapterPlan.scenes ?? [],
    createdAt: chapterPlan.createdAt,
    updatedAt: chapterPlan.updatedAt,
  };
}

function buildStateView(runtimePackage: ChapterRuntimePackage | null, stateSnapshot: StoryStateSnapshot | null | undefined) {
  if (runtimePackage?.context.stateSnapshot) {
    return runtimePackage.context.stateSnapshot;
  }
  if (!stateSnapshot) {
    return null;
  }
  return stateSnapshot;
}

function buildOpenConflictView(runtimePackage: ChapterRuntimePackage | null) {
  return runtimePackage?.context.openConflicts ?? [];
}

function buildAuditView(runtimePackage: ChapterRuntimePackage | null, auditReports: AuditReport[] | undefined) {
  if (runtimePackage?.audit) {
    return runtimePackage.audit;
  }
  const reports = auditReports ?? [];
  const openIssues = reports.flatMap((report) => report.issues).filter((issue) => issue.status === "open");
  const reportScores = reports
    .map((report) => report.overallScore ?? null)
    .filter((score): score is number => typeof score === "number");
  const overall = reportScores.length > 0
    ? Math.round(reportScores.reduce((sum, score) => sum + score, 0) / reportScores.length)
    : 0;
  return {
    score: {
      coherence: overall,
      repetition: overall,
      pacing: overall,
      voice: overall,
      engagement: overall,
      overall,
    },
    reports,
    openIssues,
    hasBlockingIssues: openIssues.some((issue) => issue.severity === "high" || issue.severity === "critical"),
  };
}

function buildReplanSummary(
  runtimePackage: ChapterRuntimePackage | null,
  auditReports: AuditReport[] | undefined,
  replanRecommendation?: ReplanRecommendation | null,
) {
  if (runtimePackage?.replanRecommendation) {
    return runtimePackage.replanRecommendation;
  }
  if (replanRecommendation) {
    return replanRecommendation;
  }
  return buildReplanRecommendationFromAuditReports(auditReports);
}

function buildTriggerLabel(triggerType: string): string {
  switch (triggerType) {
    case "manual":
      return t("trigger.manual");
    case "auto_milestone":
      return t("trigger.autoMilestone");
    case "before_pipeline":
      return t("trigger.beforePipeline");
    default:
      return triggerType.replace(/_/g, " ");
  }
}

function buildWordControlModeLabel(mode: "prompt_only" | "balanced" | "hybrid" | string): string {
  switch (mode) {
    case "prompt_only":
      return t("lengthPolicy.natural");
    case "balanced":
      return t("lengthPolicy.standard");
    case "hybrid":
      return t("lengthPolicy.mixed");
    default:
      return mode;
  }
}

function formatVariance(value: number): string {
  const percentage = Math.round(value * 100);
  return `${percentage > 0 ? "+" : ""}${percentage}%`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === "critical" || severity === "high" ? "default" : "secondary";
  return <Badge variant={variant}>{severity}</Badge>;
}

export function ChapterRuntimeLengthCard(props: {
  runtimePackage: ChapterRuntimePackage | null;
}) {
  const lengthControl = props.runtimePackage?.lengthControl ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("length.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {lengthControl ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("length.mode")}</div>
                <div className="mt-1 font-medium">{buildWordControlModeLabel(lengthControl.wordControlMode)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {lengthControl.closingPhaseTriggered ? t("length.closing") : t("length.normal")}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("length.targetResult")}</div>
                <div className="mt-1 font-medium">{t("length.words", { actual: lengthControl.finalWordCount, target: lengthControl.targetWordCount })}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("length.variance", { value: formatVariance(lengthControl.variance) })}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("length.budget")}</div>
                <div className="mt-1 font-medium">{t("length.range", { min: lengthControl.softMinWordCount, max: lengthControl.softMaxWordCount })}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("length.hardMax", { value: lengthControl.hardMaxWordCount })}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("ui.signal")}</div>
                <div className="mt-1 font-medium">{t("ui.hardStops", { count: lengthControl.hardStopsTriggered })}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("ui.scenes", { actual: lengthControl.generatedSceneCount, planned: lengthControl.plannedSceneCount })}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{t("ui.repairPath")}</div>
              <div className="mt-1">
                {lengthControl.lengthRepairPath.length > 0
                  ? lengthControl.lengthRepairPath.join(" -> ")
                  : t("ui.noRepair")}
              </div>
              <div className="mt-1">
                {lengthControl.overlengthRepairApplied ? t("ui.overlength") : t("ui.noOverlength")}
              </div>
            </div>

            {lengthControl.sceneResults.length > 0 ? (
              <div className="space-y-2">
                {lengthControl.sceneResults.map((scene, index) => (
                  <div key={`${scene.sceneIndex}-${index}`} className="rounded-md border p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{t("ui.scenes", { actual: scene.sceneIndex, planned: "" })}</Badge>
                      <Badge variant="secondary">{scene.actualWordCount}  {translateUi("字")}</Badge>
                      <Badge variant="outline">{buildWordControlModeLabel(scene.wordControlMode)}</Badge>
                      <Badge variant={scene.sceneStatus === "compressed" ? "default" : "outline"}>{scene.sceneStatus}</Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {t("ui.hardStops", { count: scene.hardStopCount })} · {scene.roundCount}
                      {scene.closingPhaseTriggered ? ` · ${t("length.closing")}` : ""}
                    </div>
                    {scene.roundResults.length > 0 ? (
                      <div className="mt-2 space-y-1 rounded-md border bg-muted/15 p-2">
                        {scene.roundResults.map((round) => (
                          <div key={`${scene.sceneIndex}-${round.roundIndex}`} className="text-muted-foreground">
                            {t("ui.rounds", { round: round.roundIndex, suggested: round.suggestedWordCount ?? "-", actual: round.actualWordCount })} ·
                            {round.isFinalRound ? t("ui.finalRound") : t("ui.middleRound")} ·
                            {round.hardStopTriggered ? t("ui.hardStop") : t("ui.naturalEnd")}
                            {round.trimmedAtSentenceBoundary ? ` · ${t("ui.sentenceTrim")}` : ""}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-muted-foreground">{t("ui.noLengthData")}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChapterRuntimeContextCard(props: {
  runtimePackage: ChapterRuntimePackage | null;
  chapterPlan?: StoryPlan | null;
  stateSnapshot?: StoryStateSnapshot | null;
}) {
  const plan = buildPlanView(props.runtimePackage, props.chapterPlan);
  const stateSnapshot = buildStateView(props.runtimePackage, props.stateSnapshot);
  const openConflicts = buildOpenConflictView(props.runtimePackage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("ui.contextTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <div className="font-medium">{t("ui.plan")}</div>
          {plan ? (
            <>
              <div className="text-muted-foreground">{plan.title}</div>
              <div>{plan.objective}</div>
              {(plan.planRole || plan.phaseLabel) ? (
                <div className="text-xs text-muted-foreground">
                  {[plan.planRole ? t("ui.role", { value: plan.planRole }) : "", plan.phaseLabel ? t("ui.phase", { value: plan.phaseLabel }) : ""].filter(Boolean).join(" | ")}
                </div>
              ) : null}
              {plan.participants.length > 0 ? (
                <div className="text-xs text-muted-foreground">{t("ui.participants", { value: plan.participants.join("、") })}</div>
              ) : null}
              {plan.mustAdvance.length > 0 ? (
                <div className="text-xs text-muted-foreground">{t("ui.mustAdvance", { value: plan.mustAdvance.join("；") })}</div>
              ) : null}
              {plan.mustPreserve.length > 0 ? (
                <div className="text-xs text-muted-foreground">{t("ui.mustPreserve", { value: plan.mustPreserve.join("；") })}</div>
              ) : null}
              {plan.replannedFromPlanId ? (
                <div className="text-xs text-muted-foreground">{t("ui.replanned")}</div>
              ) : null}
              {plan.sourceIssueIds.length > 0 ? (
                <div className="text-xs text-muted-foreground">{t("ui.sourceIssues", { count: plan.sourceIssueIds.length })}</div>
              ) : null}
              {plan.scenes.length > 0 ? (
                <div className="space-y-1 rounded-md border p-2 text-xs">
                  {plan.scenes.slice(0, 4).map((scene) => (
                    <div key={scene.id}>
                      <div className="font-medium">{scene.sortOrder}. {scene.title}</div>
                      <div className="text-muted-foreground">
                        {[scene.objective, scene.conflict, scene.reveal, scene.emotionBeat].filter(Boolean).join(" | ") || t("ui.noSupplement")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-muted-foreground">{t("ui.noPlan")}</div>
          )}
        </div>

        <div className="space-y-1">
          <div className="font-medium">{t("ui.stateSnapshot")}</div>
          {stateSnapshot ? (
            <>
              <div>{stateSnapshot.summary || t("ui.noSummary")}</div>
              {stateSnapshot.characterStates.length > 0 ? (
                <div className="rounded-md border p-2 text-xs">
                  {stateSnapshot.characterStates.slice(0, 4).map((item) => (
                    <div key={item.characterId} className="text-muted-foreground">
                      {item.summary || item.emotion || item.currentGoal || item.characterId}
                    </div>
                  ))}
                </div>
              ) : null}
              {stateSnapshot.informationStates.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  {t("ui.knowledgeState", { value: stateSnapshot.informationStates.slice(0, 3).map((item) => item.fact).join("；") })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-muted-foreground">{t("ui.noSnapshot")}</div>
          )}
        </div>

        <div className="space-y-1">
          <div className="font-medium">{t("ui.activeConflicts")}</div>
          {openConflicts.length > 0 ? (
            <div className="space-y-2">
              {openConflicts.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <SeverityBadge severity={item.severity} />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <div>{item.summary}</div>
                  {typeof item.lastSeenChapterOrder === "number" ? (
                    <div className="mt-1 text-muted-foreground">{t("ui.lastSeen", { chapter: item.lastSeenChapterOrder })}</div>
                  ) : null}
                  {item.resolutionHint ? (
                    <div className="mt-1 text-muted-foreground">{t("ui.suggestion", { value: item.resolutionHint })}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">{t("ui.noConflicts")}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChapterRuntimeAuditCard(props: {
  runtimePackage: ChapterRuntimePackage | null;
  auditReports?: AuditReport[];
  replanRecommendation?: ReplanRecommendation | null;
  onReplan?: () => void;
  isReplanning?: boolean;
  lastReplanResult?: ReplanResult | null;
}) {
  const audit = buildAuditView(props.runtimePackage, props.auditReports);
  const replanSummary = buildReplanSummary(
    props.runtimePackage,
    props.auditReports,
    props.replanRecommendation,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{translateUi("当前问题与修复建议")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="font-medium">{translateUi("总分")} {audit.score.overall}</div>
          <Badge variant={audit.hasBlockingIssues ? "default" : "outline"}>
            {audit.hasBlockingIssues ? translateUi("需处理") : translateUi("可继续")}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">

          {translateUi("审计报告")} {audit.reports.length}  {translateUi("份，未解决问题")} {audit.openIssues.length}  {translateUi("条。")}
        </div>
        {replanSummary ? (
          <div className="rounded-md border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">

                {translateUi("后续章节计划：")}{replanSummary.recommended ? translateUi("建议调整") : translateUi("暂不调整")}
              </div>
              {typeof props.onReplan === "function" ? (
                <Button
                  size="sm"
                  variant={replanSummary.recommended ? "default" : "outline"}
                  onClick={props.onReplan}
                  disabled={props.isReplanning}
                >
                  {props.isReplanning ? translateUi("调整中...") : replanSummary.recommended ? translateUi("执行重规划") : translateUi("查看重规划")}
                </Button>
              ) : null}
            </div>
            <div className="text-muted-foreground">{replanSummary.reason}</div>
            {replanSummary.blockingIssueIds.length > 0 ? (
              <div className="mt-1 text-muted-foreground">

                {translateUi("高风险问题：")}{replanSummary.blockingIssueIds.length}
              </div>
            ) : null}
          </div>
        ) : null}
        {props.lastReplanResult ? (
          <div className="rounded-md border bg-muted/20 p-2 text-xs">
            <div className="font-medium">{translateUi("最近一次规划调整")}</div>
            <div className="mt-1 text-muted-foreground">

              {translateUi("影响章节：")}{props.lastReplanResult.affectedChapterOrders.join(", ") || translateUi("暂无")}
            </div>
            <div className="text-muted-foreground">

              {translateUi("调整窗口：")}{props.lastReplanResult.windowSize}  {translateUi("| 触发方式：")}{buildTriggerLabel(props.lastReplanResult.triggerType)}
            </div>
            {props.lastReplanResult.sourceIssueIds.length > 0 ? (
              <div className="text-muted-foreground">

                {translateUi("来源问题：")}{props.lastReplanResult.sourceIssueIds.length}
              </div>
            ) : null}
          </div>
        ) : null}
        {audit.openIssues.length > 0 ? (
          <div className="space-y-2">
            {audit.openIssues.slice(0, 6).map((issue) => (
              <div key={issue.id} className="rounded-md border p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <SeverityBadge severity={issue.severity} />
                  <span className="font-medium">{issue.code}</span>
                </div>
                <div>{issue.description}</div>
                <div className="mt-1 text-muted-foreground">{translateUi("证据：")}{issue.evidence}</div>
                <div className="mt-1 text-muted-foreground">{translateUi("建议：")}{issue.fixSuggestion}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">{translateUi("当前没有待处理问题。")}</div>
        )}
      </CardContent>
    </Card>
  );
}
