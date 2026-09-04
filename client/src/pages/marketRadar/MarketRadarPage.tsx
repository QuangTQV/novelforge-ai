import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MarketInfluenceMode,
  MarketFoundationSyncTarget,
  MarketRadarPlatform,
  MarketTrendReport,
} from "@ai-novel/shared/types/marketRadar";
import { ArrowRight, Check, ExternalLink, Loader2, Radar, RefreshCw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  createMarketCreativeBrief,
  getMarketRadarScan,
  getMarketRadarSources,
  startMarketRadarAnalysis,
  startMarketRadarScan,
  syncMarketProductionFoundation,
} from "@/api/marketRadar";
import { queryKeys } from "@/api/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { resolveMarketFoundationLibraryState } from "./marketFoundationLibraryState";

const PLATFORM_ORDER: MarketRadarPlatform[] = ["fanqie", "qidian", "jinjiang"];
const INFLUENCE_MODE_ORDER: MarketInfluenceMode[] = ["follow_hot", "differentiate", "light"];

function recommendedSignalIds(report: MarketTrendReport): string[] {
  const recommended = report.signals.filter((signal) => signal.recommended);
  const opportunity = recommended.find((signal) => signal.kind === "opportunity");
  return [opportunity, ...recommended.filter((signal) => signal.id !== opportunity?.id)]
    .filter(Boolean).slice(0, 4).map((signal) => signal!.id);
}

function marketSourceKey(value: { platform: string; listKey: string }): string {
  return `${value.platform}:${value.listKey}`;
}

export default function MarketRadarPage() {
  const { t } = useTranslation("marketRadar");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [platforms, setPlatforms] = useState<MarketRadarPlatform[]>(["fanqie", "qidian", "jinjiang"]);
  const [activeRunId, setActiveRunId] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedAnalysisItemIds, setSelectedAnalysisItemIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [influenceMode, setInfluenceMode] = useState<MarketInfluenceMode>("differentiate");
  const initialScanStarted = useRef(false);
  const analysisResultRef = useRef<HTMLDivElement | null>(null);

  const sourcesQuery = useQuery({ queryKey: queryKeys.marketRadar.sources, queryFn: getMarketRadarSources });
  const scanQuery = useQuery({
    queryKey: queryKeys.marketRadar.scan(activeRunId || "none"),
    queryFn: () => getMarketRadarScan(activeRunId),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "queued" || status === "running" || status === "analyzing" ? 1500 : false;
    },
  });
  const activeRun = scanQuery.data?.data ?? null;
  const report = showAnalysis ? activeRun?.report ?? null : null;

  useEffect(() => {
    if (!report) return;
    setSelectedIds((current) => current.length > 0 ? current : recommendedSignalIds(report));
  }, [report?.id]);

  useEffect(() => {
    if (report) analysisResultRef.current?.scrollIntoView({ block: "start" });
  }, [report?.id]);

  const scanMutation = useMutation({
    mutationFn: () => startMarketRadarScan(platforms),
    onSuccess: (response) => {
      const run = response.data;
      if (!run) return;
      setActiveRunId(run.id);
      setShowAnalysis(false);
      setSelectedAnalysisItemIds([]);
      setSelectedIds([]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.scanFailed")),
  });
  const analysisMutation = useMutation({
    mutationFn: () => startMarketRadarAnalysis(activeRun!.id, {
      selectedItemIds: selectedAnalysisItemIds,
    }),
    onSuccess: (response) => {
      const run = response.data;
      if (!run) return;
      queryClient.setQueryData(queryKeys.marketRadar.scan(run.id), response);
      if (run.report) setSelectedIds(recommendedSignalIds(run.report));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.analysisFailed")),
  });
  const briefMutation = useMutation({
    mutationFn: () => createMarketCreativeBrief({ reportId: report!.id, signalIds: selectedIds, influenceMode }),
    onSuccess: (response) => {
      if (response.data) navigate(`/novels/auto-director?marketBriefId=${encodeURIComponent(response.data.id)}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.briefFailed")),
  });
  const foundationSyncMutation = useMutation({
    mutationFn: (target: MarketFoundationSyncTarget) => syncMarketProductionFoundation(report!.id, { target }),
    onSuccess: async (_response, target) => {
      await queryClient.invalidateQueries({
        queryKey: target === "genre" ? queryKeys.genres.all : queryKeys.storyModes.all,
      });
      await scanQuery.refetch();
      toast.success(target === "genre" ? t("toast.genreSynced") : t("toast.storyModeSynced"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("toast.syncFailed")),
  });

  useEffect(() => {
    if (initialScanStarted.current) return;
    initialScanStarted.current = true;
    scanMutation.mutate();
  }, []);

  const scanning = (!activeRun && scanMutation.isPending) || activeRun?.status === "queued" || activeRun?.status === "running";
  const analyzing = analysisMutation.isPending || activeRun?.status === "analyzing";
  const foundationCandidate = report?.productionFoundationCandidate ?? null;
  const {
    genreId: genreLibraryId,
    primaryStoryModeId: primaryStoryModeLibraryId,
    secondaryStoryModeId: secondaryStoryModeLibraryId,
    storyModesNeedSync,
  } = resolveMarketFoundationLibraryState(foundationCandidate, report?.productionFoundationSync);
  const rankingGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof activeRun>["rankingItems"]>();
    for (const item of activeRun?.rankingItems ?? []) {
      const key = `${item.platform}:${item.listKey}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const isPrimaryList = (key: string) => key.endsWith(":new_book") || key.endsWith(":new_author");
    return [...groups.entries()]
      .sort(([left], [right]) => Number(isPrimaryList(right)) - Number(isPrimaryList(left)))
      .map(([key, items]) => ({
        key,
        platform: items[0].platform,
        listKey: items[0].listKey,
        items: items.sort((left, right) => left.rank - right.rank),
      }));
  }, [activeRun?.rankingItems]);
  const sourceLabels = useMemo(() => new Map((sourcesQuery.data?.data ?? []).map((source) => [`${source.platform}:${source.listKey}`, source.listLabel])), [sourcesQuery.data]);
  const rankingGroupSignature = rankingGroups.map((group) => group.key).join("|");

  useEffect(() => {
    if (scanning || rankingGroups.length === 0) return;
    const availableIds = new Set(rankingGroups.flatMap((group) => group.items.map((item) => item.id)));
    const reportItemIds = activeRun?.report?.analyzedItemIds?.filter((id) => availableIds.has(id)) ?? [];
    const reportListKeys = new Set(activeRun?.report?.analyzedLists?.map(marketSourceKey) ?? []);
    const primaryPlatforms = new Set(rankingGroups
      .filter((group) => group.listKey === "new_book" || group.listKey === "new_author")
      .map((group) => group.platform));
    const recommendedItemIds = rankingGroups
      .filter((group) => !primaryPlatforms.has(group.platform) || group.listKey === "new_book" || group.listKey === "new_author")
      .flatMap((group) => group.items.map((item) => item.id));
    const legacyReportItemIds = rankingGroups
      .filter((group) => reportListKeys.has(group.key))
      .flatMap((group) => group.items.map((item) => item.id));
    setSelectedAnalysisItemIds((current) => {
      const availableCurrent = current.filter((id) => availableIds.has(id));
      if (availableCurrent.length > 0) return availableCurrent;
      if (reportItemIds.length > 0) return reportItemIds;
      if (legacyReportItemIds.length > 0) return legacyReportItemIds;
      return recommendedItemIds;
    });
  }, [activeRun?.id, activeRun?.report?.id, rankingGroupSignature, scanning]);

  const togglePlatform = (platform: MarketRadarPlatform) => {
    setPlatforms((current) => current.includes(platform)
      ? current.length === 1 ? current : current.filter((item) => item !== platform)
      : [...current, platform]);
  };
  const toggleSignal = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) { toast.error(t("toast.maxSignals")); return current; }
      return [...current, id];
    });
  };
  const toggleAnalysisList = (itemIds: string[]) => {
    setSelectedAnalysisItemIds((current) => {
      const currentSet = new Set(current);
      const allSelected = itemIds.every((id) => currentSet.has(id));
      if (allSelected) return current.filter((id) => !itemIds.includes(id));
      return [...new Set([...current, ...itemIds])];
    });
  };
  const toggleAnalysisItem = (id: string) => {
    setSelectedAnalysisItemIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };
  const openOrStartAnalysis = () => {
    setShowAnalysis(true);
    if (!activeRun?.report) analysisMutation.mutate();
  };

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/35 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">{t("page.title")}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {PLATFORM_ORDER.map((key) => (
            <button key={key} type="button" onClick={() => togglePlatform(key)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", platforms.includes(key) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{t(`platforms.${key}`)}</button>
          ))}
          <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending || scanning || sourcesQuery.isPending} variant="outline">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? t("scan.inProgress", { percent: Math.round((activeRun?.progress ?? 0) * 100) }) : t("scan.rescan")}
          </Button>
        </div>
      </div>

      {activeRun?.platformStatuses.some((item) => item.status !== "succeeded") ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/15"><CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">{t("scan.partialFailure", { details: activeRun.platformStatuses.filter((item) => item.status !== "succeeded").map((item) => t("scan.platformError", { platform: t(`platforms.${item.platform}`), error: item.error || t("scan.readFailed") })).join("；") })}</CardContent></Card>
      ) : null}
      {activeRun?.status === "failed" ? (
        <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{t("scan.runFailed", { error: activeRun.lastError || t("scan.noPublicData") })}</CardContent></Card>
      ) : null}
      {activeRun?.lastError && activeRun.status !== "failed" ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/15"><CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">{activeRun.lastError}</CardContent></Card>
      ) : null}

      {rankingGroups.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">{scanning ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Radar className="h-10 w-10 text-muted-foreground" />}<div className="font-medium">{scanning ? t("scan.emptyLoadingTitle") : t("scan.emptyTitle")}</div><p className="max-w-lg text-sm text-muted-foreground">{t("scan.emptyHint")}</p></CardContent></Card>
      ) : <>
        <section className="flex flex-col gap-4 border-b border-border/50 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-sm text-muted-foreground">{activeRun?.report ? t("analysis.lockedScope") : t("analysis.selectedCount", { count: selectedAnalysisItemIds.length })}</p>
          <div className="flex justify-end">
            <Button onClick={openOrStartAnalysis} disabled={scanning || analyzing || selectedAnalysisItemIds.length === 0} className="shrink-0">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scanning ? t("analysis.waitingForScan") : analyzing ? t("analysis.inProgress", { percent: Math.round((activeRun?.progress ?? 0) * 100) }) : activeRun?.report ? t("analysis.viewAnalysis") : t("analysis.start", { count: selectedAnalysisItemIds.length })}
            </Button>
          </div>
        </section>
        <div className="grid items-start gap-x-6 gap-y-8 md:grid-cols-2 2xl:grid-cols-3">
          {rankingGroups.map(({ key, items }) => {
            const itemIds = items.map((item) => item.id);
            const selectedCount = itemIds.filter((id) => selectedAnalysisItemIds.includes(id)).length;
            const allSelected = selectedCount === itemIds.length;
            return <Card key={key} className="flex h-[34rem] flex-col">
            <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/40 px-4 pb-4 pt-4">
              <div><CardTitle className="text-base">{t(`platforms.${items[0].platform}`)} · {sourceLabels.get(key) ?? items[0].listKey}</CardTitle><CardDescription className="mt-1">{t("analysis.listRecordCount", { count: items.length })}</CardDescription></div>
              <Button type="button" variant="ghost" size="sm" aria-pressed={allSelected} disabled={Boolean(activeRun?.report) || scanning || analyzing} onClick={() => toggleAnalysisList(itemIds)} className="shrink-0">
                {allSelected ? t("analysis.clearAll") : t("analysis.selectAll")}{selectedCount > 0 && !allSelected ? ` ${selectedCount}/${items.length}` : ""}
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2"><div className="divide-y divide-border/35">{items.map((item) => {
              const selected = selectedAnalysisItemIds.includes(item.id);
              return <div key={item.id} className="grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_1.75rem] items-center gap-2 px-2 py-2.5 text-sm transition-colors hover:bg-muted/45">
                <button type="button" aria-pressed={selected} aria-label={selected ? t("analysis.deselectItem", { title: item.title }) : t("analysis.selectItem", { title: item.title })} disabled={Boolean(activeRun?.report) || analyzing} onClick={() => toggleAnalysisItem(item.id)} className={cn("flex h-4 w-4 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {selected ? <Check className="h-3 w-3" /> : null}
                </button>
                <span className="font-mono text-muted-foreground">#{item.rank}</span>
                <button type="button" disabled={Boolean(activeRun?.report) || analyzing} onClick={() => toggleAnalysisItem(item.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.author || t("analysis.authorHidden")}{item.category ? ` · ${item.category}` : ""}</span>
                </button>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={t("analysis.viewSource", { title: item.title })} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>;
            })}</div></CardContent>
          </Card>})}
        </div>
      </>}

      {report ? (
        <div ref={analysisResultRef} className="space-y-6 scroll-mt-6">
          <Card>
            <CardHeader><CardTitle className="text-xl">{t("report.verdictTitle")}</CardTitle><CardDescription>{t("report.verdictMeta", { date: new Date(report.createdAt).toLocaleString() })}</CardDescription></CardHeader>
            <CardContent>
              <p className="leading-7">{report.summary}</p>
              {foundationCandidate ? (
                <div className="mt-4 rounded-lg bg-muted/45 px-4 py-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><span className="text-muted-foreground">{t("report.genreFoundation")}</span>{report.productionFoundationSync?.genre?.path ?? foundationCandidate.genre.name}</span>
                      {genreLibraryId ? (
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <Link to={`/genres?selectedId=${encodeURIComponent(genreLibraryId)}`}><Check className="h-3.5 w-3.5" />{t("report.inLibrary")}</Link>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled={foundationSyncMutation.isPending} onClick={() => foundationSyncMutation.mutate("genre")}>
                          {foundationSyncMutation.isPending && foundationSyncMutation.variables === "genre" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{t("report.addGenreFoundation")}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><span className="text-muted-foreground">{t("report.primaryStoryMode")}</span>{report.productionFoundationSync?.storyModes?.primaryStoryMode.path ?? foundationCandidate.primaryStoryMode.name}</span>
                      {primaryStoryModeLibraryId ? <Button type="button" variant="ghost" size="sm" asChild><Link to={`/story-modes?selectedId=${encodeURIComponent(primaryStoryModeLibraryId)}`}><Check className="h-3.5 w-3.5" />{t("report.inLibrary")}</Link></Button> : null}
                    </div>
                    {foundationCandidate.secondaryStoryMode ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span><span className="text-muted-foreground">{t("report.secondaryStoryMode")}</span>{report.productionFoundationSync?.storyModes?.secondaryStoryMode?.path ?? foundationCandidate.secondaryStoryMode.name}</span>
                        {secondaryStoryModeLibraryId ? <Button type="button" variant="ghost" size="sm" asChild><Link to={`/story-modes?selectedId=${encodeURIComponent(secondaryStoryModeLibraryId)}`}><Check className="h-3.5 w-3.5" />{t("report.inLibrary")}</Link></Button> : null}
                      </div>
                    ) : null}
                    {storyModesNeedSync ? (
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" disabled={foundationSyncMutation.isPending} onClick={() => foundationSyncMutation.mutate("story_modes")}>
                          {foundationSyncMutation.isPending && foundationSyncMutation.variables === "story_modes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{t("report.addStoryModeLibrary")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("report.foundationHint")}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">{report.platformStatuses.map((status) => <Badge key={status.platform} variant={status.status === "failed" ? "destructive" : "outline"}>{t("report.platformItemCount", { platform: t(`platforms.${status.platform}`), count: status.itemCount })}{status.status === "stale" ? t("report.suggestRefresh") : ""}</Badge>)}</div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.signals.map((signal) => {
              const selected = selectedIds.includes(signal.id);
              return <article key={signal.id} className={cn("rounded-xl border p-5 text-left transition hover:border-primary/50 hover:shadow-sm", selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card")}>
                <button type="button" aria-pressed={selected} onClick={() => toggleSignal(signal.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3"><Badge variant={signal.kind === "opportunity" ? "default" : signal.kind === "crowding" ? "destructive" : "secondary"}>{t(`signalKind.${signal.kind}`)}</Badge>{selected ? <span className="text-xs font-medium text-primary">{t("report.signalSelected")}</span> : null}</div>
                <div className="mt-4 text-lg font-semibold">{signal.label}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.summary}</p>
                <div className="mt-4 flex gap-3 text-xs text-muted-foreground"><span>{t("report.signalHeat", { value: signal.heat })}</span><span>{t("report.signalCrowding", { value: signal.crowding })}</span><span>{signal.direction === "current" ? t("signalDirection.current") : signal.direction === "rising" ? t("signalDirection.rising") : signal.direction === "falling" ? t("signalDirection.falling") : t("signalDirection.stable")}</span></div>
                </button>
              </article>;
            })}
          </div>

          <Card className="sticky bottom-4 border-primary/30 bg-background/95 shadow-xl backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="font-medium">{t("report.selectionCount", { count: selectedIds.length })}</div><p className="mt-1 text-xs text-muted-foreground">{t("report.selectionHint")}</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={influenceMode} onValueChange={(value) => setInfluenceMode(value as MarketInfluenceMode)}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{INFLUENCE_MODE_ORDER.map((value) => <SelectItem key={value} value={value}>{t(`influenceMode.${value}`)}</SelectItem>)}</SelectContent></Select>
                <Button onClick={() => briefMutation.mutate()} disabled={selectedIds.length === 0 || briefMutation.isPending}>{briefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{t("report.createWithSignals")}<ArrowRight className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
