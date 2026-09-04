import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CircleAlert,
  FileText,
  Layers3,
  LoaderCircle,
  Plus,
  Sparkles,
  Tags,
} from "lucide-react";
import { deleteGenre, flattenGenreTreeOptions, getGenreTree, type GenreTreeNode } from "@/api/genre";
import { queryKeys } from "@/api/queryKeys";
import {
  AssetLibraryEmptyState,
  AssetLibraryHeader,
  AssetLibraryRecommendation,
  AssetLibrarySection,
  AssetLibraryStatusGrid,
  type AssetLibraryStatusItem,
} from "@/components/assetLibrary";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import GenreCreateDialog from "./components/GenreCreateDialog";
import GenreEditDialog from "./components/GenreEditDialog";
import GenreTreeBrowser from "./components/GenreTreeBrowser";
import {
  collectDescendantIds,
  countGenreNovelBindingsInSubtree,
  countGenres,
  findGenreNode,
} from "./genreManagement.shared";

export default function GenreManagementPage() {
  const { t } = useTranslation("genres");
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState("");
  const [editingGenreId, setEditingGenreId] = useState("");

  const genreTreeQuery = useQuery({
    queryKey: queryKeys.genres.all,
    queryFn: getGenreTree,
  });

  const genreTree = genreTreeQuery.data?.data ?? [];
  const parentOptions = useMemo(() => flattenGenreTreeOptions(genreTree), [genreTree]);
  const totalGenres = useMemo(() => countGenres(genreTree), [genreTree]);
  const linkedNovelCount = useMemo(
    () => genreTree.reduce((total, node) => total + countGenreNovelBindingsInSubtree(node), 0),
    [genreTree],
  );
  const describedGenreCount = useMemo(
    () => parentOptions.filter((option) => Boolean(option.description?.trim())).length,
    [parentOptions],
  );
  const firstGenreWithoutDescription = useMemo(
    () => parentOptions.find((option) => !option.description?.trim()) ?? null,
    [parentOptions],
  );
  const editingGenre = useMemo(
    () => (editingGenreId ? findGenreNode(genreTree, editingGenreId) : null),
    [editingGenreId, genreTree],
  );
  const blockedParentIds = useMemo(
    () => editingGenre ? new Set([editingGenre.id, ...collectDescendantIds(editingGenre)]) : new Set<string>(),
    [editingGenre],
  );
  const statusUnavailable = genreTreeQuery.isLoading || genreTreeQuery.isError;
  const statusItems = useMemo<AssetLibraryStatusItem[]>(() => [
    {
      key: "genres",
      label: t("page.status.genres.label"),
      value: statusUnavailable ? "—" : totalGenres,
      detail: t("page.status.genres.detail"),
      icon: Tags,
      tone: statusUnavailable ? "neutral" : "info",
    },
    {
      key: "roots",
      label: t("page.status.roots.label"),
      value: statusUnavailable ? "—" : genreTree.length,
      detail: t("page.status.roots.detail"),
      icon: Layers3,
    },
    {
      key: "novels",
      label: t("page.status.novels.label"),
      value: statusUnavailable ? "—" : linkedNovelCount,
      detail: t("page.status.novels.detail"),
      icon: BookOpen,
      tone: statusUnavailable ? "neutral" : linkedNovelCount > 0 ? "success" : "neutral",
    },
    {
      key: "descriptions",
      label: t("page.status.descriptions.label"),
      value: statusUnavailable ? "—" : `${describedGenreCount}/${totalGenres}`,
      detail: t("page.status.descriptions.detail"),
      icon: FileText,
      tone: statusUnavailable
        ? "neutral"
        : totalGenres > describedGenreCount ? "warning" : "success",
    },
  ], [
    describedGenreCount,
    genreTree.length,
    linkedNovelCount,
    statusUnavailable,
    totalGenres,
  ]);

  const deleteMutation = useMutation({
    mutationFn: (genreId: string) => deleteGenre(genreId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.genres.all });
      toast.success(t("page.delete.success"));
    },
  });

  const handleCreateRoot = () => {
    setDefaultParentId("");
    setCreateDialogOpen(true);
  };

  const handleCreateChild = (parentId: string) => {
    setDefaultParentId(parentId);
    setCreateDialogOpen(true);
  };

  const handleDelete = (genre: GenreTreeNode) => {
    const descendantCount = collectDescendantIds(genre).length;
    const message = descendantCount > 0
      ? t("page.delete.confirmWithChildren", { name: genre.name, count: descendantCount })
      : t("page.delete.confirm", { name: genre.name });
    const confirmed = window.confirm(message);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(genre.id);
  };

  const recommendation = genreTreeQuery.isError ? (
    <AssetLibraryRecommendation
      icon={CircleAlert}
      title={t("page.recommendation.errorTitle")}
      description={t("page.recommendation.errorDescription")}
      tone="danger"
      action={(
        <Button type="button" variant="outline" onClick={() => void genreTreeQuery.refetch()}>
          {t("page.recommendation.reload")}
        </Button>
      )}
    />
  ) : genreTreeQuery.isLoading ? (
    <AssetLibraryRecommendation
      icon={LoaderCircle}
      title={t("page.recommendation.loadingTitle")}
      description={t("page.recommendation.loadingDescription")}
      tone="neutral"
    />
  ) : totalGenres === 0 ? (
    <AssetLibraryRecommendation
      icon={Sparkles}
      title={t("page.recommendation.emptyTitle")}
      description={t("page.recommendation.emptyDescription")}
      action={(
        <Button type="button" onClick={handleCreateRoot}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("page.recommendation.emptyAction")}
        </Button>
      )}
    />
  ) : firstGenreWithoutDescription ? (
    <AssetLibraryRecommendation
      icon={FileText}
      title={t("page.recommendation.describeTitle", { name: firstGenreWithoutDescription.name })}
      description={t("page.recommendation.describeDescription")}
      tone="warning"
      action={(
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditingGenreId(firstGenreWithoutDescription.id)}
        >
          {t("page.recommendation.describeAction")}
        </Button>
      )}
    />
  ) : (
    <AssetLibraryRecommendation
      icon={Sparkles}
      title={t("page.recommendation.readyTitle")}
      description={t("page.recommendation.readyDescription")}
      tone="success"
      action={(
        <Button type="button" variant="outline" onClick={handleCreateRoot}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("page.recommendation.readyAction")}
        </Button>
      )}
    />
  );

  return (
    <div className="space-y-5">
      <GenreCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        parentOptions={parentOptions}
        defaultParentId={defaultParentId}
      />

      <GenreEditDialog
        open={Boolean(editingGenre)}
        genre={editingGenre}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGenreId("");
          }
        }}
        parentOptions={parentOptions}
        blockedParentIds={blockedParentIds}
      />

      <AssetLibraryHeader
        icon={Tags}
        context={t("page.header.context")}
        title={t("page.header.title")}
        description={t("page.header.description")}
        actions={(
          <Button type="button" onClick={handleCreateRoot}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("page.header.createRootTree")}
          </Button>
        )}
      />

      <AssetLibraryStatusGrid items={statusItems} />

      {recommendation}

      <AssetLibrarySection
        title={t("page.section.title")}
        description={t("page.section.description")}
      >
        {genreTreeQuery.isLoading ? (
          <div
            className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-5 py-8 text-center"
            role="status"
          >
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <div className="mt-3 text-sm font-semibold text-foreground">{t("page.section.loadingTitle")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t("page.section.loadingDescription")}</div>
          </div>
        ) : null}

        {genreTreeQuery.isError ? (
          <AssetLibraryEmptyState
            icon={CircleAlert}
            title={t("page.section.errorTitle")}
            description={t("page.section.errorDescription")}
            action={(
              <Button type="button" variant="outline" onClick={() => void genreTreeQuery.refetch()}>
                {t("page.recommendation.reload")}
              </Button>
            )}
          />
        ) : null}

        {!genreTreeQuery.isLoading && !genreTreeQuery.isError && genreTree.length === 0 ? (
          <AssetLibraryEmptyState
            icon={Tags}
            title={t("page.section.emptyTitle")}
            description={t("page.section.emptyDescription")}
            action={(
              <Button type="button" onClick={handleCreateRoot}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("page.section.emptyAction")}
              </Button>
            )}
          />
        ) : null}

        {!genreTreeQuery.isLoading && !genreTreeQuery.isError && genreTree.length > 0 ? (
          <GenreTreeBrowser
            nodes={genreTree}
            initialSelectedId={searchParams.get("selectedId") ?? ""}
            onCreateChild={handleCreateChild}
            onEdit={setEditingGenreId}
            onDelete={handleDelete}
            deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          />
        ) : null}
      </AssetLibrarySection>
    </div>
  );
}
