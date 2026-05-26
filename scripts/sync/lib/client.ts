import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOCK_DIR = resolve(__dirname, "../fixtures-mock");
const BASE_URL = "https://v3.football.api-sports.io";

const ENDPOINT_TO_MOCK: Record<string, string> = {
  leagues: "leagues.json",
  teams: "teams.json",
  players: "players.json",
  "players/squads": "players-squads.json",
  "players/topscorers": "players-topscorers.json",
  fixtures: "fixtures.json",
  "fixtures/players": "fixtures-players.json",
  "fixtures/statistics": "fixtures-statistics.json",
};

export type ApiMode = "mock" | "live";

export interface ApiResponse<T = unknown> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[];
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

function getMockData<T>(endpoint: string): ApiResponse<T> {
  const mockFile = ENDPOINT_TO_MOCK[endpoint];
  if (!mockFile) {
    throw new Error(`Nessun file mock registrato per l'endpoint: ${endpoint}`);
  }
  const filePath = resolve(MOCK_DIR, mockFile);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ApiResponse<T>;
}

let _lastRequestAt = 0;
let _requestCount = 0;

async function rateLimitWait(): Promise<void> {
  const minInterval = 6_000;
  const elapsed = Date.now() - _lastRequestAt;
  if (elapsed < minInterval) {
    await new Promise<void>((res) => setTimeout(res, minInterval - elapsed));
  }
  _lastRequestAt = Date.now();
}

async function fetchLive<T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<ApiResponse<T>> {
  await rateLimitWait();
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const queryStr = url.search ? `?${url.searchParams.toString()}` : "";
  const displayUrl = `/${endpoint}${queryStr}`;

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { "x-apisports-key": apiKey },
      });
    } catch (err) {
      throw new Error(`Fetch network error: ${(err as Error).message}`);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const remaining = res.headers.get("x-ratelimit-requests-remaining") ?? "?";
    _requestCount++;

    if (res.ok) {
      console.log(
        `[LIVE] GET ${displayUrl} → ${res.status} (${elapsed}s, remaining ${remaining}/100)`,
      );
      return res.json() as Promise<ApiResponse<T>>;
    }

    if (res.status === 429) {
      const backoff = [10_000, 20_000, 40_000][attempt] ?? 40_000;
      console.warn(
        `[WARN] 429 rate limit su ${displayUrl} — attendo ${backoff / 1000}s (tentativo ${attempt + 1}/3)`,
      );
      lastErr = new Error(`HTTP 429`);
      await new Promise<void>((r) => setTimeout(r, backoff));
      await rateLimitWait();
      continue;
    }

    if (res.status >= 500) {
      if (attempt === 0) {
        console.warn(
          `[WARN] ${res.status} su ${displayUrl} — retry dopo 5s`,
        );
        lastErr = new Error(`HTTP ${res.status}`);
        await new Promise<void>((r) => setTimeout(r, 5_000));
        await rateLimitWait();
        continue;
      }
      throw new Error(`API-Football ${res.status} ${res.statusText} su ${displayUrl}`);
    }

    throw new Error(
      `API-Football ${res.status} ${res.statusText} su ${displayUrl}`,
    );
  }

  throw lastErr ?? new Error(`Tutti i tentativi esauriti per ${displayUrl}`);
}

export function getLiveRequestCount(): number {
  return _requestCount;
}

export type ApiClient = {
  get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
};

export function createClient(mode: ApiMode): ApiClient {
  if (mode === "live") {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      throw new Error(
        "API_FOOTBALL_KEY non configurata. Aggiungila come Replit Secret.",
      );
    }
    return {
      async get<T>(
        endpoint: string,
        params: Record<string, string> = {},
      ): Promise<ApiResponse<T>> {
        return fetchLive<T>(endpoint, params, apiKey);
      },
    };
  }

  return {
    async get<T>(
      endpoint: string,
      _params: Record<string, string> = {},
    ): Promise<ApiResponse<T>> {
      return getMockData<T>(endpoint);
    },
  };
}
