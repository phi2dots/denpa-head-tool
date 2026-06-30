export type ShapeType = "none" | "rock" | "scissors" | "paper";

export type NumberMap = Record<string, number>;

export interface HeadShape {
  id: string;
  name: string;
  gameNumber: number | null;
  image: string;
  type: ShapeType;
  statusBonus: NumberMap;
  elementalResistance: NumberMap;
  ailmentResistance: NumberMap;
  specialEffects: NumberMap;
  notes: string;
}

export interface EvolutionRule {
  id: string;
  parentShapeAId: string;
  parentShapeBId: string;
  resultShapeId: string;
  notes: string;
}

export type Mode = "rules" | "owned" | "records";
export type GraphMode = "shape" | "owned";

export interface Selection {
  type: "shape" | "ownedCharacter" | "birthRecord";
  id: string;
}

export interface OwnedCharacter {
  id: string;
  name: string;
  headShapeId: string;
  obtainedBy: "qr" | "text" | "manual" | "unknown";
  obtainedValue: string;
  uniqueTraits: string[];
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirthRecord {
  id: string;
  parentACharacterId: string;
  parentBCharacterId: string;
  parentAUseCountAtTime: number;
  parentBUseCountAtTime: number;
  resultCharacterId: string;
  resultHeadShapeId: string;
  resultCharacterName: string;
  resultType: "evolution" | "same" | "degeneration" | "unknown";
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  instanceKey: string;
  type: "shape" | "ownedCharacter";
  kind: string;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  image: string;
  shapeType: ShapeType;
  sourceCount: number;
  resultCount: number;
  suppressedSourceRuleId?: string;
  suppressedResultRuleId?: string;
  canExpandSources?: boolean;
  canExpandResults?: boolean;
}

export type GraphEdge =
  | { type: "merge"; fromKeys: string[]; toKey: string; collapseKey?: string }
  | { type: "branchMerge"; sourceKey: string; partnerKey: string; toKey: string; collapseKey?: string }
  | { type: "simple"; fromX: number; fromY: number; toX: number; toY: number };

export interface GraphView {
  scale: number;
  panX: number;
  panY: number;
}
