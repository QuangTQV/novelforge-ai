import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpenCheck, Bot, Database, MonitorCog } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getAPIKeySettings,
  getModelRoutes,
  getRagSettings,
  getStyleEngineRuntimeSettings,
  testModelRouteConnectivity,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsReadinessCard, { buildSettingsReadinessItems } from "../components/SettingsReadinessCard";
import { SettingsShell } from "../components/SettingsShell";
import { APP_RUNTIME } from "@/lib/constants";

const entries = [
  { to: "/settings/models", key: "models", icon: Bot },
  { to: "/settings/director", key: "director", icon: BookOpenCheck },
  { to: "/settings/knowledge", key: "knowledge", icon: Database },
  { to: "/settings/maintenance", key: "maintenance", icon: MonitorCog },
] as const;

export default function SettingsOverviewPage() {
  const { t } = useTranslation("settings");
  const providersQuery = useQuery({ queryKey: queryKeys.settings.apiKeys, queryFn: getAPIKeySettings });
  const routesQuery = useQuery({ queryKey: queryKeys.settings.modelRoutes, queryFn: getModelRoutes });
  const connectivityQuery = useQuery({
    queryKey: queryKeys.settings.modelRouteConnectivity,
    queryFn: testModelRouteConnectivity,
    enabled: routesQuery.isSuccess,
    refetchOnWindowFocus: false,
  });
  const ragQuery = useQuery({ queryKey: queryKeys.settings.rag, queryFn: getRagSettings });
  const styleQuery = useQuery({ queryKey: queryKeys.settings.styleEngineRuntime, queryFn: getStyleEngineRuntimeSettings });
  const items = useMemo(() => buildSettingsReadinessItems({
    providers: providersQuery.data?.data ?? [],
    modelRoutes: routesQuery.data?.data,
    modelRouteConnectivity: connectivityQuery.data?.data,
    ragSettings: ragQuery.data?.data,
    styleSettings: styleQuery.data?.data,
    isModelRoutesChecking: connectivityQuery.isPending || connectivityQuery.isFetching,
    isStyleSettingsLoaded: styleQuery.isSuccess,
  }), [connectivityQuery.data?.data, connectivityQuery.isFetching, connectivityQuery.isPending, providersQuery.data?.data, ragQuery.data?.data, routesQuery.data?.data, styleQuery.data?.data, styleQuery.isSuccess]);
  const configuredProvider = providersQuery.data?.data?.find((item) => item.isConfigured && item.isActive);
  const routeCount = routesQuery.data?.data?.routes.filter((route) => route.provider && route.model).length ?? 0;
  const rag = ragQuery.data?.data;

  const summaryByKey: Record<(typeof entries)[number]["key"], string> = {
    models: configuredProvider
      ? t("overview.entries.models.summaryConfigured", {
          provider: configuredProvider.name,
          model: configuredProvider.currentModel || t("overview.entries.models.noModel"),
          routeCount,
        })
      : t("overview.entries.models.summaryEmpty"),
    knowledge: rag?.enabled
      ? t("overview.entries.knowledge.summaryEnabled", {
          model: rag.embeddingModel || t("overview.entries.knowledge.noModel"),
        })
      : t("overview.entries.knowledge.summaryDisabled"),
    maintenance:
      APP_RUNTIME === "desktop"
        ? t("overview.entries.maintenance.summaryDesktop")
        : t("overview.entries.maintenance.summaryWeb"),
    director: t("overview.entries.director.summary"),
  };

  return (
    <SettingsShell title={t("overview.title")} description={t("overview.description")}>
      <SettingsReadinessCard items={items} />
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(({ to, key, icon: Icon }) => (
          <Card key={to} className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{t(`overview.entries.${key}.title`)}</CardTitle>
              <CardDescription>{t(`overview.entries.${key}.description`)}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-3">
              <p className="text-sm text-muted-foreground">{summaryByKey[key]}</p>
              <Button asChild variant="outline" size="sm" className="shrink-0"><Link to={to}>{t("overview.open")}<ArrowRight className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </SettingsShell>
  );
}
