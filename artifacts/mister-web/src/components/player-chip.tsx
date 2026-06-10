import { X, GripVertical } from "lucide-react";
import "./player-chip.css";

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type ChipRole = "GK" | "DEF" | "MID" | "ATT";

export interface ChipPlayer {
  id: number;
  name: string;
  cartoonUrl: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  role: ChipRole;
}

export const CHIP_ROLE_LETTER: Record<ChipRole, string> = {
  GK: "P", DEF: "D", MID: "C", ATT: "A",
};

export function chipLastName(name: string, maxLen = 9): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > maxLen ? last.slice(0, maxLen - 1) + "." : last;
}

// ── Faccina placeholder neutra (lecita — niente danger sul volto) ─────────────

export function NeutralFace() {
  return (
    <svg viewBox="0 0 44 44" style={{ width: "100%", height: "100%", display: "block" }}>
      <circle cx="22" cy="22" r="22" fill="#e7dcc4" />
      <circle cx="22" cy="18" r="7" fill="#b8ad92" />
      <path d="M9 40c0-7 6-11 13-11s13 4 13 11z" fill="#b8ad92" />
    </svg>
  );
}

// ── Avatar toy del mister (anello oro = R-mister-toy) ─────────────────────────

export function MisterToyAvatar({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block" }}>
      <ellipse cx="24" cy="38" rx="13" ry="10" fill="#2b5740" />
      <rect x="19" y="29" width="10" height="5" rx="2" fill="#1f4733" />
      <circle cx="24" cy="21" r="9" fill="#efe6d3" />
      <ellipse cx="24" cy="13" rx="8.5" ry="4.5" fill="#2d2420" />
      <ellipse cx="20.5" cy="21" rx="1.4" ry="1.6" fill="#3a2a1e" />
      <ellipse cx="27.5" cy="21" rx="1.4" ry="1.6" fill="#3a2a1e" />
      <path d="M21 26 Q24 28.5 27 26" stroke="#b08060" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="35" r="5" fill="#c8922b" />
      <text x="24" y="38.5" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="800" fontSize="7" fill="#fff">M</text>
    </svg>
  );
}

// ── PlayerFieldChip ───────────────────────────────────────────────────────────
// DOM (v3): .chip.{rl}[.empty][.sel] > [.cap] + .av(.ph|.slotlab) + .cr + .cn

export interface PlayerFieldChipProps {
  player: ChipPlayer | null;
  role: ChipRole;
  isSelected?: boolean;
  isCaptain?: boolean;
  isDimmed?: boolean;
  isLocked?: boolean;
  avgScore?: number | null;
  onClick?: () => void;
  onRemove?: () => void;
}

export function PlayerFieldChip({
  player, role, isSelected, isCaptain, isDimmed, isLocked, avgScore, onClick, onRemove,
}: PlayerFieldChipProps) {
  const rl = CHIP_ROLE_LETTER[role];
  const faceUrl = player?.cartoonUrl ?? player?.photoUrl ?? null;

  return (
    <div
      className={`chip ${rl}${isSelected ? " sel" : ""}${!player ? " empty" : ""}`}
      onClick={isLocked ? undefined : onClick}
      style={{ opacity: isDimmed ? 0.3 : 1, cursor: isLocked ? "default" : "pointer" }}
    >
      {/* .cap — fascia capitano, prima di .av nel DOM */}
      {isCaptain && player && <span className="cap">C</span>}

      {/* .vt — pin voto: SEMPRE presente su .chip (MAI dentro .av che ha overflow:hidden) */}
      {player && (
        <span className="vt">{avgScore != null ? avgScore.toFixed(1) : "—"}</span>
      )}

      {/* .rm — bottone rimozione: SIBLING di .av (MAI dentro .av che ha overflow:hidden) */}
      {player && !isLocked && onRemove && (
        <button
          className="rm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X size={7} />
        </button>
      )}

      {/* .av — cerchio colorato per ruolo + overflow:hidden */}
      <div className="av" style={!player ? { borderStyle: "dashed" } : undefined}>
        {player ? (
          /* .ph — volto toy (o faccina neutra se assente dall'anagrafica) */
          <div className="ph">
            <NeutralFace />
            {faceUrl && (
              <img
                src={faceUrl}
                alt={player.name}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.08)", transformOrigin: "center",
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
        ) : (
          /* Slot vuoto: lettera-posizione tratteggiata */
          <span className="slotlab">{rl}</span>
        )}
      </div>

      {/* .cr — crest club REALE: logo o .miss (mai barra-colori) */}
      {player && (
        <div className="cr">
          {player.logoUrl
            ? (
              <img
                src={player.logoUrl}
                alt=""
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  const miss = document.createElement("span");
                  miss.className = "miss";
                  miss.textContent = "?";
                  el.parentElement?.appendChild(miss);
                }}
              />
            )
            : <span className="miss">?</span>
          }
        </div>
      )}

      {/* .cn — cognome */}
      <span className="cn">{player ? chipLastName(player.name) : "\u00a0"}</span>
    </div>
  );
}

// ── PlayerBenchRow ────────────────────────────────────────────────────────────
// DOM (v3) mobile:   .rr.{rl} > [priority] + .cr + .face + .rl + .rn + [cap-btn]
// DOM (v3) desktop:  .rr.{rl}[.bench] > .cr + .face.sm + .rn + .mk.pl|[cap-btn]

export interface PlayerBenchRowProps {
  player: ChipPlayer;
  priority?: number;
  isInField?: boolean;
  isSelected?: boolean;
  isCompatible?: boolean | null;
  isCaptain?: boolean;
  isLocked?: boolean;
  faceSmall?: boolean;
  showGrip?: boolean;
  voto?: number | null;
  onTap?: () => void;
  onCaptainToggle?: () => void;
}

export function PlayerBenchRow({
  player, priority, isInField, isSelected, isCompatible, isCaptain, isLocked,
  faceSmall, showGrip, voto, onTap, onCaptainToggle,
}: PlayerBenchRowProps) {
  const rl = CHIP_ROLE_LETTER[player.role];
  const faceUrl = player.cartoonUrl ?? player.photoUrl ?? null;
  const capBtnSize = priority !== undefined ? 22 : 18;

  return (
    <div
      className={`rr ${rl}${isInField ? " bench" : ""}`}
      onClick={isLocked ? undefined : onTap}
      style={{
        opacity: isCompatible === false ? 0.25 : 1,
        outline: isSelected ? "1.5px solid rgba(255,255,255,0.42)" : "none",
        cursor: isLocked ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      {/* Maniglia drag — visibile solo quando showGrip=true (desktop panchina) */}
      {showGrip && (
        <span className="grip">
          <GripVertical size={13} />
        </span>
      )}

      {/* Priorità ordine panchina (mobile) */}
      {priority !== undefined && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          color: "rgba(239,230,211,0.45)", width: 14, flexShrink: 0,
        }}>
          {priority}
        </span>
      )}

      {/* .cr — crest club REALE: logo o .miss */}
      <div className="cr">
        {player.logoUrl
          ? (
            <img
              src={player.logoUrl}
              alt=""
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const miss = document.createElement("span");
                miss.className = "miss";
                miss.textContent = "?";
                el.parentElement?.appendChild(miss);
              }}
            />
          )
          : <span className="miss">?</span>
        }
      </div>

      {/* .face[.sm] — volto toy o faccina neutra */}
      <div
        className={`face${faceSmall ? " sm" : ""}`}
        style={{ position: "relative" }}
      >
        <NeutralFace />
        {faceUrl && (
          <img
            src={faceUrl}
            alt={player.name}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              transform: "scale(1.06)", transformOrigin: "center",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      {/* .rn — cognome */}
      <span className="rn">{chipLastName(player.name)}</span>

      {/* .rv — voto (mostrato solo se prop voto fornita: contesto Partita) */}
      {voto !== undefined && (
        <span className="rv" style={{ color: voto !== null ? "rgba(239,230,211,.82)" : "rgba(239,230,211,.3)" }}>
          {voto !== null ? voto.toFixed(1) : "—"}
        </span>
      )}

      {/* Azione: XI badge (desktop in campo) oppure capitano toggle (solo se handler presente) */}
      {isInField ? (
        <span className="mk pl">XI</span>
      ) : onCaptainToggle && !isLocked ? (
        <button
          onClick={(e) => { e.stopPropagation(); onCaptainToggle(); }}
          style={{
            width: capBtnSize, height: capBtnSize,
            borderRadius: "50%", flexShrink: 0, padding: 0,
            background: isCaptain ? "var(--gold)" : "rgba(0,0,0,0.25)",
            border: isCaptain ? "none" : "1px solid rgba(239,230,211,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: priority !== undefined ? 9 : 8,
            fontWeight: 800,
            color: isCaptain ? "#fff" : "rgba(239,230,211,0.55)",
          }}>C</span>
        </button>
      ) : null}
    </div>
  );
}
