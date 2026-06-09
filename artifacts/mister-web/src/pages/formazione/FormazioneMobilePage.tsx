import "./formazione-mobile.css";
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
import { PlayerFieldChip, PlayerBenchRow, MisterToyAvatar } from "@/components/player-chip";
import { useFormazioneRosa } from "./useFormazioneRosa";

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

// ── (FieldChip e BenchRow rimossi: usa PlayerFieldChip / PlayerBenchRow da @/components/player-chip) ──

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FormazioneMobilePage() {
  const competitionId = useRouteId("competitionId");
  const fantaTeamId   = useRouteId("fantaTeamId");
  const search = useSearch();
  const seasonOverride = parseInt(new URLSearchParams(search).get("season") ?? "0", 10);

  const queryClient = useQueryClient();

  // ── Team name ────────────────────────────────────────────────────────────────
  const { data: rosaData } = useGetFantaTeamRosa(fantaTeamId ?? "");
  const teamName = rosaData?.teamName ?? fantaTeamId ?? "Formazione";

  // ── Matches + rounds ────────────────────────────────────────────────────────
  const { data: matchesData } = useGetCompetitionMatches(competitionId ?? "");

  // season viene dalla competizione, non da un default hardcoded
  const season = seasonOverride > 0 ? seasonOverride : (matchesData?.season ?? 0);

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

  const activeRound = defaultRound ?? 1;
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

  // Snapshot dell'ultimo stato salvato (per Reset)
  const [savedSnapshot, setSavedSnapshot] = useState<{
    field: Record<string, number>; roster: number[]; captain: number | null;
  }>({ field: {}, roster: [], captain: null });

  const roundKey = `${activeRound}-${fantaTeamId}-${season}`;

  useEffect(() => { setLoadedKey(""); }, [activeRound, fantaTeamId, season]);

  useEffect(() => {
    if (loadedKey === roundKey) return;
    if (allPlayers.length === 0) return;
    if (lineupData === undefined) return; // attendi che la query sia risolta
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
      setSavedSnapshot({ field: newField, roster: newRoster, captain: lineupData.captainPlayerId ?? null });
    } else {
      setFieldSlots({});
      setRoster(allPlayers.map(p => p.id));
      setCaptainId(null);
      setSavedSnapshot({ field: {}, roster: allPlayers.map(p => p.id), captain: null });
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

  // Hook condiviso — fieldIds usato per coerenza; filteredPlayers non serve qui (panchina = roster)
  const { fieldIds } = useFormazioneRosa({
    allPlayers,
    filterRoles: new Set<Role>(),
    filterTeam: null,
    fieldSlots,
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleClear() {
    setFieldSlots({});
    setRoster(allPlayers.map(p => p.id));
    setSelection(null);
    setCaptainId(null);
    setSaveErrors([]);
  }

  function handleReset() {
    setFieldSlots(savedSnapshot.field);
    setRoster(savedSnapshot.roster);
    setCaptainId(savedSnapshot.captain);
    setSelection(null);
    setSaveErrors([]);
  }

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
    <div className="fm-pg" style={{
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

          {/* Field — sfondo separato dal layer chip per evitare overflow:hidden sui cognomi */}
          <div style={{ position: "relative", width: "100%", aspectRatio: "10/14" }}>
            {/* Layer visivo: overflow:hidden ritaglia sfondo e tracciati campo nel rettangolo arrotondato */}
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(0deg, #2d5a34 0px 36px, #295231 36px 72px)",
              borderRadius: 13, overflow: "hidden",
              border: "1px solid rgba(239,230,211,0.12)",
            }}>
              {/* pitch_mobile.svg VERBATIM — lunette area + calci d'angolo */}
              <svg viewBox="0 0 300 460" preserveAspectRatio="none" fill="none" stroke="#efe6d3" strokeOpacity="0.15" strokeWidth="1.3" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <rect x="6" y="6" width="288" height="448" rx="6"/>
                <line x1="6" y1="230" x2="294" y2="230"/>
                <circle cx="150" cy="230" r="44"/>
                <circle cx="150" cy="230" r="2" fill="#efe6d3" fillOpacity="0.4" stroke="none"/>
                <rect x="70" y="6" width="160" height="80"/>
                <rect x="110" y="6" width="80" height="34"/>
                <circle cx="150" cy="62" r="2" fill="#efe6d3" fillOpacity="0.4" stroke="none"/>
                <path d="M116 86 Q150 116 184 86"/>
                <rect x="70" y="374" width="160" height="80"/>
                <rect x="110" y="420" width="80" height="34"/>
                <circle cx="150" cy="398" r="2" fill="#efe6d3" fillOpacity="0.4" stroke="none"/>
                <path d="M116 374 Q150 344 184 374"/>
                <path d="M15,6 A9,9 0 0 1 6,15"/>
                <path d="M294,15 A9,9 0 0 1 285,6"/>
                <path d="M6,445 A9,9 0 0 1 15,454"/>
                <path d="M285,454 A9,9 0 0 1 294,445"/>
              </svg>
            </div>

            {/* Layer chip: nessun overflow:hidden — .cr e .cn visibili anche oltre il bordo riga */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", justifyContent: "space-evenly",
              padding: "14px 4px",
            }}>
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
                        <PlayerFieldChip
                          key={slotId}
                          player={player}
                          role={role}
                          isSelected={isSel}
                          isCaptain={pid !== undefined && pid === captainId}
                          isDimmed={!!isDimmed}
                          isLocked={roundLocked}
                          avgScore={player?.voto ?? null}
                          onClick={() => handleFieldChipTap(slotId)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* .cstrip — Modulo + Allenatore (volto toy + nome) + XI */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px 6px", flexShrink: 0 }}>
            {/* Modulo */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>Modulo</div>
              {roundLocked ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{modulo}</span>
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

            {/* Separatore */}
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)", flexShrink: 0 }} />

            {/* Allenatore: volto toy + nome manager */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid var(--gold-l)", flexShrink: 0, overflow: "hidden", background: "var(--cream2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MisterToyAvatar size={30} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Allenatore</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 13, fontWeight: 600, color: "var(--green)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {rosaData?.managerName ?? teamName}
                </div>
              </div>
            </div>

            {/* XI contatore */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>XI</span>
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
                  onClick={handleClear}
                  style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "transparent", border: "1px solid var(--line)",
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Svuota
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: "12px 14px", borderRadius: 10,
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
                <PlayerBenchRow
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
