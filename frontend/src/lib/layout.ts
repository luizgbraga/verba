/**
 * Converts a TreeResponse into React Flow nodes and edges.
 * Core graph logic lives in graph-core.ts — this file is the React Flow adapter.
 */

import type { Node, Edge } from "@xyflow/react";
import type { TreeResponse } from "@/types";
import {
  buildAdjacency,
  assignLayers,
  groupByLayer,
  positionTreeNodes,
  positionCognates,
  filterTransitiveEdges,
  deduplicateCognateEdges,
  resolveEdgeDirection,
  getLanguageColor,
  formatRelation,
  pickEdgeType,
  pickCognateEdgeType,
  LAYOUT,
} from "@/lib/graph-core";

export { getLanguageColor } from "@/lib/graph-core";

const { NODE_WIDTH } = LAYOUT;

export function layoutTree(data: TreeResponse): { nodes: Node[]; edges: Edge[] } {
  if (!data.root || !data.nodes.length) return { nodes: [], edges: [] };

  const rootId = data.root.id;
  const { parents, children, cognates } = buildAdjacency(data.edges, rootId);
  const layerOf = assignLayers(rootId, parents, children);

  // Nodes that are both cognates AND in the ancestry tree belong in the tree.
  // Remove them from cognates so they don't get placed in the cognate column.
  for (const id of layerOf.keys()) {
    cognates.delete(id);
  }

  // Any remaining unassigned nodes become cognates
  for (const n of data.nodes) {
    if (!layerOf.has(n.id) && !cognates.has(n.id)) {
      cognates.add(n.id);
    }
  }

  // Compute center-aligned positions
  const layerGroups = groupByLayer(layerOf);
  const treePositions = positionTreeNodes(layerGroups);
  const cognatePositions = positionCognates([...cognates], treePositions, rootId);
  const allPositions = new Map([...treePositions, ...cognatePositions]);

  // Build React Flow nodes.
  // Positions from graph-core are CENTER positions. React Flow positions nodes
  // by their top-left corner. So we offset by -NODE_WIDTH/2 to center-align.
  // This guarantees vertically-stacked nodes have perfectly aligned handles.
  const flowNodes: Node[] = data.nodes
    .filter((n) => allPositions.has(n.id))
    .map((n) => {
      const center = allPositions.get(n.id)!;
      return {
        id: n.id,
        type: "etymology",
        position: { x: center.x - NODE_WIDTH / 2, y: center.y },
        width: NODE_WIDTH,
        data: {
          term: n.term,
          lang: n.lang,
          definition: n.definition,
          isRoot: n.id === rootId,
          color: getLanguageColor(n.lang),
        },
      };
    });

  // Process edges
  const filtered = filterTransitiveEdges(data.edges, layerOf);
  const deduped = deduplicateCognateEdges(filtered, allPositions);

  // Build React Flow edges
  const flowEdges: Edge[] = deduped.map((e, i) => {
    const isCognate = e.relation === "cognate_of";
    const { rfSource, rfTarget } = resolveEdgeDirection(e.source, e.target, e.relation);
    const srcPos = allPositions.get(rfSource);
    const tgtPos = allPositions.get(rfTarget);
    const edgeType = isCognate
      ? pickCognateEdgeType(srcPos, tgtPos)
      : pickEdgeType(srcPos, tgtPos);

    const edge: Edge = {
      id: `e-${i}`,
      source: rfSource,
      target: rfTarget,
      type: edgeType,
      animated: false,
      label: isCognate ? "cognate" : formatRelation(e.relation),
      className: "verba-edge",
      ...(edgeType === "smoothstep" && { pathOptions: { offset: 20, borderRadius: 12 } }),
      style: {
        stroke: isCognate ? "rgba(120,113,108,0.35)" : "rgba(68,64,60,0.5)",
        strokeWidth: isCognate ? 1 : 1.2,
        strokeDasharray: isCognate ? "3,3" : undefined,
      },
      labelStyle: { fill: "rgba(168,162,158,0.6)", fontSize: 9, fontWeight: 400 },
      labelBgStyle: { fill: "#0c0a09", fillOpacity: 0.9 },
    };

    if (isCognate) {
      edge.sourceHandle = "right-out";
      edge.targetHandle = "left-in";
    }

    return edge;
  });

  return { nodes: flowNodes, edges: flowEdges };
}
