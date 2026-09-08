export type StoryMacroField =
  | "expanded_premise"
  | "protagonist_core"
  | "conflict_engine"
  | "conflict_layers"
  | "mystery_box"
  | "emotional_line"
  | "setpiece_seeds"
  | "tone_reference"
  | "selling_point"
  | "core_conflict"
  | "main_hook"
  | "progression_loop"
  | "growth_path"
  | "major_payoffs"
  | "ending_flavor"
  | "constraints";

export interface StoryConflictLayers {
  external: string;
  internal: string;
  relational: string;
}

export type StoryMacroFieldValue = string | string[] | StoryConflictLayers;

export interface StoryDecomposition {
  selling_point: string;
  core_conflict: string;
  main_hook: string;
  progression_loop: string;
  growth_path: string;
  major_payoffs: string[];
  ending_flavor: string;
}

/**
 * Một tầng trong "cây bí ẩn" — chỉ dùng cho story mode có twistCadence dày
 * (悬念博弈 và tương tự). Cho phép thiết kế trước chuỗi hé lộ nhiều tầng kiểu
 * Attack on Titan thay vì một `mystery_box` phẳng.
 */
export interface StoryMysteryLayer {
  /** Câu hỏi bề mặt người đọc đang thắc mắc ở tầng này. */
  question: string;
  /** Sự thật thật (chỉ tác giả biết) — cái sẽ được hé lộ. */
  hidden_truth: string;
  /** Arc/tập (đại khái) nơi tầng này bắt đầu lộ diện. */
  activates_arc: string;
  /** Arc/tập (đại khái) nơi tầng này được trả / hé lộ. */
  pays_off_arc: string;
  /** Thông tin cũ mà cú hé lộ này tái cấu trúc (nếu có). */
  reframes?: string;
}

export interface StoryExpansion {
  expanded_premise: string;
  protagonist_core: string;
  conflict_engine: string;
  conflict_layers: StoryConflictLayers;
  mystery_box: string;
  /** Cây bí ẩn phân tầng; rỗng nếu truyện không thiên về hé lộ/đảo chiều. */
  mystery_layers?: StoryMysteryLayer[];
  emotional_line: string;
  setpiece_seeds: string[];
  tone_reference: string;
}

export interface StoryMacroIssue {
  type: "conflict" | "missing_info";
  field: StoryMacroField | "global";
  message: string;
}

export type StoryMacroLocks = Partial<Record<StoryMacroField, boolean>>;

export interface StoryMacroPhase {
  name: string;
  goal: string;
}

export interface StoryMacroTurningPoint {
  title: string;
  summary: string;
  phase: string;
}

export interface StoryConstraintEngine {
  premise: string;
  conflict_axis: string;
  mystery_box: string;
  pressure_roles: string[];
  growth_path: string[];
  phase_model: StoryMacroPhase[];
  hard_constraints: string[];
  turning_points: StoryMacroTurningPoint[];
  ending_constraints: {
    must_have: string[];
    must_not_have: string[];
  };
}

export interface StoryMacroState {
  currentPhase: number;
  progress: number;
  protagonistState: string;
}

export interface StoryMacroPlan {
  id: string;
  novelId: string;
  storyInput?: string | null;
  expansion?: StoryExpansion | null;
  decomposition?: StoryDecomposition | null;
  constraints: string[];
  issues: StoryMacroIssue[];
  lockedFields: StoryMacroLocks;
  constraintEngine?: StoryConstraintEngine | null;
  state: StoryMacroState;
  createdAt: string;
  updatedAt: string;
}
