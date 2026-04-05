/**
 * Pure graph logic for etymology tree layout.
 * No React/React Flow dependencies — fully testable.
 */

import type { TermEdge } from "@/types";

// --- Constants ---

export const ORIGIN_RELATIONS = new Set([
  "inherited_from", "borrowed_from", "derived_from",
  "learned_borrowing_from", "semi_learned_borrowing_from",
  "orthographic_borrowing_from", "unadapted_borrowing_from",
  "calque_of", "partial_calque_of",
  "semantic_loan_from", "phono_semantic_matching_from",
]);

export const LAYOUT = {
  LAYER_GAP_Y: 180,
  NODE_GAP_X: 220,
  NODE_WIDTH: 150,
  COGNATE_OFFSET_X: 350,
  MAX_PER_ROW: 6,
  SUB_ROW_GAP: 160,
} as const;

const RELATION_LABELS: Record<string, string> = {
  inherited_from: "inherited", borrowed_from: "borrowed", derived_from: "derived",
  learned_borrowing_from: "learned", semi_learned_borrowing_from: "semi-learned",
  orthographic_borrowing_from: "orthographic", unadapted_borrowing_from: "unadapted",
  calque_of: "calque", partial_calque_of: "partial calque",
  semantic_loan_from: "semantic loan", phono_semantic_matching_from: "phono-semantic",
  cognate_of: "cognate", compound_of: "compound", blend_of: "blend",
  has_prefix: "prefix", has_suffix: "suffix", has_confix: "confix",
};

// --- Types ---

export interface Position {
  x: number;
  y: number;
}

// --- Adjacency building ---

export function buildAdjacency(edges: TermEdge[], rootId: string) {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const cognates = new Set<string>();

  for (const e of edges) {
    if (e.relation === "cognate_of") {
      const other = e.source === rootId ? e.target : e.target === rootId ? e.source : null;
      if (other) cognates.add(other);
      continue;
    }
    if (ORIGIN_RELATIONS.has(e.relation)) {
      if (!parents.has(e.source)) parents.set(e.source, []);
      parents.get(e.source)!.push(e.target);
      if (!children.has(e.target)) children.set(e.target, []);
      children.get(e.target)!.push(e.source);
    }
  }

  return { parents, children, cognates };
}

// --- Layer assignment ---

/**
 * Assigns vertical layers via BFS.
 * Root = layer 0, ancestors = negative, descendants = positive.
 * When reachable via multiple paths, uses the DEEPEST layer.
 */
export function assignLayers(
  rootId: string,
  parents: Map<string, string[]>,
  children: Map<string, string[]>,
): Map<string, number> {
  const layerOf = new Map<string, number>([[rootId, 0]]);
  bfsDeepest(rootId, parents, layerOf, -1);
  bfsDeepest(rootId, children, layerOf, +1);
  return layerOf;
}

function bfsDeepest(
  start: string,
  adjacency: Map<string, string[]>,
  layerOf: Map<string, number>,
  direction: 1 | -1,
) {
  const queue = [start];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const nextLayer = layerOf.get(cur)! + direction;

    for (const neighbor of adjacency.get(cur) ?? []) {
      const existing = layerOf.get(neighbor);
      const isDeeper = direction === -1
        ? nextLayer < (existing ?? 0)
        : nextLayer > (existing ?? 0);

      if (!visited.has(neighbor) || (existing !== undefined && isDeeper)) {
        visited.add(neighbor);
        layerOf.set(neighbor, nextLayer);
        queue.push(neighbor);
      }
    }
  }
}

// --- Layer grouping ---

export function groupByLayer(layerOf: Map<string, number>): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const [id, layer] of layerOf) {
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer)!.push(id);
  }
  return groups;
}

// --- Positioning ---

/**
 * Positions are CENTER-ALIGNED: the returned x,y represents the center
 * of where the node should be placed. The layout.ts adapter offsets by
 * -NODE_WIDTH/2 when creating React Flow nodes so handles align perfectly
 * for vertically-stacked nodes.
 */
export function positionTreeNodes(
  layerGroups: Map<number, string[]>,
): Map<string, Position> {
  const { LAYER_GAP_Y, NODE_GAP_X, MAX_PER_ROW, SUB_ROW_GAP } = LAYOUT;
  const positions = new Map<string, Position>();
  const sorted = [...layerGroups.keys()].sort((a, b) => a - b);
  let yOffset = 0;

  for (const layer of sorted) {
    const ids = layerGroups.get(layer)!;
    const baseY = layer * LAYER_GAP_Y + yOffset;

    if (ids.length <= MAX_PER_ROW) {
      const startX = -((ids.length - 1) * NODE_GAP_X) / 2;
      for (let i = 0; i < ids.length; i++) {
        positions.set(ids[i], { x: startX + i * NODE_GAP_X, y: baseY });
      }
    } else {
      const rows = Math.ceil(ids.length / MAX_PER_ROW);
      for (let i = 0; i < ids.length; i++) {
        const row = Math.floor(i / MAX_PER_ROW);
        const col = i % MAX_PER_ROW;
        const itemsInRow = Math.min(MAX_PER_ROW, ids.length - row * MAX_PER_ROW);
        const rowStartX = -((itemsInRow - 1) * NODE_GAP_X) / 2;
        positions.set(ids[i], { x: rowStartX + col * NODE_GAP_X, y: baseY + row * SUB_ROW_GAP });
      }
      yOffset += (rows - 1) * SUB_ROW_GAP;
    }
  }
  return positions;
}

export function positionCognates(
  cognateIds: string[],
  treePositions: Map<string, Position>,
  rootId: string,
): Map<string, Position> {
  const { COGNATE_OFFSET_X, LAYER_GAP_Y } = LAYOUT;
  const positions = new Map<string, Position>();
  if (!cognateIds.length) return positions;

  let maxX = 0;
  for (const pos of treePositions.values()) {
    maxX = Math.max(maxX, Math.abs(pos.x));
  }
  const cogX = maxX + COGNATE_OFFSET_X;
  const cogGapY = LAYER_GAP_Y * 0.6;

  const rootY = treePositions.get(rootId)?.y ?? 0;
  const totalHeight = (cognateIds.length - 1) * cogGapY;
  const startY = rootY - totalHeight / 2;

  for (let i = 0; i < cognateIds.length; i++) {
    positions.set(cognateIds[i], {
      x: cogX,
      y: startY + i * cogGapY,
    });
  }

  return positions;
}

// --- Edge processing ---

/**
 * Filters out:
 * 1. Transitive shortcut edges that skip layers (origin edges with gap > 1)
 * 2. Cognate edges between nodes that are already connected in the tree
 *    (e.g. embarrasser is both a descendant AND cognate of embarazar —
 *    the cognate edge is redundant and creates conflicting routing)
 */
export function filterTransitiveEdges(
  edges: TermEdge[],
  layerOf: Map<string, number>,
): TermEdge[] {
  return edges.filter((e) => {
    if (e.relation === "cognate_of") {
      // Drop cognate edges where both nodes are already in the ancestry tree
      const srcInTree = layerOf.has(e.source);
      const tgtInTree = layerOf.has(e.target);
      if (srcInTree && tgtInTree) return false;
      return true;
    }
    if (!ORIGIN_RELATIONS.has(e.relation)) return true;
    const srcLayer = layerOf.get(e.source);
    const tgtLayer = layerOf.get(e.target);
    if (srcLayer === undefined || tgtLayer === undefined) return true;
    return Math.abs(srcLayer - tgtLayer) <= 1;
  });
}

/**
 * Deduplicates cognate edges and orients them left→right spatially.
 */
export function deduplicateCognateEdges(
  edges: TermEdge[],
  positions: Map<string, Position>,
): TermEdge[] {
  const seen = new Set<string>();
  const result: TermEdge[] = [];

  for (const e of edges) {
    if (e.relation !== "cognate_of") {
      result.push(e);
      continue;
    }
    const key = [e.source, e.target].sort().join("↔");
    if (seen.has(key)) continue;
    seen.add(key);

    const srcPos = positions.get(e.source);
    const tgtPos = positions.get(e.target);
    if (srcPos && tgtPos && srcPos.x > tgtPos.x) {
      result.push({ source: e.target, target: e.source, relation: e.relation });
    } else {
      result.push(e);
    }
  }

  return result;
}

/**
 * Swaps source/target for origin edges so they flow top-down visually.
 */
export function resolveEdgeDirection(
  source: string,
  target: string,
  relation: string,
): { rfSource: string; rfTarget: string } {
  if (ORIGIN_RELATIONS.has(relation)) {
    return { rfSource: target, rfTarget: source };
  }
  return { rfSource: source, rfTarget: target };
}

/**
 * Cognate edges: "straight" when horizontally aligned (same Y), "smoothstep" otherwise.
 */
export function pickCognateEdgeType(
  sourcePos: Position | undefined,
  targetPos: Position | undefined,
): string {
  if (!sourcePos || !targetPos) return "smoothstep";
  return Math.abs(sourcePos.y - targetPos.y) < 10 ? "straight" : "smoothstep";
}

/**
 * Tree edges: "straight" when vertically aligned (same X), "smoothstep" otherwise.
 */
export function pickEdgeType(
  sourcePos: Position | undefined,
  targetPos: Position | undefined,
): string {
  if (!sourcePos || !targetPos) return "smoothstep";
  return Math.abs(sourcePos.x - targetPos.x) < 10 ? "straight" : "smoothstep";
}

// --- Language colors ---

const FAMILY_HUES: Record<string, number> = {
  English: 200, "Old English": 200, "Middle English": 200,
  German: 42, "Old High German": 42, "Middle High German": 42, "Low German": 42,
  Dutch: 28, "Middle Dutch": 28, "Old Dutch": 28, Afrikaans: 28,
  Swedish: 50, Norwegian: 50, "Norwegian Nynorsk": 50, "Norwegian Bokmål": 50,
  Danish: 48, Icelandic: 55, "Old Norse": 55, Faroese: 52,
  Scots: 195, Yiddish: 38, Frisian: 32, "West Frisian": 32,
  French: 270, "Old French": 270, "Middle French": 270,
  Spanish: 330, "Old Spanish": 330, Catalan: 325, Galician: 335,
  Portuguese: 330, "Old Portuguese": 330,
  Italian: 340, Sicilian: 340, Sardinian: 345, Corsican: 340,
  Romanian: 320, Aromanian: 320, Occitan: 275, Friulian: 335, Venetian: 340,
  Latin: 350, "Vulgar Latin": 350, "Medieval Latin": 350, "Late Latin": 350, "New Latin": 350,
  Greek: 160, "Ancient Greek": 160, "Koine Greek": 160, "Byzantine Greek": 160,
  Russian: 280, Ukrainian: 280, Belarusian: 280,
  Polish: 285, Czech: 285, Slovak: 285,
  Serbian: 290, Croatian: 290, Bosnian: 290, Slovenian: 290, Bulgarian: 290, Macedonian: 290,
  Irish: 140, "Old Irish": 140, Scottish: 142, Welsh: 145, Breton: 148,
  Lithuanian: 175, Latvian: 178,
  Sanskrit: 15, Hindi: 15, Urdu: 15, Bengali: 18, Marathi: 15,
  Persian: 22, Kurdish: 22, Pashto: 22,
  Arabic: 172, Hebrew: 168, Aramaic: 170, "Classical Syriac": 170,
  Turkish: 60, Azerbaijani: 62, Uzbek: 58, Kazakh: 56,
  Finnish: 190, Estonian: 188, Hungarian: 185,
  Chinese: 0, Japanese: 5, Korean: 10,
  Malay: 80, Indonesian: 80, Tagalog: 85, Hawaiian: 88, Maori: 82,
  Thai: 68, Vietnamese: 72, Georgian: 120, Armenian: 125, Basque: 110, Albanian: 130,
  Swahili: 95, Somali: 92,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getBaseLanguage(lang: string): string {
  return lang.replace(/^(Old |Middle |Ancient |Medieval |Late |New |Vulgar |Classical |Proto-|Byzantine |Koine )/, "");
}

const colorCache = new Map<string, string>();

export function getLanguageColor(lang: string): string {
  const cached = colorCache.get(lang);
  if (cached) return cached;

  const isProto = lang.startsWith("Proto-");
  const hue = FAMILY_HUES[lang] ?? FAMILY_HUES[getBaseLanguage(lang)] ?? hashString(lang) % 360;
  const saturation = isProto ? 20 : 75;
  const lightness = isProto ? 60 : 65;

  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  colorCache.set(lang, color);
  return color;
}

export function formatRelation(rel: string): string {
  return RELATION_LABELS[rel] ?? rel.replace(/_/g, " ").replace(/ of$/, "").replace(/ from$/, "");
}
