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
}

export interface MatchInfo {
  giornata: number;
  avversario: string;
  fieldStatus: FieldStatus; // campo di Mario's Squad
}

// ─── Match giornata 2 ────────────────────────────────────────────────────────
// competition_matches: id=5, giornata=2, home=ft-mvp-1 (Mario's Squad), away=ft-mvp-7 (Atletico Caffeina)

export const MATCH_GIORNATA_2: MatchInfo = {
  giornata: 2,
  avversario: "Atletico Caffeina",
  fieldStatus: "casa",
};

// ─── Rosa Mario's Squad (ft-mvp-1) ──────────────────────────────────────────
// Generata da query DB:
//   SELECT p.id, p.name, p.real_team, p.role_classic, p.photo_url, p.current_team_id,
//          tc.primary_hex, tc.secondary_hex, tc.text_hex,
//          pgs.voto_mister, pgs.round AS voto_round
//   FROM contracts c
//   JOIN players p ON p.id = c.player_id
//   LEFT JOIN team_colors tc ON tc.team_id = p.current_team_id
//   LEFT JOIN player_giornata_stats pgs ON pgs.player_id = p.id AND pgs.round = 2
//   WHERE c.fanta_team_id = 'ft-mvp-1'
//   ORDER BY CASE p.role_classic ... END, p.name
// fieldStatus: primi 13 → "casa", restanti → "trasferta"

export const ROSA_MARIO: RosterPlayer[] = [
  // ── GK (3) ────────────────────────────────────────────────────────────────
  {
    id: 30419,
    name: "F. Rossi",
    realTeam: "Atalanta",
    roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/30419.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 30913,
    name: "M. Chiesa",
    realTeam: "Hellas Verona",
    roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/30913.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 1624,
    name: "Pepe Reina",
    realTeam: "Como",
    roleClassic: "GK",
    photoUrl: "https://media.api-sports.io/football/players/1624.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 7.54,
    fieldStatus: "casa",
  },
  // ── DEF (8) ───────────────────────────────────────────────────────────────
  {
    id: 446092,
    name: "C. Cama",
    realTeam: "AS Roma",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/446092.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 162570,
    name: "G. Cittadini",
    realTeam: "Atalanta",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/162570.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 25911,
    name: "G. Donati",
    realTeam: "Monza",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/25911.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 35544,
    name: "J. Vásquez",
    realTeam: "Genoa",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/35544.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 6.91,
    fieldStatus: "casa",
  },
  {
    id: 6931,
    name: "L. Cacace",
    realTeam: "Empoli",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/6931.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 7.06,
    fieldStatus: "casa",
  },
  {
    id: 1084,
    name: "M. Pongračić",
    realTeam: "Lecce",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/1084.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 40392,
    name: "M. Wieteska",
    realTeam: "Cagliari",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/40392.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 353417,
    name: "Niccolò Postiglione",
    realTeam: "Monza",
    roleClassic: "DEF",
    photoUrl: "https://media.api-sports.io/football/players/353417.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  // ── MID (8) ───────────────────────────────────────────────────────────────
  {
    id: 42007,
    name: "Dani Silva",
    realTeam: "Hellas Verona",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/42007.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 1358,
    name: "E. Elmas",
    realTeam: "Torino",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/1358.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "casa",
  },
  {
    id: 342074,
    name: "G. Faticanti",
    realTeam: "Lecce",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/342074.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 484411,
    name: "J. Idele",
    realTeam: "Atalanta",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/484411.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 129687,
    name: "M. Aké",
    realTeam: "Juventus",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/129687.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 2055,
    name: "M. Rog",
    realTeam: "Cagliari",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/2055.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 6409,
    name: "N. Estévez",
    realTeam: "Parma",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/6409.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 6.91,
    fieldStatus: "trasferta",
  },
  {
    id: 1920,
    name: "N. Radonjić",
    realTeam: "Torino",
    roleClassic: "MID",
    photoUrl: "https://media.api-sports.io/football/players/1920.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  // ── ATT (6) ───────────────────────────────────────────────────────────────
  {
    id: 30509,
    name: "A. Belotti",
    realTeam: "AS Roma",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30509.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 7.25,
    fieldStatus: "trasferta",
  },
  {
    id: 30879,
    name: "A. Petagna",
    realTeam: "Monza",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30879.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: 7.11,
    fieldStatus: "trasferta",
  },
  {
    id: 30414,
    name: "G. Simeone",
    realTeam: "Napoli",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/30414.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 449638,
    name: "J. Nuredini",
    realTeam: "Genoa",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/449638.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 443141,
    name: "K. Maussi Martins",
    realTeam: "Monza",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/443141.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
  {
    id: 31031,
    name: "R. Inglese",
    realTeam: "Parma",
    roleClassic: "ATT",
    photoUrl: "https://media.api-sports.io/football/players/31031.png",
    primaryHex: null,
    secondaryHex: null,
    textHex: null,
    votoMister: null,
    fieldStatus: "trasferta",
  },
];
