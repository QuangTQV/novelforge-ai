import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getChapterEditorWorkspace, getNovelDetail } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import ChapterEditorShell from "./components/chapterEditor/ChapterEditorShell";

function PageStateCard(props: { message: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background p-10 text-center text-sm text-muted-foreground shadow-sm">
      {props.message}
    </div>
  );
}

export default function NovelChapterEdit() {
  const { id = "", chapterId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("novelChapters");

  const novelDetailQuery = useQuery({
    queryKey: queryKeys.novels.detail(id),
    queryFn: () => getNovelDetail(id),
    enabled: Boolean(id),
  });
  const chapterEditorWorkspaceQuery = useQuery({
    queryKey: queryKeys.novels.chapterEditorWorkspace(id, chapterId || "none"),
    queryFn: () => getChapterEditorWorkspace(id, chapterId),
    enabled: Boolean(id && chapterId),
  });

  const detail = novelDetailQuery.data?.data;
  const chapter = useMemo(
    () => detail?.chapters.find((item) => item.id === chapterId),
    [chapterId, detail?.chapters],
  );

  if (novelDetailQuery.isLoading && !detail) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageStateCard message={t("page.loading")} />
      </div>
    );
  }

  if (novelDetailQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageStateCard message={t("page.loadError")} />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageStateCard message={t("page.notFound")} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 justify-end">
        <Button asChild variant="outline">
          <Link to={`/prompt-workbench?experience=writing&novelId=${encodeURIComponent(id)}&chapterId=${encodeURIComponent(chapterId)}`}>
            <FlaskConical className="mr-2 h-4 w-4" />
            {t("page.textEffectLab")}
          </Link>
        </Button>
      </div>
      <ChapterEditorShell
        key={`${chapter.id}:${chapter.updatedAt}`}
        novelId={id}
        chapter={chapter}
        workspace={chapterEditorWorkspaceQuery.data?.data ?? null}
        workspaceStatus={chapterEditorWorkspaceQuery.isLoading
          ? "loading"
          : chapterEditorWorkspaceQuery.isError
            ? "error"
            : "ready"}
        onBack={() => navigate(`/novels/${id}/edit`)}
        onOpenVersionHistory={() => navigate(`/novels/${id}/edit`)}
      />
    </div>
  );
}
