import type { TreeResponse, SearchResult } from "@/types";

const BASE = "/api";

export async function fetchTree(term: string, lang?: string, depth = 5): Promise<TreeResponse> {
  const params = new URLSearchParams({ term, depth: String(depth) });
  if (lang) params.set("lang", lang);
  const res = await fetch(`${BASE}/tree?${params}`);
  if (!res.ok) throw new Error(`Tree fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTreeById(termId: string, depth = 5): Promise<TreeResponse> {
  const res = await fetch(`${BASE}/tree/${termId}?depth=${depth}`);
  if (!res.ok) throw new Error(`Tree fetch failed: ${res.status}`);
  return res.json();
}

export async function searchTerms(q: string, lang?: string, limit = 20): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (lang) params.set("lang", lang);
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}

export async function fetchLanguages(): Promise<string[]> {
  const res = await fetch(`${BASE}/languages`);
  if (!res.ok) throw new Error(`Languages fetch failed: ${res.status}`);
  const data = await res.json();
  return data.languages;
}
