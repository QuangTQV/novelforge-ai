import { translateUi } from "@/i18n/legacy";
import type { LLMBackupApiKey, LLMRotationStrategy } from "@ai-novel/shared/types/llm";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SelectControl from "@/components/common/SelectControl";

const ROTATION_STRATEGY_OPTIONS: { value: LLMRotationStrategy; label: string; summary: string }[] = [
  {
    value: "round_robin",
    label: translateUi("Luân phiên đều (round robin)"),
    summary: translateUi("Mỗi request dùng key kế tiếp theo vòng, dàn tải đều giữa các key."),
  },
  {
    value: "random",
    label: translateUi("Ngẫu nhiên có trọng số"),
    summary: translateUi("Xáo trộn ngẫu nhiên mỗi lần gọi — key trọng số cao được thử trước với xác suất cao hơn."),
  },
  {
    value: "sequential",
    label: translateUi("Tuần tự cố định"),
    summary: translateUi("Luôn thử theo đúng thứ tự đã khai, chỉ chuyển key sau khi key trước lỗi."),
  },
];

export interface ProviderRotationFormState {
  rotationStrategy: LLMRotationStrategy;
  apiKeyWeight: string;
  backupKeys: LLMBackupApiKey[];
  cooldownSeconds: string;
  fallbackEnabled: boolean;
  fallbackOrder: string;
}

interface ProviderRotationFieldsProps {
  value: ProviderRotationFormState;
  onChange: (value: Partial<ProviderRotationFormState>) => void;
}

export default function ProviderRotationFields({ value, onChange }: ProviderRotationFieldsProps) {
  const showWeights = value.rotationStrategy === "random";

  const updateBackupKey = (index: number, patch: Partial<LLMBackupApiKey>) => {
    const next = value.backupKeys.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ backupKeys: next });
  };

  const removeBackupKey = (index: number) => {
    onChange({ backupKeys: value.backupKeys.filter((_, i) => i !== index) });
  };

  const addBackupKey = () => {
    onChange({ backupKeys: [...value.backupKeys, { key: "", weight: 1, isActive: true }] });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{translateUi("Chiến thuật xoay tua")}</div>
        <SelectControl
          value={value.rotationStrategy}
          onChange={(event) => onChange({ rotationStrategy: event.target.value as LLMRotationStrategy })}
        >
          {ROTATION_STRATEGY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectControl>
        <div className="text-xs text-muted-foreground">
          {ROTATION_STRATEGY_OPTIONS.find((option) => option.value === value.rotationStrategy)?.summary}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {showWeights ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{translateUi("Trọng số key chính")}</div>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={value.apiKeyWeight}
              placeholder="1"
              onChange={(event) => onChange({ apiKeyWeight: event.target.value })}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{translateUi("Cooldown khi lỗi (giây)")}</div>
          <Input
            type="number"
            min={1}
            step={1}
            value={value.cooldownSeconds}
            placeholder="60"
            onChange={(event) => onChange({ cooldownSeconds: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">{translateUi("API key dự phòng")}</div>
          <Button type="button" variant="secondary" size="sm" onClick={addBackupKey}>
            {translateUi("+ Thêm key")}
          </Button>
        </div>
        {value.backupKeys.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {translateUi("Chưa có key dự phòng — khi key chính bị rate-limit/hết quota sẽ không có key khác cùng provider để chuyển sang.")}
          </div>
        ) : (
          <div className="space-y-2">
            {value.backupKeys.map((backup, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
                <input
                  type="checkbox"
                  checked={backup.isActive}
                  onChange={(event) => updateBackupKey(index, { isActive: event.target.checked })}
                  title={translateUi("Bật/tắt key này")}
                />
                <Input
                  type="password"
                  className="min-w-[160px] flex-1"
                  value={backup.key}
                  placeholder={translateUi("API key dự phòng")}
                  onChange={(event) => updateBackupKey(index, { key: event.target.value })}
                />
                {showWeights ? (
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className="w-20"
                    value={backup.weight}
                    onChange={(event) => updateBackupKey(index, { weight: Number.parseFloat(event.target.value) || 1 })}
                  />
                ) : null}
                <Input
                  className="w-28"
                  value={backup.label ?? ""}
                  placeholder={translateUi("Ghi chú")}
                  onChange={(event) => updateBackupKey(index, { label: event.target.value })}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeBackupKey(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-dashed bg-muted/10 p-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={value.fallbackEnabled}
            onChange={(event) => onChange({ fallbackEnabled: event.target.checked })}
          />
          {translateUi("Cho phép dùng provider này làm fallback liên-provider")}
        </label>
        <div className="text-xs text-muted-foreground">
          {translateUi("Khi provider chính của một request hết key khả dụng (rate limit/hết quota ở mọi key), hệ thống sẽ tự chuyển sang các provider được bật mục này, theo đúng thứ tự số nhỏ trước.")}
        </div>
        {value.fallbackEnabled ? (
          <div className="max-w-[160px] space-y-1">
            <div className="text-xs text-muted-foreground">{translateUi("Thứ tự fallback (số nhỏ thử trước)")}</div>
            <Input
              type="number"
              min={0}
              step={1}
              value={value.fallbackOrder}
              placeholder="0"
              onChange={(event) => onChange({ fallbackOrder: event.target.value })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
