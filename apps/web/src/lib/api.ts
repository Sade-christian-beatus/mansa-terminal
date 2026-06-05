/**
 * MANSA Terminal — Client API centralisé
 * Axios avec cookies httpOnly — plus de tokens en localStorage
 */
import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// En production (browser), on passe par le proxy Next.js (/api/backend → Railway)
// pour que les cookies httpOnly soient same-domain (mansa-terminal.vercel.app).
// En dev local, on appelle directement le backend sur :8000.
const IS_BROWSER = typeof window !== "undefined";
const IS_PROD = process.env.NODE_ENV === "production";
const API_BASE = IS_BROWSER && IS_PROD ? "/api/backend" : `${API_URL}/api`;

const _api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // envoie les cookies httpOnly automatiquement
});

// ── Refresh token — promise partagée ────────────────────────────────────────
// Une seule promesse en vol à la fois : les 401 concurrents se branchent dessus
// plutôt que de déclencher N appels /auth/refresh simultanés (stampede).
let _refreshPromise: Promise<void> | null = null;

async function _doRefresh(): Promise<void> {
  const refreshBase = IS_BROWSER && IS_PROD ? "/api/backend" : `${API_URL}/api`;
  await axios.post(`${refreshBase}/auth/refresh`, {}, { withCredentials: true });
}

// Intercepteur réponse — renouveler les tokens sur 401
_api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError & { config?: { _retry?: boolean } }) => {
    const config = error.config;

    // Ne tenter le refresh qu'une seule fois par requête originale
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true; // garde-fou : évite la boucle infinie
      try {
        // Partager la promesse en cours si un refresh est déjà en vol
        if (!_refreshPromise) {
          _refreshPromise = _doRefresh().finally(() => {
            _refreshPromise = null;
          });
        }
        await _refreshPromise;
        // Réessayer la requête originale avec le nouveau cookie
        return _api(config);
      } catch {
        // Refresh échoué → rediriger vers login SEULEMENT si on n'y est pas déjà
        if (typeof window !== "undefined") {
          const isAuthPage = window.location.pathname.startsWith("/auth");
          if (!isAuthPage) {
            window.location.href = "/auth/login";
          }
        }
      }
    }
    return Promise.reject(error);
  },
);

// Cast so callers get the data type directly (the response interceptor unwraps .data).
export const api = _api as unknown as {
  get: <T = any>(url: string, config?: object) => Promise<T>;
  post: <T = any>(url: string, data?: unknown, config?: object) => Promise<T>;
  put: <T = any>(url: string, data?: unknown, config?: object) => Promise<T>;
  delete: <T = any>(url: string, config?: object) => Promise<T>;
};

// ---- Helpers Auth ----
export interface AuthUser {
  user_id: string;
  email: string;
  full_name?: string | null;
}

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    organization?: string;
  }) => api.post<AuthUser>("/auth/register", data),

  login: (email: string, password: string) =>
    api.post<AuthUser>("/auth/login", { email, password }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<AuthUser & { is_verified: boolean; organization?: string }>("/auth/me"),
};

// ---- Helpers Macro ----
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

// ---- Helpers AI Analyst ----
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

// ---- Helpers Markets ----
export const marketsApi = {
  getFxRates:   () => api.get("/markets/fx"),
  getIndices:   () => api.get("/markets/indices"),
};

// ---- Helpers Climate ----
export const climateApi = {
  getIndicators: (year?: number) => api.get("/climate/indicators", { params: { year } }),
  getSummary:    () => api.get("/climate/summary"),
};

// ---- Helper AI Analyst (streaming SSE) ----
export async function* streamAIQuery(
  question: string
): AsyncGenerator<{ type: string; content?: string; query_id?: string }> {
  const streamBase = IS_BROWSER && IS_PROD ? "/api/backend" : `${API_URL}/api`;
  const response = await fetch(`${streamBase}/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  if (!reader) return;

  // Buffer les lignes incomplètes entre chunks TCP.
  // Sans ça, une ligne SSE coupée entre deux reads échoue silencieusement
  // et l'assistant reste vide (isStreaming bloqué).
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // ligne potentiellement incomplète → reste dans le buffer

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        // ignorer les lignes malformées
      }
    }
  }

  // Traiter ce qui reste dans le buffer après fermeture
  if (buffer.startsWith("data: ")) {
    try { yield JSON.parse(buffer.slice(6)); } catch { /* ignorer */ }
  }
}
