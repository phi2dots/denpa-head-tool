import { memo, useEffect, useMemo, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { EvolutionRule, GraphEdge, GraphNode, GraphView as GraphViewState, HeadShape } from "./types";
import { buildShapeGraph } from "./domain";
import { shapeTypes } from "./labels";

interface Props {
  rootShapeId: string;
  selectedShapeId: string;
  shapes: HeadShape[];
  rules: EvolutionRule[];
  expandedSources: Set<string>;
  expandedResults: Set<string>;
  collapsedBranches: Set<string>;
  resetVersion: number;
  view: GraphViewState;
  onViewChange: (view: GraphViewState) => void;
  onToggleExpand: (direction: "sources" | "results", key: string) => void;
  onCollapseBranch: (key: string) => void;
  onSelectShape: (shapeId: string) => void;
  onResetExpansion: () => void;
}

type ShapeNodeData = {
  graphNode: GraphNode;
  selectedShapeId: string;
  expandedSources: Set<string>;
  expandedResults: Set<string>;
  onToggleExpand: (direction: "sources" | "results", key: string) => void;
  onSelectShape: (shapeId: string) => void;
};

type PathEdgeData = {
  path: string;
  className: string;
  collapseKey?: string;
  onCollapseBranch?: (key: string) => void;
};

const nodeTypes = {
  shapeNode: memo(ShapeNode),
};

const edgeTypes = {
  pathEdge: PathEdge,
};

const NODE_WIDTH = 236;
const NODE_HEIGHT = 92;
type ManualPositions = Record<string, { x: number; y: number }>;

export function GraphView(props: Props) {
  const [manualPositions, setManualPositions] = useState<ManualPositions>({});

  useEffect(() => {
    setManualPositions({});
  }, [props.rootShapeId, props.resetVersion]);

  const graph = useMemo(
    () =>
      buildShapeGraph({
        rootShapeId: props.rootShapeId,
        shapes: props.shapes,
        rules: props.rules,
        expandedSources: props.expandedSources,
        expandedResults: props.expandedResults,
        collapsedBranches: props.collapsedBranches,
      }),
    [props.rootShapeId, props.shapes, props.rules, props.expandedSources, props.expandedResults, props.collapsedBranches],
  );

  const displayNodes = useMemo(
    () =>
      graph.nodes.map((node) => {
        const manual = manualPositions[node.instanceKey];
        return manual ? { ...node, x: manual.x, y: manual.y } : node;
      }),
    [graph.nodes, manualPositions],
  );

  const flowNodes = useMemo<Node<ShapeNodeData>[]>(
    () =>
      displayNodes.map((node) => ({
        id: node.instanceKey,
        type: "shapeNode",
        position: { x: node.x, y: node.y },
        data: {
          graphNode: node,
          selectedShapeId: props.selectedShapeId,
          expandedSources: props.expandedSources,
          expandedResults: props.expandedResults,
          onToggleExpand: props.onToggleExpand,
          onSelectShape: props.onSelectShape,
        },
        draggable: true,
      })),
    [displayNodes, props.selectedShapeId, props.expandedSources, props.expandedResults, props.onToggleExpand, props.onSelectShape],
  );

  const flowEdges = useMemo<Edge<PathEdgeData>[]>(
    () => graphEdgesToFlowEdges(graph.edges, displayNodes, props.onCollapseBranch),
    [graph.edges, displayNodes, props.onCollapseBranch],
  );

  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <h2>出生ルート</h2>
        <GraphToolbar />
      </div>
      <div className="graph-canvas react-flow-canvas">
        {graph.nodes.length === 0 ? (
          <div className="graph-empty">表示できる関係がありません。</div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.25}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnScroll
            onNodeDrag={(_, node) => {
              setManualPositions((current) => ({ ...current, [node.id]: node.position }));
            }}
            onNodeDragStop={(_, node) => {
              setManualPositions((current) => ({ ...current, [node.id]: node.position }));
            }}
          >
            <Background gap={28} color="rgba(204, 216, 205, 0.75)" />
            <Controls showInteractive={false} />
            <button className="react-flow-reset-button" title="表示をリセット" type="button" onClick={props.onResetExpansion}>
              ↺
            </button>
          </ReactFlow>
        )}
      </div>
    </section>
  );
}

function GraphToolbar() {
  return (
    <div className="graph-tools">
      <span className="graph-tool-note">線を選択することで個別に出生ルートを非表示。リセットは展開状態、非表示、位置変更を初期化。</span>
    </div>
  );
}

function ShapeNode({ data }: NodeProps<Node<ShapeNodeData>>) {
  const node = data.graphNode;
  const sourceExpanded = data.expandedSources.has(node.instanceKey);
  const resultExpanded = data.expandedResults.has(node.instanceKey);
  const isSelected = node.id === data.selectedShapeId;
  return (
    <div className="flow-node-wrap">
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div
        className={`flow-node-card node-card type-${node.shapeType} ${isSelected ? "selected" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => data.onSelectShape(node.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") data.onSelectShape(node.id);
        }}
      >
        <button
          className="flow-node-expand-area sources"
          type="button"
          disabled={!node.canExpandSources}
          title="進化元を展開"
          onClick={(event) => {
            event.stopPropagation();
            if (node.canExpandSources) data.onToggleExpand("sources", node.instanceKey);
          }}
        >
          <span className="flow-node-plus">{sourceExpanded ? "-" : "+"}</span>
          <span className="flow-node-count">{node.sourceCount}</span>
        </button>
        <div className="flow-node-main">
          {node.image ? <img className="flow-node-image" src={node.image} alt="" /> : <span className="flow-node-image placeholder" />}
          <span className="flow-node-text">
            <span className="flow-node-title">{node.title}</span>
            <span className="flow-node-subtitle">{shapeTypes[node.shapeType]}</span>
          </span>
        </div>
        <button
          className="flow-node-expand-area results"
          type="button"
          disabled={!node.canExpandResults}
          title="進化先を展開"
          onClick={(event) => {
            event.stopPropagation();
            if (node.canExpandResults) data.onToggleExpand("results", node.instanceKey);
          }}
        >
          <span className="flow-node-plus">{resultExpanded ? "-" : "+"}</span>
          <span className="flow-node-count">{node.resultCount}</span>
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </div>
  );
}

function PathEdge({ data, markerEnd }: EdgeProps<Edge<PathEdgeData>>) {
  if (!data?.path) return null;
  return (
    <g
      className={data.collapseKey ? "graph-edge-clickable" : undefined}
      onClick={(event) => {
        if (!data.collapseKey) return;
        event.stopPropagation();
        data.onCollapseBranch?.(data.collapseKey);
      }}
    >
      {data.collapseKey && <path d={data.path} className="graph-edge-hit" />}
      <BaseEdge path={data.path} markerEnd={markerEnd} className={data.className} />
    </g>
  );
}

function graphEdgesToFlowEdges(edges: GraphEdge[], nodes: GraphNode[], onCollapseBranch: (key: string) => void): Edge<PathEdgeData>[] {
  const nodeMap = new Map(nodes.map((node) => [node.instanceKey, node]));
  return edges.flatMap((edge, index) => {
    const paths = edgeToPaths(edge, nodeMap);
    return paths.map((path, pathIndex) => ({
      id: `edge-${index}-${pathIndex}`,
      source: edgeSource(edge),
      target: edgeTarget(edge),
      type: "pathEdge",
      markerEnd: path.className.includes("edge-main") ? { type: MarkerType.ArrowClosed, color: "#7d8b80" } : undefined,
      data: { ...path, collapseKey: edge.type !== "simple" ? edge.collapseKey : undefined, onCollapseBranch },
    }));
  });
}

function edgeSource(edge: GraphEdge): string {
  if (edge.type === "merge") return edge.fromKeys[0];
  if (edge.type === "branchMerge") return edge.sourceKey;
  return "root";
}

function edgeTarget(edge: GraphEdge): string {
  if (edge.type === "merge") return edge.toKey;
  if (edge.type === "branchMerge") return edge.toKey;
  return "root";
}

function edgeToPaths(edge: GraphEdge, nodeMap: Map<string, GraphNode>): PathEdgeData[] {
  if (edge.type === "merge") return mergeEdgePaths(edge, nodeMap);
  if (edge.type === "branchMerge") return branchMergeEdgePaths(edge, nodeMap);
  const from = { x: edge.fromX + NODE_WIDTH, y: edge.fromY + NODE_HEIGHT / 2 };
  const to = { x: edge.toX, y: edge.toY + NODE_HEIGHT / 2 };
  return [{ className: "edge edge-main", path: `M ${from.x} ${from.y} L ${to.x} ${to.y}` }];
}

function mergeEdgePaths(edge: Extract<GraphEdge, { type: "merge" }>, nodeMap: Map<string, GraphNode>): PathEdgeData[] {
  const fromNodes = edge.fromKeys.map((key) => nodeMap.get(key)).filter(Boolean) as GraphNode[];
  const toNode = nodeMap.get(edge.toKey);
  if (fromNodes.length !== 2 || !toNode) return [];
  const [first, second] = fromNodes;
  const firstAnchor = rightAnchor(first);
  const secondAnchor = rightAnchor(second);
  const toAnchor = leftAnchor(toNode);
  const sourceMaxX = Math.max(firstAnchor.x, secondAnchor.x);
  const available = toAnchor.x - sourceMaxX;
  const mergeX = available > 120 ? sourceMaxX + available * 0.42 : sourceMaxX + 84;
  const mergeY = (firstAnchor.y + secondAnchor.y) / 2;
  const elbowX = controlBeforeTarget(mergeX, toAnchor.x);
  return [
    { className: "edge", path: `M ${firstAnchor.x} ${firstAnchor.y} C ${firstAnchor.x + 80} ${firstAnchor.y}, ${mergeX - 80} ${mergeY}, ${mergeX} ${mergeY}` },
    { className: "edge", path: `M ${secondAnchor.x} ${secondAnchor.y} C ${secondAnchor.x + 80} ${secondAnchor.y}, ${mergeX - 80} ${mergeY}, ${mergeX} ${mergeY}` },
    { className: "edge edge-main", path: `M ${mergeX} ${mergeY} C ${elbowX} ${mergeY}, ${elbowX} ${toAnchor.y}, ${toAnchor.x} ${toAnchor.y}` },
  ];
}

function branchMergeEdgePaths(edge: Extract<GraphEdge, { type: "branchMerge" }>, nodeMap: Map<string, GraphNode>): PathEdgeData[] {
  const sourceNode = nodeMap.get(edge.sourceKey);
  const partnerNode = nodeMap.get(edge.partnerKey);
  const toNode = nodeMap.get(edge.toKey);
  if (!sourceNode || !partnerNode || !toNode) return [];
  const sourceAnchor = rightAnchor(sourceNode);
  const partnerAnchor = rightAnchor(partnerNode);
  const toAnchor = leftAnchor(toNode);
  const virtualParentA = { x: partnerNode.x, y: toAnchor.y - 116 };
  const partnerLaneY = partnerAnchor.y;
  const available = toAnchor.x - partnerAnchor.x;
  const mergeX = partnerAnchor.x + Math.max(120, Math.min(220, available * 0.42));
  const mergeY = (virtualParentA.y + partnerLaneY) / 2;
  const childEntryX = controlBeforeTarget(mergeX, toAnchor.x);
  return [
    {
      className: "edge edge-branch",
      path: `M ${sourceAnchor.x} ${sourceAnchor.y} C ${sourceAnchor.x + 96} ${sourceAnchor.y}, ${virtualParentA.x - 220} ${virtualParentA.y}, ${virtualParentA.x} ${virtualParentA.y} C ${virtualParentA.x + 120} ${virtualParentA.y}, ${mergeX - 96} ${mergeY}, ${mergeX} ${mergeY}`,
    },
    {
      className: "edge",
      path: `M ${partnerAnchor.x} ${partnerAnchor.y} C ${partnerAnchor.x + 88} ${partnerLaneY}, ${mergeX - 92} ${mergeY}, ${mergeX} ${mergeY}`,
    },
    {
      className: "edge edge-main",
      path: `M ${mergeX} ${mergeY} C ${childEntryX} ${mergeY}, ${childEntryX} ${toAnchor.y}, ${toAnchor.x} ${toAnchor.y}`,
    },
  ];
}

function rightAnchor(node: GraphNode) {
  return { x: node.x + NODE_WIDTH + 2, y: node.y + NODE_HEIGHT / 2 };
}

function leftAnchor(node: GraphNode) {
  return { x: node.x - 2, y: node.y + NODE_HEIGHT / 2 };
}

function controlBeforeTarget(fromX: number, targetX: number) {
  const gap = targetX - fromX;
  if (gap <= 80) return fromX + Math.max(24, gap * 0.5);
  return targetX - Math.min(110, Math.max(54, gap * 0.35));
}
