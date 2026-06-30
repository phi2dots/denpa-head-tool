import type { EvolutionRule, HeadShape } from "./types";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  title: string;
  detail: string;
}

export async function validateProjectData(shapes: HeadShape[], rules: EvolutionRule[]): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const shapeIds = new Set<string>();
  const gameNumbers = new Set<number>();
  const ruleIds = new Set<string>();
  const ruleKeys = new Set<string>();

  shapes.forEach((shape, index) => {
    if (!shape.id) issues.push(error("頭の形IDが空です", `head-shapes.json の ${index + 1} 件目です。`));
    if (shape.id && shapeIds.has(shape.id)) issues.push(error("頭の形IDが重複しています", shape.id));
    shapeIds.add(shape.id);

    if (!shape.name) issues.push(error("頭の形の名前が空です", shape.id || `${index + 1} 件目`));
    if (shape.gameNumber == null) issues.push(warning("gameNumberが未設定です", shape.name || shape.id));
    if (shape.gameNumber != null && gameNumbers.has(shape.gameNumber)) issues.push(error("gameNumberが重複しています", `No. ${shape.gameNumber}`));
    if (shape.gameNumber != null) gameNumbers.add(shape.gameNumber);

    if (!shape.image) {
      issues.push(warning("画像パスが未設定です", shape.name || shape.id));
    }
  });

  await Promise.all(
    shapes
      .filter((shape) => shape.image)
      .map(async (shape) => {
        if (!(await canFetch(shape.image))) {
          issues.push(error("画像を読み込めません", `${shape.name}: ${shape.image}`));
        }
      }),
  );

  rules.forEach((rule, index) => {
    if (!rule.id) issues.push(error("出生ルールIDが空です", `evolution-rules.json の ${index + 1} 件目です。`));
    if (rule.id && ruleIds.has(rule.id)) issues.push(error("出生ルールIDが重複しています", rule.id));
    ruleIds.add(rule.id);

    [rule.parentShapeAId, rule.parentShapeBId, rule.resultShapeId].forEach((shapeId) => {
      if (!shapeIds.has(shapeId)) issues.push(error("存在しない頭の形IDを参照しています", `${rule.id}: ${shapeId}`));
    });

    const key = [rule.parentShapeAId, rule.parentShapeBId, rule.resultShapeId].join(">");
    if (ruleKeys.has(key)) issues.push(error("同一の出生ルールが重複しています", `${rule.parentShapeAId} + ${rule.parentShapeBId} -> ${rule.resultShapeId}`));
    ruleKeys.add(key);
  });

  return issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.title.localeCompare(b.title));
}

function error(title: string, detail: string): ValidationIssue {
  return { severity: "error", title, detail };
}

function warning(title: string, detail: string): ValidationIssue {
  return { severity: "warning", title, detail };
}

function severityRank(severity: ValidationSeverity) {
  return severity === "error" ? 0 : 1;
}

async function canFetch(path: string) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}
