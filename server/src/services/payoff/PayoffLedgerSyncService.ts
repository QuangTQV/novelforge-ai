import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { AuditReport, OpenConflict, PayoffLedgerResponse } from "@ai-novel/shared/types/novel";
import type { PayoffLedgerItem } from "@ai-novel/shared/types/payoffLedger";
import { prisma } from "../../db/prisma";
import { resolveNovelLanguage, resolvePromptLanguage, type PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { payoffLedgerSyncPrompt } from "../../prompting/prompts/payoff/payoffLedgerSync.prompts";
import {
  appendStaleRiskSignal,
  buildPayoffLedgerResponse,
  buildSyntheticPayoffIssues,
  clearStaleRiskSignal,
  dedupeRiskSignals,
  mapPayoffLedgerRow,
  resolvePayoffLedgerSyncLedgerKey,
  sanitizePayoffLedgerSyncItem,
  serializeLedgerJson,
} from "./payoffLedgerShared";
import {
  createNovelChapterReferenceLookup,
  normalizePayoffLedgerPromptChapterRefs,
} from "./payoffLedgerChapterRefs";
import { resolveSupersededBookContractLedgerKeys } from "./domain/payoffLedgerSourceLifecycle";
import { buildBookContractPayoffSources } from "./sources/bookContractPayoffSources";

function pl(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

interface PayoffLedgerSyncOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  chapterOrder?: number | null;
  sourceChapterId?: string | null;
}

interface PayoffLedgerReadOptions extends PayoffLedgerSyncOptions {
  syncIfMissing?: boolean;
}

function compactText(value: string | null | undefined, fallback = ""): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeConflict(row: {
  id: string;
  novelId: string;
  chapterId: string | null;
  sourceSnapshotId: string | null;
  sourceIssueId: string | null;
  sourceType: string;
  conflictType: string;
  conflictKey: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  evidenceJson: string | null;
  affectedCharacterIdsJson: string | null;
  resolutionHint: string | null;
  lastSeenChapterOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}): OpenConflict {
  return {
    id: row.id,
    novelId: row.novelId,
    chapterId: row.chapterId,
    sourceSnapshotId: row.sourceSnapshotId,
    sourceIssueId: row.sourceIssueId,
    sourceType: row.sourceType,
    conflictType: row.conflictType,
    conflictKey: row.conflictKey,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    status: row.status,
    evidenceJson: row.evidenceJson,
    affectedCharacterIdsJson: row.affectedCharacterIdsJson,
    resolutionHint: row.resolutionHint,
    lastSeenChapterOrder: row.lastSeenChapterOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatMajorPayoffs(rawPlanJson: string | null | undefined): string {
  const parsed = safeParseJson<{ major_payoffs?: unknown }>(rawPlanJson, {});
  const majorPayoffs = Array.isArray(parsed.major_payoffs)
    ? parsed.major_payoffs.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return majorPayoffs.length > 0
    ? majorPayoffs.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "";
}

export class PayoffLedgerSyncService {
  private async getResolvedChapterOrder(novelId: string, options: PayoffLedgerSyncOptions): Promise<number | null> {
    if (typeof options.chapterOrder === "number") {
      return options.chapterOrder;
    }
    const [sourceChapter, latestChapter] = await Promise.all([
      options.sourceChapterId
        ? prisma.chapter.findFirst({
            where: { id: options.sourceChapterId, novelId },
            select: { order: true },
          })
        : Promise.resolve(null),
      prisma.chapter.findFirst({
        where: { novelId },
        orderBy: { order: "desc" },
        select: { order: true },
      }),
    ]);
    return sourceChapter?.order ?? latestChapter?.order ?? null;
  }

  private async loadLedgerRows(novelId: string) {
    return prisma.payoffLedgerItem.findMany({
      where: { novelId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  private async buildSyncPromptInput(novelId: string, options: PayoffLedgerSyncOptions) {
    const chapterOrder = await this.getResolvedChapterOrder(novelId, options);
    const [novel, volumeRows, snapshot, openConflicts, recentAuditReports] = await Promise.all([
      prisma.novel.findUnique({
        where: { id: novelId },
        select: {
          id: true,
          title: true,
          novelLanguage: true,
          storyMacroPlan: {
            select: {
              decompositionJson: true,
            },
          },
          bookContract: {
            select: {
              chapter3Payoff: true,
              chapter10Payoff: true,
              chapter30Payoff: true,
            },
          },
        },
      }),
      prisma.volumePlan.findMany({
        where: { novelId },
        orderBy: { sortOrder: "asc" },
        include: {
          chapters: {
            orderBy: { chapterOrder: "asc" },
            select: {
              id: true,
              chapterOrder: true,
              title: true,
              summary: true,
              payoffRefsJson: true,
            },
          },
        },
      }),
      prisma.storyStateSnapshot.findFirst({
        where: { novelId },
        orderBy: { createdAt: "desc" },
        include: {
          sourceChapter: {
            select: {
              id: true,
              order: true,
              title: true,
            },
          },
          foreshadowStates: true,
        },
      }),
      prisma.openConflict.findMany({
        where: {
          novelId,
          status: "open",
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 8,
      }),
      prisma.auditReport.findMany({
        where: { novelId, auditType: "plot" },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        include: {
          issues: {
            where: { status: "open" },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

    if (!novel) {
      throw new Error("Novel not found.");
    }

    const lang = resolvePromptLanguage(resolveNovelLanguage(novel.novelLanguage));
    const none = pl(lang, "无", "không có", "none");
    const sep = pl(lang, "；", "; ", "; ");

    const activeVolume = typeof chapterOrder === "number"
      ? volumeRows.find((volume) => volume.chapters.some((chapter) => chapter.chapterOrder === chapterOrder))
      : volumeRows.at(-1) ?? null;

    const activeVolumeSummary = activeVolume
      ? [
          `${pl(lang, "当前卷", "Tập hiện tại", "Current volume")}: ${pl(lang, `第${activeVolume.sortOrder}卷`, `tập ${activeVolume.sortOrder}`, `volume ${activeVolume.sortOrder}`)} "${activeVolume.title}"`,
          `${pl(lang, "卷摘要", "Tóm tắt tập", "Volume summary")}: ${compactText(activeVolume.summary, none)}`,
          `${pl(lang, "卷 open payoffs", "open payoffs của tập", "Volume open payoffs")}: ${safeParseJson<string[]>(activeVolume.openPayoffsJson, []).join(sep) || none}`,
          activeVolume.chapters.length > 0
            ? `${pl(lang, "卷章节范围", "Phạm vi chương của tập", "Volume chapter range")}: ${activeVolume.chapters[0]?.chapterOrder ?? "-"}-${activeVolume.chapters[activeVolume.chapters.length - 1]?.chapterOrder ?? "-"}`
            : `${pl(lang, "卷章节范围", "Phạm vi chương của tập", "Volume chapter range")}: ${none}`,
        ].join("\n")
      : `${pl(lang, "当前暂无激活卷窗口。", "Hiện chưa có cửa sổ tập đang kích hoạt.", "There is no active volume window right now.")}${volumeRows.length > 0 ? `${pl(lang, "已有卷", " Existing volumes", " Existing volumes")}: ${volumeRows.map((item) => `${pl(lang, `第${item.sortOrder}卷`, `tập ${item.sortOrder}`, `volume ${item.sortOrder}`)} "${item.title}"`).join(sep)}` : ""}`;

    const latestChapterContext = [
      typeof chapterOrder === "number"
        ? `${pl(lang, "当前章节序号", "Số thứ tự chương hiện tại", "Current chapter order")}: ${chapterOrder}`
        : `${pl(lang, "当前章节序号", "Số thứ tự chương hiện tại", "Current chapter order")}: ${pl(lang, "未知", "chưa biết", "unknown")}`,
      snapshot?.sourceChapter
        ? `${pl(lang, "最新状态快照来源", "Nguồn ảnh chụp trạng thái mới nhất", "Latest state-snapshot source")}: ${pl(lang, `第${snapshot.sourceChapter.order}章`, `chương ${snapshot.sourceChapter.order}`, `chapter ${snapshot.sourceChapter.order}`)} "${snapshot.sourceChapter.title}"`
        : `${pl(lang, "最新状态快照来源", "Nguồn ảnh chụp trạng thái mới nhất", "Latest state-snapshot source")}: ${none}`,
      snapshot?.summary ? `${pl(lang, "状态快照摘要", "Tóm tắt ảnh chụp trạng thái", "State-snapshot summary")}: ${snapshot.summary}` : "",
    ].filter(Boolean).join("\n");

    const openPayoffsText = volumeRows.length > 0
      ? volumeRows.map((volume) => {
          const openPayoffs = safeParseJson<string[]>(volume.openPayoffsJson, []);
          if (openPayoffs.length === 0) {
            return "";
          }
          return `[${pl(lang, `第${volume.sortOrder}卷`, `tập ${volume.sortOrder}`, `volume ${volume.sortOrder}`)} ${volume.title}] ${openPayoffs.map((item) => compactText(item, none)).join(sep)}`;
        }).filter(Boolean).join("\n\n") || none
      : none;

    const chapterPayoffRefsText = volumeRows.flatMap((volume) => volume.chapters.map((chapter) => {
      const refs = safeParseJson<string[]>(chapter.payoffRefsJson, []);
      if (refs.length === 0) {
        return "";
      }
      return `${pl(lang, `第${chapter.chapterOrder}章`, `chương ${chapter.chapterOrder}`, `chapter ${chapter.chapterOrder}`)} "${chapter.title}" | ${refs.map((item) => compactText(item, none)).join(sep)}`;
    })).filter(Boolean).join("\n\n") || none;

    const foreshadowStatesText = snapshot?.foreshadowStates.length
      ? snapshot.foreshadowStates.map((item) => (
        [
          `${pl(lang, "标题", "Tiêu đề", "Title")}: ${item.title}`,
          `${pl(lang, "状态", "Trạng thái", "Status")}: ${compactText(item.status, none)}`,
          item.summary ? `${pl(lang, "摘要", "Tóm tắt", "Summary")}: ${item.summary}` : "",
          item.setupChapterId ? `setupChapterId: ${item.setupChapterId}` : "",
          item.payoffChapterId ? `payoffChapterId: ${item.payoffChapterId}` : "",
        ].filter(Boolean).join(" | ")
      )).join("\n")
      : none;

    const payoffConflictsText = openConflicts.length > 0
      ? openConflicts.map((row) => {
          const conflict = normalizeConflict(row);
          return [
            `${conflict.conflictType}/${conflict.severity}: ${conflict.title}`,
            compactText(conflict.summary, none),
            conflict.resolutionHint ? `${pl(lang, "修复建议", "Gợi ý sửa", "Fix suggestion")}: ${compactText(conflict.resolutionHint, none)}` : "",
          ].filter(Boolean).join(" | ");
        }).join("\n")
      : none;

    const payoffAuditIssuesText = recentAuditReports.length > 0
      ? recentAuditReports.flatMap((report) => report.issues.map((issue) => (
        `${issue.code} (${issue.severity}): ${compactText(issue.description, none)} | ${pl(lang, "证据", "chứng cứ", "evidence")}: ${compactText(issue.evidence, none)}`
      ))).join("\n") || none
      : none;

    return {
      chapterOrder,
      lang,
      latestSnapshotId: snapshot?.id ?? null,
      promptInput: {
        novelTitle: novel.title,
        bookContractPayoffs: buildBookContractPayoffSources(novel.bookContract),
        activeVolumeSummary,
        latestChapterContext,
        majorPayoffsText: formatMajorPayoffs(novel.storyMacroPlan?.decompositionJson),
        openPayoffsText,
        chapterPayoffRefsText,
        foreshadowStatesText,
        payoffConflictsText,
        payoffAuditIssuesText,
      },
    };
  }

  private async syncLedgerOpenConflicts(novelId: string, items: PayoffLedgerItem[]): Promise<void> {
    const syntheticIssues = buildSyntheticPayoffIssues(items);
    const activeConflictKeys = syntheticIssues.map((issue) => `payoff:${issue.ledgerKey}:${issue.code}`);

    await prisma.$transaction(async (tx) => {
      await tx.openConflict.updateMany({
        where: {
          novelId,
          sourceType: "payoff_ledger",
          status: "open",
          conflictKey: {
            notIn: activeConflictKeys,
          },
        },
        data: {
          status: "resolved",
        },
      });

      for (const issue of syntheticIssues) {
        const ledgerItem = items.find((item) => item.ledgerKey === issue.ledgerKey);
        const conflictKey = `payoff:${issue.ledgerKey}:${issue.code}`;
        const data = {
          chapterId: ledgerItem?.lastTouchedChapterId ?? ledgerItem?.setupChapterId ?? ledgerItem?.payoffChapterId ?? null,
          sourceSnapshotId: ledgerItem?.lastSnapshotId ?? null,
          sourceIssueId: null,
          conflictType: issue.code,
          title: `payoff/${issue.code}`,
          summary: issue.description,
          severity: issue.severity,
          status: "open",
          evidenceJson: JSON.stringify([issue.evidence]),
          affectedCharacterIdsJson: JSON.stringify([]),
          resolutionHint: issue.fixSuggestion,
          lastSeenChapterOrder: ledgerItem?.lastTouchedChapterOrder ?? ledgerItem?.targetEndChapterOrder ?? null,
        };
        const updated = await tx.openConflict.updateMany({
          where: {
            novelId,
            sourceType: "payoff_ledger",
            conflictKey,
          },
          data,
        });
        if (updated.count === 0) {
          await tx.openConflict.create({
            data: {
              novelId,
              sourceType: "payoff_ledger",
              conflictKey,
              ...data,
            },
          });
        }
      }
    });
  }

  async getPayoffLedger(novelId: string, options: PayoffLedgerReadOptions = {}): Promise<PayoffLedgerResponse> {
    let rows = await this.loadLedgerRows(novelId);
    if (rows.length === 0 && options.syncIfMissing !== false) {
      try {
        const synced = await this.syncLedger(novelId, options);
        return synced;
      } catch {
        rows = await this.loadLedgerRows(novelId);
      }
    }
    return buildPayoffLedgerResponse(rows.map(mapPayoffLedgerRow), options.chapterOrder);
  }

  async syncLedger(novelId: string, options: PayoffLedgerSyncOptions = {}): Promise<PayoffLedgerResponse> {
    const existingRows = await this.loadLedgerRows(novelId);
    try {
      const { promptInput, chapterOrder, latestSnapshotId, lang } = await this.buildSyncPromptInput(novelId, options);
      const result = await runStructuredPrompt({
        asset: payoffLedgerSyncPrompt,
        promptInput,
        options: {
          novelId: novelId,
          provider: options.provider,
          model: options.model,
          temperature: options.temperature ?? 0.2,
        },
      });
      const now = new Date();
      const resolvedItemsByKey = new Map<string, typeof result.output.items[number]>();
      for (const rawItem of result.output.items) {
        const sanitizedItem = sanitizePayoffLedgerSyncItem(rawItem);
        const ledgerKey = resolvePayoffLedgerSyncLedgerKey(sanitizedItem, existingRows);
        resolvedItemsByKey.set(ledgerKey, {
          ...sanitizedItem,
          ledgerKey,
        });
      }
      const resolvedItems = Array.from(resolvedItemsByKey.values());
      const outputByKey = new Map(resolvedItems.map((item) => [item.ledgerKey, item]));
      const supersededBookContractLedgerKeys = resolveSupersededBookContractLedgerKeys({
        activeBookContractRefIds: (promptInput.bookContractPayoffs ?? []).map((item) => item.refId),
        existingItems: existingRows.map((row) => ({
          ledgerKey: row.ledgerKey,
          currentStatus: row.currentStatus,
          sourceRefs: safeParseJson(row.sourceRefsJson, []),
        })),
        resolvedItems: resolvedItems.map((item) => ({
          ledgerKey: item.ledgerKey,
          sourceRefs: item.sourceRefs,
        })),
      });
      const chapterLookup = createNovelChapterReferenceLookup(await prisma.chapter.findMany({
        where: { novelId },
        select: {
          id: true,
          order: true,
        },
      }));

      await prisma.$transaction(async (tx) => {
        for (const item of resolvedItems) {
          const previous = existingRows.find((row) => row.ledgerKey === item.ledgerKey);
          const normalizedChapterRefs = normalizePayoffLedgerPromptChapterRefs({
            item,
            previous,
            lookup: chapterLookup,
            currentChapterOrder: chapterOrder,
            sourceChapterId: options.sourceChapterId,
          });
          const riskSignals = clearStaleRiskSignal(dedupeRiskSignals(item.riskSignals.map((signal) => ({
            code: signal.code,
            severity: signal.severity,
            summary: signal.summary,
          }))));
          await tx.payoffLedgerItem.upsert({
            where: {
              novelId_ledgerKey: {
                novelId,
                ledgerKey: item.ledgerKey,
              },
            },
            create: {
              novelId,
              ledgerKey: item.ledgerKey,
              title: item.title,
              summary: item.summary,
              scopeType: item.scopeType,
              currentStatus: item.currentStatus,
              targetStartChapterOrder: item.targetStartChapterOrder ?? null,
              targetEndChapterOrder: item.targetEndChapterOrder ?? null,
              firstSeenChapterOrder: item.firstSeenChapterOrder ?? null,
              lastTouchedChapterOrder: item.lastTouchedChapterOrder ?? null,
              lastTouchedChapterId: normalizedChapterRefs.lastTouchedChapterId,
              setupChapterId: normalizedChapterRefs.setupChapterId,
              payoffChapterId: normalizedChapterRefs.payoffChapterId,
              lastSnapshotId: latestSnapshotId ?? previous?.lastSnapshotId ?? null,
              sourceRefsJson: serializeLedgerJson(normalizedChapterRefs.sourceRefs),
              evidenceJson: serializeLedgerJson(normalizedChapterRefs.evidence),
              riskSignalsJson: serializeLedgerJson(riskSignals),
              statusReason: item.statusReason?.trim() || null,
              confidence: item.confidence ?? null,
              updatedAt: now,
            },
            update: {
              title: item.title,
              summary: item.summary,
              scopeType: item.scopeType,
              currentStatus: item.currentStatus,
              targetStartChapterOrder: item.targetStartChapterOrder ?? null,
              targetEndChapterOrder: item.targetEndChapterOrder ?? null,
              firstSeenChapterOrder: item.firstSeenChapterOrder ?? previous?.firstSeenChapterOrder ?? null,
              lastTouchedChapterOrder: item.lastTouchedChapterOrder ?? previous?.lastTouchedChapterOrder ?? null,
              lastTouchedChapterId: normalizedChapterRefs.lastTouchedChapterId,
              setupChapterId: normalizedChapterRefs.setupChapterId,
              payoffChapterId: normalizedChapterRefs.payoffChapterId,
              lastSnapshotId: latestSnapshotId ?? previous?.lastSnapshotId ?? null,
              sourceRefsJson: serializeLedgerJson(normalizedChapterRefs.sourceRefs),
              evidenceJson: serializeLedgerJson(normalizedChapterRefs.evidence),
              riskSignalsJson: serializeLedgerJson(riskSignals),
              statusReason: item.statusReason?.trim() || null,
              confidence: item.confidence ?? null,
              updatedAt: now,
            },
          });
        }

        for (const row of existingRows) {
          if (supersededBookContractLedgerKeys.has(row.ledgerKey)) {
            const riskSignals = dedupeRiskSignals([
              ...clearStaleRiskSignal(safeParseJson(row.riskSignalsJson, [])),
              {
                code: "source_superseded",
                severity: "low",
                summary: pl(lang, "Book Contract 阶段回报已修改或移除，这条旧承诺已退出当前执行义务。", "Phần trả nợ theo giai đoạn của Book Contract đã bị sửa hoặc gỡ, lời hứa cũ này đã rời khỏi nghĩa vụ thực thi hiện tại.", "The Book Contract phased payoff was changed or removed; this old promise has left the current execution obligation."),
                stale: true,
              },
            ]);
            await tx.payoffLedgerItem.update({
              where: { id: row.id },
              data: {
                currentStatus: "failed",
                riskSignalsJson: serializeLedgerJson(riskSignals),
                statusReason: pl(lang, "Book Contract 来源已被新的阶段回报替换或移除。", "Nguồn Book Contract đã bị phần trả nợ theo giai đoạn mới thay thế hoặc gỡ bỏ.", "The Book Contract source was replaced or removed by a new phased payoff."),
                updatedAt: now,
              },
            });
            continue;
          }
          if (
            outputByKey.has(row.ledgerKey)
            || row.currentStatus === "paid_off"
            || row.currentStatus === "failed"
          ) {
            continue;
          }
          const staleSignals = appendStaleRiskSignal(
            safeParseJson(row.riskSignalsJson, [] as Array<{ code: string; severity: "low" | "medium" | "high" | "critical"; summary: string; stale?: boolean }>),
            pl(lang, "本轮 AI 对账没有再次命中这条伏笔，已保留旧账本并标记为 stale，等待下一次同步确认。", "Vòng đối soát AI lần này không khớp lại foreshadow này; đã giữ sổ cũ và đánh dấu stale, chờ lần đồng bộ sau xác nhận.", "This AI reconciliation pass did not re-match this foreshadowing; the old ledger entry is kept and marked stale, pending the next sync."),
          );
          await tx.payoffLedgerItem.update({
            where: { id: row.id },
            data: {
              riskSignalsJson: serializeLedgerJson(staleSignals),
              updatedAt: now,
            },
          });
        }
      });

      const rows = await this.loadLedgerRows(novelId);
      const items = rows.map(mapPayoffLedgerRow);
      await this.syncLedgerOpenConflicts(novelId, items);
      return buildPayoffLedgerResponse(items, chapterOrder);
    } catch (error) {
      if (existingRows.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const row of existingRows) {
            const staleSignals = appendStaleRiskSignal(
              safeParseJson(row.riskSignalsJson, [] as Array<{ code: string; severity: "low" | "medium" | "high" | "critical"; summary: string; stale?: boolean }>),
              "Payoff-ledger sync failed; the last successful result was kept.",
            );
            await tx.payoffLedgerItem.update({
              where: { id: row.id },
              data: {
                riskSignalsJson: serializeLedgerJson(staleSignals),
              },
            });
          }
        }).catch(() => null);
        return buildPayoffLedgerResponse(existingRows.map(mapPayoffLedgerRow), options.chapterOrder);
      }
      throw error;
    }
  }

  buildSyntheticAuditReports(novelId: string, chapterId: string, chapterOrder: number, ledger: PayoffLedgerResponse): AuditReport[] {
    const issues = buildSyntheticPayoffIssues(ledger.items, chapterOrder);
    if (issues.length === 0) {
      return [];
    }
    const reportId = `payoff-ledger:${novelId}:${chapterId}`;
    const now = new Date().toISOString();
    return [{
      id: reportId,
      novelId,
      chapterId,
      auditType: "plot",
      overallScore: null,
      summary: "The system added payoff risks that still need tracking, based on the payoff ledger.",
      legacyScoreJson: null,
      issues: issues.map((issue) => ({
        id: `${reportId}:${issue.ledgerKey}:${issue.code}`,
        reportId,
        auditType: "plot",
        severity: issue.severity,
        code: issue.code,
        description: issue.description,
        evidence: issue.evidence,
        fixSuggestion: issue.fixSuggestion,
        status: "open",
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    }];
  }
}

export const payoffLedgerSyncService = new PayoffLedgerSyncService();
