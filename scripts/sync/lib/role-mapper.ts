import type { PlayerRoleClassic } from "@workspace/db/schema";

/**
 * Mappa la posizione in inglese restituita da API-Football
 * al tipo PlayerRoleClassic usato nello schema DB.
 *
 * Nota: il DB usa GK/DEF/MID/ATT (non P/D/C/A).
 * Throw esplicito su input sconosciuto — nessun fallback silente.
 */
const ROLE_MAP: Record<string, PlayerRoleClassic> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "ATT",
};

export function mapRoleClassic(apiPosition: string): PlayerRoleClassic {
  const mapped = ROLE_MAP[apiPosition];
  if (mapped === undefined) {
    throw new Error(
      `Posizione API-Football sconosciuta: "${apiPosition}". ` +
        `Valori attesi: ${Object.keys(ROLE_MAP).join(", ")}`,
    );
  }
  return mapped;
}
