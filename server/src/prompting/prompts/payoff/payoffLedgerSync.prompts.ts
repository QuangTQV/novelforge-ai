import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import type { PromptAsset, PromptRenderContext } from "../../core/promptTypes";
import { payoffLedgerSyncOutputSchema } from "./payoffLedgerSync.promptSchemas";

function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") return vi;
  if (lang === "en") return en;
  return zh;
}

function buildPayoffLedgerSyncExample(lang: PromptLanguage): unknown {
  return {
    items: [
      {
        ledgerKey: "system_hidden_rules",
        title: pick(lang,
          "系统隐藏规则浮出水面",
          "Luật ẩn của hệ thống lộ ra",
          "The system's hidden rules surface"),
        summary: pick(lang,
          "主角第一次确认隐藏规则真实存在，后续必须继续推进并兑现其代价。",
          "Nhân vật chính lần đầu xác nhận luật ẩn có thật, về sau phải tiếp tục đẩy và trả cái giá của nó.",
          "The protagonist confirms for the first time that the hidden rules are real; it must keep advancing and pay its cost later."),
        scopeType: "book",
        currentStatus: "setup",
        targetStartChapterOrder: 3,
        targetEndChapterOrder: 40,
        firstSeenChapterOrder: 3,
        lastTouchedChapterOrder: 9,
        setupChapterOrder: 3,
        sourceRefs: [
          {
            kind: "major_payoff",
            refLabel: pick(lang,
              "第一次看见系统异常提示",
              "Lần đầu thấy cảnh báo dị thường của hệ thống",
              "First glimpse of the system's anomaly prompt"),
            chapterOrder: 3,
            volumeSortOrder: 1,
          },
        ],
        evidence: [
          {
            summary: pick(lang,
              "第三章已经明确出现异常提示并影响主角判断。",
              "Chương 3 đã xuất hiện rõ cảnh báo dị thường và ảnh hưởng phán đoán của nhân vật chính.",
              "Chapter 3 clearly shows the anomaly prompt and it affects the protagonist's judgment."),
            chapterOrder: 3,
          },
        ],
        riskSignals: [
          {
            code: "payoff_missing_progress",
            severity: "medium",
            summary: pick(lang,
              "已经进入应持续推进阶段，但后续还缺少新的触碰动作。",
              "Đã vào giai đoạn phải tiếp tục đẩy, nhưng về sau còn thiếu động tác chạm mới.",
              "It has entered the phase where it should keep advancing, but there is no new touch action yet."),
          },
        ],
        statusReason: pick(lang,
          "已建立核心铺垫，但仍未进入明确兑现窗口。",
          "Đã dựng phần tích thế cốt lõi, nhưng chưa vào cửa sổ trả nợ rõ ràng.",
          "The core setup is established, but it has not entered a clear payoff window."),
        confidence: 0.82,
      },
    ],
  };
}

export interface PayoffLedgerSyncPromptInput {
  novelTitle: string;
  bookContractPayoffs?: Array<{
    refId: string;
    refLabel: string;
    payoff: string;
    targetStartChapterOrder: number;
    targetEndChapterOrder: number;
  }>;
  activeVolumeSummary: string;
  latestChapterContext: string;
  majorPayoffsText: string;
  openPayoffsText: string;
  chapterPayoffRefsText: string;
  foreshadowStatesText: string;
  payoffConflictsText: string;
  payoffAuditIssuesText: string;
}

export const payoffLedgerSyncPrompt: PromptAsset<
  PayoffLedgerSyncPromptInput,
  z.infer<typeof payoffLedgerSyncOutputSchema>
> = {
  id: "novel.payoff_ledger.sync",
  version: "v6",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  semanticRetryPolicy: {
    maxAttempts: 1,
  },
  structuredOutputHint: {
    example: (_input: PayoffLedgerSyncPromptInput, context: PromptRenderContext) => buildPayoffLedgerSyncExample(context.promptLanguage),
    note: (_input: PayoffLedgerSyncPromptInput, context: PromptRenderContext) => pick(context.promptLanguage,
      "sourceRefs、evidence、riskSignals 始终必须是数组。 sourceRefs.kind 只能是 major_payoff、volume_open_payoff、chapter_payoff_ref、foreshadow_state、open_conflict、audit_issue。 禁止输出旧别名 chapter_payoff 或 volume_open。 scopeType 只能是 book、volume、chapter。 confidence 只能是 0-1 数字；拿不准就省略。",
      "sourceRefs, evidence, riskSignals luôn phải là mảng. sourceRefs.kind chỉ được là major_payoff, volume_open_payoff, chapter_payoff_ref, foreshadow_state, open_conflict, audit_issue. Cấm xuất các bí danh cũ chapter_payoff hoặc volume_open. scopeType chỉ được là book, volume, chapter. confidence chỉ được là số 0-1; không chắc thì bỏ.",
      "sourceRefs, evidence, and riskSignals must always be arrays. sourceRefs.kind may only be major_payoff, volume_open_payoff, chapter_payoff_ref, foreshadow_state, open_conflict, audit_issue. Do not output the old aliases chapter_payoff or volume_open. scopeType may only be book, volume, chapter. confidence may only be a number between 0 and 1 — omit it when unsure."),
  },
  outputSchema: payoffLedgerSyncOutputSchema,
  render: (input, context) => {
    const lang = context.promptLanguage;
    return [
    new SystemMessage([
      pick(lang,
        "你是小说伏笔账本同步器，负责把多个来源中的伏笔、兑现安排、兑现证据和异常信号，收敛成唯一的 canonical payoff ledger。",
        "Bạn là bộ đồng bộ sổ payoff của tiểu thuyết, chịu trách nhiệm gom các foreshadow, sắp xếp trả nợ, chứng cứ trả nợ và tín hiệu bất thường từ nhiều nguồn thành một canonical payoff ledger duy nhất.",
        "You are the novel's payoff-ledger synchronizer; you converge foreshadowing, payoff schedules, payoff evidence, and anomaly signals from multiple sources into a single canonical payoff ledger."),
      pick(lang,
        "产品服务对象是写作新手，所以你的输出必须稳定、可执行、易于后续系统继续规划，而不是写成长篇分析。",
        "Sản phẩm phục vụ người viết mới, nên đầu ra của bạn phải ổn định, khả thi, dễ để hệ thống về sau tiếp tục hoạch định, không viết thành phân tích dài.",
        "The product serves beginner writers, so your output must be stable, executable, and easy for the downstream system to keep planning with — not a long analysis."),
      "",
      pick(lang,
        "只输出一个合法 JSON 对象，不要输出 Markdown、解释、注释或任何额外文本。",
        "Chỉ xuất một đối tượng JSON hợp lệ, không xuất Markdown, giải thích, chú thích hay bất kỳ văn bản thừa nào.",
        "Output only one valid JSON object — no Markdown, explanations, comments, or any extra text."),
      pick(lang,
        "顶层固定格式只能是 {\"items\":[...]}。",
        "Định dạng cấp trên cùng cố định chỉ được là {\"items\":[...]}.",
        "The fixed top-level format may only be {\"items\":[...]}."),
      "",
      pick(lang, "硬性字段约束：", "Ràng buộc cứng về field:", "Hard field constraints:"),
      pick(lang,
        "1. sourceRefs.kind 只能是：major_payoff、volume_open_payoff、chapter_payoff_ref、foreshadow_state、open_conflict、audit_issue。",
        "1. sourceRefs.kind chỉ được là: major_payoff, volume_open_payoff, chapter_payoff_ref, foreshadow_state, open_conflict, audit_issue.",
        "1. sourceRefs.kind may only be: major_payoff, volume_open_payoff, chapter_payoff_ref, foreshadow_state, open_conflict, audit_issue."),
      pick(lang,
        "2. 不要输出旧别名 chapter_payoff 或 volume_open。",
        "2. Đừng xuất các bí danh cũ chapter_payoff hoặc volume_open.",
        "2. Do not output the old aliases chapter_payoff or volume_open."),
      pick(lang,
        "3. scopeType 只能是：book、volume、chapter。",
        "3. scopeType chỉ được là: book, volume, chapter.",
        "3. scopeType may only be: book, volume, chapter."),
      pick(lang,
        "4. confidence 不是必填；只有明确有把握时才写，而且必须是 0-1 的数字。",
        "4. confidence không bắt buộc; chỉ điền khi thực sự chắc, và phải là số 0-1.",
        "4. confidence is not required; write it only when genuinely confident, and it must be a number between 0 and 1."),
      pick(lang,
        "5. sourceRefs、evidence、riskSignals 即使只有一项也必须输出数组，不能输出对象或字符串。",
        "5. sourceRefs, evidence, riskSignals dù chỉ có một mục cũng phải xuất mảng, không được xuất đối tượng hay chuỗi.",
        "5. sourceRefs, evidence, riskSignals must be arrays even with a single item — not an object or a string."),
      "",
      pick(lang, "任务目标：", "Mục tiêu nhiệm vụ:", "Task goals:"),
      pick(lang,
        "1. 把 major payoffs、open payoffs、chapter payoff refs、foreshadow states、open conflicts 和 payoff audit issues 归并成唯一账本项。",
        "1. Gộp major payoffs, open payoffs, chapter payoff refs, foreshadow states, open conflicts và payoff audit issues thành các mục sổ duy nhất.",
        "1. Merge major payoffs, open payoffs, chapter payoff refs, foreshadow states, open conflicts, and payoff audit issues into unique ledger items."),
      pick(lang,
        "2. 避免把同义重复项拆成多个 ledger item，也不要把明显不同的伏笔强行合并。",
        "2. Tránh tách các mục trùng nghĩa thành nhiều ledger item, cũng đừng gượng gộp các foreshadow rõ ràng khác nhau.",
        "2. Do not split synonymous items into multiple ledger items, and do not force-merge clearly different foreshadowings."),
      pick(lang,
        "3. 账本项必须保守、稳定，不能编造输入中不存在的新剧情。",
        "3. Các mục sổ phải thận trọng, ổn định, không được bịa cốt truyện mới không có trong đầu vào.",
        "3. Ledger items must be conservative and stable — do not fabricate new plot not present in the input."),
      "",
      pick(lang, "状态定义：", "Định nghĩa trạng thái:", "Status definitions:"),
      pick(lang,
        "- setup：刚建立，还未形成明确兑现窗口。",
        "- setup: vừa dựng, chưa hình thành cửa sổ trả nợ rõ ràng.",
        "- setup: just established, no clear payoff window yet."),
      pick(lang,
        "- hinted：已经有铺垫，但还未进入明确待兑现阶段。",
        "- hinted: đã có tích thế, nhưng chưa vào giai đoạn chờ trả nợ rõ ràng.",
        "- hinted: setup exists, but it has not entered a clear pending-payoff phase."),
      pick(lang,
        "- pending_payoff：已经进入应持续跟进、临近兑现或正在推进的阶段。",
        "- pending_payoff: đã vào giai đoạn phải theo sát liên tục, gần trả nợ hoặc đang đẩy tới.",
        "- pending_payoff: it has entered the phase where it should be tracked continuously, is near payoff, or is being advanced."),
      pick(lang,
        "- paid_off：已经被明确兑现。",
        "- paid_off: đã được trả nợ rõ ràng.",
        "- paid_off: it has been clearly paid off."),
      pick(lang,
        "- failed：已经明确失效、作废或被推翻。",
        "- failed: đã rõ ràng mất hiệu lực, bị huỷ hoặc bị lật.",
        "- failed: it has clearly become invalid, been discarded, or been overturned."),
      pick(lang,
        "- overdue：已经超过合理目标窗口仍未兑现，必须被系统重点提醒。",
        "- overdue: đã quá cửa sổ mục tiêu hợp lý mà vẫn chưa trả nợ, hệ thống phải nhắc trọng điểm.",
        "- overdue: it is past the reasonable target window and still not paid off — the system must flag it prominently."),
      "",
      pick(lang, "章节定位规则：", "Quy tắc định vị chương:", "Chapter-locating rules:"),
      pick(lang,
        "1. 优先返回 setupChapterOrder / payoffChapterOrder。",
        "1. Ưu tiên trả về setupChapterOrder / payoffChapterOrder.",
        "1. Prefer returning setupChapterOrder / payoffChapterOrder."),
      pick(lang,
        "2. 只有当输入里明确出现了可验证的真实 chapterId 时，才填写 setupChapterId / payoffChapterId。",
        "2. Chỉ điền setupChapterId / payoffChapterId khi trong đầu vào xuất hiện rõ một chapterId thật, kiểm chứng được.",
        "2. Fill setupChapterId / payoffChapterId only when a verifiable real chapterId clearly appears in the input."),
      pick(lang,
        "3. 不要编造 chapterId；拿不准时返回 chapterOrder，不要伪造 ID。",
        "3. Đừng bịa chapterId; không chắc thì trả về chapterOrder, đừng ngụy tạo ID.",
        "3. Do not fabricate a chapterId; when unsure, return chapterOrder — do not forge an ID."),
      "",
      pick(lang, "压缩输出规则：", "Quy tắc nén đầu ra:", "Compressed-output rules:"),
      pick(lang,
        "1. sourceRefs 只保留最强的 0-4 个来源；Book Contract 固定来源不得在压缩时丢失。",
        "1. sourceRefs chỉ giữ 0-4 nguồn mạnh nhất; nguồn cố định của Book Contract không được mất khi nén.",
        "1. sourceRefs: keep only the 0-4 strongest sources; Book Contract fixed sources must not be lost during compression."),
      pick(lang,
        "2. evidence 只保留最关键的 0-1 条证据。",
        "2. evidence chỉ giữ 0-1 chứng cứ then chốt nhất.",
        "2. evidence: keep only the 0-1 most critical pieces."),
      pick(lang,
        "3. riskSignals 只在确有风险时填写，最多保留 2 条。",
        "3. riskSignals chỉ điền khi thực sự có rủi ro, giữ tối đa 2 mục.",
        "3. riskSignals: fill only when there is a real risk; keep at most 2."),
      pick(lang,
        "4. statusReason 用一句短句说明当前状态判断依据，不要写长段。",
        "4. statusReason dùng một câu ngắn nêu căn cứ phán đoán trạng thái hiện tại, đừng viết đoạn dài.",
        "4. statusReason: one short sentence on the basis for the current status judgment — no long paragraph."),
      "",
      pick(lang, "判断原则：", "Nguyên tắc phán đoán:", "Judgment principles:"),
      pick(lang,
        "0. Book Contract 第 3/10/30 章回报是稳定书级承诺。每个非空来源都必须出现在某个账项的 sourceRefs 中，kind=major_payoff，refId 必须原样保留；允许与语义相同的其他承诺合并，但不得遗漏来源或放宽其截止章。",
        "0. Phần trả nợ chương 3/10/30 của Book Contract là lời hứa cấp sách ổn định. Mỗi nguồn không rỗng phải xuất hiện trong sourceRefs của một mục nào đó, kind=major_payoff, refId phải giữ nguyên xi; được gộp với các lời hứa cùng nghĩa, nhưng không được bỏ sót nguồn hoặc nới lỏng chương chốt của nó.",
        "0. Book Contract's chapter-3/10/30 payoffs are stable book-level promises. Every non-empty source must appear in some item's sourceRefs with kind=major_payoff and refId kept verbatim; merging with semantically identical promises is allowed, but do not drop a source or loosen its deadline chapter."),
      pick(lang,
        "1. major payoffs 是书级提示源，但只有映射到卷/章窗口后，才允许进入 pending_payoff 或 overdue。",
        "1. major payoffs là nguồn gợi ý cấp sách, nhưng chỉ được vào pending_payoff hoặc overdue sau khi đã ánh xạ vào cửa sổ tập/chương.",
        "1. major payoffs are a book-level hint source, but they may enter pending_payoff or overdue only after being mapped to a volume/chapter window."),
      pick(lang,
        "2. 同一 canonical payoff 若同时有卷级窗口和章节窗口，以章节窗口为更强约束。",
        "2. Nếu cùng một canonical payoff có cả cửa sổ cấp tập lẫn cấp chương, lấy cửa sổ cấp chương làm ràng buộc mạnh hơn.",
        "2. If one canonical payoff has both a volume-level and a chapter-level window, the chapter-level window is the stronger constraint."),
      pick(lang,
        "3. 如果已经有明确兑现证据，应优先标成 paid_off。",
        "3. Nếu đã có chứng cứ trả nợ rõ ràng, nên ưu tiên đánh paid_off.",
        "3. If there is clear payoff evidence, prefer marking it paid_off."),
      pick(lang,
        "4. 如果没有足够铺垫就直接兑现，要保留该项并输出风险信号。",
        "4. Nếu chưa đủ tích thế mà đã trả nợ thẳng, phải giữ mục đó và xuất tín hiệu rủi ro.",
        "4. If it is paid off directly without enough setup, keep the item and output a risk signal."),
      pick(lang,
        "5. 如果已经过了明确目标窗口仍未兑现，要标成 overdue；没有 targetStartChapterOrder / targetEndChapterOrder / payoffChapterOrder / payoffChapterId 时，不要标成 overdue，只能用 pending_payoff 加 riskSignals 提醒。",
        "5. Nếu đã qua cửa sổ mục tiêu rõ ràng mà vẫn chưa trả nợ, phải đánh overdue; khi không có targetStartChapterOrder / targetEndChapterOrder / payoffChapterOrder / payoffChapterId thì đừng đánh overdue, chỉ được dùng pending_payoff kèm riskSignals để nhắc.",
        "5. If it is past a clear target window and still unpaid, mark it overdue; when targetStartChapterOrder / targetEndChapterOrder / payoffChapterOrder / payoffChapterId are absent, do not mark it overdue — use pending_payoff plus riskSignals to flag it."),
      pick(lang,
        "6. 如果输入里只有提示和铺垫，没有明确兑现证据，不要误判为 paid_off。",
        "6. Nếu đầu vào chỉ có gợi ý và tích thế, không có chứng cứ trả nợ rõ ràng, đừng phán nhầm thành paid_off.",
        "6. If the input has only hints and setup, with no clear payoff evidence, do not misjudge it as paid_off."),
      "",
      pick(lang,
        "输出必须严格符合 payoffLedgerSyncOutputSchema。",
        "Đầu ra phải tuân thủ nghiêm payoffLedgerSyncOutputSchema.",
        "The output must strictly conform to payoffLedgerSyncOutputSchema."),
    ].join("\n")),
    new HumanMessage([
      pick(lang, `小说标题：${input.novelTitle}`, `Tên tiểu thuyết: ${input.novelTitle}`, `Novel title: ${input.novelTitle}`),
      "",
      pick(lang,
        "Book Contract 阶段回报（稳定书级来源）：",
        "Phần trả nợ theo giai đoạn của Book Contract (nguồn cấp sách ổn định):",
        "Book Contract phased payoffs (stable book-level source):"),
      (input.bookContractPayoffs ?? []).length > 0
        ? (input.bookContractPayoffs ?? []).map((item) => pick(lang,
            `${item.refLabel} | refId=${item.refId} | 目标窗口=${item.targetStartChapterOrder}-${item.targetEndChapterOrder} | 承诺=${item.payoff}`,
            `${item.refLabel} | refId=${item.refId} | cửa sổ mục tiêu=${item.targetStartChapterOrder}-${item.targetEndChapterOrder} | lời hứa=${item.payoff}`,
            `${item.refLabel} | refId=${item.refId} | target window=${item.targetStartChapterOrder}-${item.targetEndChapterOrder} | promise=${item.payoff}`,
          )).join("\n")
        : pick(lang, "无", "không có", "none"),
      "",
      pick(lang, "当前激活卷与章节窗口：", "Tập đang kích hoạt và cửa sổ chương:", "Active volume and chapter window:"),
      input.activeVolumeSummary,
      "",
      pick(lang, "最近章节上下文：", "Ngữ cảnh chương gần đây:", "Recent chapter context:"),
      input.latestChapterContext,
      "",
      pick(lang, "书级 major payoffs：", "major payoffs cấp sách:", "Book-level major payoffs:"),
      input.majorPayoffsText,
      "",
      pick(lang, "当前卷 open payoffs：", "open payoffs của tập hiện tại:", "Current-volume open payoffs:"),
      input.openPayoffsText,
      "",
      pick(lang, "当前卷 chapter payoff refs：", "chapter payoff refs của tập hiện tại:", "Current-volume chapter payoff refs:"),
      input.chapterPayoffRefsText,
      "",
      pick(lang, "最新 foreshadow states：", "foreshadow states mới nhất:", "Latest foreshadow states:"),
      input.foreshadowStatesText,
      "",
      pick(lang, "相关 open conflicts：", "open conflicts liên quan:", "Related open conflicts:"),
      input.payoffConflictsText,
      "",
      pick(lang, "最近 payoff 审校问题：", "Các vấn đề soát payoff gần đây:", "Recent payoff audit issues:"),
      input.payoffAuditIssuesText,
      "",
      pick(lang, "输出提醒：", "Nhắc nhở đầu ra:", "Output reminders:"),
      pick(lang,
        "1. kind 只能用规定枚举，禁止使用 chapter_payoff / volume_open。",
        "1. kind chỉ được dùng enum đã quy định, cấm dùng chapter_payoff / volume_open.",
        "1. kind may only use the prescribed enum — chapter_payoff / volume_open are forbidden."),
      pick(lang,
        "2. confidence 如填写，必须是数字，不要写成字符串。",
        "2. confidence nếu điền thì phải là số, đừng viết thành chuỗi.",
        "2. confidence, if filled, must be a number — not a string."),
      pick(lang,
        "3. scopeType 只能是 book、volume、chapter。",
        "3. scopeType chỉ được là book, volume, chapter.",
        "3. scopeType may only be book, volume, chapter."),
    ].join("\n")),
    ];
  },
  postValidate: (output, input) => {
    const ledgerKeySet = new Set<string>();
    for (const item of output.items) {
      if (ledgerKeySet.has(item.ledgerKey)) {
        throw new Error(`Duplicate ledgerKey: ${item.ledgerKey}`);
      }
      ledgerKeySet.add(item.ledgerKey);
      if (
        item.targetStartChapterOrder
        && item.targetEndChapterOrder
        && item.targetStartChapterOrder > item.targetEndChapterOrder
      ) {
        throw new Error(`Payoff ${item.ledgerKey} has an invalid target chapter window.`);
      }
      if (item.currentStatus === "paid_off" && !item.payoffChapterId && item.payoffChapterOrder == null) {
        throw new Error(`Payoff ${item.ledgerKey} is marked paid_off but has no payoffChapterOrder or payoffChapterId.`);
      }
    }
    for (const requiredSource of input?.bookContractPayoffs ?? []) {
      const coveringItem = output.items.find((item) => item.sourceRefs.some((source) => (
        source.kind === "major_payoff" && source.refId === requiredSource.refId
      )));
      if (!coveringItem) {
        throw new Error(`Missing Book Contract promise source: ${requiredSource.refId}`);
      }
      if (
        coveringItem.scopeType !== "book"
        || coveringItem.targetEndChapterOrder == null
        || coveringItem.targetEndChapterOrder > requiredSource.targetEndChapterOrder
      ) {
        throw new Error(`Book Contract promise ${requiredSource.refId} must keep a book-level scope and a deadline window no later than chapter ${requiredSource.targetEndChapterOrder}.`);
      }
    }
    return output;
  },
};
