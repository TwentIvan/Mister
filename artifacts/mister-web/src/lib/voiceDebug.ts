// ── T131: diagnostica pipeline vocale ─────────────────────────────────────────
// Ring buffer di eventi per osservare ogni stadio della pipeline voce→dato.
// Attivo SOLO con query param ?vdebug=1: senza flag ogni chiamata è un no-op.
// Nessun impatto sul comportamento: sola registrazione (vietati i fix qui, T132+).

export interface VoiceDebugEvent {
  t: number; // ms epoch
  stage: string;
  data?: unknown;
}

const MAX_EVENTS = 300;

let enabled: boolean | null = null;
const buffer: VoiceDebugEvent[] = [];
const listeners = new Set<() => void>();

export function vdebugEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("vdebug") === "1";
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

/** Registra un evento. No-op se il flag non è attivo. Non lancia mai. */
export function vlog(stage: string, data?: unknown): void {
  if (!vdebugEnabled()) return;
  try {
    buffer.push({ t: Date.now(), stage, data });
    if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
    listeners.forEach((fn) => {
      try { fn(); } catch { /* mai propagare */ }
    });
  } catch {
    /* mai propagare: il logging non deve rompere la pipeline */
  }
}

export function getVoiceDebugLog(): readonly VoiceDebugEvent[] {
  return buffer;
}

export function subscribeVoiceDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function serializeVoiceDebugLog(): string {
  try {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), userAgent: navigator.userAgent, events: buffer },
      null,
      1,
    );
  } catch {
    return "[]";
  }
}
