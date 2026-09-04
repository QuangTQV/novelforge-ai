import { Languages, Palette, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LanguageSelector from "@/components/common/LanguageSelector";
import { SettingsShell } from "../components/SettingsShell";
import { useTheme } from "@/components/theme/ThemeProvider";

const PALETTE_VALUES = ["ink", "paper", "night"] as const;

export default function AppearanceSettingsPage() {
  const { t } = useTranslation("settings");
  const { mode, palette, density, setMode, setPalette, setDensity, reset } = useTheme();
  return (
    <SettingsShell title={t("appearance.title")} description={t("appearance.description")}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4" />
            {t("language.cardTitle")}
          </CardTitle>
          <CardDescription>{t("language.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("language.label")}</span>
            <LanguageSelector />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" />{t("appearance.cardTitle")}</CardTitle>
          <CardDescription>{t("appearance.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("appearance.mode.label")}</span>
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("appearance.mode.system")}</SelectItem>
                <SelectItem value="light">{t("appearance.mode.light")}</SelectItem>
                <SelectItem value="dark">{t("appearance.mode.dark")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("appearance.palette.label")}</span>
            <Select value={palette} onValueChange={(value) => setPalette(value as typeof palette)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PALETTE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`appearance.palette.${value}.label`)} · {t(`appearance.palette.${value}.description`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("appearance.density.label")}</span>
            <Select value={density} onValueChange={(value) => setDensity(value as typeof density)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">{t("appearance.density.comfortable")}</SelectItem>
                <SelectItem value="compact">{t("appearance.density.compact")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t("appearance.reset")}</Button>
          </div>
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
