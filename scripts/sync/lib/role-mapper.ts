import type { PlayerRoleClassic } from "@workspace/db/schema";

/**
 * Mappa la posizione in inglese restituita da API-Football
 * al tipo PlayerRoleClassic usato nello schema DB.
 *
 * Nota: il DB usa GK/DEF/MID/ATT (non P/D/C/A).
 * Restituisce null per posizioni sconosciute — il chiamante decide se skippare.
 */
const ROLE_MAP: Record<string, PlayerRoleClassic> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "ATT",
  // Alias usati da API-Football in alcuni endpoint
  Forward: "ATT",
  G: "GK",
  D: "DEF",
  M: "MID",
  A: "ATT",
  F: "ATT",
};

export function mapRoleClassic(apiPosition: string): PlayerRoleClassic | null {
  return ROLE_MAP[apiPosition] ?? null;
}
