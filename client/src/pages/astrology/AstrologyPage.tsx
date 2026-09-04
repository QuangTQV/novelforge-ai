import { translateUi } from "@/i18n/legacy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AstrologyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{translateUi("占星灵感")}</CardTitle>
        <CardDescription>{translateUi("占星模块占位页。")}</CardDescription>
      </CardHeader>
      <CardContent>{translateUi("后续将在此接入题材化灵感生成与设定扩展能力。")}</CardContent>
    </Card>
  );
}
