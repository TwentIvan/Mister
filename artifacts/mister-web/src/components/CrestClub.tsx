import { useState } from "react";

// ─── Mappa nome DB → API-Football team ID (Serie A 2024/25) ──────────────────
// URL logo: https://media.api-sports.io/football/teams/{id}.png
// Fonte: https://www.api-football.com/documentation-v3 (teams endpoint, league=135)

const TEAM_IDS: Record<string, number> = {
  "AC Milan":      489,
  "AS Roma":       497,
  "Atalanta":      499,
  "Bologna":       500,
  "Cagliari":      488,
  "Como":          1106,
  "Empoli":        511,
  "Fiorentina":    502,
  "Genoa":         495,
  "Hellas Verona": 504,
  "Inter":         505,
  "Juventus":      496,
  "Lazio":         487,
  "Lecce":         867,
  "Monza":         1579,
  "Napoli":        492,
  "Parma":         498,
  "Torino":        503,
  "Udinese":       494,
  "Venezia":       517,
};

function logoUrl(realTeam: string): string | null {
  const id = TEAM_IDS[realTeam];
  return id != null ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}

function initials(realTeam: string): string {
  const normalized = realTeam
    .replace(/^AC\s+/i, "")
    .replace(/^AS\s+/i, "")
    .replace(/^FC\s+/i, "")
    .trim();
  const parts = normalized.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}

// ─── CrestClub ────────────────────────────────────────────────────────────────
// Usa il logo reale del club (API-Football CDN), in contenitore neutro crema.
// Fallback: monogramma su fondo grigio-crema quando il logo non è disponibile.
//
// DISTINTO dal Disco-Squadra fanta (monogramma + team.color) che è usato per
// il proprietario / owner della squadra fantacalcistica.
//
// Props:
//   realTeam      — nome esatto dal DB (es. "AC Milan", "Hellas Verona")
//   size          — lato del contenitore in px (default 20)
//   borderRadius  — bordo arrotondato in px o stringa CSS (default 4)
//   style         — stili aggiuntivi sull'elemento radice

interface CrestClubProps {
  realTeam: string;
  size?: number;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

export function CrestClub({
  realTeam,
  size = 20,
  borderRadius = 4,
  style,
}: CrestClubProps) {
  const [failed, setFailed] = useState(false);
  const url = logoUrl(realTeam);
  const logoSize = Math.round(size * 0.72);
  const monogramFontSize = Math.max(6, Math.round(size * 0.35));

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius,
        background: "#f2ead8",
        border: "1px solid #d0c5ae",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
    >
      {url && !failed ? (
        <img
          src={url}
          width={logoSize}
          height={logoSize}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          style={{
            fontSize: monogramFontSize,
            fontFamily: "var(--mono)",
            fontWeight: 700,
            color: "#7a7260",
            lineHeight: 1,
            letterSpacing: "-.02em",
          }}
        >
          {initials(realTeam)}
        </span>
      )}
    </span>
  );
}
