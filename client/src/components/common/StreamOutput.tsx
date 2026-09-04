import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import MarkdownViewer from "./MarkdownViewer";

interface StreamOutputProps {
  isStreaming: boolean;
  content: string;
  onAbort?: () => void;
  title?: string;
  emptyText?: string;
}

export default function StreamOutput({ isStreaming, content, onAbort, title: titleProp, emptyText: emptyTextProp }: StreamOutputProps) {
  const { t } = useTranslation("components");
  const title = titleProp ?? t("streamOutput.title");
  const emptyText = emptyTextProp ?? t("streamOutput.waiting");
  const wordCount = content.trim().length;

  return (
    <motion.div
      className="min-w-0 w-full max-w-full overflow-hidden rounded-md border bg-card p-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="text-xs text-muted-foreground">{t("streamOutput.generating")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("streamOutput.wordCount", { count: wordCount })}</span>
          )}
          {isStreaming && onAbort ? (
            <Button size="sm" variant="secondary" onClick={onAbort}>
              {t("streamOutput.stop")}
            </Button>
          ) : null}
        </div>
      </div>

      <MarkdownViewer content={content || emptyText} />
    </motion.div>
  );
}
