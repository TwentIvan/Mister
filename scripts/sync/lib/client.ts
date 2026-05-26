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
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

export type ApiClient = ReturnType<typeof createClient>;

export function createClient(mode: ApiMode) {
  if (mode === "live") {
    throw new Error(
      "live mode disabled in task 5b — abilitare solo nel task 5c dopo aver configurato API_FOOTBALL_KEY",
    );
  }
  return {
    get<T>(
      endpoint: string,
      _params: Record<string, string> = {},
    ): ApiResponse<T> {
      return getMockData<T>(endpoint);
    },
    _fetchLive: fetchLive,
  };
}
