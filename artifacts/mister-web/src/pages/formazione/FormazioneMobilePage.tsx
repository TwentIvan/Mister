import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import {
  useGetCompetitionMatches,
  useGetRoster,
  useGetLineups,
  useGetFantaTeamRosa,
  usePutLineup,
  getGetLineupsQueryKey,
  type RosterPlayer,
  type CompetitionMatch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouteId } from "@/hooks/useRouteId";
import { ChevronLeft, Lock, Home as HomeIcon, Plane, Trophy } from "lucide-react";
import { TEAM_CODE } from "./team-constants";

// ── Tipi ──────────────────────────────────────────────────────────────────────

type Role = "GK" | "DEF" | "MID" | "ATT";
type Tab  = "campo" | "panchina";
type Sel  =
  | { kind: "field";       slotId: string; playerId: number }
  | { kind: "field-empty"; slotId: string }
  | { kind: "bench";       rosterIdx: number; playerId: number }
  | null;

interface LocalPlayer {
  id: number;
  name: string;
  realTeam: string;
  role: Role;
  photoUrl: string | null;
  cartoonUrl: string | null;
  voto: number | null;
  colors: { primary: string; secondary: string };
  teamCode: string;
  logoUrl: string | null;
}

// ── Costanti ──────────────────────────────────────────────────────────────────

const MODULI = ["4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2", "4-2-3-1", "4-3-1-2"];

// Anello chip sul campo (--ringP/D/C/A): colori chiari, leggibili sull'erba verde
const ROLE_RING: Record<Role, string> = {
  GK:  "#c79a4e",   // --ringP
  DEF: "#6aa07f",   // --ringD
  MID: "#6aa6b8",   // --ringC
  ATT: "#cf8a6a",   // --ringA
};

// Sfondo riga panchina (--rP/D/C/A): stessa palette scura
const ROLE_BENCH_BG: Record<Role, string> = {
  GK:  "#7e5a26",
  DEF: "#2b5740",
  MID: "#234c5e",
  ATT: "#6b2c24",
};

const ROLE_LABEL: Record<Role, string> = {
  GK: "P", DEF: "D", MID: "C", ATT: "A",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFormation(mod: string): number[] {
  return [1, ...mod.split("-").map(Number)];
}

function getRowLabel(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "P";
  if (rowIdx === 1) return "D";
  if (rowIdx === totalRows - 1) return "A";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "C";
}

function labelToRole(label: string): Role {
  switch (label) {
    case "P": return "GK";
    case "D": return "DEF";
    case "A": return "ATT";
    default:  return "MID";
  }
}

function getSlotRole(slotId: string, formation: number[]): Role {
  const rowIdx = parseInt(slotId.split("-")[0], 10);
  return labelToRole(getRowLabel(rowIdx, formation.length));
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 8 ? last.slice(0, 7) + "." : last;
}

function adaptPlayer(p: RosterPlayer): LocalPlayer {
  const teamName = p.realTeamName ?? "";
  return {
    id: p.id,
    name: p.name,
    realTeam: teamName,
    role: p.roleClassic as Role,
    photoUrl: p.photoUrl ?? null,
    cartoonUrl: p.photoCartoonUrl ?? null,
    voto: p.votoMister ?? null,
    colors: {
      primary:   p.realTeamColorPrimary  ?? "#444",
      secondary: p.realTeamColorSecondary ?? "#888",
    },
    teamCode: TEAM_CODE[teamName] ?? teamName.slice(0, 3).toUpperCase(),
    logoUrl: p.logoUrl ?? null,
  };
}

function migrateLineup(
  oldFieldSlots: Record<string, number>,
  oldRoster: number[],
  oldFormation: number[],
  newFormation: number[],
): { fieldSlots: Record<string, number>; roster: number[] } {
  const byLabel = (filter: (l: string) => boolean): number[] => {
    const res: number[] = [];
    oldFormation.forEach((count, rowIdx) => {
      const label = getRowLabel(rowIdx, oldFormation.length);
      if (filter(label)) {
        for (let si = 0; si < count; si++) {
          const pid = oldFieldSlots[`${rowIdx}-${si}`];
          if (pid !== undefined) res.push(pid);
        }
      }
    });
    return res;
  };
  const newSlotIds = (filter: (l: string) => boolean): string[] => {
    const res: string[] = [];
    newFormation.forEach((count, rowIdx) => {
      const label = getRowLabel(rowIdx, newFormation.length);
      if (filter(label)) {
        for (let si = 0; si < count; si++) res.push(`${rowIdx}-${si}`);
      }
    });
    return res;
  };

  const gks  = byLabel(l => l === "P");
  const defs = byLabel(l => l === "D");
  const mids = byLabel(l => l === "C" || l === "T");
  const atts = byLabel(l => l === "A");

  const newSlots: Record<string, number> = {};
  const surplus: number[] = [];

  if (gks.length > 0) newSlots["0-0"] = gks[0];
  surplus.push(...gks.slice(1));

  const defS = newSlotIds(l => l === "D");
  defs.forEach((pid, i) => { if (i < defS.length) newSlots[defS[i]] = pid; else surplus.push(pid); });

  const midS = newSlotIds(l => l === "C" || l === "T");
  mids.forEach((pid, i) => { if (i < midS.length) newSlots[midS[i]] = pid; else surplus.push(pid); });

  const attS = newSlotIds(l => l === "A");
  atts.forEach((pid, i) => { if (i < attS.length) newSlots[attS[i]] = pid; else surplus.push(pid); });

  return { fieldSlots: newSlots, roster: [...oldRoster, ...surplus] };
}

// ── FieldChip ─────────────────────────────────────────────────────────────────

interface FieldChipProps {
  player: LocalPlayer | null;
  slotId: string;
  role: Role;
  isSelected: boolean;
  isCaptain: boolean;
  isDimmed: boolean;
  isLocked: boolean;
  onClick: () => void;
}

function FieldChip({ player, role, isSelected, isCaptain, isDimmed, isLocked, onClick }: FieldChipProps) {
  const ring = ROLE_RING[role];
  const AVATAR = 42;
  const RING   = 2.5;
  const OUTER  = AVATAR + RING * 2;

  return (
    <div
      onClick={isLocked ? undefined : onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        width: 58, cursor: isLocked ? "default" : "pointer",
        opacity: isDimmed ? 0.3 : 1, transition: "opacity 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        {/* Avatar */}
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "#2d5848" }}>
          {player && (player.cartoonUrl ?? player.photoUrl) && (
            <img
              src={player.cartoonUrl ?? player.photoUrl!} alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", transformOrigin: "center" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {!player && (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: ring, opacity: 0.7 }}>
                {ROLE_LABEL[role]}
              </span>
            </div>
          )}
        </div>
        {/* Ring */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${RING}px ${!player ? "dashed" : "solid"} ${isSelected ? "rgba(255,255,255,0.95)" : ring}`,
          pointerEvents: "none",
          transition: "border-color 0.15s",
        }} />
        {/* Captain badge */}
        {isCaptain && (
          <div style={{
            position: "absolute", bottom: -1, right: -1,
            width: 15, height: 15, borderRadius: "50%", background: "#c8922b",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 800, color: "#fff" }}>C</span>
          </div>
        )}
      </div>

      {/* Club pill bicolor */}
      {player && (
        <div style={{
          width: 40, height: 11, borderRadius: 4, overflow: "hidden",
          position: "relative", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: player.colors.primary }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: player.colors.secondary }} />
          {player.logoUrl ? (
            <img
              src={player.logoUrl} alt=""
              style={{ position: "absolute", inset: 0, margin: "auto", width: 9, height: 9, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 6, fontWeight: 700, color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}>
              {player.teamCode}
            </span>
          )}
        </div>
      )}

      {/* Cognome */}
      <span style={{
        fontSize: 9, fontWeight: 600, color: "rgba(239,230,211,0.9)",
        fontFamily: "var(--font-sans)", textAlign: "center", lineHeight: 1.2,
        maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      }}>
        {player ? lastName(player.name) : "—"}
      </span>
    </div>
  );
}

// ── BenchRow ──────────────────────────────────────────────────────────────────

interface BenchRowProps {
  player: LocalPlayer;
  priority: number;
  isSelected: boolean;
  isCompatible: boolean | null;
  isCaptain: boolean;
  isLocked: boolean;
  onTap: () => void;
  onCaptainToggle: () => void;
}

function BenchRow({ player, priority, isSelected, isCompatible, isCaptain, isLocked, onTap, onCaptainToggle }: BenchRowProps) {
  const dimmed = isCompatible === false;
  return (
    <div
      onClick={isLocked ? undefined : onTap}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        borderRadius: 9, padding: "8px 11px",
        background: isSelected ? "rgba(255,255,255,0.12)" : ROLE_BENCH_BG[player.role],
        color: "var(--cream)",
        cursor: isLocked ? "default" : "pointer",
        opacity: dimmed ? 0.28 : 1,
        border: isSelected ? "1.5px solid rgba(255,255,255,0.45)" : "1.5px solid transparent",
        transition: "opacity 0.15s, border-color 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Priorità */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "rgba(239,230,211,0.45)", width: 14, flexShrink: 0 }}>
        {priority}
      </span>
      {/* Avatar */}
      <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ROLE_RING[player.role]}`, flexShrink: 0, background: "#2d5848" }}>
        {(player.cartoonUrl ?? player.photoUrl) && (
          <img
            src={player.cartoonUrl ?? player.photoUrl!} alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.06)", transformOrigin: "center" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>
      {/* Role badge */}
      <div style={{
        width: 18, height: 18, borderRadius: 4, background: "rgba(0,0,0,0.28)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, color: ROLE_RING[player.role] }}>
          {ROLE_LABEL[player.role]}
        </span>
      </div>
      {/* Crest */}
      {player.logoUrl ? (
        <img
          src={player.logoUrl} alt=""
          style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "rgba(239,230,211,0.6)", width: 16, flexShrink: 0 }}>
          {player.teamCode}
        </span>
      )}
      {/* Cognome */}
      <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "rgba(239,230,211,0.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lastName(player.name)}
      </span>
      {/* Captain toggle */}
      {!isLocked && (
        <button
          onClick={(e) => { e.stopPropagation(); onCaptainToggle(); }}
          style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0, padding: 0,
            background: isCaptain ? "#c8922b" : "rgba(0,0,0,0.25)",
            border: isCaptain ? "none" : "1px solid rgba(239,230,211,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, color: isCaptain ? "#fff" : "rgba(239,230,211,0.55)" }}>C</span>
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FormazioneMobilePage() {
  const competitionId = useRouteId("competitionId");
  const fantaTeamId   = useRouteId("fantaTeamId");
  const search = useSearch();
  const season = parseInt(new URLSearchParams(search).get("season") ?? "2025", 10);

  const queryClient = useQueryClient();

  // ── Team name ────────────────────────────────────────────────────────────────
  const { data: rosaData } = useGetFantaTeamRosa(fantaTeamId ?? "");
  const teamName = rosaData?.teamName ?? fantaTeamId ?? "Formazione";

  // ── Matches + rounds ────────────────────────────────────────────────────────
  const { data: matchesData } = useGetCompetitionMatches(competitionId ?? "");

  const rounds = useMemo((): number[] => {
    if (!matchesData) return [];
    return Array.from(new Set(matchesData.matches.map((m: CompetitionMatch) => m.round))).sort((a, b) => a - b);
  }, [matchesData]);

  const isRoundLocked = (r: number) =>
    !!(matchesData?.matches.filter((m: CompetitionMatch) => m.round === r).some((m: CompetitionMatch) => m.playedAt != null));

  const defaultRound = useMemo((): number | null => {
    if (!matchesData || rounds.length === 0) return null;
    return rounds.find(r => !isRoundLocked(r)) ?? rounds[rounds.length - 1];
  }, [matchesData, rounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  useEffect(() => {
    if (selectedRound === null && defaultRound !== null) setSelectedRound(defaultRound);
  }, [defaultRound, selectedRound]);

  const activeRound = selectedRound ?? defaultRound ?? 1;
  const roundLocked = isRoundLocked(activeRound);

  const myMatch = useMemo((): CompetitionMatch | null => {
    if (!matchesData || !fantaTeamId) return null;
    return matchesData.matches.find((m: CompetitionMatch) =>
      m.round === activeRound &&
      (m.homeTeam.id === fantaTeamId || m.awayTeam.id === fantaTeamId)
    ) ?? null;
  }, [matchesData, activeRound, fantaTeamId]);

  const isHome   = myMatch?.homeTeam.id === fantaTeamId;
  const opponent = myMatch ? (isHome ? myMatch.awayTeam : myMatch.homeTeam) : null;

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: rosterData } = useGetRoster(
    { fantaTeamId: fantaTeamId ?? "", season, round: activeRound },
  );

  const { data: lineupData } = useGetLineups(
    { fantaTeamId: fantaTeamId ?? "", season, round: activeRound },
  );

  const saveMutation = usePutLineup();

  const allPlayers = useMemo((): LocalPlayer[] =>
    (rosterData ?? []).map(adaptPlayer), [rosterData]);

  const playerById = useMemo((): Map<number, LocalPlayer> => {
    const m = new Map<number, LocalPlayer>();
    allPlayers.forEach(p => m.set(p.id, p));
    return m;
  }, [allPlayers]);

  // ── Lineup state ────────────────────────────────────────────────────────────
  const [modulo, setModulo]         = useState("4-3-3");
  const [fieldSlots, setFieldSlots] = useState<Record<string, number>>({});
  const [roster, setRoster]         = useState<number[]>([]);
  const [captainId, setCaptainId]   = useState<number | null>(null);
  const [loadedKey, setLoadedKey]   = useState("");

  const roundKey = `${activeRound}-${fantaTeamId}-${season}`;

  useEffect(() => { setLoadedKey(""); }, [activeRound, fantaTeamId, season]);

  useEffect(() => {
    if (loadedKey === roundKey) return;
    if (allPlayers.length === 0) return;
    setLoadedKey(roundKey);

    if (lineupData && lineupData.players.length > 0) {
      setModulo(lineupData.module);
      setCaptainId(lineupData.captainPlayerId ?? null);
      const formation = parseFormation(lineupData.module);
      let si = 1;
      const siToSlot = new Map<number, string>();
      formation.forEach((count, rowIdx) => {
        for (let j = 0; j < count; j++) { siToSlot.set(si, `${rowIdx}-${j}`); si++; }
      });
      const newField: Record<string, number> = {};
      const newRoster: number[] = [];
      lineupData.players.forEach(p => {
        if (p.isStarter) { const sid = siToSlot.get(p.slotIndex); if (sid) newField[sid] = p.playerId; }
        else newRoster.push(p.playerId);
      });
      setFieldSlots(newField);
      setRoster(newRoster);
    } else {
      setFieldSlots({});
      setRoster(allPlayers.map(p => p.id));
      setCaptainId(null);
    }
  }, [roundKey, loadedKey, allPlayers, lineupData]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState<Tab>("campo");
  const [selection, setSelection]   = useState<Sel>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saveOk, setSaveOk]         = useState(false);
  const [roleError, setRoleError]   = useState<string | null>(null);

  const formation    = useMemo(() => parseFormation(modulo), [modulo]);
  const starterCount = Object.keys(fieldSlots).length;

  const selectedFieldRole: Role | null =
    (selection?.kind === "field" || selection?.kind === "field-empty")
      ? getSlotRole(selection.slotId, formation)
      : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleModuloChange(newMod: string) {
    const result = migrateLineup(fieldSlots, roster, formation, parseFormation(newMod));
    setModulo(newMod);
    setFieldSlots(result.fieldSlots);
    setRoster(result.roster);
    setSelection(null);
  }

  function handleFieldChipTap(slotId: string) {
    if (roundLocked) return;
    const pid = fieldSlots[slotId];
    if (pid !== undefined) {
      // Slot occupato
      if (selection?.kind === "field" && selection.slotId === slotId) { setSelection(null); return; }
      setSelection({ kind: "field", slotId, playerId: pid });
      setActiveTab("panchina");
    } else {
      // Slot vuoto — seleziona per riempirlo dalla panchina
      if (selection?.kind === "field-empty" && selection.slotId === slotId) { setSelection(null); return; }
      setSelection({ kind: "field-empty", slotId });
      setActiveTab("panchina");
    }
  }

  function handleBenchRowTap(pid: number, idx: number) {
    if (roundLocked) return;

    if (selection?.kind === "field" || selection?.kind === "field-empty") {
      const reqRole = getSlotRole(selection.slotId, formation);
      const player  = playerById.get(pid);
      if (!player || player.role !== reqRole) {
        setRoleError(`Slot ${ROLE_LABEL[reqRole]} richiede ruolo ${ROLE_LABEL[reqRole]}`);
        setTimeout(() => setRoleError(null), 2200);
        return;
      }
      const slotId   = selection.slotId;
      const outgoing = selection.kind === "field" ? fieldSlots[slotId] : undefined;
      setFieldSlots(prev => ({ ...prev, [slotId]: pid }));
      setRoster(prev => {
        const next = prev.filter(id => id !== pid);
        if (outgoing !== undefined) next.splice(idx, 0, outgoing);
        return next;
      });
      setSelection(null);
      setActiveTab("campo");
      return;
    }

    if (selection?.kind === "bench") {
      const a = roster.indexOf(selection.playerId);
      const b = roster.indexOf(pid);
      if (a !== -1 && b !== -1) {
        setRoster(prev => { const n = [...prev]; [n[a], n[b]] = [n[b], n[a]]; return n; });
      }
      setSelection(null);
      return;
    }

    setSelection({ kind: "bench", rosterIdx: idx, playerId: pid });
  }

  function handleSave() {
    if (!fantaTeamId) return;
    setSaveErrors([]); setSaveOk(false);

    type SP = "GK" | "DEF" | "MID" | "T" | "ATT";
    const slotToPos = (label: string): SP => {
      switch (label) { case "P": return "GK"; case "D": return "DEF"; case "T": return "T"; case "A": return "ATT"; default: return "MID"; }
    };
    const roleToPos = (role: Role): SP => {
      switch (role) { case "GK": return "GK"; case "DEF": return "DEF"; case "ATT": return "ATT"; default: return "MID"; }
    };

    const players: Array<{ playerId: number; slotPosition: SP; slotIndex: number; isStarter: boolean; benchOrder: number | null }> = [];
    let si = 1;
    formation.forEach((count, rowIdx) => {
      const pos = slotToPos(getRowLabel(rowIdx, formation.length));
      for (let j = 0; j < count; j++) {
        const pid = fieldSlots[`${rowIdx}-${j}`];
        if (pid !== undefined) players.push({ playerId: pid, slotPosition: pos, slotIndex: si, isStarter: true, benchOrder: null });
        si++;
      }
    });
    roster.forEach((pid, i) => {
      const p = playerById.get(pid);
      if (!p) return;
      players.push({ playerId: pid, slotPosition: roleToPos(p.role), slotIndex: 12 + i, isStarter: false, benchOrder: i + 1 });
    });

    saveMutation.mutate({ data: { fantaTeamId, season, round: activeRound, module: modulo, captainPlayerId: captainId ?? null, players } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLineupsQueryKey({ fantaTeamId, season, round: activeRound }) });
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3200);
      },
      onError: (err: unknown) => {
        const d = (err as { response?: { data?: unknown } })?.response?.data;
        if (d && typeof d === "object" && "errors" in d && Array.isArray((d as { errors: unknown[] }).errors)) {
          setSaveErrors((d as { errors: string[] }).errors);
        } else if (d && typeof d === "object" && "error" in d) {
          setSaveErrors([(d as { error: string }).error]);
        } else {
          setSaveErrors(["Salvataggio non riuscito"]);
        }
      },
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: 390, margin: "0 auto", minHeight: "100dvh",
      background: "var(--cream)", color: "var(--green-d)",
      fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column",
    }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px", flexShrink: 0 }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", padding: 4, borderRadius: 6, display: "flex" }}
        >
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 600, color: "var(--green-d)",
            lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {teamName}
          </div>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Gestione formazione
          </div>
        </div>
        {roundLocked && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4, padding: "3px 9px",
            borderRadius: 99, background: "rgba(31,71,51,0.06)", border: "1px solid rgba(31,71,51,0.14)",
          }}>
            <Lock size={11} color="var(--muted)" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>Bloccata</span>
          </div>
        )}
      </div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 6, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
        {["Panoramica", "Rosa", "Formazione", "Mercato", "Classifica"].map(label => (
          <div key={label} style={{
            padding: "4px 13px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
            background: label === "Formazione" ? "var(--green)" : "var(--paper)",
            color: label === "Formazione" ? "var(--cream)" : "var(--muted)",
            border: label === "Formazione" ? "1px solid rgba(239,230,211,0.18)" : "1px solid var(--line)",
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Round picker */}
      {rounds.length > 0 && (
        <div style={{ display: "flex", gap: 5, padding: "0 16px 8px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", flexShrink: 0, textTransform: "uppercase" }}>G</span>
          {rounds.map(r => {
            const locked = isRoundLocked(r);
            const active = r === activeRound;
            return (
              <button
                key={r}
                onClick={() => { setSelectedRound(r); setSelection(null); setActiveTab("campo"); setSaveErrors([]); setSaveOk(false); }}
                style={{
                  padding: "3px 10px", borderRadius: 99, flexShrink: 0, cursor: "pointer",
                  border: active ? "1px solid rgba(31,71,51,0.22)" : "1px solid var(--line)",
                  background: active ? "var(--green)" : "transparent",
                  display: "flex", alignItems: "center", gap: 3,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "var(--cream)" : "var(--muted)" }}>
                  {r}
                </span>
                {locked && <Lock size={9} color={active ? "rgba(239,230,211,0.6)" : "var(--line)"} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Context row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={12} color="var(--green-l)" />
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, fontWeight: 600, color: "var(--green)", letterSpacing: "0.01em" }}>
            Giornata {activeRound}
          </span>
          {opponent && (
            <>
              <span style={{ color: "var(--line)", fontSize: 12 }}>·</span>
              {isHome
                ? <HomeIcon size={10} color="var(--muted)" />
                : <Plane size={10} color="var(--muted)" />}
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--green-l)", fontWeight: 600 }}>
                {opponent.name}
              </span>
            </>
          )}
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color: roundLocked ? "var(--muted)" : "var(--green-l)",
          letterSpacing: "0.05em",
        }}>
          {roundLocked ? "Conclusa" : "Aperta"}
        </span>
      </div>

      {/* Segment tabs */}
      <div style={{ display: "flex", gap: 2, margin: "0 16px 12px", background: "rgba(31,71,51,0.06)", borderRadius: 10, padding: 3, flexShrink: 0 }}>
        {(["campo", "panchina"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab === "campo") setSelection(null); }}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === tab ? "var(--green)" : "transparent",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: activeTab === tab ? "var(--cream)" : "var(--muted)",
              transition: "background 0.15s, color 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {tab === "campo" ? "Campo" : "Panchina"}
          </button>
        ))}
      </div>

      {/* ── Campo view ─────────────────────────────────────────────────────────── */}
      {activeTab === "campo" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 12px" }}>
          {roundLocked && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
              borderRadius: 8, marginBottom: 10,
              background: "var(--paper)", border: "1px solid var(--line)",
            }}>
              <Lock size={12} color="var(--muted)" />
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Giornata conclusa — sola lettura</span>
            </div>
          )}

          {/* Field */}
          <div style={{
            position: "relative", width: "100%", aspectRatio: "10/14",
            background: "repeating-linear-gradient(0deg, #2d5a34 0px 36px, #295231 36px 72px)",
            borderRadius: 13, overflow: "hidden",
            border: "1px solid rgba(239,230,211,0.12)",
            display: "flex", flexDirection: "column", justifyContent: "space-evenly",
            padding: "14px 4px",
          }}>
            {/* Field markings */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.16 }} viewBox="0 0 100 140" preserveAspectRatio="none">
              <rect x="10" y="4" width="80" height="132" fill="none" stroke="#fff" strokeWidth="0.8" />
              <line x1="10" y1="70" x2="90" y2="70" stroke="#fff" strokeWidth="0.6" />
              <circle cx="50" cy="70" r="10" fill="none" stroke="#fff" strokeWidth="0.6" />
              <circle cx="50" cy="70" r="1.2" fill="#fff" />
              <rect x="30" y="4" width="40" height="16" fill="none" stroke="#fff" strokeWidth="0.6" />
              <rect x="38" y="4" width="24" height="8" fill="none" stroke="#fff" strokeWidth="0.6" />
              <rect x="30" y="120" width="40" height="16" fill="none" stroke="#fff" strokeWidth="0.6" />
              <rect x="38" y="128" width="24" height="8" fill="none" stroke="#fff" strokeWidth="0.6" />
              <circle cx="50" cy="26" r="6" fill="none" stroke="#fff" strokeWidth="0.5" />
              <circle cx="50" cy="114" r="6" fill="none" stroke="#fff" strokeWidth="0.5" />
            </svg>

            {/* Rows: ATT in alto, GK in basso */}
            {[...formation].reverse().map((count, revIdx) => {
              const rowIdx = formation.length - 1 - revIdx;
              return (
                <div
                  key={rowIdx}
                  style={{ display: "flex", justifyContent: "space-evenly", alignItems: "center", width: "100%", position: "relative", zIndex: 1 }}
                >
                  {Array.from({ length: count }, (_, si) => {
                    const slotId = `${rowIdx}-${si}`;
                    const pid    = fieldSlots[slotId];
                    const player = pid !== undefined ? (playerById.get(pid) ?? null) : null;
                    const role   = getSlotRole(slotId, formation);
                    const isSel  = (selection?.kind === "field" && selection.slotId === slotId) ||
                                   (selection?.kind === "field-empty" && selection.slotId === slotId);
                    const isDimmed = selection !== null && !isSel && !(
                      selection.kind === "bench" && role === playerById.get(selection.playerId)?.role
                    );
                    return (
                      <FieldChip
                        key={slotId}
                        player={player}
                        slotId={slotId}
                        role={role}
                        isSelected={isSel}
                        isCaptain={pid !== undefined && pid === captainId}
                        isDimmed={!!isDimmed}
                        isLocked={roundLocked}
                        onClick={() => handleFieldChipTap(slotId)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Modulo strip + contatore */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px 6px", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>Modulo</div>
              {roundLocked ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>{modulo}</span>
              ) : (
                <select
                  value={modulo}
                  onChange={e => handleModuloChange(e.target.value)}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
                    color: "var(--green)", background: "transparent",
                    border: "none", outline: "none", cursor: "pointer",
                    appearance: "none", WebkitAppearance: "none", padding: 0,
                  }}
                >
                  {MODULI.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>XI</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: starterCount === 11 ? "var(--green-l)" : "var(--muted)" }}>
                {starterCount}/11
              </span>
            </div>
          </div>

          {/* Save bar */}
          {!roundLocked && (
            <div style={{ paddingBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={starterCount !== 11 || saveMutation.isPending}
                  onClick={handleSave}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 10,
                    background: starterCount === 11 ? "var(--green)" : "var(--paper)",
                    border: starterCount === 11 ? "1px solid rgba(239,230,211,0.22)" : "1px solid var(--line)",
                    color: starterCount === 11 ? "var(--cream)" : "var(--muted)",
                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
                    cursor: starterCount === 11 && !saveMutation.isPending ? "pointer" : "not-allowed",
                    transition: "all 0.2s", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {saveMutation.isPending ? "Salvataggio…" : "Salva"}
                </button>
                <button
                  onClick={() => { setFieldSlots({}); setRoster(allPlayers.map(p => p.id)); setSelection(null); setCaptainId(null); setSaveErrors([]); }}
                  style={{
                    padding: "12px 16px", borderRadius: 10,
                    background: "transparent", border: "1px solid var(--line)",
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Reset
                </button>
              </div>
              {saveOk && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(46,96,71,0.09)", border: "1px solid rgba(46,96,71,0.22)", fontSize: 12, color: "var(--green-l)", fontFamily: "var(--font-sans)" }}>
                  Formazione salvata
                </div>
              )}
              {saveErrors.length > 0 && (
                <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(207,138,106,0.11)", border: "1px solid rgba(207,138,106,0.28)", display: "flex", flexDirection: "column", gap: 4 }}>
                  {saveErrors.map((e, i) => (
                    <span key={i} style={{ fontSize: 12, color: "#cf8a6a", fontFamily: "var(--font-sans)" }}>{e}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Panchina view ─────────────────────────────────────────────────────── */}
      {activeTab === "panchina" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 12px 20px" }}>
          {/* Hint bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 9, marginBottom: 10, flexShrink: 0,
            background: (selection?.kind === "field" || selection?.kind === "field-empty") ? "var(--green-d)" : "var(--paper)",
            border: (selection?.kind === "field" || selection?.kind === "field-empty") ? "1px solid rgba(106,160,127,0.38)" : "1px solid var(--line)",
          }}>
            {selection?.kind === "field" ? (
              <>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6aa07f", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(239,230,211,0.85)", fontFamily: "var(--font-sans)", flex: 1 }}>
                  <strong style={{ color: "#efe6d3" }}>
                    {lastName(playerById.get(selection.playerId)?.name ?? "—")}
                  </strong>{" "}
                  esce — entra un{" "}
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: selectedFieldRole ? ROLE_RING[selectedFieldRole] : "#fff" }}>
                    {selectedFieldRole ? ROLE_LABEL[selectedFieldRole] : "—"}
                  </span>
                </span>
                <button onClick={() => { setSelection(null); setActiveTab("campo"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,230,211,0.5)", padding: 4, fontSize: 14 }}>✕</button>
              </>
            ) : selection?.kind === "field-empty" ? (
              <>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6aa07f", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(239,230,211,0.85)", fontFamily: "var(--font-sans)", flex: 1 }}>
                  Slot{" "}
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: selectedFieldRole ? ROLE_RING[selectedFieldRole] : "#fff" }}>
                    {selectedFieldRole ? ROLE_LABEL[selectedFieldRole] : "—"}
                  </span>
                  {" "}vuoto — scegli chi entra
                </span>
                <button onClick={() => { setSelection(null); setActiveTab("campo"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,230,211,0.5)", padding: 4, fontSize: 14 }}>✕</button>
              </>
            ) : roundLocked ? (
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Panchina in sola lettura</span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Tocca un titolare in campo, poi scegli chi entra</span>
            )}
          </div>

          {roleError && (
            <div style={{ padding: "7px 12px", borderRadius: 8, marginBottom: 8, background: "rgba(207,138,106,0.11)", border: "1px solid rgba(207,138,106,0.28)", fontSize: 12, color: "#cf8a6a", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
              {roleError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 5, overflowY: "auto" }}>
            {roster.map((pid, idx) => {
              const player = playerById.get(pid);
              if (!player) return null;
              const isSel   = selection?.kind === "bench" && selection.playerId === pid;
              const compat  = (selection?.kind === "field" || selection?.kind === "field-empty")
                ? (player.role === selectedFieldRole)
                : null;
              return (
                <BenchRow
                  key={pid}
                  player={player}
                  priority={idx + 1}
                  isSelected={isSel}
                  isCompatible={compat}
                  isCaptain={pid === captainId}
                  isLocked={roundLocked}
                  onTap={() => handleBenchRowTap(pid, idx)}
                  onCaptainToggle={() => setCaptainId(prev => prev === pid ? null : pid)}
                />
              );
            })}
            {roster.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--muted)" }}>
                Tutti i giocatori sono in campo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
