const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Research ─────────────────────────────────────────────────────────────────
export const researchApi = {
  start: (query: string, userId?: string, arxivIds?: string[]) =>
    apiRequest<{ session_id: string; status: string }>("/api/research/start", {
      method: "POST",
      body: JSON.stringify({ query, user_id: userId, arxiv_ids: arxivIds }),
    }),

  getStatus: (sessionId: string) =>
    apiRequest<ResearchStatus>(`/api/research/${sessionId}/status`),

  getSolutions: (sessionId: string) =>
    apiRequest<SolutionCard[]>(`/api/research/${sessionId}/solutions`),

  getPapers: (sessionId: string) =>
    apiRequest<Paper[]>(`/api/research/${sessionId}/papers`),

  generateMoreSession: (sessionId: string, instructions: string, count: number = 2) =>
    apiRequest(`/api/research/${sessionId}/generate-more`, {
      method: "POST",
      body: JSON.stringify({ count, instructions }),
    }),

  getHistory: (userId: string) =>
    apiRequest<ResearchSession[]>(`/api/research/history?user_id=${userId}`),

  deleteSession: (sessionId: string) =>
    apiRequest(`/api/research/${sessionId}`, {
      method: "DELETE",
    }),
};

// ─── Solutions ────────────────────────────────────────────────────────────────
export const solutionsApi = {
  get: (solutionId: string) =>
    apiRequest<Solution>(`/api/solutions/${solutionId}`),

  save: (solutionId: string, userId: string) =>
    apiRequest(`/api/solutions/${solutionId}/save?user_id=${userId}`, {
      method: "POST",
    }),

  unsave: (solutionId: string, userId: string) =>
    apiRequest(`/api/solutions/${solutionId}/save?user_id=${userId}`, {
      method: "DELETE",
    }),

  delete: (solutionId: string) =>
    apiRequest(`/api/solutions/${solutionId}`, {
      method: "DELETE",
    }),

  generateMore: (solutionId: string, count: number = 2) =>
    apiRequest(`/api/solutions/${solutionId}/generate-more`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),

  exportUrl: (solutionId: string) =>
    `${API_URL}/api/solutions/${solutionId}/export`,
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (
    sessionId: string,
    message: string,
    solutionId?: string,
    userId?: string
  ) =>
    apiRequest<ChatMessage>(`/api/chat/${sessionId}`, {
      method: "POST",
      body: JSON.stringify({ message, solution_id: solutionId, user_id: userId }),
    }),

  getHistory: (sessionId: string, solutionId?: string) => {
    const params = solutionId ? `?solution_id=${solutionId}` : "";
    return apiRequest<{ messages: ChatMessage[]; total: number }>(
      `/api/chat/${sessionId}/history${params}`
    );
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ResearchSession {
  id: string;
  query: string;
  status: "pending" | "processing" | "complete" | "failed";
  papers_found: number;
  created_at: string;
}

export interface ResearchStatus {
  session_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  papers_found: number;
  embeddings_generated: number;
  solutions_count: number;
  current_step: string;
  progress_pct: number;
}

export interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string[];
  published_date: string;
  categories: string[];
  pdf_url: string;
  is_processed: boolean;
}

export interface SolutionCard {
  id: string;
  session_id: string;
  title: string;
  summary: string;
  feasibility_score: number;
  cost_score: number;
  innovation_score: number;
  confidence_level: number;
  tags: string[];
  domains: string[];
  is_speculative: boolean;
  created_at: string;
}

export interface SolutionContent {
  idea: string;
  why_it_works: string;
  advantages: string[];
  limitations: string[];
  feasibility_analysis: string;
  implementation_ideas: string[];
  possible_risks: string[];
  cost_efficiency: string;
  cross_domain_inspirations: string[];
}

export interface CitationRef {
  paper_id: string;
  arxiv_id: string;
  title: string;
  chunk_text: string;
  relevance: number;
}

export interface Solution extends SolutionCard {
  full_content: SolutionContent;
  citations: CitationRef[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { arxiv_id: string; title: string }[];
  created_at: string;
}
