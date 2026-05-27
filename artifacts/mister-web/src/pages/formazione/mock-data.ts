// ─── Tipi ────────────────────────────────────────────────────────────────────

export type RoleClassic = "GK" | "DEF" | "MID" | "ATT";
export type FieldStatus = "casa" | "trasferta";

export interface RosterPlayer {
  id: number;
  name: string;
  realTeam: string;
  roleClassic: RoleClassic;
  photoUrl: string | null;
  primaryHex: string | null;
  secondaryHex: string | null;
  textHex: string | null;
  votoMister: number | null;
  fieldStatus: FieldStatus;
  /** Avversario Serie A in giornata 2 (sigla 3 lettere) */
  nextOpponentShort: string | null;
  /** true = gioca in casa la partita Serie A */
  nextIsHome: boolean | null;
}

export interface MatchInfo {
  giornata: number;
  avversario: string;
  fieldStatus: FieldStatus;
}

// ─── Match giornata 2 ────────────────────────────────────────────────────────
// competition_matches: id=5, giornata=2, home=ft-mvp-1 (Mario's Squad), away=ft-mvp-7

export const MATCH_GIORNATA_2: MatchInfo = {
  giornata: 2,
  avversario: "Atletico Caffeina",
  fieldStatus: "casa",
};

// ─── Fixture Serie A giornata 2 (hardcoded, plausibili per 2024-25) ──────────
// Accoppiamenti: Atalanta-Lecce, Bologna-Genoa, Como-Parma, Fiorentina-Cagliari,
//                Juventus-Verona, Lazio-Udinese, Milan-Empoli, Monza-Inter,
//                Napoli-Torino, Roma-Venezia
const SERIE_A_ROUND_2: Record<string, { opponentShort: string; isHome: boolean }> = {
  "Atalanta":       { opponentShort: "LEC", isHome: true  },
  "Lecce":          { opponentShort: "ATA", isHome: false },
  "Bologna":        { opponentShort: "GEN", isHome: true  },
  "Genoa":          { opponentShort: "BOL", isHome: false },
  "Como":           { opponentShort: "PAR", isHome: true  },
  "Parma":          { opponentShort: "COM", isHome: false },
  "Fiorentina":     { opponentShort: "CAG", isHome: true  },
  "Cagliari":       { opponentShort: "FIO", isHome: false },
  "Juventus":       { opponentShort: "VER", isHome: true  },
  "Hellas Verona":  { opponentShort: "JUV", isHome: false },
  "Lazio":          { opponentShort: "UDI", isHome: true  },
  "Udinese":        { opponentShort: "LAZ", isHome: false },
  "Milan":          { opponentShort: "EMP", isHome: true  },
  "Empoli":         { opponentShort: "MIL", isHome: false },
  "Monza":          { opponentShort: "INT", isHome: true  },
  "Inter":          { opponentShort: "MON", isHome: false },
  "Napoli":         { opponentShort: "TOR", isHome: true  },
  "Torino":         { opponentShort: "NAP", isHome: false },
  "AS Roma":        { opponentShort: "VEN", isHome: true  },
  "Venezia":        { opponentShort: "ROM", isHome: false },
};

function fixture(realTeam: string) {
  const f = SERIE_A_ROUND_2[realTeam];
  return { nextOpponentShort: f?.opponentShort ?? null, nextIsHome: f?.isHome ?? null };
}

// ─── Rosa Mario's Squad (ft-mvp-1) ──────────────────────────────────────────
// Generata da query DB round 2, fieldStatus: indici 0-12 → "casa", 13-24 → "trasferta"

export const ROSA_MARIO: RosterPlayer[] = [
  // ── GK (3) ────────────────────────────────────────────────────────────────
  {
    id: 30419, name: "F. Rossi", realTeam: "Atalanta", roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/30419.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Atalanta"),
  },
  {
    id: 30913, name: "M. Chiesa", realTeam: "Hellas Verona", roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/30913.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Hellas Verona"),
  },
  {
    id: 1624, name: "Pepe Reina", realTeam: "Como", roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/1624.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 7.54, fieldStatus: "casa",
    ...fixture("Como"),
  },
  // ── DEF (8) ───────────────────────────────────────────────────────────────
  {
    id: 446092, name: "C. Cama", realTeam: "AS Roma", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/446092.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("AS Roma"),
  },
  {
    id: 162570, name: "G. Cittadini", realTeam: "Atalanta", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/162570.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Atalanta"),
  },
  {
    id: 25911, name: "G. Donati", realTeam: "Monza", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/25911.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Monza"),
  },
  {
    id: 35544, name: "J. Vásquez", realTeam: "Genoa", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/35544.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 6.91, fieldStatus: "casa",
    ...fixture("Genoa"),
  },
  {
    id: 6931, name: "L. Cacace", realTeam: "Empoli", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/6931.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 7.06, fieldStatus: "casa",
    ...fixture("Empoli"),
  },
  {
    id: 1084, name: "M. Pongračić", realTeam: "Lecce", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/1084.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Lecce"),
  },
  {
    id: 40392, name: "M. Wieteska", realTeam: "Cagliari", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/40392.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Cagliari"),
  },
  {
    id: 353417, name: "N. Postiglione", realTeam: "Monza", roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/353417.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Monza"),
  },
  // ── MID (8) ───────────────────────────────────────────────────────────────
  {
    id: 42007, name: "Dani Silva", realTeam: "Hellas Verona", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/42007.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Hellas Verona"),
  },
  {
    id: 1358, name: "E. Elmas", realTeam: "Torino", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/1358.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "casa",
    ...fixture("Torino"),
  },
  {
    id: 342074, name: "G. Faticanti", realTeam: "Lecce", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/342074.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Lecce"),
  },
  {
    id: 484411, name: "J. Idele", realTeam: "Atalanta", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/484411.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Atalanta"),
  },
  {
    id: 129687, name: "M. Aké", realTeam: "Juventus", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/129687.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Juventus"),
  },
  {
    id: 2055, name: "M. Rog", realTeam: "Cagliari", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/2055.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Cagliari"),
  },
  {
    id: 6409, name: "N. Estévez", realTeam: "Parma", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/6409.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 6.91, fieldStatus: "trasferta",
    ...fixture("Parma"),
  },
  {
    id: 1920, name: "N. Radonjić", realTeam: "Torino", roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/1920.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Torino"),
  },
  // ── ATT (6) ───────────────────────────────────────────────────────────────
  {
    id: 30509, name: "A. Belotti", realTeam: "AS Roma", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30509.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 7.25, fieldStatus: "trasferta",
    ...fixture("AS Roma"),
  },
  {
    id: 30879, name: "A. Petagna", realTeam: "Monza", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30879.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: 7.11, fieldStatus: "trasferta",
    ...fixture("Monza"),
  },
  {
    id: 30414, name: "G. Simeone", realTeam: "Napoli", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30414.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Napoli"),
  },
  {
    id: 449638, name: "J. Nuredini", realTeam: "Genoa", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/449638.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Genoa"),
  },
  {
    id: 443141, name: "K. Maussi Martins", realTeam: "Monza", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/443141.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Monza"),
  },
  {
    id: 31031, name: "R. Inglese", realTeam: "Parma", roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/31031.png",
    primaryHex: null, secondaryHex: null, textHex: null, votoMister: null, fieldStatus: "trasferta",
    ...fixture("Parma"),
  },
];

export const PLAYER_BY_ID = new Map<number, RosterPlayer>(ROSA_MARIO.map(p => [p.id, p]));
