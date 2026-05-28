export interface HeadCoach {
  id: number;
  name: string;
  photoCartoonUrl: string | null;
  nationality: string | null;
  currentTeamName: string | null;
}

export interface TeamInfo {
  sigla: string;
  logoColori: { bg: string; fg: string };
  magliaPrimary: string;
  magliaSecondary: string;
}

export interface MatchInfoMeta {
  giornata: number;
  avversario: string;
  avversarioSigla: string;
  avversarioColori: { primary: string; secondary: string };
  fieldStatus: "casa" | "trasferta";
  competizione: string;
  stadio: string;
}

export const MY_TEAM_INFO: TeamInfo = {
  sigla: "MS",
  logoColori: { bg: "#1f4733", fg: "#efe6d3" },
  magliaPrimary: "#1f4733",
  magliaSecondary: "#efe6d3",
};

export const MATCH_GIORNATA_2: MatchInfoMeta = {
  giornata: 2,
  avversario: "Atletico Caffeina",
  avversarioSigla: "AC",
  avversarioColori: { primary: "#C8102E", secondary: "#FFFFFF" },
  fieldStatus: "casa",
  competizione: "Serie A",
  stadio: "Stadio Olimpico",
};

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
  "AC Milan":       { primary: "#C8102E", secondary: "#000000" },
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
  "AC Milan":      "MIL",
  "Monza":         "MON",
  "Napoli":        "NAP",
  "Parma":         "PAR",
  "AS Roma":       "ROM",
  "Torino":        "TOR",
  "Udinese":       "UDI",
  "Venezia":       "VEN",
  "Hellas Verona": "VER",
};

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
  "AC Milan":      "https://media.api-sports.io/football/teams/489.png",
  "Monza":         "https://media.api-sports.io/football/teams/1579.png",
  "Napoli":        "https://media.api-sports.io/football/teams/492.png",
  "Parma":         "https://media.api-sports.io/football/teams/523.png",
  "AS Roma":       "https://media.api-sports.io/football/teams/497.png",
  "Torino":        "https://media.api-sports.io/football/teams/503.png",
  "Udinese":       "https://media.api-sports.io/football/teams/494.png",
  "Venezia":       "https://media.api-sports.io/football/teams/517.png",
};

export const TEAM_LOGO_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_CODE)
    .filter(([name]) => TEAM_LOGO_URL[name])
    .map(([name, code]) => [code, TEAM_LOGO_URL[name]!]),
);

export const COACH_MARIO: HeadCoach = {
  id: 3386,
  name: "M. Allegri",
  photoCartoonUrl: "/avatars/coaches/3386.webp",
  nationality: "Italy",
  currentTeamName: "Milan",
};

export const ATLETICO_CAFFEINA_COACH: HeadCoach = {
  id: 2915,
  name: "M. Baroni",
  photoCartoonUrl: "/avatars/coaches/2915.webp",
  nationality: "Italy",
  currentTeamName: null,
};
