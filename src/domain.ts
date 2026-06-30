import type { EvolutionRule, GraphEdge, GraphNode, HeadShape } from "./types";
import { ailmentLabels, elementalLabels, specialLabels, statusLabels } from "./labels";
import { normalizeNumberMap } from "./data";

export function bonusTags(value: unknown, labels: Record<string, string>, options: { percent?: boolean } = {}): string[] {
  return Object.entries(normalizeNumberMap(value, labels))
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([key, amount]) => {
      const numeric = Number(amount);
      const sign = numeric > 0 ? "+" : "";
      if (key === "expReductionPercent") return `${labels[key]} -${Math.abs(numeric)}%`;
      return `${labels[key]} ${sign}${numeric}${options.percent ? "%" : ""}`;
    });
}

export const statusTags = (shape: HeadShape) => bonusTags(shape.statusBonus, statusLabels);
export const elementalTags = (shape: HeadShape) => bonusTags(shape.elementalResistance, elementalLabels);
export const ailmentTags = (shape: HeadShape) => bonusTags(shape.ailmentResistance, ailmentLabels);
export const specialTags = (shape: HeadShape) => bonusTags(shape.specialEffects, specialLabels, { percent: true });

export function shapeSearchValues(shape: HeadShape): string[] {
  return [
    shape.id,
    shape.name,
    String(shape.gameNumber ?? ""),
    shape.type,
    shape.notes,
    ...statusTags(shape),
    ...elementalTags(shape),
    ...ailmentTags(shape),
    ...specialTags(shape),
  ];
}

export function incomingRules(rules: EvolutionRule[], shapeId: string): EvolutionRule[] {
  return rules.filter((rule) => rule.resultShapeId === shapeId);
}

export function outgoingRules(rules: EvolutionRule[], shapeId: string): EvolutionRule[] {
  return rules.filter((rule) => rule.parentShapeAId === shapeId || rule.parentShapeBId === shapeId);
}

export function shapeById(shapes: HeadShape[], id: string): HeadShape | undefined {
  return shapes.find((shape) => shape.id === id);
}

export function orderedParentShapeIds(shapes: HeadShape[], parentAId: string, parentBId: string): [string, string] {
  const first = shapeById(shapes, parentAId);
  const second = shapeById(shapes, parentBId);
  const firstNumber = Number(first?.gameNumber ?? Number.MAX_SAFE_INTEGER);
  const secondNumber = Number(second?.gameNumber ?? Number.MAX_SAFE_INTEGER);
  if (firstNumber < secondNumber) return [parentAId, parentBId];
  if (firstNumber > secondNumber) return [parentBId, parentAId];
  return [parentAId, parentBId].sort() as [string, string];
}

export function nextEvolutionRuleId(rules: EvolutionRule[]): string {
  const max = rules.reduce((current, rule) => {
    const match = /^ev(\d+)$/.exec(rule.id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `ev${String(max + 1).padStart(4, "0")}`;
}

export function sortRulesByGameNumber(rules: EvolutionRule[], shapes: HeadShape[]): EvolutionRule[] {
  const numberOf = (id: string) => Number(shapeById(shapes, id)?.gameNumber ?? Number.MAX_SAFE_INTEGER);
  return [...rules].sort(
    (a, b) =>
      numberOf(a.parentShapeAId) - numberOf(b.parentShapeAId) ||
      numberOf(a.parentShapeBId) - numberOf(b.parentShapeBId) ||
      numberOf(a.resultShapeId) - numberOf(b.resultShapeId) ||
      a.id.localeCompare(b.id),
  );
}

export function buildShapeGraph(params: {
  rootShapeId: string;
  shapes: HeadShape[];
  rules: EvolutionRule[];
  expandedSources: Set<string>;
  expandedResults: Set<string>;
  collapsedBranches: Set<string>;
}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { rootShapeId, shapes, rules, expandedSources, expandedResults, collapsedBranches } = params;
  if (!shapeById(shapes, rootShapeId)) return { nodes: [], edges: [] };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const occupied = new Set<string>();
  addShapeBranch(rootShapeId, "shape", 350, 250, 0, "root", nodes, edges, occupied, {
    shapes,
    rules,
    expandedSources,
    expandedResults,
    collapsedBranches,
  });
  normalizeGraphLayout(nodes);
  return { nodes, edges };
}

function addShapeBranch(
  shapeId: string,
  kind: string,
  x: number,
  y: number,
  depth: number,
  instanceKey: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  occupied: Set<string>,
  context: {
    shapes: HeadShape[];
    rules: EvolutionRule[];
    expandedSources: Set<string>;
    expandedResults: Set<string>;
    collapsedBranches: Set<string>;
  },
  hidden: { sourceRuleId?: string; resultRuleId?: string } = {},
) {
  if (occupied.has(instanceKey) || depth > 8) return;
  occupied.add(instanceKey);
  const node = makeShapeNode(shapeId, kind, x, y, instanceKey, context.shapes, context.rules, hidden);
  if (node) nodes.push(node);

  if (context.expandedSources.has(instanceKey)) {
    const sourceRules = incomingRules(context.rules, shapeId).filter(
      (rule) => rule.id !== hidden.sourceRuleId && !context.collapsedBranches.has(`${instanceKey}/source/${rule.id}`),
    );
    const laneGap = spacingFor(sourceRules.length, 180, 250);
    const columnGap = spacingFor(sourceRules.length, 500, 620);
    sourceRules.forEach((rule, index) => {
      const collapseKey = `${instanceKey}/source/${rule.id}`;
      const baseY = y + (index - (sourceRules.length - 1) / 2) * laneGap;
      const parentAKey = `${instanceKey}/source/${rule.id}/a`;
      const parentBKey = `${instanceKey}/source/${rule.id}/b`;
      addShapeBranch(rule.parentShapeAId, "shape", x - columnGap, baseY - 58, depth + 1, parentAKey, nodes, edges, occupied, context, { resultRuleId: rule.id });
      addShapeBranch(rule.parentShapeBId, "shape", x - columnGap, baseY + 58, depth + 1, parentBKey, nodes, edges, occupied, context, { resultRuleId: rule.id });
      edges.push({ type: "merge", fromKeys: [parentAKey, parentBKey], toKey: instanceKey, collapseKey });
    });
  }

  if (context.expandedResults.has(instanceKey)) {
    const resultRules = outgoingRules(context.rules, shapeId).filter(
      (rule) => rule.id !== hidden.resultRuleId && !context.collapsedBranches.has(`${instanceKey}/result/${rule.id}`),
    );
    const laneGap = spacingFor(resultRules.length, 200, 280);
    const partnerGap = spacingFor(resultRules.length, 300, 380);
    const childGap = spacingFor(resultRules.length, 640, 780);
    resultRules.forEach((rule, index) => {
      const collapseKey = `${instanceKey}/result/${rule.id}`;
      const partnerId = rule.parentShapeAId === shapeId ? rule.parentShapeBId : rule.parentShapeAId;
      const partnerKey = `${instanceKey}/result/${rule.id}/partner`;
      const resultKey = `${instanceKey}/result/${rule.id}/child`;
      const partnerY = y + (index - (resultRules.length - 1) / 2) * laneGap + 58;
      addShapeBranch(partnerId, "shape", x + partnerGap, partnerY, depth + 1, partnerKey, nodes, edges, occupied, context, { resultRuleId: rule.id });
      addShapeBranch(rule.resultShapeId, "shape", x + childGap, partnerY - 58, depth + 1, resultKey, nodes, edges, occupied, context, { sourceRuleId: rule.id });
      edges.push({ type: "branchMerge", sourceKey: instanceKey, partnerKey, toKey: resultKey, collapseKey });
    });
  }
}

function spacingFor(count: number, compact: number, expanded: number): number {
  if (count <= 1) return compact;
  const factor = Math.min(1, (count - 1) / 6);
  return Math.round(compact + (expanded - compact) * factor);
}

function makeShapeNode(
  id: string,
  kind: string,
  x: number,
  y: number,
  instanceKey: string,
  shapes: HeadShape[],
  rules: EvolutionRule[],
  hidden: { sourceRuleId?: string; resultRuleId?: string },
): GraphNode | null {
  const shape = shapeById(shapes, id);
  if (!shape) return null;
  const sourceCount = incomingRules(rules, id).filter((rule) => rule.id !== hidden.sourceRuleId).length;
  const resultCount = outgoingRules(rules, id).filter((rule) => rule.id !== hidden.resultRuleId).length;
  return {
    id,
    instanceKey,
    type: "shape",
    kind,
    x,
    y,
    title: shape.name,
    subtitle: `進化元 ${sourceCount} / 進化先 ${resultCount}`,
    image: shape.image,
    shapeType: shape.type,
    sourceCount,
    resultCount,
    suppressedSourceRuleId: hidden.sourceRuleId,
    suppressedResultRuleId: hidden.resultRuleId,
    canExpandSources: sourceCount > 0,
    canExpandResults: resultCount > 0,
  };
}

function normalizeGraphLayout(nodes: GraphNode[]) {
  const groups = new Map<number, GraphNode[]>();
  nodes.forEach((node) => {
    const groupX = Math.round(node.x / 130) * 130;
    if (!groups.has(groupX)) groups.set(groupX, []);
    groups.get(groupX)?.push(node);
  });
  groups.forEach((group) => {
    group.sort((a, b) => a.y - b.y);
    for (let index = 1; index < group.length; index += 1) {
      const minimumY = group[index - 1].y + 165;
      if (group[index].y < minimumY) group[index].y = minimumY;
    }
  });
}
