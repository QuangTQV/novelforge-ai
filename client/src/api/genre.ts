import { translateResourceText, translateUi } from "@/i18n/legacy";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { NovelGenre } from "@ai-novel/shared/types/novel";
import { apiClient } from "./client";

export interface GenreTreeNode extends NovelGenre {
  childCount: number;
  novelCount: number;
  children: GenreTreeNode[];
}

export interface GenreTreeDraft {
  name: string;
  description?: string;
  children: GenreTreeDraft[];
}

export interface GenreOption {
  id: string;
  name: string;
  label: string;
  path: string;
  level: number;
  description?: string | null;
  template?: string | null;
}

export function translateGenreName(name: string): string {
  return translateUi(name);
}

export function translateGenrePath(path: string): string {
  return path.split("/").map((segment) => translateUi(segment.trim())).join(" / ");
}

export async function getGenreTree() {
  const { data } = await apiClient.get<ApiResponse<GenreTreeNode[]>>("/genres");
  return data;
}

export async function createGenreTree(payload: {
  name: string;
  description?: string;
  parentId?: string | null;
  children?: GenreTreeDraft[];
}) {
  const { data } = await apiClient.post<ApiResponse<NovelGenre>>("/genres", payload);
  return data;
}

export async function updateGenre(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    parentId: string | null;
  }>,
) {
  const { data } = await apiClient.put<ApiResponse<NovelGenre>>(`/genres/${id}`, payload);
  return data;
}

export async function deleteGenre(id: string) {
  const { data } = await apiClient.delete<ApiResponse<null>>(`/genres/${id}`);
  return data;
}

export async function generateGenreTree(payload: {
  prompt: string;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const { data } = await apiClient.post<ApiResponse<GenreTreeDraft>>("/genres/generate", payload);
  return data;
}

export function flattenGenreTreeOptions(
  nodes: GenreTreeNode[],
  level = 0,
  path: string[] = [],
): GenreOption[] {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.name];
    const translatedPath = nextPath.map((part) => translateUi(part));
    const current: GenreOption = {
      id: node.id,
      name: node.name,
      label: `${level > 0 ? `${"— ".repeat(level)}` : ""}${translateUi(node.name)}`,
      path: translatedPath.join(" / "),
      level,
      description: node.description?.trim() ? translateResourceText(node.description) : null,
      template: node.template?.trim() ? translateResourceText(node.template) : null,
    };
    return [current, ...flattenGenreTreeOptions(node.children, level + 1, nextPath)];
  });
}
