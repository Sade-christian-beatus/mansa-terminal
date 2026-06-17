/**
 * MANSA Terminal — Client API centralisé
 * Axios avec Bearer token Supabase (Authorization: Bearer <access_token>)
 * Le token est récupéré depuis la session Supabase avant chaque requête.
 */
import axios, { AxiosError } from "axios";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// En production, passer par le proxy Next.js (/api/* → Railway FastAPI)
// pour éviter les problèmes CORS cross-domain.
const IS_BROWSER = typeof window !== "undefined";
const IS_PROD = process.env.NODE_ENV === "production";
const API_BASE = IS_BROWSER && IS_PROD ? "/api" : `${API_URL}/api`;

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
  sync: (data?: {
    full_name?: string;
    organization?: string;
    country_of_residence?: string;
    preferred_currency?: string;
    preferred_language?: string;
  }) => api.post<AuthUser>("/auth/sync", data ?? {}),

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

  /** Matrice pays × indicateurs pour le module Macroeconomic Table. */
  getTable: (params?: { year?: number; region?: string }) =>
    api.get<{
      year: number;
      indicators_present: string[];
      countries: { id: string; name: string; region: string | null; values: Record<string, number> }[];
      is_live: boolean;
    }>("/macro/table", { params }),

  getFreshness: () => api.get("/macro/freshness"),

  getExport: (params?: { sources?: string; year_from?: number; year_to?: number }) =>
    api.get("/macro/export", { params }),

  getRegion: (zone: "UEMOA" | "CEMAC" | "SSA", year?: number) =>
    api.get(`/macro/regions/${zone}`, { params: { year } }),
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
  getFxRates:      () => api.get("/markets/fx"),
  getIndices:      () => api.get("/markets/indices"),
  getCommodities:  () => api.get("/markets/commodities"),
};

// ── Helpers Conflicts (ACLED) ─────────────────────────────────────────────
export const conflictsApi = {
  getEvents:    (params?: { risk_level?: string; region?: string; sort_by?: string; limit?: number }) =>
    api.get("/acled/events", { params }),
  getHotspots:  () => api.get("/acled/hotspots"),
};

// ── Helpers Climate ──────────────────────────────────────────────────────
export const climateApi = {
  getIndicators: (year?: number) => api.get("/climate/indicators", { params: { year } }),
  getSummary:    () => api.get("/climate/summary"),
};

// ── Helpers News ─────────────────────────────────────────────────────────
export const newsApi = {
  getFeed: (params?: { limit?: number; category?: string }) =>
    api.get("/news/feed", { params }),
};

// ── Helpers Alerts ───────────────────────────────────────────────────────
export const alertsApi = {
  getMacroAlerts: (params?: { severity?: string; year?: number; limit?: number }) =>
    api.get("/alerts/macro", { params }),
};

// ── Helpers API Keys ─────────────────────────────────────────────────────
export interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
export interface APIKeyCreated extends APIKeyItem {
  full_key: string;
}

export const apiKeysApi = {
  list: (): Promise<APIKeyItem[]> =>
    api.get("/keys"),
  create: (data: { name: string; scopes?: string[]; expires_days?: number }): Promise<APIKeyCreated> =>
    api.post("/keys", data),
  revoke: (keyId: string): Promise<void> =>
    api.delete(`/keys/${keyId}`),
};

// ── Helpers Bulk Export ───────────────────────────────────────────────────
export const bulkExportApi = {
  getCatalog: (): Promise<{ indicators: { code: string; name: string }[]; total: number }> =>
    api.get("/macro/catalog"),

  /** Retourne une URL de téléchargement direct (CSV ou JSON). */
  buildUrl: (params: {
    countries?: string;
    indicators?: string;
    from_year?: number;
    to_year?: number;
    format?: "csv" | "json";
    region?: string;
  }): string => {
    const base = IS_BROWSER && IS_PROD ? "/api" : `${API_URL}/api`;
    const qs = new URLSearchParams();
    if (params.countries)  qs.set("countries",  params.countries);
    if (params.indicators) qs.set("indicators", params.indicators);
    if (params.from_year)  qs.set("from_year",  String(params.from_year));
    if (params.to_year)    qs.set("to_year",    String(params.to_year));
    if (params.format)     qs.set("format",     params.format);
    if (params.region)     qs.set("region",     params.region);
    return `${base}/macro/bulk-export?${qs.toString()}`;
  },
};

// ── Helpers Forecasting ──────────────────────────────────────────────────
export interface ForecastPoint {
  year:     number;
  value:    number;
  lower_80: number;
  upper_80: number;
  lower_95: number;
  upper_95: number;
}
export interface HistoricalPoint { year: number; value: number; }
export interface ForecastResult {
  country_id:         string;
  indicator_code:     string;
  indicator_name:     string;
  unit:               string | null;
  model:              string;
  horizon_years:      number;
  n_observations:     number;
  last_historical_year: number;
  historical:         HistoricalPoint[];
  forecast:           ForecastPoint[];
  generated_at:       string;
}
export interface BatchForecastResult {
  country_id:    string;
  horizon_years: number;
  generated_at:  string;
  forecasts:     Record<string, ForecastResult | { error: string }>;
}

export const forecastApi = {
  getIndicator: (
    countryId: string,
    indicatorCode: string,
    params?: { horizon?: number; from_year?: number }
  ): Promise<ForecastResult> =>
    api.get(`/forecast/${countryId}/${indicatorCode}`, { params }),

  getBatch: (
    countryId: string,
    params?: { indicators?: string; horizon?: number }
  ): Promise<BatchForecastResult> =>
    api.get(`/forecast/batch/${countryId}`, { params }),
};

// ── Streaming SSE AI Analyst ────────────────────────────────────────────

/** Récupère un token Supabase valide, en rafraîchissant si nécessaire. */
async function _getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Si le token expire dans moins de 60 secondes, on rafraîchit proactivement
  const expiresAt = (session as { expires_at?: number }).expires_at ?? 0;
  const expiresInMs = expiresAt * 1000 - Date.now();
  if (expiresInMs < 60_000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    return refreshed?.access_token ?? null;
  }
  return session.access_token ?? null;
}

export async function* streamAIQuery(
  question: string
): AsyncGenerator<{ type: string; content?: string; query_id?: string }> {
  const streamBase = IS_BROWSER && IS_PROD ? "/api" : `${API_URL}/api`;

  // Toujours obtenir un token frais (auto-refresh si proche de l'expiration)
  const token = await _getFreshToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response = await fetch(`${streamBase}/ai/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question }),
  });

  // Si 401, forcer un refresh de session et réessayer une fois
  if (response.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) {
      headers["Authorization"] = `Bearer ${refreshed.access_token}`;
      response = await fetch(`${streamBase}/ai/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question }),
      });
    }
  }

  if (!response.ok) {
    let detail = `Erreur ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch { /* ignore */ }
    const err = new Error(detail) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

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
