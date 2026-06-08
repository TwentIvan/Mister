import { useParams, useSearch } from "wouter";
import { useRef, useState, useEffect } from "react";
import {
  useGetCompetitionCoppa,
  type CoppaGroupRow,
  type CoppaGroup,
  type CoppaSlot,
  type CoppaRound,
  type CoppaGironiPhase,
  type CoppaTabellonePhase,
} from "@workspace/api-client-react";

// ─── Disco squadra ────────────────────────────────────────────────────────────
function Disco({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const code = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--disp)", fontWeight: 700,
        fontSize: size === 22 ? 8 : size === 23 ? 9 : 8,
        color: "#efe6d3",
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.18)",
      }}
    >
      {code}
    </span>
  );
}

// ─── Icone ────────────────────────────────────────────────────────────────────
function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} width={23} height={23}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} width={18} height={18}>
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4 7.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.4 4h.2a2 2 0 1 1 4 0v.2A1.6 1.6 0 0 0 17 5.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.2" />
    </svg>
  );
}
function IconForcella() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={17} height={17}>
      <path d="M7 4v6a3 3 0 0 0 3 3h7M7 20v-6M17 13l3-3-3-3" />
    </svg>
  );
}
function IconFunnel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}>
      <path d="M3 4h18l-7 9v6l-4 2v-8z" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={34} height={34}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} width={14} height={14}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={17} height={17}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ─── Bottom tabs ──────────────────────────────────────────────────────────────
function BottomTabs() {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", background: "#efe6d3", borderTop: "1px solid #d8ccae", padding: "10px 0 12px" }}>
      {[
        { label: "Home", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}><path d="M3 11l9-7 9 7M5 10v9h14v-9"/></svg> },
        { label: "Leghe", active: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}><path d="M4 7h16M4 12h16M4 17h16"/></svg> },
        { label: "Notifiche", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg> },
        { label: "Profilo", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}><circle cx={12} cy={8} r={4}/><path d="M4 21a8 8 0 0 1 16 0"/></svg> },
      ].map((tab) => (
        <div key={tab.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 9, color: tab.active ? "#1f4733" : "#8a8266", fontFamily: "var(--ui)" }}>
          {tab.icon}{tab.label}
        </div>
      ))}
    </div>
  );
}

// ─── Girone card ─────────────────────────────────────────────────────────────
function GironeCard({ name, teams, started, nPassanti }: { name: string; teams: CoppaGroupRow[]; started: boolean; nPassanti: number }) {
  return (
    <div style={{ margin: "0 16px 11px", background: "#f7f1e4", border: "1px solid #d8ccae", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(216,204,174,.7)" }}>
        <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 14, color: "#1f4733" }}>Girone {name}</span>
        <span style={{ fontSize: 8, color: "#8a8266", textTransform: "uppercase", letterSpacing: ".08em" }}>{started ? "Pt" : "—"}</span>
      </div>
      {teams.map((team, i) => {
        const isQ = team.qualified;
        const isOut = started && !isQ;
        return (
          <div
            key={team.fanta_team_id}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
              borderTop: i > 0 ? "1px solid rgba(216,204,174,.5)" : undefined,
              background: isQ ? "rgba(46,96,71,.06)" : undefined,
              position: "relative", opacity: isOut ? 0.5 : 1,
            }}
          >
            {isQ && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#2e6047" }} />}
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: isQ ? "#2e6047" : "#8a8266", width: 14, textAlign: "center", fontWeight: isQ ? 700 : 400 }}>
              {i + 1}
            </span>
            <Disco name={team.team_name} color={team.color_primary} size={22} />
            <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 13.5, color: "#1f4733", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {team.team_name}
            </span>
            {isQ && <span style={{ fontFamily: "var(--ui)", fontWeight: 700, fontSize: 7.5, letterSpacing: ".04em", color: "#efe6d3", background: "#2e6047", borderRadius: 5, padding: "2px 5px" }}>Q</span>}
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color: "#1f4733", width: 22, textAlign: "right" }}>
              {started ? team.points : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pour section (qualificate → semifinali) ─────────────────────────────────
function PourSection({ groups, started }: { groups: { name: string; teams: CoppaGroupRow[] }[]; started: boolean }) {
  // Cross-bracket accoppiamenti: 1°A vs 2°B, 1°B vs 2°A
  const [gA, gB] = groups;
  if (!gA || !gB) return null;

  const pairings: Array<[{ seed: string; team: CoppaGroupRow | null; prov: string }, { seed: string; team: CoppaGroupRow | null; prov: string }]> = [
    [
      { seed: `1°${gA.name}`, team: started ? gA.teams[0] ?? null : null, prov: `1° Girone ${gA.name}` },
      { seed: `2°${gB.name}`, team: started ? gB.teams[1] ?? null : null, prov: `2° Girone ${gB.name}` },
    ],
    [
      { seed: `1°${gB.name}`, team: started ? gB.teams[0] ?? null : null, prov: `1° Girone ${gB.name}` },
      { seed: `2°${gA.name}`, team: started ? gA.teams[1] ?? null : null, prov: `2° Girone ${gA.name}` },
    ],
  ];

  return (
    <div style={{ margin: "6px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 0 13px", color: "#8a8266", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em" }}>
        <span style={{ color: "#2e6047", display: "flex" }}><IconFunnel /></span>
        Le {groups.length * 2} qualificate → semifinali
      </div>
      <div style={{ textAlign: "center", fontSize: 9.5, color: "#8a8266", marginBottom: 12 }}>
        le prime di un girone contro le seconde dell'altro
      </div>
      {pairings.map(([top, bot], pi) => (
        <div key={pi} style={{ background: "#f7f1e4", border: "1px solid #d8ccae", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
          {[top, bot].map((slot, si) => (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderTop: si > 0 ? "1px solid rgba(216,204,174,.6)" : undefined }}>
              <span style={{ fontFamily: "var(--ui)", fontWeight: 700, fontSize: 8, color: "#2e6047", background: "rgba(46,96,71,.1)", border: "1px solid rgba(46,96,71,.2)", borderRadius: 5, padding: "2px 0", width: 26, textAlign: "center" }}>
                {slot.seed}
              </span>
              {slot.team ? (
                <>
                  <Disco name={slot.team.team_name} color={slot.team.color_primary} size={22} />
                  <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 14, color: "#1f4733", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {slot.team.team_name}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: "var(--disp)", fontStyle: "italic", fontSize: 13, color: "#8a8266", flex: 1 }}>
                  {slot.prov}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Tab Gironi ───────────────────────────────────────────────────────────────
function TabGironi({
  gironi,
  onGoTabellone,
}: {
  gironi: CoppaGironiPhase | null | undefined;
  onGoTabellone: () => void;
}) {
  if (!gironi) return <div style={{ padding: "20px 18px", color: "#8a8266", fontSize: 13 }}>Dati gironi non disponibili.</div>;

  const allStarted = gironi.groups?.every((g: CoppaGroup) => g.started) ?? false;

  return (
    <div style={{ flex: 1 }}>
      {/* Caption */}
      <div style={{ fontSize: 10, color: "#8a8266", padding: "13px 18px 2px", letterSpacing: ".02em" }}>
        {!gironi.sorteggio_done
          ? "In attesa del sorteggio"
          : allStarted
            ? `Fase 1 · gironi conclusi · ${gironi.qualification_label}`
            : "Fase 1 · non ancora iniziata · sorteggio effettuato"}
      </div>

      {/* Gironi */}
      {gironi.groups?.map((g: CoppaGroup) => (
        <GironeCard key={g.name} name={g.name} teams={g.teams} started={g.started} nPassanti={gironi.n_passanti} />
      ))}

      {/* Pour */}
      {gironi.groups && <PourSection groups={gironi.groups} started={allStarted} />}

      {/* Vai al tabellone */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 16px 16px", padding: "13px 15px", border: "1px solid #d8ccae", borderRadius: 13, background: "rgba(31,71,51,.04)", cursor: "pointer" }}
        onClick={onGoTabellone}
      >
        <span style={{ color: "#2e6047", display: "flex" }}><IconForcella /></span>
        <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 13.5, color: "#1f4733" }}>Vai al tabellone</span>
        <span style={{ marginLeft: "auto", color: "#2e6047", display: "flex" }}><IconChevronRight /></span>
      </div>
    </div>
  );
}

// ─── Bracket match card ───────────────────────────────────────────────────────
function BracketMatch({ match, tbd }: { match: { home: CoppaSlot; away: CoppaSlot; spareggio_note?: string | null }; tbd: boolean }) {
  const border = tbd ? "1px dashed #d8ccae" : "1px solid #d8ccae";
  return (
    <div style={{ position: "absolute", left: 66, width: 240, height: 64, background: "#f7f1e4", border, borderRadius: 11, overflow: "hidden" }}>
      {[match.home, match.away].map((slot, i) => {
        const resolved = !!slot.fanta_team_id;
        const isWin = slot.winner === true;
        const isLose = slot.winner === false;
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 9, height: 32, padding: "0 11px",
              borderTop: i > 0 ? "1px solid rgba(216,204,174,.6)" : undefined,
              background: isWin ? "#e7dcc4" : undefined,
            }}
          >
            {resolved && slot.team_name ? (
              <Disco name={slot.team_name} color={slot.color_primary ?? "#1f4733"} size={23} />
            ) : (
              <span style={{ width: 23, height: 23, borderRadius: "50%", border: "1.5px dashed #d8ccae", flexShrink: 0 }} />
            )}
            <span style={{ fontFamily: "var(--disp)", fontWeight: resolved ? 600 : 400, fontStyle: resolved ? "normal" : "italic", fontSize: 13.5, color: resolved ? (isLose ? "#8a8266" : "#1f4733") : "#8a8266", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {resolved ? slot.team_name : slot.provenienza}
            </span>
            {resolved && slot.score !== null && slot.score !== undefined && (
              <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 16, color: isLose ? "#8a8266" : "#1f4733", flexShrink: 0 }}>
                {Math.round(slot.score)}
              </span>
            )}
            {resolved && isWin && (
              <span style={{ color: "#2e6047", flexShrink: 0 }}><IconCheck /></span>
            )}
            {resolved && !isWin && <span style={{ width: 14, flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab Tabellone ────────────────────────────────────────────────────────────
function TabTabellone({
  tabellone,
  lega,
  nTeams,
}: {
  tabellone: CoppaTabellonePhase | null | undefined;
  lega: string;
  nTeams: number;
}) {
  const [roundIdx, setRoundIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rounds = tabellone.rounds + "Coppa" (campione tab)
  const rounds = tabellone?.rounds ?? [];
  const totalTabs = rounds.length + 1; // last tab = Campione

  const tbd = tabellone?.status === "programmata";
  const champion = tabellone?.champion ?? null;

  function goToRound(i: number) {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: i * 372, behavior: "smooth" });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let tid: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(tid);
      tid = setTimeout(() => {
        const i = Math.round(el.scrollLeft / 372);
        setRoundIdx(i);
      }, 60);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const tabLabels = [...rounds.map((r: CoppaRound) => r.name), "Coppa"];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Subheader */}
      <div style={{ padding: "0 16px 11px", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 10, color: "#8a8266", textTransform: "uppercase", letterSpacing: ".07em" }}>
          {lega} · {nTeams} squadre
        </span>
        <span style={{ marginLeft: "auto", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#2e6047", border: "1px solid #2e6047", borderRadius: 10, padding: "3px 9px" }}>
          Fase 2 · Tabellone
        </span>
      </div>

      {/* Round tabs */}
      <div style={{ display: "flex", gap: 7, padding: "4px 16px 12px", overflowX: "auto", borderBottom: "1px solid #d8ccae", scrollbarWidth: "none" }}>
        {tabLabels.map((label, i) => (
          <div
            key={i}
            onClick={() => { setRoundIdx(i); goToRound(i); }}
            style={{
              flexShrink: 0, fontFamily: "var(--disp)", fontWeight: 600, fontSize: 12,
              color: roundIdx === i ? "#efe6d3" : "#8a8266",
              background: roundIdx === i ? "#1f4733" : "#f7f1e4",
              border: `1px solid ${roundIdx === i ? "#1f4733" : "#d8ccae"}`,
              borderRadius: 16, padding: "6px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {label === "Coppa" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={13} height={13}>
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/>
                <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>
              </svg>
            )}
            {label}
          </div>
        ))}
      </div>

      {/* Scroll-snap bracket pages */}
      <div
        ref={scrollRef}
        style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", height: 472 }}
      >
        {/* One page per round */}
        {rounds.map((round: CoppaRound, ri: number) => (
          <RoundPage key={round.name} round={round} tbd={tbd} roundIndex={ri} totalRounds={rounds.length} />
        ))}

        {/* Campione page */}
        <div style={{ flexShrink: 0, width: 372, scrollSnapAlign: "start" }}>
          <div style={{ position: "relative", width: 372, height: 424, margin: "14px 0 0" }}>
            {/* Incoming connector */}
            <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 372 424" fill="none" stroke={champion ? "#2e6047" : "#d8ccae"} strokeWidth={1.6} strokeDasharray={!champion ? "4 3" : undefined}>
              <path d="M0,212 H58" />
            </svg>
            {/* Champion card */}
            {champion ? (
              <div style={{ position: "absolute", left: 58, width: 256, top: 164, background: "#15301f", color: "#efe6d3", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4 }}>
                <span style={{ color: "#e6b84d" }}><IconTrophy /></span>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".11em", color: "rgba(239,230,211,.6)" }}>Campione</div>
                <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 20, lineHeight: 1.1 }}>{champion.team_name}</div>
                <div style={{ fontSize: 9.5, color: "rgba(239,230,211,.6)", marginTop: 2 }}>vince la Coppa</div>
              </div>
            ) : (
              <div style={{ position: "absolute", left: 58, width: 256, top: 164, background: "rgba(216,204,174,.35)", border: "1.5px dashed #d8ccae", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4 }}>
                <span style={{ color: "#b8ac94" }}><IconTrophy /></span>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".11em", color: "#8a8266" }}>Campione</div>
                <div style={{ fontFamily: "var(--disp)", fontStyle: "italic", fontSize: 16, color: "#8a8266", lineHeight: 1.1 }}>da assegnare</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 9, color: "#8a8266", padding: "8px 0 12px", letterSpacing: ".03em" }}>
        scorri o tocca un turno · i rami proseguono nella schermata accanto
      </div>
    </div>
  );
}

// ─── Round page (Semifinali / Finale) ─────────────────────────────────────────
function RoundPage({ round, tbd, roundIndex, totalRounds }: { round: CoppaRound; tbd: boolean; roundIndex: number; totalRounds: number }) {
  const isFirst = roundIndex === 0;
  const isLast = roundIndex === totalRounds - 1;
  const n = round.matches.length; // 2 per SF, 1 per Finale

  // Y centers for matches (canvas 424px)
  // 2 matches: top=60 (cy=92), top=300 (cy=332)
  // 1 match: top=180 (cy=212)
  const matchTops = n === 2 ? [60, 300] : [180];
  const matchCenters = matchTops.map((t) => t + 32);

  const strokeColor = "#d8ccae";
  const strokeDash = tbd ? "4 3" : undefined;

  // SVG connector paths
  // Incoming (from left): from previous round right edge → match left edge (x=66)
  // Outgoing (to right): from match right edge (x=306) → merge → right edge (x=372)
  let svgPaths: string[] = [];

  if (!isFirst) {
    // Incoming lines
    matchCenters.forEach((cy) => {
      svgPaths.push(`M0,${cy} H66`);
    });
  }
  if (!isLast) {
    // Outgoing merge
    if (n === 2) {
      const [cy1, cy2] = matchCenters;
      const mid = (cy1! + cy2!) / 2;
      svgPaths.push(`M306,${cy1} H338 M306,${cy2} H338 M338,${cy1} V${cy2} M338,${mid} H372`);
    } else {
      svgPaths.push(`M306,${matchCenters[0]} H372`);
    }
  } else {
    // Last round outgoing (to campione tab) — green if won
    svgPaths.push(`M306,${matchCenters[0]} H372`);
  }

  return (
    <div style={{ flexShrink: 0, width: 372, scrollSnapAlign: "start" }}>
      <div style={{ position: "relative", width: 372, height: 424, margin: "14px 0 0" }}>
        <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 372 424" fill="none" stroke={strokeColor} strokeWidth={1.6} strokeDasharray={strokeDash}>
          {svgPaths.map((d, i) => <path key={i} d={d} />)}
        </svg>
        {round.matches.map((match, mi) => (
          <div key={mi} style={{ position: "absolute", top: matchTops[mi] }}>
            <BracketMatch match={match} tbd={tbd} />
          </div>
        ))}
        {/* Spareggio note */}
        {round.matches.map((match, mi) =>
          match.spareggio_note ? (
            <div key={`note-${mi}`} style={{ position: "absolute", left: 78, top: (matchTops[mi] ?? 0) + 68, fontSize: 9, color: "#e2554e", letterSpacing: ".02em" }}>
              {match.spareggio_note}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─── CoppaPage ────────────────────────────────────────────────────────────────
export default function CoppaPage() {
  const rawParams = useParams<{ competitionId: string }>();
  // Wouter v3 con component-prop può restituire il template (":competitionId")
  // come stringa truthy durante la navigazione SPA — va filtrato
  const competitionId = rawParams.competitionId?.startsWith(":")
    ? undefined
    : rawParams.competitionId;

  const search = useSearch();
  const params = new URLSearchParams(search);
  const initTab = params.get("tab") === "tabellone" ? "tabellone" : "gironi";
  const [tab, setTab] = useState<"gironi" | "tabellone">(initTab);

  const { data, isLoading, isError } = useGetCompetitionCoppa(competitionId ?? "");

  if (!competitionId) return null;

  return (
    <div style={{ minHeight: "100dvh", background: "#cfc6ad", fontFamily: "var(--mono)", padding: "24px 12px 48px", overflowX: "auto" }}>
      <div style={{ width: 390, margin: "0 auto", background: "#efe6d3", border: "9px solid #2a2a2a", borderRadius: 36, overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 828, position: "relative" }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px 8px" }}>
            <button onClick={() => window.history.back()} style={{ background: "none", border: "none", padding: 0, color: "#1f4733", display: "flex", cursor: "pointer" }}>
              <IconBack />
            </button>
            <span style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 18, color: "#1f4733" }}>
              {data?.name ?? "Coppa"}
            </span>
            <span style={{ marginLeft: "auto", color: "#8a8266", display: "flex" }}><IconGear /></span>
          </div>

          {/* Phase switch */}
          <div style={{ display: "flex", gap: 8, padding: "4px 16px 12px", borderBottom: "1px solid #d8ccae" }}>
            {(["gironi", "tabellone"] as const).map((t) => (
              <div
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontFamily: "var(--disp)", fontWeight: 600, fontSize: 13,
                  color: tab === t ? "#efe6d3" : "#8a8266",
                  background: tab === t ? "#1f4733" : "#f7f1e4",
                  border: `1px solid ${tab === t ? "#1f4733" : "#d8ccae"}`,
                  borderRadius: 16, padding: "7px 20px", cursor: "pointer",
                }}
              >
                {t === "gironi" ? "Gironi" : "Tabellone"}
              </div>
            ))}
          </div>

          {/* Loading / error */}
          {isLoading && <div style={{ padding: "40px 18px", textAlign: "center", color: "#8a8266", fontSize: 13 }}>Caricamento…</div>}
          {isError && <div style={{ padding: "40px 18px", textAlign: "center", color: "#8a8266", fontSize: 13 }}>Errore nel caricamento.</div>}

          {/* Content */}
          {data && tab === "gironi" && (
            <TabGironi gironi={data.gironi} onGoTabellone={() => setTab("tabellone")} />
          )}
          {data && tab === "tabellone" && (
            <TabTabellone tabellone={data.tabellone} lega={data.league_name} nTeams={data.n_teams} />
          )}

          {/* Bottom tabs */}
          <div style={{ marginTop: "auto" }}>
            <BottomTabs />
          </div>
        </div>
      </div>
    </div>
  );
}
