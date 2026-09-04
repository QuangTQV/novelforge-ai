import { translateUi } from "@/i18n/legacy";
import { useEffect, useMemo, useState } from "react";
import type { Chapter, ChapterStatus } from "@ai-novel/shared/types/novel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, Copy, Download, Edit3, List, Settings2, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { downloadNovelExport, getNovelChapters, getNovelDetail } from "@/api/novel";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function countWords(content: string | null | undefined): number {
  const text = content?.trim() ?? "";
  if (!text) return 0;
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjk + words;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatChapterStatus(status?: ChapterStatus | null): string {
  switch (status) {
    case "completed": return translateUi("正文完成");
    case "pending_review": return translateUi("待审校");
    case "needs_repair": return translateUi("待修复");
    case "generating": return translateUi("生成中");
    case "pending_generation": return translateUi("待生成");
    case "unplanned": return translateUi("未规划");
    default: return translateUi("未标记");
  }
}

function chapterText(content: string | null | undefined): string {
  return content?.trim() ?? "";
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || translateUi("小说");
}

export default function NovelPreview() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showChapters, setShowChapters] = useState(true);
  const [copied, setCopied] = useState(false);
  const selectedChapterId = searchParams.get("chapterId") ?? "";

  const novelQuery = useQuery({
    queryKey: queryKeys.novels.detail(id),
    queryFn: () => getNovelDetail(id),
    enabled: Boolean(id),
  });
  const chaptersQuery = useQuery({
    queryKey: queryKeys.novels.chapters(id),
    queryFn: () => getNovelChapters(id),
    enabled: Boolean(id),
  });

  const novel = novelQuery.data?.data ?? null;
  const chapters = useMemo(
    () => [...(chaptersQuery.data?.data ?? [])].sort((a, b) => a.order - b.order),
    [chaptersQuery.data?.data],
  );
  const generatedChapters = useMemo(() => chapters.filter((chapter) => chapterText(chapter.content)), [chapters]);
  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? generatedChapters[0] ?? chapters[0] ?? null,
    [chapters, generatedChapters, selectedChapterId],
  );
  const activeContent = chapterText(activeChapter?.content);
  const totalWordCount = useMemo(() => chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0), [chapters]);
  const downloadFullMutation = useMutation({
    mutationFn: () => downloadNovelExport(id, "txt", "full", novel?.title),
    onSuccess: ({ blob, fileName }) => {
      downloadBlob(blob, fileName);
      toast.success(translateUi("整本正文下载已开始。"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : translateUi("整本正文下载失败。")),
  });

  useEffect(() => {
    if (!activeChapter || selectedChapterId === activeChapter.id) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("chapterId", activeChapter.id);
      return next;
    }, { replace: true });
  }, [activeChapter, selectedChapterId, setSearchParams]);

  const selectChapter = (chapter: Chapter) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("chapterId", chapter.id);
      return next;
    });
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setShowChapters(false);
    }
  };

  const handleCopy = async () => {
    if (!activeContent) return toast.error(translateUi("当前章节还没有正文。"));
    try {
      await copyText(activeContent);
      setCopied(true);
      toast.success(translateUi("正文已复制。"));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(translateUi("复制失败，请手动选择正文复制。"));
    }
  };

  const handleDownloadChapter = () => {
    if (!activeChapter || !activeContent) return toast.error(translateUi("当前章节还没有正文。"));
    const title = safeFileNamePart(novel?.title ?? translateUi("小说"));
    const chapterTitle = activeChapter.title?.trim() ? safeFileNamePart(activeChapter.title) : "";
    downloadBlob(
      new Blob(["\uFEFF", `${translateUi("Chương {{order}}", { order: activeChapter.order })}${chapterTitle ? ` ${chapterTitle}` : ""}\n\n${activeContent}`], { type: "text/plain;charset=utf-8" }),
      `${title}-C${activeChapter.order}${chapterTitle ? `-${chapterTitle}` : ""}.txt`,
    );
    toast.success(translateUi("本章正文下载已开始。"));
  };

  if (!id) {
    return <div className="flex min-h-full items-center justify-center"><Button asChild><Link to="/novels">{translateUi("返回小说列表")}</Link></Button></div>;
  }

  const isLoading = novelQuery.isPending || chaptersQuery.isPending;
  const isError = novelQuery.isError || chaptersQuery.isError;

  if (isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">{translateUi("正在打开作品...")}</div>;
  }
  if (isError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{translateUi("当前无法打开这本作品。")}</p>
        <Button onClick={() => { void novelQuery.refetch(); void chaptersQuery.refetch(); }}>{translateUi("重新加载")}</Button>
      </div>
    );
  }
  if (chapters.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{translateUi("这本作品还没有可阅读的章节。")}</p>
        <Button asChild><Link to={`/novels/${id}/edit`}>{translateUi("进入工作区")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className={cn("mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 transition-[padding]", showChapters && "lg:pl-[22.5rem]")}>
          <div className="flex items-center gap-1">
            {!showChapters ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => setShowChapters(true)} title={translateUi("打开目录")} aria-label={translateUi("打开目录")}>
                <List className="h-4 w-4" />
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to="/novels" aria-label={translateUi("返回书架")}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-medium">{novel?.title ?? translateUi("小说预览")}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{activeChapter ? translateUi("第 {{value0}} 章", { value0: activeChapter.order }) : translateUi("阅读")}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleDownloadChapter} disabled={!activeContent} title={translateUi("下载本章")} aria-label={translateUi("下载本章")}>
              <Download className="h-4 w-4" /><span className="ml-1.5 hidden xl:inline">{translateUi("本章")}</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => downloadFullMutation.mutate()} disabled={downloadFullMutation.isPending || generatedChapters.length === 0} title={translateUi("下载整本")} aria-label={translateUi("下载整本")}>
              <BookOpen className="h-4 w-4" /><span className="ml-1.5 hidden xl:inline">{translateUi("整本")}</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title={translateUi("打开工作区")} aria-label={translateUi("打开工作区")}>
              <Link to={`/novels/${id}/edit`}><Settings2 className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("px-6 pb-24 pt-16 transition-[padding] sm:px-10 sm:pt-20", showChapters && "lg:pl-[22.5rem]")}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
          <div className="text-xs tracking-[0.22em] text-muted-foreground">{novel?.status === "published" ? "PUBLISHED" : "DRAFT"}</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{novel?.title ?? translateUi("小说预览")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{formatCount(totalWordCount)}  {translateUi("字 ·")} {generatedChapters.length}/{chapters.length}  {translateUi("章已生成")}</p>
          </div>

          <article className="whitespace-pre-wrap text-[17px] leading-[2.15] text-foreground sm:text-[18px]">
            {activeContent || translateUi("本章还没有正文。")}
          </article>

          <footer className="mt-20 flex items-center justify-center gap-2 border-t border-border/70 pt-6">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void handleCopy()} disabled={!activeContent}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? translateUi("已复制") : translateUi("复制本章")}
            </Button>
            {activeChapter ? (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link to={`/novels/${id}/chapters/${activeChapter.id}`}><Edit3 className="mr-1.5 h-4 w-4" />{translateUi("编辑本章")}</Link>
              </Button>
            ) : null}
          </footer>
        </div>
      </main>

      {showChapters ? (
        <>
          <button type="button" aria-label={translateUi("关闭目录")} className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setShowChapters(false)} />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-[min(360px,88vw)] flex-col border-r border-border bg-background shadow-xl lg:shadow-none">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div><div className="font-medium">{translateUi("目录")}</div><div className="mt-1 text-xs text-muted-foreground">{generatedChapters.length}/{chapters.length}  {translateUi("章 ·")} {formatCount(totalWordCount)}  {translateUi("字")}</div></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChapters(false)} title={translateUi("关闭目录")} aria-label={translateUi("关闭目录")}><X className="h-4 w-4" /></Button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {chapters.map((chapter) => {
                const hasContent = Boolean(chapterText(chapter.content));
                return (
                  <button key={chapter.id} type="button" className={cn("w-full rounded-md px-3 py-3 text-left transition hover:bg-muted/70", activeChapter?.id === chapter.id && "bg-muted")} onClick={() => selectChapter(chapter)}>
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{translateUi("第")} {chapter.order}  {translateUi("章")}</span><span className="text-xs text-muted-foreground">{formatCount(countWords(chapter.content))}  {translateUi("字")}</span></div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{chapter.title || translateUi("未命名章节")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{hasContent ? formatChapterStatus(chapter.chapterStatus) : translateUi("暂无正文")}</div>
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}
