import type { ComponentProps } from "react";
import type { CreativeHubResourceBinding } from "@ai-novel/shared/types/creativeHub";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { buildCreativeHubPath } from "@/lib/creativeHubLinks";

interface OpenInCreativeHubButtonProps {
  bindings: CreativeHubResourceBinding;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}

export default function OpenInCreativeHubButton({
  bindings,
  label,
  variant = "outline",
  size = "sm",
  className,
}: OpenInCreativeHubButtonProps) {
  const { t } = useTranslation("creativeHub");
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link to={buildCreativeHubPath(bindings)}>{label ?? t("openInButton.label")}</Link>
    </Button>
  );
}
