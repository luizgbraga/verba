export interface TermNode {
  id: string;
  term: string;
  lang: string;
  definition?: string;
}

export interface TermEdge {
  source: string;
  target: string;
  relation: string;
}

export interface TreeResponse {
  root: TermNode | null;
  nodes: TermNode[];
  edges: TermEdge[];
}

export interface SearchResult {
  term: string;
  lang: string;
}
