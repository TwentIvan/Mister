// ─── Tipi ────────────────────────────────────────────────────────────────────

export type RoleClassic = "GK" | "DEF" | "MID" | "ATT";

export interface HeadCoach {
  id: number;
  name: string;
  photoCartoonUrl: string | null;
  nationality: string | null;
  currentTeamName: string | null;
}
export type FieldStatus = "casa" | "trasferta";

export interface RosterPlayer {
  id: number;
  name: string;
  realTeam: string;
  roleClassic: RoleClassic;
  photoUrl: string | null;
  photoCartoonUrl: string | null;
  votoMister: number | null;
  fieldStatus: FieldStatus;
  nextOpponentShort: string | null;
  nextIsHome: boolean | null;
}

export interface MatchInfo {
  giornata: number;
  avversario: string;
  fieldStatus: FieldStatus;
}

// ─── Match giornata 2 ────────────────────────────────────────────────────────

export const MATCH_GIORNATA_2: MatchInfo = {
  giornata: 2,
  avversario: "Atletico Caffeina",
  fieldStatus: "casa",
};

// ─── Colori squadre Serie A 2024-25 ──────────────────────────────────────────

export const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  "Atalanta":       { primary: "#1B3A8A", secondary: "#000000" },
  "Bologna":        { primary: "#C8102E", secondary: "#002D6E" },
  "Cagliari":       { primary: "#C8102E", secondary: "#002149" },
  "Como":           { primary: "#005DAA", secondary: "#FFFFFF" },
  "Empoli":         { primary: "#0057A8", secondary: "#FFFFFF" },
  "Fiorentina":     { primary: "#6B1B8E", secondary: "#FFFFFF" },
  "Genoa":          { primary: "#C8102E", secondary: "#003087" },
  "Inter":          { primary: "#0033A0", secondary: "#000000" },
  "Juventus":       { primary: "#000000", secondary: "#FFFFFF" },
  "Lazio":          { primary: "#87CEEB", secondary: "#FFFFFF" },
  "Lecce":          { primary: "#FFD700", secondary: "#B8001B" },
  "Milan":          { primary: "#C8102E", secondary: "#000000" },
  "Monza":          { primary: "#E8002D", secondary: "#FFFFFF" },
  "Napoli":         { primary: "#0058A3", secondary: "#FFFFFF" },
  "Parma":          { primary: "#FFD700", secondary: "#002D6E" },
  "AS Roma":        { primary: "#8B0000", secondary: "#F5C518" },
  "Torino":         { primary: "#8B1A1A", secondary: "#FFFFFF" },
  "Udinese":        { primary: "#000000", secondary: "#FFFFFF" },
  "Venezia":        { primary: "#FF6600", secondary: "#005A28" },
  "Hellas Verona":  { primary: "#002D6E", secondary: "#FFD700" },
};

export const TEAM_CODE: Record<string, string> = {
  "Atalanta":      "ATA",
  "Bologna":       "BOL",
  "Cagliari":      "CAG",
  "Como":          "COM",
  "Empoli":        "EMP",
  "Fiorentina":    "FIO",
  "Genoa":         "GEN",
  "Inter":         "INT",
  "Juventus":      "JUV",
  "Lazio":         "LAZ",
  "Lecce":         "LEC",
  "Milan":         "MIL",
  "Monza":         "MON",
  "Napoli":        "NAP",
  "Parma":         "PAR",
  "AS Roma":       "ROM",
  "Torino":        "TOR",
  "Udinese":       "UDI",
  "Venezia":       "VEN",
  "Hellas Verona": "VER",
};

// ─── Fixture Serie A giornata 2 ───────────────────────────────────────────────

const SERIE_A_ROUND_2: Record<string, { opponentShort: string; isHome: boolean }> = {
  "Atalanta":      { opponentShort: "LEC", isHome: true  },
  "Lecce":         { opponentShort: "ATA", isHome: false },
  "Bologna":       { opponentShort: "GEN", isHome: true  },
  "Genoa":         { opponentShort: "BOL", isHome: false },
  "Como":          { opponentShort: "PAR", isHome: true  },
  "Parma":         { opponentShort: "COM", isHome: false },
  "Fiorentina":    { opponentShort: "CAG", isHome: true  },
  "Cagliari":      { opponentShort: "FIO", isHome: false },
  "Juventus":      { opponentShort: "VER", isHome: true  },
  "Hellas Verona": { opponentShort: "JUV", isHome: false },
  "Lazio":         { opponentShort: "UDI", isHome: true  },
  "Udinese":       { opponentShort: "LAZ", isHome: false },
  "Milan":         { opponentShort: "EMP", isHome: true  },
  "Empoli":        { opponentShort: "MIL", isHome: false },
  "Monza":         { opponentShort: "INT", isHome: true  },
  "Inter":         { opponentShort: "MON", isHome: false },
  "Napoli":        { opponentShort: "TOR", isHome: true  },
  "Torino":        { opponentShort: "NAP", isHome: false },
  "AS Roma":       { opponentShort: "VEN", isHome: true  },
  "Venezia":       { opponentShort: "ROM", isHome: false },
};

function fixture(realTeam: string) {
  const f = SERIE_A_ROUND_2[realTeam];
  return { nextOpponentShort: f?.opponentShort ?? null, nextIsHome: f?.isHome ?? null };
}

// ─── Rosa Mario's Squad (ft-mvp-1) ───────────────────────────────────────────

export const ROSA_MARIO: RosterPlayer[] = [
  // ── GK (3) ────────────────────────────────────────────────────────────────
  { id: 30419,  name: "F. Rossi",          realTeam: "Atalanta",      roleClassic: "GK",  photoUrl: "https://media.api-sports.io/football/players/30419.png",  photoCartoonUrl: "/avatars/30419.webp",  votoMister: null, fieldStatus: "casa",      ...fixture("Atalanta") },
  { id: 30913,  name: "M. Chiesa",         realTeam: "Hellas Verona", roleClassic: "GK",  photoUrl: "https://media.api-sports.io/football/players/30913.png",  photoCartoonUrl: "/avatars/30913.webp",  votoMister: null, fieldStatus: "casa",      ...fixture("Hellas Verona") },
  { id: 1624,   name: "Pepe Reina",        realTeam: "Como",          roleClassic: "GK",  photoUrl: "https://media.api-sports.io/football/players/1624.png",   photoCartoonUrl: "/avatars/1624.webp",   votoMister: 7.54, fieldStatus: "casa",      ...fixture("Como") },
  // ── DEF (8) ───────────────────────────────────────────────────────────────
  { id: 446092, name: "C. Cama",           realTeam: "AS Roma",       roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/446092.png", photoCartoonUrl: "/avatars/446092.webp", votoMister: null, fieldStatus: "casa",      ...fixture("AS Roma") },
  { id: 162570, name: "G. Cittadini",      realTeam: "Atalanta",      roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/162570.png", photoCartoonUrl: "/avatars/162570.webp", votoMister: null, fieldStatus: "casa",      ...fixture("Atalanta") },
  { id: 25911,  name: "G. Donati",         realTeam: "Monza",         roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/25911.png",  photoCartoonUrl: "/avatars/25911.webp",  votoMister: null, fieldStatus: "casa",      ...fixture("Monza") },
  { id: 35544,  name: "J. Vásquez",        realTeam: "Genoa",         roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/35544.png",  photoCartoonUrl: "/avatars/35544.webp",  votoMister: 6.91, fieldStatus: "casa",      ...fixture("Genoa") },
  { id: 6931,   name: "L. Cacace",         realTeam: "Empoli",        roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/6931.png",   photoCartoonUrl: "/avatars/6931.webp",   votoMister: 7.06, fieldStatus: "casa",      ...fixture("Empoli") },
  { id: 1084,   name: "M. Pongračić",      realTeam: "Lecce",         roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/1084.png",   photoCartoonUrl: "/avatars/1084.webp",   votoMister: null, fieldStatus: "casa",      ...fixture("Lecce") },
  { id: 40392,  name: "M. Wieteska",       realTeam: "Cagliari",      roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/40392.png",  photoCartoonUrl: "/avatars/40392.webp",  votoMister: null, fieldStatus: "casa",      ...fixture("Cagliari") },
  { id: 353417, name: "N. Postiglione",    realTeam: "Monza",         roleClassic: "DEF", photoUrl: "https://media.api-sports.io/football/players/353417.png", photoCartoonUrl: "/avatars/353417.webp", votoMister: null, fieldStatus: "casa",      ...fixture("Monza") },
  // ── MID (8) ───────────────────────────────────────────────────────────────
  { id: 42007,  name: "Dani Silva",        realTeam: "Hellas Verona", roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/42007.png",  photoCartoonUrl: "/avatars/42007.webp",  votoMister: null, fieldStatus: "casa",      ...fixture("Hellas Verona") },
  { id: 1358,   name: "E. Elmas",          realTeam: "Torino",        roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/1358.png",   photoCartoonUrl: "/avatars/1358.webp",   votoMister: null, fieldStatus: "casa",      ...fixture("Torino") },
  { id: 342074, name: "G. Faticanti",      realTeam: "Lecce",         roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/342074.png", photoCartoonUrl: "/avatars/342074.webp", votoMister: null, fieldStatus: "trasferta", ...fixture("Lecce") },
  { id: 484411, name: "J. Idele",          realTeam: "Atalanta",      roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/484411.png", photoCartoonUrl: "/avatars/484411.webp", votoMister: null, fieldStatus: "trasferta", ...fixture("Atalanta") },
  { id: 129687, name: "M. Aké",            realTeam: "Juventus",      roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/129687.png", photoCartoonUrl: "/avatars/129687.webp", votoMister: null, fieldStatus: "trasferta", ...fixture("Juventus") },
  { id: 2055,   name: "M. Rog",            realTeam: "Cagliari",      roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/2055.png",   photoCartoonUrl: "/avatars/2055.webp",   votoMister: null, fieldStatus: "trasferta", ...fixture("Cagliari") },
  { id: 6409,   name: "N. Estévez",        realTeam: "Parma",         roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/6409.png",   photoCartoonUrl: "/avatars/6409.webp",   votoMister: 6.91, fieldStatus: "trasferta", ...fixture("Parma") },
  { id: 1920,   name: "N. Radonjić",       realTeam: "Torino",        roleClassic: "MID", photoUrl: "https://media.api-sports.io/football/players/1920.png",   photoCartoonUrl: "/avatars/1920.webp",   votoMister: null, fieldStatus: "trasferta", ...fixture("Torino") },
  // ── ATT (6) ───────────────────────────────────────────────────────────────
  { id: 30509,  name: "A. Belotti",        realTeam: "AS Roma",       roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/30509.png",  photoCartoonUrl: "/avatars/30509.webp",  votoMister: 7.25, fieldStatus: "trasferta", ...fixture("AS Roma") },
  { id: 30879,  name: "A. Petagna",        realTeam: "Monza",         roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/30879.png",  photoCartoonUrl: "/avatars/30879.webp",  votoMister: 7.11, fieldStatus: "trasferta", ...fixture("Monza") },
  { id: 30414,  name: "G. Simeone",        realTeam: "Napoli",        roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/30414.png",  photoCartoonUrl: "/avatars/30414.webp",  votoMister: null, fieldStatus: "trasferta", ...fixture("Napoli") },
  { id: 449638, name: "J. Nuredini",       realTeam: "Genoa",         roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/449638.png", photoCartoonUrl: "/avatars/449638.webp", votoMister: null, fieldStatus: "trasferta", ...fixture("Genoa") },
  { id: 443141, name: "K. Maussi Martins", realTeam: "Monza",         roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/443141.png", photoCartoonUrl: "/avatars/443141.webp", votoMister: null, fieldStatus: "trasferta", ...fixture("Monza") },
  { id: 31031,  name: "R. Inglese",        realTeam: "Parma",         roleClassic: "ATT", photoUrl: "https://media.api-sports.io/football/players/31031.png",  photoCartoonUrl: "/avatars/31031.webp",  votoMister: null, fieldStatus: "trasferta", ...fixture("Parma") },
];

export const PLAYER_BY_ID = new Map<number, RosterPlayer>(ROSA_MARIO.map(p => [p.id, p]));

// ─── Loghi squadre Serie A (API-Football media CDN) ──────────────────────────
// URL: https://media.api-sports.io/football/teams/{id}.png

export const TEAM_LOGO_URL: Record<string, string> = {
  "Atalanta":      "https://media.api-sports.io/football/teams/499.png",
  "Bologna":       "https://media.api-sports.io/football/teams/500.png",
  "Cagliari":      "https://media.api-sports.io/football/teams/490.png",
  "Como":          "https://media.api-sports.io/football/teams/895.png",
  "Empoli":        "https://media.api-sports.io/football/teams/511.png",
  "Fiorentina":    "https://media.api-sports.io/football/teams/502.png",
  "Genoa":         "https://media.api-sports.io/football/teams/495.png",
  "Hellas Verona": "https://media.api-sports.io/football/teams/504.png",
  "Inter":         "https://media.api-sports.io/football/teams/505.png",
  "Juventus":      "https://media.api-sports.io/football/teams/496.png",
  "Lazio":         "https://media.api-sports.io/football/teams/487.png",
  "Lecce":         "https://media.api-sports.io/football/teams/867.png",
  "Milan":         "https://media.api-sports.io/football/teams/489.png",
  "Monza":         "https://media.api-sports.io/football/teams/1579.png",
  "Napoli":        "https://media.api-sports.io/football/teams/492.png",
  "Parma":         "https://media.api-sports.io/football/teams/523.png",
  "AS Roma":       "https://media.api-sports.io/football/teams/497.png",
  "Torino":        "https://media.api-sports.io/football/teams/503.png",
  "Udinese":       "https://media.api-sports.io/football/teams/494.png",
  "Venezia":       "https://media.api-sports.io/football/teams/517.png",
};

// Mappa inversa: 3 iniziali → URL logo (per logo avversario nei badge)
export const TEAM_LOGO_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_CODE)
    .filter(([name]) => TEAM_LOGO_URL[name])
    .map(([name, code]) => [code, TEAM_LOGO_URL[name]])
);

// ─── Allenatore Mario's Squad ─────────────────────────────────────────────────
// M. Allegri (id 3386) — allena il Milan (team_id 489) nella stagione corrente

export const COACH_MARIO: HeadCoach = {
  id: 3386,
  name: "M. Allegri",
  photoCartoonUrl: "/avatars/coaches/3386.webp",
  nationality: "Italy",
  currentTeamName: "Milan",
};
