// ── T131: pannello diagnostico pipeline vocale ────────────────────────────────
// Renderizzato SOLO con ?vdebug=1 (guardia nel chiamante E qui). Overlay in
// basso, collassato di default a una barra con i contatori. "Copia JSON"
// esporta il buffer per l'analisi. Nessuna logica di fix: sola osservazione.

import { useEffect, useRef, useState } from "react";
import {
  getVoiceDebugLog,
  serializeVoiceDebugLog,
  subscribeVoiceDebug,
  vdebugEnabled,
  type VoiceDebugEvent,
} from "@/lib/voiceDebug";

const STALE_MS = 8000; // nessun evento sr_* da più di 8s ⇒ recognition sospetta morta (H3)

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function fmtData(data: unknown): string {
  if (data === undefined) return "";
  try {
    const s = JSON.stringify(data);
    return s.length > 160 ? s.slice(0, 157) + "…" : s;
  } catch {
    return String(data);
  }
}

function rowColor(stage: string, data: unknown): string {
  if (stage.startsWith("drop_") || stage.endsWith("_err") || stage === "sr_error" || stage === "api_err") return "#ff6b6b";
  if (stage === "interim_cleared" && (data as { by?: string } | undefined)?.by === "onend") return "#ffb347";
  if (stage === "intent" || stage === "cb_fired" || stage === "api_ok") return "#5dd39e";
  return "#c9c9c9";
}

export function VoiceDebugPanel() {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!vdebugEnabled()) return;
    const unsub = subscribeVoiceDebug(() => force((n) => n + 1));
    const tick = setInterval(() => setNow(Date.now()), 2000); // aggiorna il pallino stato
    return () => { unsub(); clearInterval(tick); };
  }, []);

  // autoscroll in fondo quando aperto
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  });

  if (!vdebugEnabled()) return null;

  const events = getVoiceDebugLog();
  const count = (pred: (e: VoiceDebugEvent) => boolean) => events.filter(pred).length;
  const counters = {
    results: count((e) => e.stage === "sr_result"),
    finals:  count((e) => e.stage === "sr_result" && (e.data as { isFinal?: boolean })?.isFinal === true),
    drops:   count((e) => e.stage.startsWith("drop_") || (e.stage === "interim_cleared" && (e.data as { by?: string })?.by === "onend")),
    intents: count((e) => e.stage === "intent"),
    apiOk:   count((e) => e.stage === "api_ok"),
    apiErr:  count((e) => e.stage === "api_err"),
  };

  const lastSr = [...events].reverse().find((e) => e.stage.startsWith("sr_"));
  const micAlive = lastSr !== undefined && now - lastSr.t < STALE_MS;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serializeVoiceDebugLog());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: textarea temporanea
      const ta = document.createElement("textarea");
      ta.value = serializeVoiceDebugLog();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const bar: React.CSSProperties = {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
    background: "rgba(20,24,22,0.96)", color: "#c9c9c9",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11,
    borderTop: "1px solid #3a4a42",
  };

  return (
    <div style={bar}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 10px", cursor: "pointer", height: 28, boxSizing: "border-box" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          title={micAlive ? "recognition attiva" : "nessun evento sr_* da >8s: recognition sospetta morta (H3)"}
          style={{ width: 9, height: 9, borderRadius: "50%", background: micAlive ? "#5dd39e" : "#ff6b6b", flexShrink: 0 }}
        />
        <span style={{ fontWeight: 700 }}>vdebug</span>
        <span>res {counters.results}</span>
        <span>fin {counters.finals}</span>
        <span style={{ color: counters.drops ? "#ff6b6b" : undefined }}>drop {counters.drops}</span>
        <span style={{ color: "#5dd39e" }}>int {counters.intents}</span>
        <span>api {counters.apiOk}/{counters.apiOk + counters.apiErr}</span>
        <span style={{ marginLeft: "auto" }} />
        <button
          onClick={(e) => { e.stopPropagation(); void copy(); }}
          style={{ background: "#1f4733", color: "#efe6d3", border: "none", borderRadius: 3, padding: "2px 8px", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
        >
          {copied ? "Copiato ✓" : "Copia JSON"}
        </button>
        <span>{open ? "▾" : "▴"}</span>
      </div>
      {open && (
        <div ref={listRef} style={{ maxHeight: "40vh", overflowY: "auto", padding: "4px 10px 8px", borderTop: "1px solid #2a352f" }}>
          {events.length === 0 && <div style={{ opacity: 0.6 }}>Nessun evento. Attiva il microfono e parla.</div>}
          {events.map((e, i) => (
            <div key={i} style={{ color: rowColor(e.stage, e.data), whiteSpace: "nowrap" }}>
              {fmtTime(e.t)}  <span style={{ fontWeight: 700 }}>{e.stage}</span>  {fmtData(e.data)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
