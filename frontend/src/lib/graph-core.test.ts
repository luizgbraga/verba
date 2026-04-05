import { describe, it, expect } from "vitest";
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
  ORIGIN_RELATIONS,
  LAYOUT,
} from "./graph-core";
import type { TermEdge } from "@/types";

function edge(source: string, target: string, relation: string): TermEdge {
  return { source, target, relation };
}

const SIMPLE_CHAIN: TermEdge[] = [
  edge("english", "old-english", "inherited_from"),
  edge("old-english", "proto-germanic", "inherited_from"),
  edge("proto-germanic", "pie", "inherited_from"),
];

const WITH_DESCENDANTS: TermEdge[] = [
  edge("english", "old-english", "inherited_from"),
  edge("naet", "english", "borrowed_from"),
  edge("nait", "english", "borrowed_from"),
];

const WITH_COGNATES: TermEdge[] = [
  edge("english", "old-english", "inherited_from"),
  edge("english", "german-cognate", "cognate_of"),
  edge("german-cognate", "english", "cognate_of"),
  edge("dutch-cognate", "english", "cognate_of"),
];

// --- buildAdjacency ---

describe("buildAdjacency", () => {
  it("builds parent/child maps from origin edges", () => {
    const { parents, children } = buildAdjacency(SIMPLE_CHAIN, "english");
    expect(parents.get("english")).toEqual(["old-english"]);
    expect(parents.get("old-english")).toEqual(["proto-germanic"]);
    expect(children.get("old-english")).toEqual(["english"]);
    expect(children.get("pie")).toEqual(["proto-germanic"]);
  });

  it("identifies cognates relative to root", () => {
    const { cognates } = buildAdjacency(WITH_COGNATES, "english");
    expect(cognates.has("german-cognate")).toBe(true);
    expect(cognates.has("dutch-cognate")).toBe(true);
    expect(cognates.size).toBe(2);
  });

  it("ignores non-origin non-cognate relations", () => {
    const { parents, children, cognates } = buildAdjacency([edge("a", "b", "compound_of")], "a");
    expect(parents.size).toBe(0);
    expect(children.size).toBe(0);
    expect(cognates.size).toBe(0);
  });
});

// --- assignLayers ---

describe("assignLayers", () => {
  it("assigns root=0, ancestors negative, descendants positive", () => {
    const { parents, children } = buildAdjacency(SIMPLE_CHAIN, "english");
    const layers = assignLayers("english", parents, children);
    expect(layers.get("english")).toBe(0);
    expect(layers.get("old-english")).toBe(-1);
    expect(layers.get("proto-germanic")).toBe(-2);
    expect(layers.get("pie")).toBe(-3);
  });

  it("assigns descendants to positive layers", () => {
    const { parents, children } = buildAdjacency(WITH_DESCENDANTS, "english");
    const layers = assignLayers("english", parents, children);
    expect(layers.get("naet")).toBe(1);
    expect(layers.get("nait")).toBe(1);
  });

  it("uses deepest layer when multiple paths exist (palavra case)", () => {
    const edges: TermEdge[] = [
      edge("portuguese", "old-portuguese", "inherited_from"),
      edge("portuguese", "latin", "inherited_from"),
      edge("old-portuguese", "latin", "inherited_from"),
    ];
    const { parents, children } = buildAdjacency(edges, "portuguese");
    const layers = assignLayers("portuguese", parents, children);
    expect(layers.get("old-portuguese")).toBe(-1);
    expect(layers.get("latin")).toBe(-2); // deepest, not -1
  });

  it("handles diamond ancestry", () => {
    const edges: TermEdge[] = [
      edge("a", "b", "inherited_from"),
      edge("a", "c", "inherited_from"),
      edge("b", "d", "inherited_from"),
      edge("c", "d", "inherited_from"),
    ];
    const { parents, children } = buildAdjacency(edges, "a");
    const layers = assignLayers("a", parents, children);
    expect(layers.get("b")).toBe(-1);
    expect(layers.get("c")).toBe(-1);
    expect(layers.get("d")).toBe(-2);
  });
});

// --- groupByLayer ---

describe("groupByLayer", () => {
  it("groups node IDs by layer", () => {
    const layerOf = new Map([["a", 0], ["b", -1], ["c", -1], ["d", 1]]);
    const groups = groupByLayer(layerOf);
    expect(groups.get(0)).toEqual(["a"]);
    expect(groups.get(-1)?.sort()).toEqual(["b", "c"]);
    expect(groups.get(1)).toEqual(["d"]);
  });
});

// --- positionTreeNodes ---

describe("positionTreeNodes", () => {
  it("centers a single node at x=0", () => {
    const groups = new Map([[0, ["a"]]]);
    const positions = positionTreeNodes(groups);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
  });

  it("centers layer horizontally with NODE_GAP_X spacing", () => {
    const groups = new Map([[0, ["a", "b", "c"]]]);
    const positions = positionTreeNodes(groups);
    const xa = positions.get("a")!.x;
    const xb = positions.get("b")!.x;
    const xc = positions.get("c")!.x;
    expect(xa).toBe(-xc); // symmetric
    expect(xb).toBe(0);   // center
    expect(xb - xa).toBe(LAYOUT.NODE_GAP_X);
  });

  it("stacks layers with LAYER_GAP_Y", () => {
    const groups = new Map([[-1, ["a"]], [0, ["b"]], [1, ["c"]]]);
    const positions = positionTreeNodes(groups);
    expect(positions.get("a")!.y).toBe(-LAYOUT.LAYER_GAP_Y);
    expect(positions.get("b")!.y).toBe(0);
    expect(positions.get("c")!.y).toBe(LAYOUT.LAYER_GAP_Y);
  });

  it("wraps wide layers into rows of MAX_PER_ROW", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `n${i}`);
    const groups = new Map([[0, ids]]);
    const positions = positionTreeNodes(groups);
    const firstRowY = positions.get("n0")!.y;
    let firstRowCount = 0;
    for (const id of ids) {
      if (positions.get(id)!.y === firstRowY) firstRowCount++;
    }
    expect(firstRowCount).toBe(LAYOUT.MAX_PER_ROW);
    expect(positions.get(`n${LAYOUT.MAX_PER_ROW}`)!.y - firstRowY).toBe(LAYOUT.SUB_ROW_GAP);
  });

  it("vertically-aligned single-node layers share the same X (garrafa fix)", () => {
    // Two layers each with 1 node: both should be at x=0
    const groups = new Map([[-1, ["parent"]], [0, ["child"]]]);
    const positions = positionTreeNodes(groups);
    expect(positions.get("parent")!.x).toBe(positions.get("child")!.x);
    expect(positions.get("parent")!.x).toBe(0);
  });
});

// --- positionCognates ---

describe("positionCognates", () => {
  it("places cognates to the right of the tree", () => {
    const tree = new Map([["root", { x: 0, y: 0 }]]);
    const cogs = positionCognates(["c1", "c2"], tree, "root");
    expect(cogs.get("c1")!.x).toBeGreaterThan(0);
    expect(cogs.get("c2")!.x).toBeGreaterThan(0);
  });

  it("single column (all same X)", () => {
    const tree = new Map([["root", { x: 0, y: 0 }]]);
    const cogs = positionCognates(["c0", "c1", "c2"], tree, "root");
    const xs = ["c0", "c1", "c2"].map((id) => cogs.get(id)!.x);
    expect(new Set(xs).size).toBe(1);
  });

  it("centers vertically around root", () => {
    const tree = new Map([["root", { x: 0, y: 200 }]]);
    const cogs = positionCognates(["c0", "c1"], tree, "root");
    expect((cogs.get("c0")!.y + cogs.get("c1")!.y) / 2).toBe(200);
  });

  it("returns empty for no cognates", () => {
    expect(positionCognates([], new Map([["r", { x: 0, y: 0 }]]), "r").size).toBe(0);
  });
});

// --- filterTransitiveEdges ---

describe("filterTransitiveEdges", () => {
  it("keeps adjacent-layer edges", () => {
    const layerOf = new Map([["a", 0], ["b", -1]]);
    expect(filterTransitiveEdges([edge("a", "b", "inherited_from")], layerOf)).toHaveLength(1);
  });

  it("removes skip-layer edges", () => {
    const layerOf = new Map([["a", 0], ["b", -1], ["c", -3]]);
    const filtered = filterTransitiveEdges([
      edge("a", "b", "inherited_from"),
      edge("a", "c", "inherited_from"),
    ], layerOf);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].target).toBe("b");
  });

  it("keeps cognate edges when cognate is outside the tree", () => {
    // "b" is not in layerOf — it's a pure cognate, not a tree member
    const layerOf = new Map([["a", 0]]);
    expect(filterTransitiveEdges([edge("a", "b", "cognate_of")], layerOf)).toHaveLength(1);
  });

  it("filters heute case (gap=2)", () => {
    const layerOf = new Map([["h", 0], ["mhg", -1], ["pg", -2]]);
    const filtered = filterTransitiveEdges([
      edge("h", "mhg", "inherited_from"),
      edge("h", "pg", "inherited_from"),
    ], layerOf);
    expect(filtered).toHaveLength(1);
  });

  it("drops cognate edges when both nodes are in the ancestry tree (embarazar case)", () => {
    // embarazar (L0) and embarrasser (L+1) are connected by borrowed_from AND cognate_of.
    // The cognate edge is redundant — drop it.
    const layerOf = new Map([["embarazar", 0], ["embarrasser", 1]]);
    const edges = [
      edge("embarrasser", "embarazar", "borrowed_from"),
      edge("embarazar", "embarrasser", "cognate_of"),
    ];
    const filtered = filterTransitiveEdges(edges, layerOf);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].relation).toBe("borrowed_from");
  });

  it("keeps cognate edges when the cognate is NOT in the tree", () => {
    // embarazar (L0) and embarassar (Catalan) — Catalan is a true cognate, not in tree
    const layerOf = new Map([["embarazar", 0], ["embarrasser", 1]]);
    const edges = [edge("embarazar", "catalan-cognate", "cognate_of")];
    const filtered = filterTransitiveEdges(edges, layerOf);
    expect(filtered).toHaveLength(1);
  });
});

// --- deduplicateCognateEdges ---

describe("deduplicateCognateEdges", () => {
  it("removes duplicate A↔B cognate edges", () => {
    const edges = [edge("a", "b", "cognate_of"), edge("b", "a", "cognate_of")];
    const positions = new Map([["a", { x: 0, y: 0 }], ["b", { x: 100, y: 0 }]]);
    const result = deduplicateCognateEdges(edges, positions);
    expect(result.filter((e) => e.relation === "cognate_of")).toHaveLength(1);
  });

  it("orients cognate left→right", () => {
    const edges = [edge("right", "left", "cognate_of")];
    const positions = new Map([["left", { x: 0, y: 0 }], ["right", { x: 500, y: 0 }]]);
    const result = deduplicateCognateEdges(edges, positions);
    expect(result[0].source).toBe("left");
    expect(result[0].target).toBe("right");
  });

  it("passes through non-cognate edges unchanged", () => {
    const edges = [edge("a", "b", "inherited_from")];
    expect(deduplicateCognateEdges(edges, new Map())).toEqual(edges);
  });
});

// --- resolveEdgeDirection ---

describe("resolveEdgeDirection", () => {
  it("swaps for origin edges", () => {
    const { rfSource, rfTarget } = resolveEdgeDirection("modern", "ancient", "inherited_from");
    expect(rfSource).toBe("ancient");
    expect(rfTarget).toBe("modern");
  });

  it("keeps direction for non-origin edges", () => {
    const { rfSource, rfTarget } = resolveEdgeDirection("a", "b", "cognate_of");
    expect(rfSource).toBe("a");
    expect(rfTarget).toBe("b");
  });

  for (const rel of ORIGIN_RELATIONS) {
    it(`swaps for ${rel}`, () => {
      const { rfSource, rfTarget } = resolveEdgeDirection("src", "tgt", rel);
      expect(rfSource).toBe("tgt");
      expect(rfTarget).toBe("src");
    });
  }
});

// --- pickEdgeType ---

describe("pickEdgeType", () => {
  it("straight when vertically aligned", () => {
    expect(pickEdgeType({ x: 0, y: 0 }, { x: 0, y: 180 })).toBe("straight");
  });

  it("straight when X diff < 10", () => {
    expect(pickEdgeType({ x: 100, y: 0 }, { x: 105, y: 180 })).toBe("straight");
  });

  it("smoothstep when horizontally offset", () => {
    expect(pickEdgeType({ x: 0, y: 0 }, { x: 220, y: 180 })).toBe("smoothstep");
  });

  it("smoothstep when positions undefined", () => {
    expect(pickEdgeType(undefined, { x: 0, y: 0 })).toBe("smoothstep");
  });
});

// --- pickCognateEdgeType ---

describe("pickCognateEdgeType", () => {
  it("straight when horizontally aligned (same Y)", () => {
    expect(pickCognateEdgeType({ x: 0, y: 100 }, { x: 500, y: 100 })).toBe("straight");
  });

  it("straight when Y diff < 10", () => {
    expect(pickCognateEdgeType({ x: 0, y: 100 }, { x: 500, y: 105 })).toBe("straight");
  });

  it("smoothstep when vertically offset", () => {
    expect(pickCognateEdgeType({ x: 0, y: 0 }, { x: 500, y: 180 })).toBe("smoothstep");
  });
});

// --- getLanguageColor ---

describe("getLanguageColor", () => {
  it("returns HSL string", () => {
    expect(getLanguageColor("English")).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it("is deterministic", () => {
    expect(getLanguageColor("French")).toBe(getLanguageColor("French"));
  });

  it("desaturates Proto- languages", () => {
    expect(getLanguageColor("Proto-Germanic")).toContain("20%");
    expect(getLanguageColor("German")).toContain("75%");
  });

  it("maps historical variants to same hue", () => {
    expect(getLanguageColor("Old French")).toContain("270");
    expect(getLanguageColor("French")).toContain("270");
  });

  it("generates color for unknown languages", () => {
    expect(getLanguageColor("Xyzzy")).toMatch(/^hsl\(\d+, 75%, 65%\)$/);
  });
});

// --- formatRelation ---

describe("formatRelation", () => {
  it("maps known relations", () => {
    expect(formatRelation("inherited_from")).toBe("inherited");
    expect(formatRelation("cognate_of")).toBe("cognate");
  });

  it("cleans unknown relations", () => {
    expect(formatRelation("some_weird_thing_from")).toBe("some weird thing");
  });
});
