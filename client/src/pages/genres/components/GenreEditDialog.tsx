import { translateUi } from "@/i18n/legacy";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateGenre, type GenreOption, type GenreTreeNode } from "@/api/genre";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AppDialogContent,
  Dialog,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import SelectControl from "@/components/common/SelectControl";

interface GenreEditDialogProps {
  open: boolean;
  genre: GenreTreeNode | null;
  onOpenChange: (open: boolean) => void;
  parentOptions: GenreOption[];
  blockedParentIds: Set<string>;
}

export default function GenreEditDialog({
  open,
  genre,
  onOpenChange,
  parentOptions,
  blockedParentIds,
}: GenreEditDialogProps) {
  const { t } = useTranslation("genres");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");

  useEffect(() => {
    if (!open || !genre) {
      return;
    }
    setName(genre.name);
    setDescription(genre.description ?? "");
    setParentId(genre.parentId ?? "");
  }, [genre, open]);

  const filteredParentOptions = useMemo(
    () => parentOptions.filter((option) => !blockedParentIds.has(option.id)),
    [blockedParentIds, parentOptions],
  );

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!genre) {
        throw new Error(translateUi("题材基底不存在。"));
      }
      return updateGenre(genre.id, {
        name: name.trim(),
        description: description.trim() || null,
        parentId: parentId || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.genres.all });
      toast.success(t("editDialog.updateSuccess"));
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        className="max-w-2xl"
        title={t("editDialog.title")}
        description={t("editDialog.description")}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("editDialog.cancel")}
            </Button>
            <Button type="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !name.trim()}>
              {updateMutation.isPending ? t("editDialog.saving") : t("editDialog.save")}
            </Button>
          </>
        )}
        footerClassName="gap-2"
      >
        <div className="space-y-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">{t("editDialog.nameLabel")}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">{t("editDialog.descriptionLabel")}</span>
            <textarea
              rows={4}
              className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">{t("editDialog.parentLabel")}</span>
            <SelectControl
              className="w-full rounded-md border bg-background p-2 text-sm"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">{translateUi("无父级，作为根题材基底")}</option>
              {filteredParentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.path}
                </option>
              ))}
            </SelectControl>
          </label>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
