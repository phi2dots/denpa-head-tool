import type { EvolutionRule, HeadShape, NumberMap, ShapeType } from "./types";
import { ailmentLabels, elementalLabels, specialLabels, statusLabels } from "./labels";

export function emptyNumberMap(labels: Record<string, string>): NumberMap {
  return Object.fromEntries(Object.keys(labels).map((key) => [key, 0]));
}

export function normalizeNumberMap(value: unknown, labels: Record<string, string>): NumberMap {
  return { ...emptyNumberMap(labels), ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}) };
}

export function normalizeHeadShape(shape: Partial<HeadShape>): HeadShape {
  return {
    id: shape.id ?? "",
    name: shape.name ?? "",
    gameNumber: shape.gameNumber ?? null,
    image: shape.image ?? "",
    type: (shape.type ?? "none") as ShapeType,
    statusBonus: normalizeNumberMap(shape.statusBonus, statusLabels),
    elementalResistance: normalizeNumberMap(shape.elementalResistance, elementalLabels),
    ailmentResistance: normalizeNumberMap(shape.ailmentResistance, ailmentLabels),
    specialEffects: normalizeNumberMap(shape.specialEffects, specialLabels),
    notes: shape.notes ?? "",
  };
}

export function normalizeHeadShapes(shapes: unknown): HeadShape[] {
  return (Array.isArray(shapes) ? shapes : []).map((shape) => normalizeHeadShape(shape as Partial<HeadShape>));
}

export function serializeHeadShape(shape: HeadShape): HeadShape {
  return normalizeHeadShape(shape);
}

export function normalizeEvolutionRule(rule: Partial<EvolutionRule>): EvolutionRule {
  return {
    id: rule.id ?? "",
    parentShapeAId: rule.parentShapeAId ?? "",
    parentShapeBId: rule.parentShapeBId ?? "",
    resultShapeId: rule.resultShapeId ?? "",
    notes: rule.notes ?? "",
  };
}

export function normalizeEvolutionRules(rules: unknown): EvolutionRule[] {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => normalizeEvolutionRule(rule as Partial<EvolutionRule>))
    .filter((rule) => rule.id && rule.parentShapeAId && rule.parentShapeBId && rule.resultShapeId);
}

export async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} を読み込めませんでした。`);
  return response.json() as Promise<T>;
}

export async function saveJson(path: "/api/head-shapes" | "/api/evolution-rules", data: unknown[]): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const text = await response.text();
  let result: { ok?: boolean; error?: string };
  try {
    result = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    throw new Error(`${path} がJSONを返しませんでした。開発サーバーを再起動してください。`);
  }
  if (!response.ok || !result.ok) throw new Error(result.error || "保存に失敗しました。");
}
