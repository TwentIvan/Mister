import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal Web Speech API types (not available as globals in all TS builds) ──
interface SRAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SRAlternative;
}
interface SRResultList {
  readonly length: number;
  readonly [index: number]: SRResult;
}
interface SREvent {
  readonly resultIndex: number;
  readonly results: SRResultList;
}
interface SRErrorEvent {
  readonly error: string;
}
interface SRRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SRCtor {
  new(): SRRecognition;
}
type WinWithSR = Window & {
  SpeechRecognition?: SRCtor;
  webkitSpeechRecognition?: SRCtor;
};

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as WinWithSR;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── Italian number words 1-100 ──────────────────────────────────────────────
function buildItalianNumbers(): Map<string, number> {
  const m = new Map<string, number>();
  const ones = [
    "", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
    "dieci", "undici", "dodici", "tredici", "quattordici", "quindici",
    "sedici", "diciassette", "diciotto", "diciannove",
  ];
  const tens = [
    "", "", "venti", "trenta", "quaranta", "cinquanta",
    "sessanta", "settanta", "ottanta", "novanta",
  ];
  for (let n = 1; n <= 99; n++) {
    if (n < 20) {
      if (ones[n]) m.set(ones[n], n);
    } else {
      const t = Math.floor(n / 10);
      const o = n % 10;
      // Italian elision: tens loses trailing vowel before "uno" (1) and "otto" (8)
      const base = o === 1 || o === 8 ? tens[t].slice(0, -1) : tens[t];
      const word = o === 0 ? tens[t] : base + ones[o];
      m.set(word, n);
    }
  }
  m.set("cento", 100);
  return m;
}

const ITALIAN_NUMBERS = buildItalianNumbers();

// ── Text normalisation ───────────────────────────────────────────────────────
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(token: string): number | null {
  const n = parseInt(token, 10);
  if (!isNaN(n) && n > 0) return n;
  return ITALIAN_NUMBERS.get(token) ?? null;
}

// ── Fuzzy team-name matching ─────────────────────────────────────────────────
interface Squadra {
  id: string;
  name: string;
  name_auction?: string | null;
}

function fuzzyMatch(fragment: string, squadre: Squadra[]): Squadra | null {
  if (!fragment) return null;
  const candidates = squadre.map((s) => ({
    s,
    key: norm(s.name_auction ?? s.name),
  }));
  // 1. Exact
  const exact = candidates.find((c) => c.key === fragment);
  if (exact) return exact.s;
  // 2. Starts-with either direction
  const sw = candidates.find(
    (c) => fragment.startsWith(c.key) || c.key.startsWith(fragment),
  );
  if (sw) return sw.s;
  // 3. Any ≥3-char token overlap
  const fragTokens = fragment.split(" ");
  for (const { s, key } of candidates) {
    const keyTokens = key.split(" ");
    if (fragTokens.some((t) => t.length >= 3 && keyTokens.includes(t))) return s;
  }
  return null;
}

// ── Public interface ─────────────────────────────────────────────────────────
export interface UseVoiceBidderOptions {
  squadre: Squadra[];
  onPlaceBid: (teamId: string, amountAbsoluto: number) => void;
  onAggiudica: () => void;
  onSalta: () => void;
  onPausa: () => void;
  onRiprendi: () => void;
}

export interface UseVoiceBidderResult {
  isActive: boolean;
  transcript: string;         // live interim text while speaking
  lastCommand: string | null; // label of the most recently executed command (flash)
  supported: boolean;
  toggle: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useVoiceBidder({
  squadre,
  onPlaceBid,
  onAggiudica,
  onSalta,
  onPausa,
  onRiprendi,
}: UseVoiceBidderOptions): UseVoiceBidderResult {
  const [isActive, setIsActive]       = useState(false);
  const [transcript, setTranscript]   = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  // Stable refs — prevent stale closures inside recognition event handlers
  const isActiveRef = useRef(false);
  const recRef      = useRef<SRRecognition | null>(null);
  const debounceRef = useRef<{ key: string; ts: number } | null>(null);
  const cbRef       = useRef({ onPlaceBid, onAggiudica, onSalta, onPausa, onRiprendi, squadre });

  // Keep callback ref current on every render (no deps needed)
  useEffect(() => {
    cbRef.current = { onPlaceBid, onAggiudica, onSalta, onPausa, onRiprendi, squadre };
  });

  const supported = !!getSRCtor();

  // Flash a command label for 1.8s then clear
  const flash = useCallback((label: string) => {
    setLastCommand(label);
    setTimeout(() => setLastCommand((p) => (p === label ? null : p)), 1800);
  }, []);

  // Parse and dispatch a FINAL transcript result
  const dispatch = useCallback(
    (text: string) => {
      const normalized = norm(text);
      const now = Date.now();

      // Debounce: identical command within 1.5s → skip
      if (
        debounceRef.current?.key === normalized &&
        now - debounceRef.current.ts < 1500
      ) return;

      // ── 1. Control commands (prefix "mister") ────────────────────────────
      if (normalized === "mister salta") {
        debounceRef.current = { key: normalized, ts: now };
        flash("Comando: salta");
        cbRef.current.onSalta();
        return;
      }
      if (normalized === "mister pausa") {
        debounceRef.current = { key: normalized, ts: now };
        flash("Comando: pausa");
        cbRef.current.onPausa();
        return;
      }
      if (normalized.includes("mister riprendi")) {
        debounceRef.current = { key: normalized, ts: now };
        flash("Comando: riprendi");
        cbRef.current.onRiprendi();
        return;
      }

      // ── 2. Aggiudica ─────────────────────────────────────────────────────
      if (normalized.includes("aggiudicato") || normalized === "aggiudica") {
        debounceRef.current = { key: normalized, ts: now };
        flash("Comando: aggiudicato");
        cbRef.current.onAggiudica();
        return;
      }

      // ── 3. Bid: "[nome squadra] [numero]" ────────────────────────────────
      // Try last token as number; everything before = team name fragment
      const tokens = normalized.split(" ").filter(Boolean);
      if (tokens.length >= 2) {
        const lastTok = tokens[tokens.length - 1];
        const amount  = parseNumber(lastTok);
        if (amount !== null) {
          const frag = tokens.slice(0, -1).join(" ");
          const team = fuzzyMatch(frag, cbRef.current.squadre);
          if (team) {
            const key = `bid-${team.id}-${amount}`;
            debounceRef.current = { key, ts: now };
            flash(`Offerta: ${team.name_auction ?? team.name} ${amount}`);
            cbRef.current.onPlaceBid(team.id, amount);
            return;
          }
        }
        // Fallback: second-to-last token as number (multi-word team names)
        if (tokens.length >= 3) {
          const secLast = tokens[tokens.length - 2];
          const amount2 = parseNumber(secLast);
          if (amount2 !== null) {
            const frag2 = tokens.slice(0, -2).join(" ");
            const team2 = fuzzyMatch(frag2, cbRef.current.squadre);
            if (team2) {
              const key2 = `bid-${team2.id}-${amount2}`;
              debounceRef.current = { key: key2, ts: now };
              flash(`Offerta: ${team2.name_auction ?? team2.name} ${amount2}`);
              cbRef.current.onPlaceBid(team2.id, amount2);
              return;
            }
          }
        }
      }
      // Not recognized → ignore silently
    },
    [flash],
  );

  // Create and start a SpeechRecognition instance
  const startRec = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang              = "it-IT";
    rec.continuous        = true;
    rec.interimResults    = true;
    rec.maxAlternatives   = 1;

    rec.onresult = (event: SREvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          dispatch(r[0].transcript);
          setTranscript("");
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) setTranscript(interim);
    };

    rec.onend = () => {
      setTranscript("");
      if (isActiveRef.current) {
        // CRITICO: Chrome ferma l'ascolto dopo silenzio prolungato → riavvia automaticamente
        setTimeout(() => {
          if (isActiveRef.current) {
            try { rec.start(); } catch { /* already started */ }
          }
        }, 150);
      }
    };

    rec.onerror = (event: SRErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Permissions denied: stop mic
        isActiveRef.current = false;
        setIsActive(false);
      }
      // no-speech / network / aborted → onend handles restart
    };

    recRef.current = rec;
    rec.start();
  }, [dispatch]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (isActiveRef.current) {
      isActiveRef.current = false;
      setIsActive(false);
      setTranscript("");
      try { recRef.current?.stop(); } catch { /* ignore */ }
    } else {
      isActiveRef.current = true;
      setIsActive(true);
      startRec();
    }
  }, [supported, startRec]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  return { isActive, transcript, lastCommand, supported, toggle };
}
