import type {
  StoryConstraintEngine,
  StoryDecomposition,
  StoryExpansion,
  StoryMacroField,
  StoryMacroFieldValue,
  StoryMacroLocks,
  StoryMacroPhase,
  StoryMacroTurningPoint,
} from "@ai-novel/shared/types/storyMacro";
import type { PromptLanguage } from "@ai-novel/shared/utils/novelLanguage";
import {
  normalizeConflictLayers,
  normalizeConstraints,
  normalizeDecomposition,
  normalizeExpansion,
  STORY_MACRO_FIELDS,
} from "./storyMacroPlanSchema";

export interface StoryMacroEditablePlan {
  expansion: StoryExpansion;
  decomposition: StoryDecomposition;
  constraints: string[];
}

/**
 * The constraint engine is *derived* data that is injected verbatim into every
 * planning and chapter prompt. Its template text must therefore follow the
 * novel's output language, otherwise a Vietnamese novel receives a
 * Vietnamese/Chinese mixed prompt on every chapter.
 */
function pick(lang: PromptLanguage, zh: string, vi: string, en: string): string {
  if (lang === "vi") {
    return vi;
  }
  if (lang === "en") {
    return en;
  }
  return zh;
}

function mergeUnique(items: string[], maxItems: number): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, maxItems);
}

function summarizeText(value: string, fallback: string): string {
  const parts = value
    .split(/\r?\n|。|！|!|？|\?|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts[0] ?? fallback;
}

const NEGATIVE_CONSTRAINT_PATTERN =
  /^(不要|禁止|避免|不可|不能|không được|không nên|không thể|cấm|tránh|đừng|do not|don't|never|avoid|no )/i;

function negativeConstraintsOnly(value: string[]): string[] {
  return value.filter((item) => NEGATIVE_CONSTRAINT_PATTERN.test(item.trim()));
}

export function toGrowthSteps(value: string): string[] {
  const steps = value
    .split(/\r?\n|->|→|=>|，|,|、|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(steps)).slice(0, 6);
}

function buildPressureRoles(expansion: StoryExpansion, lang: PromptLanguage): string[] {
  const roleLabel = pick(lang, "主角位：", "Vị trí nhân vật chính: ", "Protagonist position: ");
  const opposeLabel = pick(lang, "对立位：", "Vị trí đối kháng: ", "Antagonist position: ");
  const relationLabel = pick(lang, "关系压力位：", "Vị trí áp lực quan hệ: ", "Relational-pressure position: ");
  return mergeUnique([
    `${roleLabel}${summarizeText(
      expansion.protagonist_core,
      pick(
        lang,
        "主角被困在无法轻易退出的处境中。",
        "Nhân vật chính bị kẹt trong tình thế không thể dễ dàng rút lui.",
        "The protagonist is trapped in a situation they cannot easily exit.",
      ),
    )}`,
    `${opposeLabel}${summarizeText(
      expansion.conflict_layers.external,
      pick(
        lang,
        "外部力量持续压迫主角。",
        "Thế lực bên ngoài liên tục chèn ép nhân vật chính.",
        "An external force keeps pressing on the protagonist.",
      ),
    )}`,
    `${relationLabel}${summarizeText(
      expansion.conflict_layers.relational,
      pick(
        lang,
        "关键关系不断施压并制造选择代价。",
        "Quan hệ then chốt liên tục gây áp lực và tạo ra cái giá cho mỗi lựa chọn.",
        "A key relationship keeps applying pressure and creating a cost for every choice.",
      ),
    )}`,
  ], 4);
}

function phaseNames(lang: PromptLanguage): [string, string, string, string, string] {
  return [
    pick(lang, "困局锁死", "Khóa chặt thế bí", "Locked-in predicament"),
    pick(lang, "误判行动", "Hành động sai lầm", "Misjudged action"),
    pick(lang, "代价升级", "Cái giá leo thang", "Escalating cost"),
    pick(lang, "认知翻转", "Lật ngược nhận thức", "Cognitive reversal"),
    pick(lang, "终局兑现", "Tất toán hồi kết", "Endgame payoff"),
  ];
}

function buildPhaseModel(plan: StoryMacroEditablePlan, lang: PromptLanguage): StoryMacroPhase[] {
  const { expansion, decomposition } = plan;
  const names = phaseNames(lang);
  const coreUnknown = expansion.mystery_box || decomposition.main_hook;
  return [
    {
      name: names[0],
      goal: pick(
        lang,
        `先把主角困进「${summarizeText(expansion.protagonist_core, decomposition.core_conflict)}」，并抛出核心未知：${coreUnknown}`,
        `Trước hết dồn nhân vật chính vào "${summarizeText(expansion.protagonist_core, decomposition.core_conflict)}", và tung ra ẩn số cốt lõi: ${coreUnknown}`,
        `First trap the protagonist inside "${summarizeText(expansion.protagonist_core, decomposition.core_conflict)}", and pose the core unknown: ${coreUnknown}`,
      ),
    },
    {
      name: names[1],
      goal: pick(
        lang,
        `围绕「${decomposition.progression_loop}」推进第一次行动，让主角在误判下付出代价。`,
        `Xoay quanh "${decomposition.progression_loop}", triển khai hành động đầu tiên, để nhân vật chính trả giá vì phán đoán sai.`,
        `Around "${decomposition.progression_loop}", drive the first action and make the protagonist pay for a misjudgment.`,
      ),
    },
    {
      name: names[2],
      goal: pick(
        lang,
        `同步拉高外部、内部、关系三条压力线，兑现冲突引擎：${summarizeText(expansion.conflict_engine, decomposition.core_conflict)}`,
        `Đồng loạt đẩy cao ba tuyến áp lực bên ngoài, nội tâm và quan hệ, hiện thực hóa động cơ xung đột: ${summarizeText(expansion.conflict_engine, decomposition.core_conflict)}`,
        `Simultaneously raise all three pressure lines — external, internal, relational — and deliver on the conflict engine: ${summarizeText(expansion.conflict_engine, decomposition.core_conflict)}`,
      ),
    },
    {
      name: names[3],
      goal: pick(
        lang,
        `逼近并改写核心未知「${coreUnknown}」，让主角的认知发生翻转。`,
        `Ép sát và viết lại ẩn số cốt lõi "${coreUnknown}", khiến nhận thức của nhân vật chính bị lật ngược.`,
        `Close in on and rewrite the core unknown "${coreUnknown}", forcing a reversal in the protagonist's understanding.`,
      ),
    },
    {
      name: names[4],
      goal: pick(
        lang,
        `以「${decomposition.ending_flavor}」完成收束，并兑现关键爆点与情绪后劲。`,
        `Khép lại theo "${decomposition.ending_flavor}", đồng thời tất toán các cú bùng nổ then chốt và dư âm cảm xúc.`,
        `Close on "${decomposition.ending_flavor}", paying off the key blow-ups and the emotional aftertaste.`,
      ),
    },
  ];
}

function buildTurningPoints(payoffs: string[], lang: PromptLanguage): StoryMacroTurningPoint[] {
  const names = phaseNames(lang);
  return payoffs.map((item, index) => ({
    title: pick(lang, `兑现节点 ${index + 1}`, `Điểm tất toán ${index + 1}`, `Payoff point ${index + 1}`),
    summary: item,
    phase: names[Math.min(index, names.length - 1)] ?? names[names.length - 1],
  }));
}

function buildMysteryLayerConstraints(expansion: StoryExpansion, lang: PromptLanguage): string[] {
  const layers = expansion.mystery_layers ?? [];
  if (layers.length === 0) {
    return [];
  }
  const layerSep = pick(lang, "；", "; ", "; ");
  const layerLines = layers
    .map((layer, index) => pick(
      lang,
      `第${index + 1}层「${summarizeText(layer.question, layer.hidden_truth)}」于${layer.activates_arc}显形、${layer.pays_off_arc}揭示`,
      `Lớp ${index + 1} "${summarizeText(layer.question, layer.hidden_truth)}" lộ diện ở ${layer.activates_arc}, được hé lộ ở ${layer.pays_off_arc}`,
      `Layer ${index + 1} "${summarizeText(layer.question, layer.hidden_truth)}" surfaces at ${layer.activates_arc}, is revealed at ${layer.pays_off_arc}`,
    ))
    .join(layerSep);
  return [
    pick(
      lang,
      `悬念分层树必须按层兑现，不允许一次性揭穿或无铺垫反转：${layerLines}`,
      `Cây nghi vấn phân tầng phải được giải theo từng lớp, không lật hết một lúc và không có cú lật nào thiếu mồi cài trước: ${layerLines}`,
      `The layered mystery tree must be paid off layer by layer; no single-shot exposure and no reveal without prior setup: ${layerLines}`,
    ),
    pick(
      lang,
      "每一次分层揭示都必须改写读者此前已知的信息，且为下一层制造更大的疑问。",
      "Mỗi lần hé lộ một lớp đều phải viết lại thông tin người đọc đã biết trước đó, và tạo ra câu hỏi lớn hơn cho lớp kế tiếp.",
      "Each layer's reveal must rewrite information the reader previously held as true, and raise a bigger question for the next layer.",
    ),
  ];
}

function buildHardConstraints(plan: StoryMacroEditablePlan, lang: PromptLanguage): string[] {
  const growthStepPrefix = pick(
    lang,
    "主角认知推进必须经过：",
    "Bước tiến nhận thức của nhân vật chính bắt buộc phải đi qua: ",
    "The protagonist's cognitive progression must pass through: ",
  );
  const growthSteps = toGrowthSteps(plan.decomposition.growth_path).map((item) => `${growthStepPrefix}${item}`);
  const coreUnknown = plan.expansion.mystery_box || plan.decomposition.main_hook;
  return mergeUnique([
    ...plan.constraints,
    pick(
      lang,
      "角色创建前禁止生成具体角色姓名、固定角色阵容或完整人物小传。",
      "Trước bước tạo nhân vật, cấm sinh tên nhân vật cụ thể, dàn nhân vật cố định hoặc tiểu sử nhân vật hoàn chỉnh.",
      "Before the character-creation step, do not generate concrete character names, a fixed cast, or full character bios.",
    ),
    pick(
      lang,
      `每轮推进都必须持续回应核心未知：${coreUnknown}`,
      `Mỗi vòng đẩy truyện đều phải tiếp tục hồi đáp ẩn số cốt lõi: ${coreUnknown}`,
      `Every progression round must keep responding to the core unknown: ${coreUnknown}`,
    ),
    pick(
      lang,
      `剧情升级必须由冲突引擎驱动：${summarizeText(plan.expansion.conflict_engine, plan.decomposition.core_conflict)}`,
      `Việc nâng cấp tình tiết phải do động cơ xung đột dẫn dắt: ${summarizeText(plan.expansion.conflict_engine, plan.decomposition.core_conflict)}`,
      `Plot escalation must be driven by the conflict engine: ${summarizeText(plan.expansion.conflict_engine, plan.decomposition.core_conflict)}`,
    ),
    pick(
      lang,
      `高张力场面必须服务于主线，而不是单独炫技：${plan.expansion.setpiece_seeds.join(" / ")}`,
      `Các phân cảnh cao trào phải phục vụ mạch chính, không phải chỉ để phô diễn: ${plan.expansion.setpiece_seeds.join(" / ")}`,
      `High-tension set pieces must serve the main line, not just show off: ${plan.expansion.setpiece_seeds.join(" / ")}`,
    ),
    ...buildMysteryLayerConstraints(plan.expansion, lang),
    ...growthSteps,
  ], 12);
}

export function buildConstraintEngine(
  plan: StoryMacroEditablePlan,
  lang: PromptLanguage = "zh",
): StoryConstraintEngine {
  const growthSteps = toGrowthSteps(plan.decomposition.growth_path);
  const hardConstraints = buildHardConstraints(plan, lang);
  const mustNotHave = mergeUnique([
    ...negativeConstraintsOnly(plan.constraints),
    pick(
      lang,
      "用具体人物设定替代故事发动机",
      "Dùng thiết lập nhân vật cụ thể để thay cho động cơ câu chuyện",
      "Replacing the story engine with concrete character setup",
    ),
    pick(
      lang,
      "让世界观说明压过冲突推进",
      "Để phần giải thích thế giới quan lấn át nhịp đẩy xung đột",
      "Letting worldbuilding exposition overwhelm conflict progression",
    ),
  ], 6);
  return {
    premise: plan.expansion.expanded_premise || pick(
      lang,
      `${plan.decomposition.selling_point} 主线围绕「${plan.decomposition.core_conflict}」展开。`,
      `${plan.decomposition.selling_point} Mạch chính triển khai xoay quanh "${plan.decomposition.core_conflict}".`,
      `${plan.decomposition.selling_point} The main line unfolds around "${plan.decomposition.core_conflict}".`,
    ),
    conflict_axis: plan.decomposition.core_conflict,
    mystery_box: plan.expansion.mystery_box || plan.decomposition.main_hook,
    pressure_roles: buildPressureRoles(plan.expansion, lang),
    growth_path: growthSteps.length > 0 ? growthSteps : [plan.decomposition.growth_path].filter(Boolean),
    phase_model: buildPhaseModel(plan, lang),
    hard_constraints: hardConstraints,
    turning_points: buildTurningPoints(plan.decomposition.major_payoffs, lang),
    ending_constraints: {
      must_have: mergeUnique([
        pick(
          lang,
          `回应主线问题：${plan.decomposition.main_hook}`,
          `Hồi đáp câu hỏi mạch chính: ${plan.decomposition.main_hook}`,
          `Answer the main-line question: ${plan.decomposition.main_hook}`,
        ),
        pick(
          lang,
          `保留结局味道：${plan.decomposition.ending_flavor}`,
          `Giữ đúng dư vị hồi kết: ${plan.decomposition.ending_flavor}`,
          `Preserve the ending's flavor: ${plan.decomposition.ending_flavor}`,
        ),
        plan.decomposition.major_payoffs[plan.decomposition.major_payoffs.length - 1] ?? "",
      ], 4),
      must_not_have: mustNotHave,
    },
  };
}

export function getEditablePlanFieldValue(plan: StoryMacroEditablePlan, field: StoryMacroField): StoryMacroFieldValue {
  switch (field) {
    case "expanded_premise":
    case "protagonist_core":
    case "conflict_engine":
    case "mystery_box":
    case "emotional_line":
    case "tone_reference":
      return plan.expansion[field];
    case "conflict_layers":
      return plan.expansion.conflict_layers;
    case "setpiece_seeds":
      return plan.expansion.setpiece_seeds;
    case "selling_point":
    case "core_conflict":
    case "main_hook":
    case "progression_loop":
    case "growth_path":
    case "ending_flavor":
      return plan.decomposition[field];
    case "major_payoffs":
      return plan.decomposition.major_payoffs;
    case "constraints":
      return plan.constraints;
  }
}

export function setEditablePlanFieldValue(
  plan: StoryMacroEditablePlan,
  field: StoryMacroField,
  value: StoryMacroFieldValue,
): StoryMacroEditablePlan {
  const nextPlan: StoryMacroEditablePlan = {
    expansion: normalizeExpansion(plan.expansion),
    decomposition: normalizeDecomposition(plan.decomposition),
    constraints: normalizeConstraints(plan.constraints),
  };
  switch (field) {
    case "expanded_premise":
    case "protagonist_core":
    case "conflict_engine":
    case "mystery_box":
    case "emotional_line":
    case "tone_reference":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        [field]: typeof value === "string" ? value : "",
      });
      return nextPlan;
    case "conflict_layers":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        conflict_layers: normalizeConflictLayers(value),
      });
      return nextPlan;
    case "setpiece_seeds":
      nextPlan.expansion = normalizeExpansion({
        ...nextPlan.expansion,
        setpiece_seeds: Array.isArray(value) ? value : [],
      });
      return nextPlan;
    case "selling_point":
    case "core_conflict":
    case "main_hook":
    case "progression_loop":
    case "growth_path":
    case "ending_flavor":
      nextPlan.decomposition = normalizeDecomposition({
        ...nextPlan.decomposition,
        [field]: typeof value === "string" ? value : "",
      });
      return nextPlan;
    case "major_payoffs":
      nextPlan.decomposition = normalizeDecomposition({
        ...nextPlan.decomposition,
        major_payoffs: Array.isArray(value) ? value : [],
      });
      return nextPlan;
    case "constraints":
      nextPlan.constraints = normalizeConstraints(value);
      return nextPlan;
  }
}

export function mergeLockedFields(
  nextPlan: StoryMacroEditablePlan,
  previousPlan: StoryMacroEditablePlan | null,
  locks: StoryMacroLocks,
): StoryMacroEditablePlan {
  if (!previousPlan) {
    return nextPlan;
  }
  let merged = {
    expansion: normalizeExpansion(nextPlan.expansion),
    decomposition: normalizeDecomposition(nextPlan.decomposition),
    constraints: normalizeConstraints(nextPlan.constraints),
  };
  for (const field of STORY_MACRO_FIELDS) {
    if (!locks[field]) {
      continue;
    }
    merged = setEditablePlanFieldValue(
      merged,
      field,
      getEditablePlanFieldValue(previousPlan, field),
    );
  }
  return merged;
}
