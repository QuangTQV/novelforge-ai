import { translateUi } from "@/i18n/legacy";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const nextMode: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };
const labels: Record<ThemeMode, string> = { light: translateUi("浅色主题"), dark: translateUi("深色主题"), system: translateUi("跟随系统") };

export default function ThemeToggle() {
  const { mode, resolvedMode, setMode } = useTheme();
  const Icon = mode === "system" ? Monitor : resolvedMode === "dark" ? Moon : Sun;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-9 w-9"
      aria-label={translateUi("{{value0}}，点击切换", { value0: labels[mode] })}
      title={translateUi("{{value0}}，点击切换", { value0: labels[mode] })}
      onClick={() => setMode(nextMode[mode])}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
