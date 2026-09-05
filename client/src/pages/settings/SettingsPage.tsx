import { translateUi } from "@/i18n/legacy";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import {
  type APIKeyStatus,
  createCustomProvider,
  deleteCustomProvider,
  getAPIKeySettings,
  getProviderBalances,
  previewCustomProviderModels,
  refreshProviderBalance,
  refreshProviderModelList,
  saveAPIKeySetting,
  testLLMConnection,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import ProviderConfigDialog, { type ProviderFormState } from "./components/ProviderConfigDialog";
import ProviderSettingsSection from "./components/ProviderSettingsSection";
import SettingsActionResult from "./SettingsActionResult";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

function formatConnectionTestResult(response: Awaited<ReturnType<typeof testLLMConnection>>): string {
  const latency = response.data?.latency ?? 0;
  const plain = response.data?.plain;
  const structured = response.data?.structured;
  const plainText = plain
    ? plain.ok
      ? translateUi("Kết nối thường OK") + (plain.latency != null ? ` (${plain.latency}ms)` : "")
      : translateUi("Kết nối thường lỗi") + (plain.error ? `: ${plain.error}` : "")
    : translateUi("普通连通未检测");
  const structuredText = structured
    ? structured.ok
      ? translateUi("Structured OK") + (structured.strategy ? translateUi(", chiến lược {{v0}}", { v0: structured.strategy }) : "") + (structured.reasoningForcedOff ? translateUi("，已强制关闭 thinking") : "")
      : translateUi("Structured lỗi") + (structured.errorCategory ? translateUi(", phân loại {{v0}}", { v0: structured.errorCategory }) : "") + (structured.error ? `: ${structured.error}` : "")
    : translateUi("结构化未检测");
  return translateUi("连接成功，总耗时 {{v0}}ms · {{v1}} · {{v2}}", { v0: latency, v1: plainText, v2: structuredText });
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState("");
  const [isCreatingCustomProvider, setIsCreatingCustomProvider] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({
    displayName: "",
    key: "",
    model: "",
    imageModel: "",
    baseURL: "",
    concurrencyLimit: "0",
    requestIntervalMs: "0",
    reasoningEffort: "medium",
    rotationStrategy: "round_robin",
    apiKeyWeight: "1",
    backupKeys: [],
    cooldownSeconds: "60",
    fallbackEnabled: false,
    fallbackOrder: "0",
  });
  const [dialogTestResult, setDialogTestResult] = useState("");
  const [providerTestResults, setProviderTestResults] = useState<Record<string, string>>({});
  const [actionResult, setActionResult] = useState("");
  const [previewModels, setPreviewModels] = useState<string[]>([]);
  const [previewModelsResult, setPreviewModelsResult] = useState("");

  const apiKeySettingsQuery = useQuery({
    queryKey: queryKeys.settings.apiKeys,
    queryFn: getAPIKeySettings,
  });

  const providerBalancesQuery = useQuery({
    queryKey: queryKeys.settings.apiKeyBalances,
    queryFn: getProviderBalances,
  });

  const providerConfigs = useMemo(() => apiKeySettingsQuery.data?.data ?? [], [apiKeySettingsQuery.data?.data]);
  const editingConfig = useMemo(
    () => providerConfigs.find((item) => item.provider === editingProvider),
    [editingProvider, providerConfigs],
  );
  const isDialogOpen = isCreatingCustomProvider || Boolean(editingProvider);
  const isCustomDialog = isCreatingCustomProvider || editingConfig?.kind === "custom";
  const modelOptions = editingConfig?.models ?? [];
  const selectableModels = isCreatingCustomProvider ? previewModels : modelOptions;
  const resetDialogState = () => {
    setEditingProvider("");
    setIsCreatingCustomProvider(false);
    setForm({
      displayName: "",
      key: "",
      model: "",
      imageModel: "",
      baseURL: "",
      concurrencyLimit: "0",
      requestIntervalMs: "0",
      reasoningEffort: "medium",
      rotationStrategy: "round_robin",
      apiKeyWeight: "1",
      backupKeys: [],
      cooldownSeconds: "60",
      fallbackEnabled: false,
      fallbackOrder: "0",
    });
    setDialogTestResult("");
    setPreviewModels([]);
    setPreviewModelsResult("");
  };

  const invalidateProviderQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeyBalances }),
      queryClient.invalidateQueries({ queryKey: queryKeys.llm.providers }),
    ]);
  };

  const updateProviderModelsInCache = (provider: string, models: string[], currentModel: string) => {
    queryClient.setQueryData<ApiResponse<APIKeyStatus[]>>(queryKeys.settings.apiKeys, (previous) => {
      if (!previous?.data) {
        return previous;
      }
      return {
        ...previous,
        data: previous.data.map((item) => item.provider === provider
          ? {
            ...item,
            models,
            currentModel,
          }
          : item),
      };
    });
  };

  const invalidateProviderAuxiliaryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeyBalances }),
      queryClient.invalidateQueries({ queryKey: queryKeys.llm.providers }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      provider: LLMProvider;
      displayName?: string;
      key?: string;
      model?: string;
      imageModel?: string;
      baseURL?: string;
      concurrencyLimit?: number;
      requestIntervalMs?: number;
      reasoningEffort?: ProviderFormState["reasoningEffort"];
      rotationStrategy?: ProviderFormState["rotationStrategy"];
      apiKeyWeight?: number;
      backupKeys?: ProviderFormState["backupKeys"];
      cooldownSeconds?: number;
      fallbackOrder?: number | null;
    }) =>
      saveAPIKeySetting(payload.provider, {
        displayName: payload.displayName,
        key: payload.key,
        model: payload.model,
        imageModel: payload.imageModel,
        baseURL: payload.baseURL,
        concurrencyLimit: payload.concurrencyLimit,
        requestIntervalMs: payload.requestIntervalMs,
        reasoningEffort: payload.reasoningEffort,
        rotationStrategy: payload.rotationStrategy,
        apiKeyWeight: payload.apiKeyWeight,
        backupKeys: payload.backupKeys,
        cooldownSeconds: payload.cooldownSeconds,
        fallbackOrder: payload.fallbackOrder,
      }),
    onSuccess: async (response) => {
      resetDialogState();
      setActionResult(response.message ?? translateUi("保存成功。"));
      await invalidateProviderQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("保存失败。"));
    },
  });

  const createCustomProviderMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      key?: string;
      model?: string;
      imageModel?: string;
      baseURL: string;
      concurrencyLimit?: number;
      requestIntervalMs?: number;
    }) => createCustomProvider(payload),
    onSuccess: async (response) => {
      resetDialogState();
      setActionResult(response.message ?? translateUi("自定义厂商创建成功。"));
      await invalidateProviderQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("创建自定义厂商失败。"));
    },
  });

  const previewCustomProviderModelsMutation = useMutation({
    mutationFn: (payload: { key?: string; baseURL: string }) => previewCustomProviderModels(payload),
    onSuccess: (response) => {
      const models = response.data?.models ?? [];
      setPreviewModels(models);
      setPreviewModelsResult(response.message ?? translateUi("已获取 {{v0}} 个模型。", { v0: models.length }));
      setForm((prev) => ({
        ...prev,
        model: prev.model.trim() || models[0] || "",
      }));
    },
    onError: (error) => {
      setPreviewModels([]);
      setPreviewModelsResult(error instanceof Error ? error.message : translateUi("获取模型列表失败。"));
    },
  });

  const deleteCustomProviderMutation = useMutation({
    mutationFn: (provider: LLMProvider) => deleteCustomProvider(provider),
    onSuccess: async (response) => {
      resetDialogState();
      setActionResult(response.message ?? translateUi("自定义厂商已删除。"));
      await invalidateProviderQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("删除自定义厂商失败。"));
    },
  });

  const removeProviderMutation = useMutation({
    mutationFn: async (provider: APIKeyStatus) => {
      if (provider.kind === "custom") {
        return deleteCustomProvider(provider.provider);
      }
      return saveAPIKeySetting(provider.provider, { isActive: false });
    },
    onSuccess: async (response, provider) => {
      setActionResult(response.message ?? (provider.kind === "builtin" ? translateUi("厂商已从列表移除。") : translateUi("自定义厂商已删除。")));
      await invalidateProviderQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("移除厂商失败。"));
    },
  });

  const testMutation = useMutation({
    mutationFn: testLLMConnection,
  });

  const refreshModelsMutation = useMutation({
    mutationFn: (provider: LLMProvider) => refreshProviderModelList(provider),
    onSuccess: async (response, provider) => {
      const count = response.data?.models?.length ?? 0;
      const providerName = providerConfigs.find((item) => item.provider === provider)?.name ?? provider;
      if (response.data) {
        updateProviderModelsInCache(response.data.provider, response.data.models, response.data.currentModel);
      }
      setActionResult(translateUi("{{v0}} 模型列表已刷新（{{v1}} 个）。", { v0: providerName, v1: count }));
      await invalidateProviderAuxiliaryQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("刷新模型列表失败。"));
    },
  });

  const toggleReasoningMutation = useMutation({
    mutationFn: (payload: { provider: LLMProvider; reasoningEnabled: boolean }) =>
      saveAPIKeySetting(payload.provider, {
        reasoningEnabled: payload.reasoningEnabled,
      }),
    onSuccess: async (_response, variables) => {
      const providerName = providerConfigs.find((item) => item.provider === variables.provider)?.name ?? variables.provider;
      setActionResult(translateUi("Đã {{state}} tính năng suy luận cho {{provider}}.", { provider: providerName, state: variables.reasoningEnabled ? translateUi("bật") : translateUi("tắt") }));
      await invalidateProviderQueries();
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("更新思考开关失败。"));
    },
  });

  const refreshBalanceMutation = useMutation({
    mutationFn: (provider: LLMProvider) => refreshProviderBalance(provider),
    onSuccess: async (response, provider) => {
      const providerName = providerConfigs.find((item) => item.provider === provider)?.name ?? provider;
      setActionResult(response.message ?? translateUi("{{v0}} 余额已刷新。", { v0: providerName }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeyBalances });
    },
    onError: (error) => {
      setActionResult(error instanceof Error ? error.message : translateUi("刷新余额失败。"));
    },
  });

  const openBuiltInDialog = (provider: LLMProvider) => {
    const config = providerConfigs.find((item) => item.provider === provider);
    if (!config) {
      return;
    }
    setIsCreatingCustomProvider(false);
    setEditingProvider(provider);
    setForm({
      displayName: config.displayName ?? config.name,
      key: "",
      model: config.currentModel,
      imageModel: config.currentImageModel ?? config.defaultImageModel ?? "",
      baseURL: config.currentBaseURL,
      concurrencyLimit: String(config.concurrencyLimit ?? 0),
      requestIntervalMs: String(config.requestIntervalMs ?? 0),
      reasoningEffort: config.reasoningEffort === "low" || config.reasoningEffort === "high" ? config.reasoningEffort : "medium",
      rotationStrategy: config.rotationStrategy ?? "round_robin",
      apiKeyWeight: String(config.apiKeyWeight ?? 1),
      backupKeys: config.backupKeys ?? [],
      cooldownSeconds: String(config.cooldownSeconds ?? 60),
      fallbackEnabled: config.fallbackOrder != null,
      fallbackOrder: String(config.fallbackOrder ?? 0),
    });
    setDialogTestResult("");
    setActionResult("");
    setPreviewModels([]);
    setPreviewModelsResult("");
  };

  const openCreateCustomDialog = () => {
    setEditingProvider("");
    setIsCreatingCustomProvider(true);
    setForm({
      displayName: "",
      key: "",
      model: "",
      imageModel: "",
      baseURL: "",
      concurrencyLimit: "0",
      requestIntervalMs: "0",
      reasoningEffort: "medium",
      rotationStrategy: "round_robin",
      apiKeyWeight: "1",
      backupKeys: [],
      cooldownSeconds: "60",
      fallbackEnabled: false,
      fallbackOrder: "0",
    });
    setDialogTestResult("");
    setActionResult("");
    setPreviewModels([]);
    setPreviewModelsResult("");
  };

  const clearPreviewModels = () => {
    setPreviewModels([]);
    setPreviewModelsResult("");
  };

  const handlePreviewCustomModels = () => {
    setPreviewModelsResult("");
    previewCustomProviderModelsMutation.mutate({
      key: form.key.trim() ? form.key : undefined,
      baseURL: form.baseURL.trim(),
    });
  };

  const handleSubmitProviderDialog = () => {
    if (isCreatingCustomProvider) {
      createCustomProviderMutation.mutate({
        name: form.displayName.trim(),
        key: form.key.trim() ? form.key : undefined,
        model: form.model.trim() || undefined,
        imageModel: form.imageModel.trim(),
        baseURL: form.baseURL.trim(),
        concurrencyLimit: Number.parseInt(form.concurrencyLimit, 10) || 0,
        requestIntervalMs: Number.parseInt(form.requestIntervalMs, 10) || 0,
      });
      return;
    }
    if (!editingProvider) {
      return;
    }
    saveMutation.mutate({
      provider: editingProvider,
      displayName: isCustomDialog ? form.displayName.trim() || undefined : undefined,
      key: form.key.trim() ? form.key : undefined,
      model: form.model.trim() || undefined,
      imageModel: form.imageModel.trim(),
      baseURL: form.baseURL,
      concurrencyLimit: Number.parseInt(form.concurrencyLimit, 10) || 0,
      requestIntervalMs: Number.parseInt(form.requestIntervalMs, 10) || 0,
      reasoningEffort: form.reasoningEffort,
      rotationStrategy: form.rotationStrategy,
      apiKeyWeight: Number.parseFloat(form.apiKeyWeight) || 1,
      backupKeys: form.backupKeys.filter((item) => item.key.trim()),
      cooldownSeconds: Number.parseInt(form.cooldownSeconds, 10) || 60,
      fallbackOrder: form.fallbackEnabled ? Number.parseInt(form.fallbackOrder, 10) || 0 : null,
    });
  };

  const handleProviderCardTest = (provider: APIKeyStatus) => {
    setProviderTestResults((prev) => ({
      ...prev,
      [provider.provider]: "",
    }));
    testMutation.mutate(
      {
        provider: provider.provider,
        model: provider.currentModel || undefined,
        baseURL: provider.currentBaseURL || undefined,
      },
      {
        onSuccess: (response) => {
          setProviderTestResults((prev) => ({
            ...prev,
            [provider.provider]: formatConnectionTestResult(response),
          }));
        },
        onError: (error) => {
          setProviderTestResults((prev) => ({
            ...prev,
            [provider.provider]: error instanceof Error ? error.message : translateUi("连接测试失败。"),
          }));
        },
      },
    );
  };

  const handleTestProviderDialog = () => {
    testMutation.mutate(
      {
        provider: editingProvider || "custom_preview",
        apiKey: form.key.trim() ? form.key : undefined,
        model: form.model.trim() || undefined,
        baseURL: form.baseURL.trim() ? form.baseURL : undefined,
        probeMode: "both",
      },
      {
        onSuccess: (response) => {
          setDialogTestResult(formatConnectionTestResult(response));
        },
        onError: (error) => {
          setDialogTestResult(error instanceof Error ? error.message : translateUi("连接测试失败。"));
        },
      },
    );
  };

  const handleDeleteCustomProvider = () => {
    if (!editingProvider || !editingConfig) {
      return;
    }
    if (!window.confirm(translateUi("确认删除自定义厂商 {{value0}} 吗？", { value0: editingConfig.name }))) {
      return;
    }
    deleteCustomProviderMutation.mutate(editingProvider);
  };

  const handleRemoveProvider = (provider: APIKeyStatus) => {
    const label = provider.kind === "builtin" ? translateUi("从列表移除") : translateUi("删除");
    if (!window.confirm(translateUi("确认{{value0}} {{value1}} 吗？", { value0: label, value1: provider.name }))) {
      return;
    }
    removeProviderMutation.mutate(provider);
  };

  const isSavingProvider = saveMutation.isPending || createCustomProviderMutation.isPending;
  const providerSubmitDisabled = isSavingProvider
    || previewCustomProviderModelsMutation.isPending
    || (!isCreatingCustomProvider && !form.model.trim())
    || (isCustomDialog && !form.displayName.trim())
    || (isCreatingCustomProvider && !form.baseURL.trim())
    || (!isCustomDialog && editingConfig?.requiresApiKey !== false && !form.key.trim() && !editingConfig?.isConfigured);
  const providerSubmitLabel = isSavingProvider ? translateUi("保存中...") : isCreatingCustomProvider ? translateUi("创建厂商") : translateUi("保存");

  return (
    <div className={AUTO_DIRECTOR_MOBILE_CLASSES.settingsPageRoot}>
      <div className="space-y-4">
        <ProviderSettingsSection
          providers={providerConfigs}
          balances={providerBalancesQuery.data?.data ?? []}
          isBalanceLoading={providerBalancesQuery.isLoading}
          testingProvider={testMutation.variables?.provider}
          providerTestResults={providerTestResults}
          refreshingModelProvider={refreshModelsMutation.variables}
          refreshingBalanceProvider={refreshBalanceMutation.variables}
          reasoningProvider={toggleReasoningMutation.variables?.provider}
          onCreateCustomProvider={openCreateCustomDialog}
          onRemoveProvider={handleRemoveProvider}
          onOpenConfig={openBuiltInDialog}
          onTest={handleProviderCardTest}
          onRefreshModels={(provider) => {
            setActionResult("");
            refreshModelsMutation.mutate(provider);
          }}
          onRefreshBalance={(provider) => {
            setActionResult("");
            refreshBalanceMutation.mutate(provider);
          }}
          onToggleReasoning={(provider, reasoningEnabled) => {
            setActionResult("");
            toggleReasoningMutation.mutate({
              provider,
              reasoningEnabled,
            });
          }}
          removingProvider={removeProviderMutation.variables?.provider}
        />
      </div>

      <SettingsActionResult message={actionResult} />

      <ProviderConfigDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDialogState();
          }
        }}
        isCreatingCustomProvider={isCreatingCustomProvider}
        isCustomDialog={isCustomDialog}
        editingConfig={editingConfig}
        form={form}
        setForm={setForm}
        selectableModels={selectableModels}
        previewModelsResult={previewModelsResult}
        isPreviewingModels={previewCustomProviderModelsMutation.isPending}
        onClearPreviewModels={clearPreviewModels}
        onPreviewModels={handlePreviewCustomModels}
        onSubmit={handleSubmitProviderDialog}
        submitDisabled={providerSubmitDisabled}
        submitLabel={providerSubmitLabel}
        onTest={handleTestProviderDialog}
        testDisabled={testMutation.isPending || !form.model.trim() || !form.baseURL.trim()}
        testResult={dialogTestResult}
        onDeleteCustomProvider={handleDeleteCustomProvider}
        deleteDisabled={deleteCustomProviderMutation.isPending}
        deleteLabel={deleteCustomProviderMutation.isPending ? translateUi("删除中...") : translateUi("删除")}
      />
    </div>
  );
}
