/**
 * MANSA Terminal — Client API centralisé
 * Axios avec Bearer token Supabase (Authorization: Bearer <access_token>)
 * Le token est récupéré depuis la session Supabase avant chaque requête.
 */
import axios, { AxiosError } from "axios";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// En production, passer par le proxy Next.js (/api/backend → Railway)
// pour éviter les problèmes CORS cross-domain.
const IS_BROWSER = typeof window !== "undefined";
const IS_PROD = process.env.NODE_ENV === "production";
const API_BASE = IS_BROWSER && IS_PROD ? "/api/backend" : `${API_URL}/api`;

const _api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ── Intercepteur requête — attache le Bearer token Supabase ──────────────
_api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

// ── Intercepteur réponse — refresh automatique sur 401 ──────────────────
let _refreshPromise: Promise<void> | null = null;

async function _doRefresh(): Promise<void> {
  const { error } = await supabase.auth.refreshSession();
  if (error) throw error;
}

_api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError & { config?: { _retry?: boolean } }) => {
    const config = error.config;

    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      try {
        if (!_refreshPromise) {
          _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
        }
        await _refreshPromise;
        // Réessayer avec le nouveau token (l'intercepteur request l'attachera)
        return _api(config);
      } catch {
        if (typeof window !== "undefined") {
          const isAuthPage = window.location.pathname.startsWith("/auth");
          if (!isAuthPage) {
            await supabase.auth.signOut();
            window.location.href = "/auth/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Cast pour que les appelants reçoivent directement le type de données
export const api = _api as unknown as {
  get: <T = any>(url: string, config?: object) => Promise<T>;
  post: <T = any>(url: string, data?: unknown, config?: object) => Promise<T>;
  put: <T = any>(url: string, data?: unknown, config?: object) => Promise<T>;
  delete: <T = any>(url: string, config?: object) => Promise<T>;
};

// ── Helpers Auth ────────────────────────────────────────────────────────
export interface AuthUser {
  user_id: string;
  email: string;
  full_name?: string | null;
  organization?: string | null;
  is_verified: boolean;
}

export const authApi = {
  /** Synchronise l'utilisateur Supabase dans notre DB après signup/login. */
  sync: (data?: { full_name?: string; organization?: string }) =>
    api.post<AuthUser>("/auth/sync", data ?? {}),

  me: () => api.get<AuthUser>("/auth/me"),
};

// ── Helpers Macro ────────────────────────────────────────────────────────
export const macroApi = {
  getCountries: (params?: { region?: string; tier?: number }) =>
    api.get("/macro/countries", { params }),

  getCountryMacro: (
    countryId: string,
    params?: { indicators?: string; from_year?: number; to_year?: number }
  ) => api.get(`/macro/${countryId}`, { params }),

  getHeatmap: (indicator: string, year: number) =>
    api.get("/macro/heatmap/africa", { params: { indicator, year } }),
};

// ── Helpers AI Analyst ──────────────────────────────────────────────────
export interface AIHistoryItem {
  id: string;
  question: string;
  response_preview: string | null;
  countries: string[];
  created_at: string;
  tokens_used: number;
}

export const aiApi = {
  getHistory: (limit = 20): Promise<AIHistoryItem[]> =>
    api.get("/ai/history", { params: { limit } }),
};

// ── Helpers Markets ──────────────────────────────────────────────────────
export const marketsApi = {
  getFxRates: () => api.get("/markets/fx"),
  getIndices:  () => api.get("/markets/indices"),
};

// ── Helpers Climate ──────────────────────────────────────────────────────
export const climateApi = {
  getIndicators: (year?: number) => api.get("/climate/indicators", { params: { year } }),
  getSummary:    () => api.get("/climate/summary"),
};

// ── Streaming SSE AI Analyst ────────────────────────────────────────────
export async function* streamAIQuery(
  question: string
): AsyncGenerator<{ type: string; content?: string; query_id?: string }> {
  const streamBase = IS_BROWSER && IS_PROD ? "/api/backend" : `${API_URL}/api`;

  // Récupérer le token Supabase pour le streaming fetch (pas Axios)
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${streamBase}/ai/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  if (!reader) return;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* ignorer */ }
    }
  }
  if (buffer.startsWith("data: ")) {
    try { yield JSON.parse(buffer.slice(6)); } catch { /* ignorer */ }
  }
}
