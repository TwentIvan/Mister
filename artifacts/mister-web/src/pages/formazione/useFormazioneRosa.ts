import { useMemo } from "react";
import type { ChipRole } from "@/components/player-chip";

// Ordine canonico ruolo per la lista rosa: P → D → C → A
export const ROLE_ORDER: Record<ChipRole, number> = {
  GK: 0, DEF: 1, MID: 2, ATT: 3,
};

interface RosaPlayer {
  id: number;
  role: ChipRole;
  realTeam: string;
}

/**
 * Logica condivisa tra desktop e mobile:
 *  - fieldIds: Set dei playerId già schierati in campo
 *  - filteredPlayers: lista filtrata per ruolo/club e ordinata P→D→C→A
 *
 * Entrambe le pagine usano questo hook invece di duplicare la logica.
 */
export function useFormazioneRosa<P extends RosaPlayer>(params: {
  allPlayers: P[];
  filterRoles: Set<ChipRole>;
  filterTeam: string | null;
  fieldSlots: Record<string, number>;
}) {
  const { allPlayers, filterRoles, filterTeam, fieldSlots } = params;

  const fieldIds = useMemo(
    () => new Set(Object.values(fieldSlots)),
    [fieldSlots],
  );

  const filteredPlayers = useMemo((): P[] => {
    let list = allPlayers;
    if (filterRoles.size > 0) list = list.filter(p => filterRoles.has(p.role));
    if (filterTeam) list = list.filter(p => p.realTeam === filterTeam);
    return [...list].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  }, [allPlayers, filterRoles, filterTeam]);

  return { fieldIds, filteredPlayers };
}
