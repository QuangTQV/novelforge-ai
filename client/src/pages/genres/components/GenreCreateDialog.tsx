import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { createGenreTree, generateGenreTree, type GenreOption, type GenreTreeDraft } from "@/api/genre";
import { queryKeys } from "@/api/queryKeys";
import LLMSelector from "@/components/common/LLMSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useLLMStore } from "@/store/llmStore";
import GenreTreeEditor from "./GenreTreeEditor";
import { cloneGenreDraft, createEmptyGenreDraft } from "../genreManagement.shared";
import SelectControl from "@/components/common/SelectControl";

interface GenreCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOptions: GenreOption[];
  defaultParentId?: string;
}

function normalizeDraftForSubmit(draft: GenreTreeDraft): GenreTreeDraft {
  return {
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    children: draft.children
      .map((child) => normalizeDraftForSubmit(child))
      .filter((child) => child.name),
  };
}

export default function GenreCreateDialog({
  open,
  onOpenChange,
  parentOptions,
  defaultParentId,
}: GenreCreateDialogProps) {
  const { t } = useTranslation("genres");
  const llm = useLLMStore();
  const queryClient = useQueryClient();
  const [parentId, setParentId] = useState(defaultParentId ?? "");
  const [draft, setDraft] = useState<GenreTreeDraft>(createEmptyGenreDraft());
  const [generationPrompt, setGenerationPrompt] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setParentId(defaultParentId ?? "");
    setDraft(createEmptyGenreDraft());
    setGenerationPrompt("");
  }, [defaultParentId, open]);

  const canSubmit = useMemo(() => draft.name.trim().length > 0, [draft.name]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeDraftForSubmit(draft);
      return createGenreTree({
        name: normalized.name,
        description: normalized.description,
        parentId: parentId || null,
        children: normalized.children,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.genres.all });
      toast.success(t("createDialog.createSuccess"));
      onOpenChange(false);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateGenreTree({
      prompt: generationPrompt.trim(),
      provider: llm.provider,
      model: llm.model,
      temperature: llm.temperature,
      maxTokens: llm.maxTokens,
    }),
    onSuccess: (response) => {
      if (!response.data) {
        return;
      }
      setDraft(cloneGenreDraft(response.data));
      toast.success(t("createDialog.generateSuccess"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("createDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">{t("createDialog.aiSectionTitle")}</div>
              <div className="text-xs leading-5 text-muted-foreground">
                {t("createDialog.aiSectionHint")}
              </div>
            </div>
            <LLMSelector />
            <textarea
              rows={4}
              className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={generationPrompt}
              placeholder={t("createDialog.promptPlaceholder")}
              onChange={(event) => setGenerationPrompt(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !generationPrompt.trim()}
              >
                {generateMutation.isPending ? t("createDialog.generating") : t("createDialog.generate")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(createEmptyGenreDraft())}
              >
                {t("createDialog.resetDraft")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="genre-parent" className="text-sm font-medium text-foreground">
              {t("createDialog.parentLabel")}
            </label>
            <SelectControl
              id="genre-parent"
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">{t("createDialog.parentNone")}</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.path}
                </option>
              ))}
            </SelectControl>
          </div>

          <GenreTreeEditor value={draft} onChange={setDraft} />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("createDialog.cancel")}
          </Button>
          <Button type="button" onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? t("createDialog.saving") : t("createDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
