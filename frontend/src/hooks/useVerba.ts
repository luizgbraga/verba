import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { TreeResponse } from "@/types";
import { fetchTree, fetchTreeById } from "@/lib/api";
import { layoutTree } from "@/lib/layout";

interface VerbaState {
  query: string;
  detectedLang: string | null;
  selectedLang: string | null;
  confidence: number;
  nodes: Node[];
  edges: Edge[];
  rootId: string | null;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  history: string[];

  setQuery: (q: string) => void;
  setDetectedLang: (lang: string | null, confidence: number) => void;
  setSelectedLang: (lang: string | null) => void;
  search: (term?: string, lang?: string) => Promise<void>;
  recenter: (nodeId: string) => Promise<void>;
  goBack: () => Promise<void>;
}

function applyTree(data: TreeResponse) {
  if (!data.root) return null;
  const { nodes, edges } = layoutTree(data);
  return { nodes, edges, rootId: data.root.id, query: data.root.term, detectedLang: data.root.lang };
}

export const useVerba = create<VerbaState>((set, get) => ({
  query: "", detectedLang: null, selectedLang: null, confidence: 0,
  nodes: [], edges: [], rootId: null,
  loading: false, error: null, hasSearched: false, history: [],

  setQuery: (q) => set({ query: q }),
  setDetectedLang: (lang, confidence) => set({ detectedLang: lang, confidence }),
  setSelectedLang: (lang) => set({ selectedLang: lang }),

  search: async (term?: string, lang?: string) => {
    const state = get();
    const searchTerm = term ?? state.query.trim();
    const searchLang = lang ?? state.selectedLang ?? state.detectedLang ?? undefined;
    if (!searchTerm) return;

    set({ loading: true, error: null });
    try {
      const data = await fetchTree(searchTerm, searchLang);
      const result = applyTree(data);
      if (!result) {
        set({ loading: false, hasSearched: true, error: `No etymology found for "${searchTerm}"${searchLang ? ` in ${searchLang}` : ""}` });
        return;
      }
      set({ ...result, loading: false, hasSearched: true, history: [] });
    } catch {
      set({ loading: false, hasSearched: true, error: "Failed to fetch etymology data." });
    }
  },

  recenter: async (nodeId: string) => {
    const state = get();
    if (nodeId === state.rootId) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchTreeById(nodeId);
      const result = applyTree(data);
      if (!result) { set({ loading: false }); return; }
      set({ ...result, loading: false, history: state.rootId ? [...state.history, state.rootId] : state.history });
    } catch {
      set({ loading: false });
    }
  },

  goBack: async () => {
    const state = get();
    if (!state.history.length) return;
    const prevId = state.history.at(-1)!;
    set({ loading: true, history: state.history.slice(0, -1) });
    try {
      const data = await fetchTreeById(prevId);
      const result = applyTree(data);
      if (!result) { set({ loading: false }); return; }
      set({ ...result, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
