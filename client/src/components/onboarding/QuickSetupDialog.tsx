import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  PlugZap,
  ServerCog,
  Sparkles,
} from "lucide-react";
import type {
  CompleteQuickSetupRequest,
  QuickSetupProviderOption,
  QuickSetupStatus,
} from "@ai-novel/shared/types/onboarding";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { completeQuickSetup } from "@/api/onboarding";
import { previewCustomProviderModels } from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { AppDialogContent, Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useLLMStore } from "@/store/llmStore";
import {
  shouldInitializeProviderSelection,
  shouldShowFirstNovelHandoff,
} from "./creationSetupState";

interface QuickSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: QuickSetupStatus | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  forceConfiguration?: boolean;
}

interface SetupForm {
  providerKind: "builtin" | "custom";
  provider: LLMProvider | "";
  customProviderName: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

const EMPTY_FORM: SetupForm = {
  providerKind: "builtin",
  provider: "",
  customProviderName: "",
  apiKey: "",
  baseURL: "",
  model: "",
};

function providerDescription(provider: QuickSetupProviderOption): string {
  if (provider.id === "deepseek") return i18n.t("onboarding:quickSetup.providerDesc.deepseek");
  if (provider.id === "ollama") return i18n.t("onboarding:quickSetup.providerDesc.ollama");
  if (provider.id === "openai") return i18n.t("onboarding:quickSetup.providerDesc.openai");
  return provider.configured ? i18n.t("onboarding:quickSetup.providerDesc.configured") : i18n.t("onboarding:quickSetup.providerDesc.default");
}

export default function QuickSetupDialog(props: QuickSetupDialogProps) {
  const { t } = useTranslation("onboarding");
  const queryClient = useQueryClient();
  const llmStore = useLLMStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<SetupForm>(EMPTY_FORM);
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [customModelsMessage, setCustomModelsMessage] = useState("");
  const [showAllProviderChoices, setShowAllProviderChoices] = useState(false);

  useEffect(() => {
    if (props.open && props.forceConfiguration) {
      setStep(1);
    }
  }, [props.forceConfiguration, props.open]);

  const selectedProvider = useMemo(
    () => props.status?.providers.find((provider) => provider.id === form.provider) ?? null,
    [form.provider, props.status?.providers],
  );
  const recommendedProvider = useMemo(
    () => props.status?.providers.find((provider) => provider.id === props.status?.selectedProvider)
      ?? props.status?.providers.find((provider) => provider.id === "deepseek")
      ?? props.status?.providers[0]
      ?? null,
    [props.status?.providers, props.status?.selectedProvider],
  );
  const preferredProvider = selectedProvider ?? recommendedProvider;
  const providerChoices: QuickSetupProviderOption[] = showAllProviderChoices
    ? props.status?.providers ?? []
    : preferredProvider ? [preferredProvider] : [];
  const modelOptions = form.providerKind === "custom"
    ? customModels
    : selectedProvider?.models ?? [];

  useEffect(() => {
    if (!shouldInitializeProviderSelection({
      open: props.open,
      statusAvailable: Boolean(props.status),
      providerKind: form.providerKind,
      provider: form.provider,
    })) {
      return;
    }
    if (!props.status) return;
    const preferred = props.status.providers.find(
      (provider) => provider.id === props.status?.selectedProvider,
    ) ?? props.status.providers.find((provider) => provider.id === "deepseek")
      ?? props.status.providers[0];
    if (!preferred) return;
    setForm({
      providerKind: preferred.kind,
      provider: preferred.id,
      customProviderName: preferred.kind === "custom" ? preferred.name : "",
      apiKey: "",
      baseURL: preferred.currentBaseURL || preferred.defaultBaseURL,
      model: preferred.currentModel || preferred.defaultModel,
    });
  }, [form.provider, form.providerKind, props.open, props.status]);

  const completeMutation = useMutation({
    mutationFn: (payload: CompleteQuickSetupRequest) => completeQuickSetup(payload),
    onSuccess: async (response) => {
      if (response.data) {
        llmStore.setSelection({
          provider: response.data.provider,
          model: response.data.model,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.quickSetup }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.llmSelection }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.firstNovel }),
      ]);
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => previewCustomProviderModels({
      key: form.apiKey.trim() || undefined,
      baseURL: form.baseURL.trim(),
    }),
    onSuccess: (response) => {
      const models = response.data?.models ?? [];
      setCustomModels(models);
      setCustomModelsMessage(models.length > 0 ? t("quickSetup.customModels.found", { count: models.length }) : t("quickSetup.customModels.none"));
      setForm((current) => ({ ...current, model: current.model.trim() || models[0] || "" }));
    },
    onError: (error) => {
      setCustomModels([]);
      setCustomModelsMessage(error instanceof Error ? error.message : t("quickSetup.customModels.failed"));
    },
  });

  const chooseProvider = (provider: QuickSetupProviderOption) => {
    setForm({
      providerKind: provider.kind,
      provider: provider.id,
      customProviderName: provider.kind === "custom" ? provider.name : "",
      apiKey: "",
      baseURL: provider.currentBaseURL || provider.defaultBaseURL,
      model: provider.currentModel || provider.defaultModel,
    });
    setCustomModels([]);
    setCustomModelsMessage("");
  };

  const chooseCustom = (continueToConnection = false) => {
    setForm({
      providerKind: "custom",
      provider: "",
      customProviderName: "",
      apiKey: "",
      baseURL: "",
      model: "",
    });
    setCustomModels([]);
    setCustomModelsMessage("");
    setShowAllProviderChoices(false);
    if (continueToConnection) {
      setStep(2);
    }
  };

  const canContinueProvider = form.providerKind === "custom" || Boolean(form.provider);
  const requiresApiKey = form.providerKind === "builtin" && selectedProvider?.requiresApiKey !== false;
  const hasSavedKey = selectedProvider?.configured === true;
  const canSubmit = Boolean(
    form.model.trim()
    && form.baseURL.trim()
    && (form.providerKind === "builtin" ? form.provider : form.customProviderName.trim())
    && (!requiresApiKey || form.apiKey.trim() || hasSavedKey),
  );
  const showFirstNovelHandoff = shouldShowFirstNovelHandoff({
    configurationSucceeded: completeMutation.isSuccess,
    forceConfiguration: props.forceConfiguration === true,
  });

  const submit = () => {
    setStep(3);
    completeMutation.mutate({
      providerKind: form.providerKind,
      ...(form.provider ? { provider: form.provider } : {}),
      ...(form.providerKind === "custom" ? { customProviderName: form.customProviderName.trim() } : {}),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
    });
  };

  const footer = props.loading || props.error || (props.status?.readyForCreation && !props.forceConfiguration)
    ? null
    : step === 1
      ? (
          <Button onClick={() => setStep(2)} disabled={!canContinueProvider}>
            {t("quickSetup.footer.fillConnection")} <ArrowRight className="h-4 w-4" />
          </Button>
        )
      : step === 2
        ? (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> {t("quickSetup.footer.backToSelect")}</Button>
              <Button onClick={submit} disabled={!canSubmit}>{t("quickSetup.footer.detectAndComplete")} <PlugZap className="h-4 w-4" /></Button>
            </>
          )
        : completeMutation.isSuccess
          ? (
              showFirstNovelHandoff
                ? (
                    <>
                      <Button variant="outline" asChild><Link to="/help">{t("quickSetup.footer.viewGuide")}</Link></Button>
                      <Button asChild><Link to="/novels/auto-director">{t("quickSetup.footer.startFirstNovel")} <ArrowRight className="h-4 w-4" /></Link></Button>
                    </>
                  )
                : (
                    <>
                      <Button variant="outline" asChild><Link to="/settings">{t("quickSetup.footer.viewAdvanced")}</Link></Button>
                      <Button onClick={() => props.onOpenChange(false)}>{t("quickSetup.footer.startCreating")} <Sparkles className="h-4 w-4" /></Button>
                    </>
                  )
            )
          : completeMutation.isError
            ? (
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> {t("quickSetup.footer.editConfig")}</Button>
              )
            : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <AppDialogContent
        className="max-w-3xl"
        title={t("quickSetup.title")}
        description={t("quickSetup.description")}
        footer={footer}
        footerClassName="gap-2"
      >
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[
            { index: 1, label: t("quickSetup.steps.chooseProvider") },
            { index: 2, label: t("quickSetup.steps.connectModel") },
            { index: 3, label: t("quickSetup.steps.detect") },
          ].map((item) => (
            <div key={item.index} className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              step === item.index ? "border-primary bg-primary/5 text-primary" : step > item.index ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "text-muted-foreground",
            )}>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">
                  {step > item.index ? <Check className="h-3 w-3" /> : item.index}
                </span>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {props.loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("quickSetup.checkingEnv")}
          </div>
        ) : props.error ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
            <CircleAlert className="h-9 w-9 text-amber-600" />
            <div>
              <div className="font-semibold">{t("quickSetup.readError.title")}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("quickSetup.readError.description")}</div>
            </div>
            <Button variant="outline" onClick={props.onRetry}>{t("quickSetup.reload")}</Button>
          </div>
        ) : props.status?.readyForCreation && !props.forceConfiguration && !completeMutation.isSuccess ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <div>
              <div className="text-lg font-semibold">{t("quickSetup.ready.title")}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {t("quickSetup.ready.summary", { provider: props.status.selectedProvider, model: props.status.selectedModel, count: props.status.routeCoverage.total })}
              </div>
            </div>
            <Button onClick={() => props.onOpenChange(false)}>{t("quickSetup.ready.continue")}</Button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{showAllProviderChoices ? t("quickSetup.step1.titleAll") : t("quickSetup.step1.titleRecommended")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {showAllProviderChoices
                  ? t("quickSetup.step1.hintAll")
                  : t("quickSetup.step1.hintRecommended")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providerChoices.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={cn(
                    "rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5",
                    form.provider === provider.id && "border-primary bg-primary/5 ring-1 ring-primary/20",
                  )}
                  onClick={() => chooseProvider(provider)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{provider.name}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{providerDescription(provider)}</div>
                    </div>
                    {form.provider === provider.id
                        ? <Badge>{t("quickSetup.badge.selected")}</Badge>
                      : provider.configured ? <Badge variant="outline">{t("quickSetup.badge.configured")}</Badge> : null}
                  </div>
                <div className="mt-3 text-xs text-muted-foreground">{t("quickSetup.step1.recommendedModel", { model: provider.currentModel || provider.defaultModel })}</div>
              </button>
              ))}
              {!showAllProviderChoices ? (
                <button
                  type="button"
                  className="rounded-xl border border-dashed p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => setShowAllProviderChoices(true)}
                >
                  <div className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" /> {t("quickSetup.step1.viewAllProviders")}</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">{t("quickSetup.step1.viewAllProvidersHint")}</div>
                </button>
              ) : null}
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-dashed p-4 text-left transition hover:border-primary/50 hover:bg-primary/5",
                  form.providerKind === "custom" && !form.provider && "border-primary bg-primary/5 ring-1 ring-primary/20",
                )}
                onClick={() => chooseCustom(true)}
              >
                <div className="flex items-center gap-2 font-semibold"><ServerCog className="h-4 w-4" /> {t("quickSetup.step1.addCustom")} <ArrowRight className="h-4 w-4" /></div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">{t("quickSetup.step1.addCustomHint")}</div>
              </button>
            </div>
            {showAllProviderChoices ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllProviderChoices(false)}>
                <ArrowLeft className="h-4 w-4" /> {t("quickSetup.step1.backToRecommended")}
              </Button>
            ) : null}
          </div>
        ) : step === 2 ? (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold">{form.providerKind === "custom" ? t("quickSetup.step1.addCustom") : t("quickSetup.step2.connectTitle", { name: selectedProvider?.name ?? t("quickSetup.step2.providerFallback") })}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("quickSetup.step2.apiKeyNote")}</p>
              {form.providerKind === "custom" ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("quickSetup.step2.customNote")}</p>
              ) : null}
            </div>
            {form.providerKind === "custom" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{t("quickSetup.step2.providerName")}</span>
                <Input value={form.customProviderName} placeholder={t("quickSetup.step2.providerNamePlaceholder")} onChange={(event) => setForm((current) => ({ ...current, customProviderName: event.target.value }))} />
              </label>
            ) : null}
            <label className="block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" /> API Key {requiresApiKey ? "" : t("quickSetup.step2.optional")}</span>
              <Input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                placeholder={hasSavedKey ? t("quickSetup.step2.apiKeyPlaceholderSaved") : requiresApiKey ? t("quickSetup.step2.apiKeyPlaceholderRequired") : t("quickSetup.step2.apiKeyPlaceholderLocal")}
                onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("quickSetup.step2.baseUrl")}</span>
              <Input value={form.baseURL} placeholder="https://api.example.com/v1" onChange={(event) => setForm((current) => ({ ...current, baseURL: event.target.value }))} />
            </label>
            {form.providerKind === "custom" ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => previewMutation.mutate()} disabled={!form.baseURL.trim() || previewMutation.isPending}>
                  {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4" />}
                  {t("quickSetup.step2.fetchModels")}
                </Button>
                {customModelsMessage ? <span className="text-xs text-muted-foreground">{customModelsMessage}</span> : null}
              </div>
            ) : null}
            {modelOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {modelOptions.slice(0, 8).map((model) => (
                  <button
                    key={model}
                    type="button"
                    className={cn("rounded-full border px-3 py-1.5 text-xs", form.model === model && "border-primary bg-primary/10 text-primary")}
                    onClick={() => setForm((current) => ({ ...current, model }))}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("quickSetup.step2.textModel")}</span>
              <Input value={form.model} placeholder={t("quickSetup.step2.modelPlaceholder")} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              {t("quickSetup.step2.footnote")}
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            {completeMutation.isPending ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{t("quickSetup.step3.detecting")}</div>
                  <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("quickSetup.step3.detectingHint")}</div>
                </div>
              </>
            ) : completeMutation.isSuccess ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{t("quickSetup.step3.successTitle")}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{t("quickSetup.step3.successDesc", { model: completeMutation.data.data?.model })}</div>
                </div>
                {showFirstNovelHandoff ? (
                  <div className="w-full max-w-xl rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 text-left shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-primary">{t("quickSetup.handoff.title")}</div>
                      <Link to="/settings" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t("quickSetup.handoff.configureMore")}</Link>
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">{t("quickSetup.handoff.heading")}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("quickSetup.handoff.body")}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {[t("quickSetup.handoff.steps.idea"), t("quickSetup.handoff.steps.direction"), t("quickSetup.handoff.steps.firstChapter")].map((label, index) => (
                        <div key={label} className="rounded-xl border bg-background/80 px-3 py-2.5 text-sm font-medium">
                          <span className="mr-2 text-primary">{index + 1}</span>{label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <CircleAlert className="h-8 w-8 text-amber-700" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{t("quickSetup.step3.failTitle")}</div>
                  <div className="mt-2 max-w-lg text-sm leading-6 text-destructive">
                    {completeMutation.error instanceof Error ? completeMutation.error.message : t("quickSetup.step3.failDesc")}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </AppDialogContent>
    </Dialog>
  );
}
