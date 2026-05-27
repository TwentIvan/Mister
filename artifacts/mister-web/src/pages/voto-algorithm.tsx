import { useState } from "react";
import { useListVotoAlgorithmConfigs } from "@workspace/api-client-react";
import type { VotoAlgorithmConfig } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, RotateCcw, BarChart2 } from "lucide-react";

type VotoMisterConfig = {
  anchor: number;
  minutes: { threshold: number; fullSample: number; extrapolationCap: number };
  stripping: {
    goalFirst: number; goalIncremental: number; penaltyExtraOverGoal: number;
    assist: number; penaltyMissed: number; penaltyCommitted: number;
    redCardPrior: number; savePrior: number;
  };
  blend: { alphaStats: number; betaRating: number };
  stats: {
    passAccuracy: { neutral: number; weightPerPoint: number; minPasses: number };
    duelWinRate: { neutral: number; weightPerPoint: number; minDuels: number };
    dribbleSuccessRate: { neutral: number; weightPerPoint: number; minAttempts: number };
    keyPass: { perUnit: number; cap: number };
    tackle: { perUnit: number; cap: number };
    block: { perUnit: number; cap: number };
    interception: { perUnit: number; cap: number };
    shotOn: { perUnit: number; cap: number };
    save: { perUnit: number; cap: number };
    foulDrawn: { perUnit: number; cap: number };
    shotOffTarget: { perUnit: number; cap: number };
    foulCommitted: { perUnit: number; cap: number };
    dribbledPast: { perUnit: number; cap: number };
  };
};

// ─── Helpers tipografici ────────────────────────────────────────────────────

function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", ...style }}>
      {children}
    </span>
  );
}

// ─── Badge stato ────────────────────────────────────────────────────────────

function StatoBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 4,
        background: "var(--green-deep)", color: "white",
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      }}>attiva</span>
    );
  }
  if (status === "draft") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 4,
        background: "var(--cream)", color: "var(--ink-mid)",
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
        border: "1px solid var(--cream-dark)",
      }}>bozza</span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 4,
      background: "var(--paper)", color: "var(--ink-dim)",
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      border: "1px solid var(--border)",
    }}>archiviata</span>
  );
}

// ─── Selettore versione ─────────────────────────────────────────────────────

function VersionSelector({
  configs,
  selected,
  onChange,
}: {
  configs: VotoAlgorithmConfig[];
  selected: VotoAlgorithmConfig;
  onChange: (cfg: VotoAlgorithmConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  const active = configs.filter(c => c.status === "active");
  const drafts = configs.filter(c => c.status === "draft");
  const archived = configs.filter(c => c.status === "archived");

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px",
          background: "var(--surface)", border: "1px solid var(--border-strong)",
          borderRadius: 6, cursor: "pointer",
          fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)",
        }}
      >
        <Mono>{selected.version}</Mono>
        <StatoBadge status={selected.status} />
        <ChevronDown size={14} style={{ color: "var(--ink-dim)" }} />
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(10,31,23,0.12)",
            minWidth: 220, overflow: "hidden",
          }}>
            {active.length > 0 && (
              <>
                <div style={{
                  padding: "6px 12px 4px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                }}>Attiva</div>
                {active.map(c => (
                  <button key={c.id} onClick={() => { onChange(c); setOpen(false); }} style={dropdownItemStyle(c.id === selected.id)}>
                    <Mono>{c.version}</Mono>
                    <StatoBadge status={c.status} />
                  </button>
                ))}
              </>
            )}
            {drafts.length > 0 && (
              <>
                <div style={{
                  padding: "8px 12px 4px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  borderTop: "1px solid var(--border)",
                }}>Bozze</div>
                {drafts.map(c => (
                  <button key={c.id} onClick={() => { onChange(c); setOpen(false); }} style={dropdownItemStyle(c.id === selected.id)}>
                    <Mono>{c.version}</Mono>
                    <StatoBadge status={c.status} />
                  </button>
                ))}
              </>
            )}
            {archived.length > 0 && (
              <>
                <div style={{
                  padding: "8px 12px 4px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  borderTop: "1px solid var(--border)",
                }}>Archivio</div>
                {archived.map(c => (
                  <button key={c.id} onClick={() => { onChange(c); setOpen(false); }} style={dropdownItemStyle(c.id === selected.id)}>
                    <Mono>{c.version}</Mono>
                    <StatoBadge status={c.status} />
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function dropdownItemStyle(isSelected: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 12px",
    background: isSelected ? "var(--green-pale)" : "transparent",
    border: "none", cursor: "pointer", textAlign: "left",
    fontFamily: "var(--font-sans)", fontSize: 13,
    color: isSelected ? "var(--green-deep)" : "var(--ink)",
  };
}

// ─── Riga form parametro ────────────────────────────────────────────────────

interface ParamRowProps {
  label: string;
  desc: string;
  value: number;
  defaultValue: number;
}

function ParamRow({ label, desc, value, defaultValue }: ParamRowProps) {
  const isModified = value !== defaultValue;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 120px 36px",
      gap: 12, alignItems: "start",
      padding: "10px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
          {desc}{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>(default: {defaultValue})</span>
        </div>
      </div>
      <input
        readOnly
        value={value}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          padding: "5px 8px",
          border: isModified ? "1px solid var(--green-mid)" : "1px solid var(--border-strong)",
          borderRadius: 4, background: "var(--paper)", color: "var(--ink)",
          textAlign: "right", width: "100%",
        }}
      />
      <button
        disabled
        title="Reimposta default"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 4,
          background: "transparent", border: "1px solid var(--border)",
          cursor: "not-allowed", color: "var(--ink-dim)", opacity: 0.5,
        }}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

// ─── Sezione ─────────────────────────────────────────────────────────────────

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--ink-dim)",
        fontFamily: "var(--font-mono)", marginBottom: 4,
        paddingBottom: 4, borderBottom: "1px solid var(--border)",
      }}>{titolo}</div>
      {children}
    </div>
  );
}

// ─── Tab 1: Calibrazione base ────────────────────────────────────────────────

function TabCalibrazione({ cfg }: { cfg: VotoMisterConfig }) {
  const def: VotoMisterConfig = DEFAULT_CONFIG;
  return (
    <div>
      <Sezione titolo="Anchor">
        <ParamRow
          label="Anchor (sufficienza italiana)"
          desc="Voto di partenza prima di applicare modificatori."
          value={cfg.anchor} defaultValue={def.anchor}
        />
      </Sezione>
      <Sezione titolo="Minuti giocati">
        <ParamRow
          label="Soglia minuti minimi"
          desc="Sotto questo numero di minuti il voto non viene calcolato."
          value={cfg.minutes.threshold} defaultValue={def.minutes.threshold}
        />
        <ParamRow
          label="Minuti per voto pieno"
          desc="Da questa soglia in su il giocatore conta come titolare intero."
          value={cfg.minutes.fullSample} defaultValue={def.minutes.fullSample}
        />
        <ParamRow
          label="Limite estrapolazione subentranti"
          desc="Cap moltiplicativo al riscalamento per partite parziali."
          value={cfg.minutes.extrapolationCap} defaultValue={def.minutes.extrapolationCap}
        />
      </Sezione>
      <Sezione titolo="Blend voto">
        <ParamRow
          label="Peso componente stat (α)"
          desc="Quota del voto basata sulle statistiche pure. α + β = 1."
          value={cfg.blend.alphaStats} defaultValue={def.blend.alphaStats}
        />
        <ParamRow
          label="Peso componente rating (β)"
          desc="Quota del voto basata sul rating grezzo API-Football."
          value={cfg.blend.betaRating} defaultValue={def.blend.betaRating}
        />
      </Sezione>
    </div>
  );
}

// ─── Tab 2: Stripping eventi ─────────────────────────────────────────────────

function TabStripping({ cfg }: { cfg: VotoMisterConfig }) {
  const def = DEFAULT_CONFIG;
  return (
    <div>
      <Sezione titolo="Gol e assist">
        <ParamRow
          label="Stripping primo gol"
          desc="Punti rimossi dal rating per il primo gol segnato."
          value={cfg.stripping.goalFirst} defaultValue={def.stripping.goalFirst}
        />
        <ParamRow
          label="Stripping gol successivi"
          desc="Punti rimossi per ogni gol dopo il primo."
          value={cfg.stripping.goalIncremental} defaultValue={def.stripping.goalIncremental}
        />
        <ParamRow
          label="Stripping extra rigore su gol"
          desc="Delta aggiuntivo rimosso per gol su rigore."
          value={cfg.stripping.penaltyExtraOverGoal} defaultValue={def.stripping.penaltyExtraOverGoal}
        />
        <ParamRow
          label="Stripping assist"
          desc="Punti rimossi dal rating per ogni assist fornito."
          value={cfg.stripping.assist} defaultValue={def.stripping.assist}
        />
      </Sezione>
      <Sezione titolo="Rigori">
        <ParamRow
          label="Stripping rigore sbagliato"
          desc="Punti rimossi per rigore calciato e non trasformato."
          value={cfg.stripping.penaltyMissed} defaultValue={def.stripping.penaltyMissed}
        />
        <ParamRow
          label="Stripping rigore commesso"
          desc="Punti rimossi per fallo da rigore causato."
          value={cfg.stripping.penaltyCommitted} defaultValue={def.stripping.penaltyCommitted}
        />
        <ParamRow
          label="Stripping neutralizzazione rigore"
          desc="Punti rimossi dal rating per parata su rigore (verrà reintegrato come stat)."
          value={cfg.stripping.savePrior} defaultValue={def.stripping.savePrior}
        />
      </Sezione>
      <Sezione titolo="Cartellini">
        <ParamRow
          label="Stripping espulsione"
          desc="Punti rimossi dal rating per cartellino rosso ricevuto."
          value={cfg.stripping.redCardPrior} defaultValue={def.stripping.redCardPrior}
        />
      </Sezione>
    </div>
  );
}

// ─── Tab 3: Pesi performance ─────────────────────────────────────────────────

function TabPerformance({ cfg }: { cfg: VotoMisterConfig }) {
  const def = DEFAULT_CONFIG;
  const s = cfg.stats;
  const d = def.stats;
  return (
    <div>
      <Sezione titolo="Indicatori di qualità">
        <ParamRow
          label="Precisione passaggi — neutro"
          desc="Valore % considerato neutro (sotto non penalizza, sopra non premia)."
          value={s.passAccuracy.neutral} defaultValue={d.passAccuracy.neutral}
        />
        <ParamRow
          label="Precisione passaggi — peso per punto"
          desc="Punti aggiunti/rimossi per ogni punto % sopra/sotto il neutro."
          value={s.passAccuracy.weightPerPoint} defaultValue={d.passAccuracy.weightPerPoint}
        />
        <ParamRow
          label="Precisione passaggi — minimo passaggi"
          desc="Soglia minima di passaggi tentati per attivare il calcolo."
          value={s.passAccuracy.minPasses} defaultValue={d.passAccuracy.minPasses}
        />

        <ParamRow
          label="Duelli vinti — neutro"
          desc="Percentuale di duelli vinti considerata pareggio."
          value={s.duelWinRate.neutral} defaultValue={d.duelWinRate.neutral}
        />
        <ParamRow
          label="Duelli vinti — peso per punto"
          desc="Punti aggiunti per ogni punto % sopra il neutro."
          value={s.duelWinRate.weightPerPoint} defaultValue={d.duelWinRate.weightPerPoint}
        />
        <ParamRow
          label="Duelli vinti — minimo duelli"
          desc="Soglia minima di duelli affrontati per attivare il calcolo."
          value={s.duelWinRate.minDuels} defaultValue={d.duelWinRate.minDuels}
        />

        <ParamRow
          label="Dribbling riusciti — neutro"
          desc="Percentuale di dribbling riusciti considerata neutro."
          value={s.dribbleSuccessRate.neutral} defaultValue={d.dribbleSuccessRate.neutral}
        />
        <ParamRow
          label="Dribbling riusciti — peso per punto"
          desc="Punti aggiunti per ogni punto % sopra il neutro."
          value={s.dribbleSuccessRate.weightPerPoint} defaultValue={d.dribbleSuccessRate.weightPerPoint}
        />
        <ParamRow
          label="Dribbling riusciti — minimo tentativi"
          desc="Soglia minima di dribbling tentati per attivare il calcolo."
          value={s.dribbleSuccessRate.minAttempts} defaultValue={d.dribbleSuccessRate.minAttempts}
        />
      </Sezione>

      <Sezione titolo="Contributi di volume">
        <ParamRow
          label="Passaggio chiave — per unità"
          desc="Punti aggiunti per ogni key pass effettuato."
          value={s.keyPass.perUnit} defaultValue={d.keyPass.perUnit}
        />
        <ParamRow
          label="Passaggio chiave — cap"
          desc="Bonus massimo accumulabile dai passaggi chiave."
          value={s.keyPass.cap} defaultValue={d.keyPass.cap}
        />

        <ParamRow
          label="Contrasto — per unità"
          desc="Punti aggiunti per ogni tackle riuscito."
          value={s.tackle.perUnit} defaultValue={d.tackle.perUnit}
        />
        <ParamRow
          label="Contrasto — cap"
          desc="Bonus massimo accumulabile dai contrasti."
          value={s.tackle.cap} defaultValue={d.tackle.cap}
        />

        <ParamRow
          label="Blocco tiro — per unità"
          desc="Punti aggiunti per ogni tiro bloccato."
          value={s.block.perUnit} defaultValue={d.block.perUnit}
        />
        <ParamRow
          label="Blocco tiro — cap"
          desc="Bonus massimo accumulabile dai blocchi."
          value={s.block.cap} defaultValue={d.block.cap}
        />

        <ParamRow
          label="Intercettazione — per unità"
          desc="Punti aggiunti per ogni intercettazione."
          value={s.interception.perUnit} defaultValue={d.interception.perUnit}
        />
        <ParamRow
          label="Intercettazione — cap"
          desc="Bonus massimo accumulabile dalle intercettazioni."
          value={s.interception.cap} defaultValue={d.interception.cap}
        />

        <ParamRow
          label="Tiro in porta — per unità"
          desc="Punti aggiunti per ogni tiro nello specchio (portieri esclusi)."
          value={s.shotOn.perUnit} defaultValue={d.shotOn.perUnit}
        />
        <ParamRow
          label="Tiro in porta — cap"
          desc="Bonus massimo accumulabile dai tiri in porta."
          value={s.shotOn.cap} defaultValue={d.shotOn.cap}
        />

        <ParamRow
          label="Parata — per unità"
          desc="Punti aggiunti per ogni parata del portiere."
          value={s.save.perUnit} defaultValue={d.save.perUnit}
        />
        <ParamRow
          label="Parata — cap"
          desc="Bonus massimo accumulabile dalle parate."
          value={s.save.cap} defaultValue={d.save.cap}
        />

        <ParamRow
          label="Fallo subito — per unità"
          desc="Punti aggiunti per ogni fallo subito (indicatore di aggressività offensiva)."
          value={s.foulDrawn.perUnit} defaultValue={d.foulDrawn.perUnit}
        />
        <ParamRow
          label="Fallo subito — cap"
          desc="Bonus massimo accumulabile dai falli subiti."
          value={s.foulDrawn.cap} defaultValue={d.foulDrawn.cap}
        />
      </Sezione>

      <Sezione titolo="Penalità">
        <ParamRow
          label="Tiro fuori — per unità"
          desc="Penalità per ogni tiro fuori dallo specchio (valore negativo)."
          value={s.shotOffTarget.perUnit} defaultValue={d.shotOffTarget.perUnit}
        />
        <ParamRow
          label="Tiro fuori — cap"
          desc="Penalità massima accumulabile dai tiri fuori (valore negativo)."
          value={s.shotOffTarget.cap} defaultValue={d.shotOffTarget.cap}
        />

        <ParamRow
          label="Fallo commesso — per unità"
          desc="Penalità per ogni fallo commesso."
          value={s.foulCommitted.perUnit} defaultValue={d.foulCommitted.perUnit}
        />
        <ParamRow
          label="Fallo commesso — cap"
          desc="Penalità massima accumulabile dai falli commessi."
          value={s.foulCommitted.cap} defaultValue={d.foulCommitted.cap}
        />

        <ParamRow
          label="Dribbling subito — per unità"
          desc="Penalità per ogni dribbling subito da un avversario."
          value={s.dribbledPast.perUnit} defaultValue={d.dribbledPast.perUnit}
        />
        <ParamRow
          label="Dribbling subito — cap"
          desc="Penalità massima accumulabile dai dribbling subiti."
          value={s.dribbledPast.cap} defaultValue={d.dribbledPast.cap}
        />
      </Sezione>
    </div>
  );
}

// ─── Config default (valori v1.0 per confronto) ───────────────────────────────

const DEFAULT_CONFIG: VotoMisterConfig = {
  anchor: 6.0,
  minutes: { threshold: 15, fullSample: 60, extrapolationCap: 1.5 },
  stripping: {
    goalFirst: 1.0, goalIncremental: 1.0, penaltyExtraOverGoal: 0.5,
    assist: 0.5, penaltyMissed: 0.5, penaltyCommitted: 0.5,
    redCardPrior: 1.0, savePrior: 1.0,
  },
  blend: { alphaStats: 0.35, betaRating: 0.65 },
  stats: {
    passAccuracy: { neutral: 80, weightPerPoint: 0.012, minPasses: 10 },
    duelWinRate: { neutral: 51, weightPerPoint: 0.008, minDuels: 5 },
    dribbleSuccessRate: { neutral: 57, weightPerPoint: 0.005, minAttempts: 2 },
    keyPass: { perUnit: 0.12, cap: 0.60 },
    tackle: { perUnit: 0.08, cap: 0.48 },
    block: { perUnit: 0.10, cap: 0.40 },
    interception: { perUnit: 0.10, cap: 0.50 },
    shotOn: { perUnit: 0.10, cap: 0.50 },
    save: { perUnit: 0.15, cap: 1.05 },
    foulDrawn: { perUnit: 0.05, cap: 0.20 },
    shotOffTarget: { perUnit: -0.03, cap: -0.15 },
    foulCommitted: { perUnit: -0.04, cap: -0.20 },
    dribbledPast: { perUnit: -0.10, cap: -0.40 },
  },
};

// ─── Pagina principale ───────────────────────────────────────────────────────

const TABS = [
  { id: "calibrazione", label: "Calibrazione base" },
  { id: "stripping", label: "Stripping eventi" },
  { id: "performance", label: "Pesi performance" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function VotoAlgorithm() {
  const { data: configs, isLoading, error } = useListVotoAlgorithmConfigs();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("calibrazione");

  if (isLoading) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <Skeleton style={{ height: 40, width: 280, marginBottom: 8 }} />
        <Skeleton style={{ height: 20, width: 420, marginBottom: 32 }} />
        <Skeleton style={{ height: 120, width: "100%", marginBottom: 16 }} />
        <Skeleton style={{ height: 400, width: "100%" }} />
      </div>
    );
  }

  if (error || !configs) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <p style={{ color: "var(--danger)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Errore nel caricamento delle configurazioni.
        </p>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--green-deep)", marginBottom: 8 }}>
          Algoritmo voto
        </h1>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: 24, background: "var(--paper)",
          border: "1px dashed var(--border-strong)", borderRadius: 6, marginTop: 32,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Nessuna configurazione trovata</div>
            <div style={{ fontSize: 13, color: "var(--ink-mid)", marginTop: 4 }}>
              Esegui il seed del database: <Mono>pnpm --filter @workspace/db run seed</Mono>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selected = configs.find(c => c.id === selectedId) ?? configs.find(c => c.status === "active") ?? configs[0];
  const rawCfg = selected.configJson as unknown as VotoMisterConfig;

  const isSystem = (selected as VotoAlgorithmConfig & { isProtected?: boolean }).isProtected;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900 }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600,
          color: "var(--green-deep)", marginBottom: 6, lineHeight: 1.15,
        }}>
          Algoritmo voto
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-mid)", maxWidth: 560 }}>
          Pesi e soglie che producono il voto base Mister.
          Le modifiche non hanno effetto finché non si attiva una versione.
        </p>
      </header>

      {/* ── Versione corrente + selettore ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "16px 20px", marginBottom: 24,
        boxShadow: "0 1px 2px rgba(10,31,23,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-dim)", fontWeight: 500 }}>
                Versione visualizzata:
              </span>
              <Mono style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{selected.version}</Mono>
              <StatoBadge status={selected.status} />
              {isSystem && (
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                  fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  background: "var(--cream)", color: "var(--ink-mid)",
                  border: "1px solid var(--cream-dark)",
                }}>sistema</span>
              )}
            </div>
            {selected.notes && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-mid)", maxWidth: 560, lineHeight: 1.5 }}>
                {selected.notes}
              </p>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
              <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                id: {selected.id}
              </span>
              {selected.createdBy && (
                <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                  creato da: {selected.createdBy}
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                {new Date(selected.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          <VersionSelector
            configs={configs}
            selected={selected}
            onChange={c => setSelectedId(c.id)}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--border)",
        marginBottom: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 18px",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
              border: "none", background: "transparent", cursor: "pointer",
              color: activeTab === tab.id ? "var(--green-deep)" : "var(--ink-mid)",
              borderBottom: activeTab === tab.id ? "2px solid var(--green-deep)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 80ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderTop: "none", borderRadius: "0 0 8px 8px",
        padding: "20px 24px", marginBottom: 32,
      }}>
        {activeTab === "calibrazione" && <TabCalibrazione cfg={rawCfg} />}
        {activeTab === "stripping" && <TabStripping cfg={rawCfg} />}
        {activeTab === "performance" && <TabPerformance cfg={rawCfg} />}
      </div>

      {/* ── Note versione ── */}
      <div style={{ marginBottom: 32 }}>
        <label style={{
          display: "block", fontFamily: "var(--font-sans)", fontSize: 12,
          fontWeight: 500, color: "var(--ink-mid)", marginBottom: 6,
        }}>
          Note sulla versione
        </label>
        <textarea
          readOnly
          value={selected.notes ?? ""}
          rows={3}
          placeholder="Nessuna nota per questa versione."
          style={{
            width: "100%", fontFamily: "var(--font-sans)", fontSize: 13,
            padding: "8px 12px", border: "1px solid var(--border-strong)",
            borderRadius: 6, background: "var(--paper)", color: "var(--ink)",
            resize: "vertical", lineHeight: 1.5,
          }}
        />
      </div>

      {/* ── Azioni (disabilitate — Batch 1) ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingTop: 20, borderTop: "1px solid var(--border)",
      }}>
        <button
          disabled
          style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            padding: "7px 16px", borderRadius: 4,
            background: "var(--surface)", color: "var(--ink-dim)",
            border: "1px solid var(--border-strong)", cursor: "not-allowed", opacity: 0.55,
          }}
        >
          Salva come bozza
        </button>
        <button
          disabled
          style={{
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            padding: "7px 16px", borderRadius: 4,
            background: "var(--green-deep)", color: "white",
            border: "1px solid var(--green-deep)", cursor: "not-allowed", opacity: 0.55,
          }}
        >
          Salva e attiva
        </button>
        <div style={{ flex: 1 }} />
        <button
          disabled
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            padding: "7px 16px", borderRadius: 4,
            background: "transparent", color: "var(--ink-dim)",
            border: "1px solid var(--border-strong)", cursor: "not-allowed", opacity: 0.55,
          }}
        >
          <BarChart2 size={14} />
          Ricalcola voti stagione corrente
        </button>
      </div>
    </div>
  );
}
