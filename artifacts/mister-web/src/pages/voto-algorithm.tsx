import { useState, useEffect, useCallback } from "react";
import {
  useListVotoAlgorithmConfigs,
  useCreateVotoAlgorithmConfig,
  useUpdateVotoAlgorithmConfig,
  useRecalculateVotoMister,
  getListVotoAlgorithmConfigsQueryKey,
} from "@workspace/api-client-react";
import type { VotoAlgorithmConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, RotateCcw, BarChart2, AlertCircle } from "lucide-react";

// ─── Tipo locale VotoMisterConfig ──────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", ...style }}>
      {children}
    </span>
  );
}

function StatoBadge({ status }: { status: string }) {
  if (status === "active") return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, background: "var(--green-deep)", color: "white", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500 }}>attiva</span>
  );
  if (status === "draft") return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, background: "var(--cream)", color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, border: "1px solid var(--cream-dark)" }}>bozza</span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, background: "var(--paper)", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, border: "1px solid var(--border)" }}>archiviata</span>
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

// ─── Selettore versione ─────────────────────────────────────────────────────

function VersionSelector({ configs, selected, onChange, disabled }: {
  configs: VotoAlgorithmConfig[];
  selected: VotoAlgorithmConfig;
  onChange: (cfg: VotoAlgorithmConfig) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = configs.filter(c => c.status === "active");
  const drafts = configs.filter(c => c.status === "draft");
  const archived = configs.filter(c => c.status === "archived");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px",
          background: "var(--surface)", border: "1px solid var(--border-strong)",
          borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Mono>{selected.version}</Mono>
        <StatoBadge status={selected.status} />
        <ChevronDown size={14} style={{ color: "var(--ink-dim)" }} />
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(10,31,23,0.12)",
            minWidth: 220, overflow: "hidden",
          }}>
            {[
              { label: "Attiva", items: active },
              { label: "Bozze", items: drafts },
              { label: "Archivio", items: archived },
            ].map(({ label, items }, idx) => items.length > 0 && (
              <div key={label}>
                <div style={{
                  padding: idx === 0 ? "6px 12px 4px" : "8px 12px 4px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  ...(idx > 0 ? { borderTop: "1px solid var(--border)" } : {}),
                }}>{label}</div>
                {items.map(c => (
                  <button key={c.id} onClick={() => { onChange(c); setOpen(false); }}
                    style={dropdownItemStyle(c.id === selected.id)}>
                    <Mono>{c.version}</Mono>
                    <StatoBadge status={c.status} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Riga form parametro ─────────────────────────────────────────────────────

interface ParamRowProps {
  label: string;
  desc: string;
  value: number;
  defaultValue: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function ParamRow({ label, desc, value, defaultValue, step = 0.01, onChange, disabled }: ParamRowProps) {
  const isModified = value !== defaultValue;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 120px 36px",
      gap: 12, alignItems: "start",
      padding: "10px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
          {desc}{" "}
          <Mono style={{ fontSize: 11 }}>(default: {defaultValue})</Mono>
        </div>
      </div>
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontVariantNumeric: "tabular-nums",
          padding: "5px 8px",
          border: isModified ? "1px solid var(--green-mid)" : "1px solid var(--border-strong)",
          borderRadius: 4, background: disabled ? "var(--paper)" : "var(--surface)",
          color: "var(--ink)", textAlign: "right", width: "100%",
        }}
      />
      <button
        onClick={() => onChange(defaultValue)}
        disabled={disabled || value === defaultValue}
        title="Reimposta default"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 4,
          background: "transparent", border: "1px solid var(--border)",
          cursor: disabled || value === defaultValue ? "not-allowed" : "pointer",
          color: "var(--ink-dim)", opacity: disabled || value === defaultValue ? 0.4 : 1,
          transition: "opacity 80ms",
        }}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--ink-dim)", fontFamily: "var(--font-mono)",
        marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid var(--border)",
      }}>{titolo}</div>
      {children}
    </div>
  );
}

// ─── Tab 1: Calibrazione base ────────────────────────────────────────────────

function TabCalibrazione({ cfg, def, onChange, disabled }: {
  cfg: VotoMisterConfig; def: VotoMisterConfig;
  onChange: (c: VotoMisterConfig) => void; disabled?: boolean;
}) {
  const set = (patch: Partial<VotoMisterConfig>) => onChange({ ...cfg, ...patch });
  const setMinutes = (patch: Partial<VotoMisterConfig["minutes"]>) => set({ minutes: { ...cfg.minutes, ...patch } });
  const setBlend = (patch: Partial<VotoMisterConfig["blend"]>) => set({ blend: { ...cfg.blend, ...patch } });

  return (
    <div>
      <Sezione titolo="Anchor">
        <ParamRow label="Anchor (sufficienza italiana)" desc="Voto di partenza prima di applicare modificatori."
          value={cfg.anchor} defaultValue={def.anchor} step={0.1}
          onChange={v => set({ anchor: v })} disabled={disabled} />
      </Sezione>
      <Sezione titolo="Minuti giocati">
        <ParamRow label="Soglia minuti minimi" desc="Sotto questo numero di minuti il voto non viene calcolato."
          value={cfg.minutes.threshold} defaultValue={def.minutes.threshold} step={1}
          onChange={v => setMinutes({ threshold: v })} disabled={disabled} />
        <ParamRow label="Minuti per voto pieno" desc="Da questa soglia in su il giocatore conta come titolare intero."
          value={cfg.minutes.fullSample} defaultValue={def.minutes.fullSample} step={1}
          onChange={v => setMinutes({ fullSample: v })} disabled={disabled} />
        <ParamRow label="Limite estrapolazione subentranti" desc="Cap moltiplicativo al riscalamento per partite parziali."
          value={cfg.minutes.extrapolationCap} defaultValue={def.minutes.extrapolationCap} step={0.1}
          onChange={v => setMinutes({ extrapolationCap: v })} disabled={disabled} />
      </Sezione>
      <Sezione titolo="Blend voto">
        <ParamRow label="Peso componente stat (α)" desc="Quota del voto basata sulle statistiche pure. α + β = 1."
          value={cfg.blend.alphaStats} defaultValue={def.blend.alphaStats} step={0.05}
          onChange={v => setBlend({ alphaStats: v })} disabled={disabled} />
        <ParamRow label="Peso componente rating (β)" desc="Quota del voto basata sul rating grezzo API-Football."
          value={cfg.blend.betaRating} defaultValue={def.blend.betaRating} step={0.05}
          onChange={v => setBlend({ betaRating: v })} disabled={disabled} />
      </Sezione>
    </div>
  );
}

// ─── Tab 2: Stripping eventi ─────────────────────────────────────────────────

function TabStripping({ cfg, def, onChange, disabled }: {
  cfg: VotoMisterConfig; def: VotoMisterConfig;
  onChange: (c: VotoMisterConfig) => void; disabled?: boolean;
}) {
  const setStrip = (patch: Partial<VotoMisterConfig["stripping"]>) =>
    onChange({ ...cfg, stripping: { ...cfg.stripping, ...patch } });

  return (
    <div>
      <Sezione titolo="Gol e assist">
        <ParamRow label="Stripping primo gol" desc="Punti rimossi dal rating per il primo gol segnato."
          value={cfg.stripping.goalFirst} defaultValue={def.stripping.goalFirst} step={0.1}
          onChange={v => setStrip({ goalFirst: v })} disabled={disabled} />
        <ParamRow label="Stripping gol successivi" desc="Punti rimossi per ogni gol dopo il primo."
          value={cfg.stripping.goalIncremental} defaultValue={def.stripping.goalIncremental} step={0.1}
          onChange={v => setStrip({ goalIncremental: v })} disabled={disabled} />
        <ParamRow label="Stripping extra rigore su gol" desc="Delta aggiuntivo rimosso per gol su rigore."
          value={cfg.stripping.penaltyExtraOverGoal} defaultValue={def.stripping.penaltyExtraOverGoal} step={0.1}
          onChange={v => setStrip({ penaltyExtraOverGoal: v })} disabled={disabled} />
        <ParamRow label="Stripping assist" desc="Punti rimossi dal rating per ogni assist fornito."
          value={cfg.stripping.assist} defaultValue={def.stripping.assist} step={0.1}
          onChange={v => setStrip({ assist: v })} disabled={disabled} />
      </Sezione>
      <Sezione titolo="Rigori">
        <ParamRow label="Stripping rigore sbagliato" desc="Punti rimossi per rigore calciato e non trasformato."
          value={cfg.stripping.penaltyMissed} defaultValue={def.stripping.penaltyMissed} step={0.1}
          onChange={v => setStrip({ penaltyMissed: v })} disabled={disabled} />
        <ParamRow label="Stripping rigore commesso" desc="Punti rimossi per fallo da rigore causato."
          value={cfg.stripping.penaltyCommitted} defaultValue={def.stripping.penaltyCommitted} step={0.1}
          onChange={v => setStrip({ penaltyCommitted: v })} disabled={disabled} />
        <ParamRow label="Stripping neutralizzazione rigore" desc="Punti rimossi dal rating per parata su rigore."
          value={cfg.stripping.savePrior} defaultValue={def.stripping.savePrior} step={0.1}
          onChange={v => setStrip({ savePrior: v })} disabled={disabled} />
      </Sezione>
      <Sezione titolo="Cartellini">
        <ParamRow label="Stripping espulsione" desc="Punti rimossi dal rating per cartellino rosso ricevuto."
          value={cfg.stripping.redCardPrior} defaultValue={def.stripping.redCardPrior} step={0.1}
          onChange={v => setStrip({ redCardPrior: v })} disabled={disabled} />
      </Sezione>
    </div>
  );
}

// ─── Tab 3: Pesi performance ─────────────────────────────────────────────────

function TabPerformance({ cfg, def, onChange, disabled }: {
  cfg: VotoMisterConfig; def: VotoMisterConfig;
  onChange: (c: VotoMisterConfig) => void; disabled?: boolean;
}) {
  const setStats = (patch: Partial<VotoMisterConfig["stats"]>) =>
    onChange({ ...cfg, stats: { ...cfg.stats, ...patch } });

  const s = cfg.stats; const d = def.stats;

  return (
    <div>
      <Sezione titolo="Indicatori di qualità">
        <ParamRow label="Precisione passaggi — neutro" desc="Valore % considerato neutro (sopra/sotto premia/penalizza)."
          value={s.passAccuracy.neutral} defaultValue={d.passAccuracy.neutral} step={1}
          onChange={v => setStats({ passAccuracy: { ...s.passAccuracy, neutral: v } })} disabled={disabled} />
        <ParamRow label="Precisione passaggi — peso per punto" desc="Punti aggiunti/rimossi per ogni punto % sopra/sotto il neutro."
          value={s.passAccuracy.weightPerPoint} defaultValue={d.passAccuracy.weightPerPoint} step={0.001}
          onChange={v => setStats({ passAccuracy: { ...s.passAccuracy, weightPerPoint: v } })} disabled={disabled} />
        <ParamRow label="Precisione passaggi — minimo passaggi" desc="Soglia minima di passaggi tentati per attivare il calcolo."
          value={s.passAccuracy.minPasses} defaultValue={d.passAccuracy.minPasses} step={1}
          onChange={v => setStats({ passAccuracy: { ...s.passAccuracy, minPasses: v } })} disabled={disabled} />

        <ParamRow label="Duelli vinti — neutro" desc="Percentuale di duelli vinti considerata pareggio."
          value={s.duelWinRate.neutral} defaultValue={d.duelWinRate.neutral} step={1}
          onChange={v => setStats({ duelWinRate: { ...s.duelWinRate, neutral: v } })} disabled={disabled} />
        <ParamRow label="Duelli vinti — peso per punto" desc="Punti aggiunti per ogni punto % sopra il neutro."
          value={s.duelWinRate.weightPerPoint} defaultValue={d.duelWinRate.weightPerPoint} step={0.001}
          onChange={v => setStats({ duelWinRate: { ...s.duelWinRate, weightPerPoint: v } })} disabled={disabled} />
        <ParamRow label="Duelli vinti — minimo duelli" desc="Soglia minima di duelli affrontati per attivare il calcolo."
          value={s.duelWinRate.minDuels} defaultValue={d.duelWinRate.minDuels} step={1}
          onChange={v => setStats({ duelWinRate: { ...s.duelWinRate, minDuels: v } })} disabled={disabled} />

        <ParamRow label="Dribbling riusciti — neutro" desc="Percentuale di dribbling riusciti considerata neutro."
          value={s.dribbleSuccessRate.neutral} defaultValue={d.dribbleSuccessRate.neutral} step={1}
          onChange={v => setStats({ dribbleSuccessRate: { ...s.dribbleSuccessRate, neutral: v } })} disabled={disabled} />
        <ParamRow label="Dribbling riusciti — peso per punto" desc="Punti aggiunti per ogni punto % sopra il neutro."
          value={s.dribbleSuccessRate.weightPerPoint} defaultValue={d.dribbleSuccessRate.weightPerPoint} step={0.001}
          onChange={v => setStats({ dribbleSuccessRate: { ...s.dribbleSuccessRate, weightPerPoint: v } })} disabled={disabled} />
        <ParamRow label="Dribbling riusciti — minimo tentativi" desc="Soglia minima di dribbling tentati per attivare il calcolo."
          value={s.dribbleSuccessRate.minAttempts} defaultValue={d.dribbleSuccessRate.minAttempts} step={1}
          onChange={v => setStats({ dribbleSuccessRate: { ...s.dribbleSuccessRate, minAttempts: v } })} disabled={disabled} />
      </Sezione>

      <Sezione titolo="Contributi di volume">
        {([
          ["Passaggio chiave", "Punti aggiunti per ogni key pass effettuato.", "keyPass"],
          ["Contrasto", "Punti aggiunti per ogni tackle riuscito.", "tackle"],
          ["Blocco tiro", "Punti aggiunti per ogni tiro bloccato.", "block"],
          ["Intercettazione", "Punti aggiunti per ogni intercettazione.", "interception"],
          ["Tiro in porta", "Punti aggiunti per ogni tiro nello specchio.", "shotOn"],
          ["Parata", "Punti aggiunti per ogni parata del portiere.", "save"],
          ["Fallo subito", "Punti aggiunti per ogni fallo subito.", "foulDrawn"],
        ] as [string, string, keyof typeof s][]).map(([label, desc, key]) => (
          <div key={key}>
            <ParamRow label={`${label} — per unità`} desc={desc}
              value={(s[key] as { perUnit: number; cap: number }).perUnit}
              defaultValue={(d[key] as { perUnit: number; cap: number }).perUnit}
              step={0.01}
              onChange={v => setStats({ [key]: { ...(s[key] as object), perUnit: v } } as Partial<VotoMisterConfig["stats"]>)}
              disabled={disabled} />
            <ParamRow label={`${label} — cap`} desc="Bonus massimo accumulabile."
              value={(s[key] as { perUnit: number; cap: number }).cap}
              defaultValue={(d[key] as { perUnit: number; cap: number }).cap}
              step={0.01}
              onChange={v => setStats({ [key]: { ...(s[key] as object), cap: v } } as Partial<VotoMisterConfig["stats"]>)}
              disabled={disabled} />
          </div>
        ))}
      </Sezione>

      <Sezione titolo="Penalità">
        {([
          ["Tiro fuori", "Penalità per ogni tiro fuori dallo specchio (valore negativo).", "shotOffTarget"],
          ["Fallo commesso", "Penalità per ogni fallo commesso.", "foulCommitted"],
          ["Dribbling subito", "Penalità per ogni dribbling subito da un avversario.", "dribbledPast"],
        ] as [string, string, keyof typeof s][]).map(([label, desc, key]) => (
          <div key={key}>
            <ParamRow label={`${label} — per unità`} desc={desc}
              value={(s[key] as { perUnit: number; cap: number }).perUnit}
              defaultValue={(d[key] as { perUnit: number; cap: number }).perUnit}
              step={0.01}
              onChange={v => setStats({ [key]: { ...(s[key] as object), perUnit: v } } as Partial<VotoMisterConfig["stats"]>)}
              disabled={disabled} />
            <ParamRow label={`${label} — cap`} desc="Penalità massima accumulabile (valore negativo)."
              value={(s[key] as { perUnit: number; cap: number }).cap}
              defaultValue={(d[key] as { perUnit: number; cap: number }).cap}
              step={0.01}
              onChange={v => setStats({ [key]: { ...(s[key] as object), cap: v } } as Partial<VotoMisterConfig["stats"]>)}
              disabled={disabled} />
          </div>
        ))}
      </Sezione>
    </div>
  );
}

// ─── Tab navigation ──────────────────────────────────────────────────────────

const TABS = [
  { id: "calibrazione", label: "Calibrazione base" },
  { id: "stripping", label: "Stripping eventi" },
  { id: "performance", label: "Pesi performance" },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Bottone con spinner ──────────────────────────────────────────────────────

function ActionButton({
  children, onClick, disabled, variant = "secondary", loading = false,
}: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--green-deep)", color: "white", border: "1px solid var(--green-deep)" },
    secondary: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--ink-mid)", border: "1px solid var(--border-strong)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
        padding: "7px 16px", borderRadius: 4, cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.55 : 1, transition: "opacity 80ms",
        ...styles[variant],
      }}
    >
      {loading && <Spinner style={{ width: 14, height: 14 }} />}
      {children}
    </button>
  );
}

// ─── Dialog attiva versione ──────────────────────────────────────────────────

function DialogAttivaVersione({
  open, onClose, onConfirm, nomeVersione, versioneAttivaCorrente, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  nomeVersione: string; versioneAttivaCorrente: string | null; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !loading) onClose(); }}>
      <DialogContent style={{ maxWidth: 480, padding: 32 }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--green-deep)" }}>
            Attivare versione "{nomeVersione}"?
          </DialogTitle>
        </DialogHeader>
        <div style={{ marginTop: 12, fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-mid)", lineHeight: 1.6 }}>
          {versioneAttivaCorrente && (
            <p>
              La versione attualmente attiva (<Mono>{versioneAttivaCorrente}</Mono>) verrà archiviata.
            </p>
          )}
          <p style={{ marginTop: 8 }}>Tutti i nuovi voti calcolati useranno la nuova versione.</p>
          <p style={{ marginTop: 12, padding: "10px 12px", background: "var(--paper)", borderRadius: 6, fontSize: 13, color: "var(--ink-dim)", borderLeft: "3px solid var(--border-strong)" }}>
            Questo non ricalcola i voti già salvati in database. Per ricalcolare, usa il bottone "Ricalcola voti" separato.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <ActionButton onClick={onClose} disabled={loading}>Annulla</ActionButton>
          <ActionButton onClick={onConfirm} variant="primary" loading={loading}>
            Attiva versione
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog ricalcola ────────────────────────────────────────────────────────

function DialogRicalcola({
  open, onClose, onConfirm, configAttiva, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  configAttiva: VotoAlgorithmConfig | null; loading: boolean;
}) {
  const note = configAttiva?.notes ?? "";
  const notePreview = note.length > 80 ? note.slice(0, 80) + "…" : note;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !loading) onClose(); }}>
      <DialogContent style={{ maxWidth: 520, padding: 32 }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--green-deep)" }}>
            Ricalcolare i voti della stagione?
          </DialogTitle>
        </DialogHeader>
        <div style={{ marginTop: 12, fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-mid)", lineHeight: 1.6 }}>
          {configAttiva && (
            <>
              <p>Verrà usata la versione attualmente attiva: <Mono style={{ fontWeight: 600, color: "var(--ink)" }}>{configAttiva.version}</Mono></p>
              {notePreview && (
                <p style={{ marginTop: 4, fontSize: 13 }}>Note: {notePreview}</p>
              )}
            </>
          )}
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>Record</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--green-deep)" }}>623</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>Tempo stimato</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)" }}>&lt; 2s</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          {!loading && <ActionButton onClick={onClose}>Annulla</ActionButton>}
          <ActionButton onClick={onConfirm} variant="primary" loading={loading}>
            {loading ? "Ricalcolo in corso…" : "Ricalcola"}
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function VotoAlgorithm() {
  const queryClient = useQueryClient();
  const { data: configs, isLoading, error } = useListVotoAlgorithmConfigs();

  const [selectedConfig, setSelectedConfig] = useState<VotoAlgorithmConfig | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("calibrazione");

  const [formCfg, setFormCfg] = useState<VotoMisterConfig | null>(null);
  const [formVersion, setFormVersion] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [showDialogAttiva, setShowDialogAttiva] = useState(false);
  const [showDialogRicalcola, setShowDialogRicalcola] = useState(false);

  const createMutation = useCreateVotoAlgorithmConfig();
  const updateMutation = useUpdateVotoAlgorithmConfig();
  const recalcMutation = useRecalculateVotoMister();

  const isAnyMutationPending =
    createMutation.isPending || updateMutation.isPending || recalcMutation.isPending;

  // configAttiva: se selectedConfig è già attiva la usiamo direttamente (evita flicker
  // tra il render locale e il refetch di configs), altrimenti cerca nei dati server.
  const configAttiva =
    selectedConfig?.status === "active"
      ? selectedConfig
      : (configs?.find(c => c.status === "active") ?? null);

  const resetFormToSelected = useCallback((cfg: VotoAlgorithmConfig) => {
    setFormCfg(cfg.configJson as unknown as VotoMisterConfig);
    setFormVersion(cfg.version);
    setFormNotes(cfg.notes ?? "");
  }, []);

  // Inizializza selectedConfig una volta sola quando configs si carica
  useEffect(() => {
    if (!selectedConfig && configs && configs.length > 0) {
      const initial = configs.find(c => c.status === "active") ?? configs[0];
      setSelectedConfig(initial);
      resetFormToSelected(initial);
    }
  }, [configs, selectedConfig, resetFormToSelected]);

  const handleSelectVersion = (cfg: VotoAlgorithmConfig) => {
    setSelectedConfig(cfg);
    resetFormToSelected(cfg);
  };

  const isDirty = (() => {
    if (!selectedConfig || !formCfg) return false;
    return (
      formVersion !== selectedConfig.version ||
      formNotes !== (selectedConfig.notes ?? "") ||
      JSON.stringify(formCfg) !== JSON.stringify(selectedConfig.configJson)
    );
  })();

  // ─── Salva come bozza ────────────────────────────────────────────────────

  const handleSalvaBozza = () => {
    if (!formCfg || !formVersion.trim()) return;
    createMutation.mutate(
      { data: { version: formVersion.trim(), configJson: formCfg as unknown as Record<string, unknown>, status: "draft", notes: formNotes || null, federationId: null } },
      {
        onSuccess: (newConfig) => {
          // Aggiorna la cache per il dropdown (no flicker) + background refetch
          queryClient.setQueryData<VotoAlgorithmConfig[]>(
            getListVotoAlgorithmConfigsQueryKey(),
            (old) => (old ? [newConfig, ...old] : [newConfig])
          );
          queryClient.invalidateQueries({ queryKey: getListVotoAlgorithmConfigsQueryKey() });
          // Aggiorna direttamente selectedConfig (non dipende dal refetch di configs)
          setSelectedConfig(newConfig);
          setFormCfg(newConfig.configJson as unknown as VotoMisterConfig);
          setFormVersion(newConfig.version);
          setFormNotes(newConfig.notes ?? "");
          toast({ title: `Bozza "${newConfig.version}" salvata.`, duration: 4000 });
        },
        onError: () => {
          toast({ title: "Errore durante il salvataggio. Riprova.", variant: "destructive", duration: 6000 });
        },
      }
    );
  };

  // ─── Salva e attiva ──────────────────────────────────────────────────────

  const handleConfermaAttiva = () => {
    if (!formCfg || !formVersion.trim()) return;
    createMutation.mutate(
      { data: { version: formVersion.trim(), configJson: formCfg as unknown as Record<string, unknown>, status: "active", notes: formNotes || null, federationId: null } },
      {
        onSuccess: (newConfig) => {
          setShowDialogAttiva(false);
          // Aggiorna la cache: inserisce la nuova attiva, archivia le precedenti attive
          queryClient.setQueryData<VotoAlgorithmConfig[]>(
            getListVotoAlgorithmConfigsQueryKey(),
            (old) => {
              const base = old ?? [];
              return [
                newConfig,
                ...base.map(c =>
                  c.status === "active" ? { ...c, status: "archived" as const } : c
                ),
              ];
            }
          );
          queryClient.invalidateQueries({ queryKey: getListVotoAlgorithmConfigsQueryKey() });
          // Aggiorna direttamente selectedConfig (non dipende dal refetch di configs)
          setSelectedConfig(newConfig);
          setFormCfg(newConfig.configJson as unknown as VotoMisterConfig);
          setFormVersion(newConfig.version);
          setFormNotes(newConfig.notes ?? "");
          toast({ title: `Versione "${newConfig.version}" attivata. La versione precedente è stata archiviata.`, duration: 5000 });
        },
        onError: () => {
          setShowDialogAttiva(false);
          toast({ title: "Errore durante l'attivazione. Riprova.", variant: "destructive", duration: 6000 });
        },
      }
    );
  };

  // ─── Ricalcola ───────────────────────────────────────────────────────────

  const handleConfermaRicalcola = () => {
    recalcMutation.mutate(
      { params: undefined },
      {
        onSuccess: (result) => {
          setShowDialogRicalcola(false);
          toast({
            title: `Ricalcolati ${result.updatedCount} voti in ${result.durationMs}ms. ${result.skippedCount} righe sotto soglia minuti (NULL).`,
            duration: 9000,
          });
        },
        onError: () => {
          toast({ title: "Errore durante il ricalcolo. Riprova.", variant: "destructive", duration: 6000 });
        },
      }
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

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
          padding: 24, background: "var(--paper)", border: "1px dashed var(--border-strong)", borderRadius: 6, marginTop: 32,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Nessuna configurazione trovata</div>
            <div style={{ fontSize: 13, color: "var(--ink-mid)", marginTop: 4 }}>
              Esegui il seed del database: <Mono>pnpm --filter @workspace/db run seed</Mono>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedConfig || !formCfg) return null;

  const isSystem = !!(selectedConfig as VotoAlgorithmConfig & { isProtected?: boolean }).isProtected;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900 }}>

      {/* ── Dialogs ── */}
      <DialogAttivaVersione
        open={showDialogAttiva}
        onClose={() => setShowDialogAttiva(false)}
        onConfirm={handleConfermaAttiva}
        nomeVersione={formVersion}
        versioneAttivaCorrente={configAttiva?.version ?? null}
        loading={createMutation.isPending}
      />
      <DialogRicalcola
        open={showDialogRicalcola}
        onClose={() => { if (!recalcMutation.isPending) setShowDialogRicalcola(false); }}
        onConfirm={handleConfermaRicalcola}
        configAttiva={configAttiva}
        loading={recalcMutation.isPending}
      />

      {/* ── Header ── */}
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--green-deep)", marginBottom: 6, lineHeight: 1.15 }}>
          Algoritmo voto
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-mid)", maxWidth: 560 }}>
          Pesi e soglie che producono il voto base Mister.
          Le modifiche non hanno effetto finché non si attiva una versione.
        </p>
      </header>

      {/* ── Card versione + selettore ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "16px 20px", marginBottom: 24,
        boxShadow: "0 1px 2px rgba(10,31,23,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-dim)", fontWeight: 500 }}>Versione visualizzata:</span>
              <Mono style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{selectedConfig.version}</Mono>
              <StatoBadge status={selectedConfig.status} />
              {isSystem && (
                <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", background: "var(--cream)", color: "var(--ink-mid)", border: "1px solid var(--cream-dark)" }}>sistema</span>
              )}
            </div>
            {selectedConfig.notes && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-mid)", maxWidth: 560, lineHeight: 1.5 }}>
                {selectedConfig.notes}
              </p>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
              <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>id: {selectedConfig.id}</span>
              {selectedConfig.createdBy && <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>creato da: {selectedConfig.createdBy}</span>}
              <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                {new Date(selectedConfig.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          <VersionSelector
            configs={configs}
            selected={selectedConfig}
            onChange={handleSelectVersion}
            disabled={isAnyMutationPending}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
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
              marginBottom: -1, transition: "color 80ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderTop: "none", borderRadius: "0 0 8px 8px",
        padding: "20px 24px", marginBottom: 24,
      }}>
        {activeTab === "calibrazione" && (
          <TabCalibrazione cfg={formCfg} def={DEFAULT_CONFIG} onChange={setFormCfg} disabled={isAnyMutationPending} />
        )}
        {activeTab === "stripping" && (
          <TabStripping cfg={formCfg} def={DEFAULT_CONFIG} onChange={setFormCfg} disabled={isAnyMutationPending} />
        )}
        {activeTab === "performance" && (
          <TabPerformance cfg={formCfg} def={DEFAULT_CONFIG} onChange={setFormCfg} disabled={isAnyMutationPending} />
        )}
      </div>

      {/* ── Nome versione + note ── */}
      <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-mid)", marginBottom: 6 }}>
            Nome versione
          </label>
          <input
            type="text"
            value={formVersion}
            onChange={e => setFormVersion(e.target.value)}
            disabled={isAnyMutationPending}
            placeholder="es. v1.1"
            style={{
              width: "100%", fontFamily: "var(--font-mono)", fontSize: 13,
              padding: "7px 10px", border: "1px solid var(--border-strong)",
              borderRadius: 4, background: isAnyMutationPending ? "var(--paper)" : "var(--surface)",
              color: "var(--ink)",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-mid)", marginBottom: 6 }}>
            Note sulla versione
          </label>
          <textarea
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            disabled={isAnyMutationPending}
            rows={2}
            placeholder="Descrizione breve delle modifiche."
            style={{
              width: "100%", fontFamily: "var(--font-sans)", fontSize: 13,
              padding: "7px 10px", border: "1px solid var(--border-strong)",
              borderRadius: 4, background: isAnyMutationPending ? "var(--paper)" : "var(--surface)",
              color: "var(--ink)", resize: "vertical", lineHeight: 1.5,
            }}
          />
        </div>
      </div>

      {/* ── Indicatore dirty + azioni ── */}
      {isDirty && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <AlertCircle size={13} style={{ color: "var(--warn)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--warn)" }}>
            Modifiche non salvate
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <ActionButton
          onClick={handleSalvaBozza}
          disabled={!isDirty || isAnyMutationPending || !formVersion.trim()}
          loading={createMutation.isPending && !showDialogAttiva}
        >
          Salva come bozza
        </ActionButton>
        <ActionButton
          onClick={() => setShowDialogAttiva(true)}
          variant="primary"
          disabled={!isDirty || isAnyMutationPending || !formVersion.trim()}
        >
          Salva e attiva
        </ActionButton>
        <div style={{ flex: 1 }} />
        <ActionButton
          onClick={() => setShowDialogRicalcola(true)}
          variant="ghost"
          disabled={!configAttiva || isAnyMutationPending}
          loading={recalcMutation.isPending}
        >
          <BarChart2 size={14} />
          Ricalcola voti stagione corrente
        </ActionButton>
      </div>
    </div>
  );
}
