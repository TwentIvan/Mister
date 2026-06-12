import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal Web Speech API types ─────────────────────────────────────────────
interface SRAlternative { readonly transcript: string; readonly confidence: number; }
interface SRResult { readonly isFinal: boolean; readonly length: number; readonly [index: number]: SRAlternative; }
interface SRResultList { readonly length: number; readonly [index: number]: SRResult; }
interface SREvent { readonly resultIndex: number; readonly results: SRResultList; }
interface SRErrorEvent { readonly error: string; }
interface SRRecognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  start(): void; stop(): void; abort(): void;
}
interface SRCtor { new(): SRRecognition; }
type WinWithSR = Window & { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor; };

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as WinWithSR;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── Italian number words 1-100 ───────────────────────────────────────────────
function buildItalianNumbers(): Map<string, number> {
  const m = new Map<string, number>();
  const ones = [
    "", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
    "dieci", "undici", "dodici", "tredici", "quattordici", "quindici",
    "sedici", "diciassette", "diciotto", "diciannove",
  ];
  const tens = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
  for (let n = 1; n <= 99; n++) {
    if (n < 20) {
      if (ones[n]) m.set(ones[n], n);
    } else {
      const t = Math.floor(n / 10), o = n % 10;
      const base = (o === 1 || o === 8) ? tens[t].slice(0, -1) : tens[t];
      m.set(o === 0 ? tens[t] : base + ones[o], n);
    }
  }
  m.set("cento", 100);
  return m;
}
const ITALIAN_NUMBERS = buildItalianNumbers();

// ── Text normalisation ────────────────────────────────────────────────────────
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(token: string): number | null {
  const n = parseInt(token, 10);
  if (!isNaN(n) && n > 0) return n;
  return ITALIAN_NUMBERS.get(token) ?? null;
}

// ── Levenshtein distance + normalised variant ─────────────────────────────────
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

export function normalizedDist(a: string, b: string): number {
  if (!a && !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : levenshtein(a, b) / maxLen;
}

// ── Fuzzy keyword presence check ──────────────────────────────────────────────
// Returns true if any single token (or adjacent bigram) in `text` is within
// `maxDist` normalised Levenshtein distance from `keyword`.
export function fuzzyContainsKeyword(text: string, keyword: string, maxDist = 0.35): boolean {
  const tokens = text.split(" ").filter(Boolean);
  for (const t of tokens) {
    if (normalizedDist(t, keyword) <= maxDist) return true;
  }
  // Bigrams: adjacent tokens concatenated (catches "a giudica" → "agiudica" ≈ "aggiudica")
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + tokens[i + 1];
    if (normalizedDist(bigram, keyword) <= maxDist) return true;
  }
  return false;
}

// ── Team-name fuzzy matching — "pick the nearest" ────────────────────────────
interface Squadra { id: string; name: string; name_auction?: string | null; }

// Min distance from `frag` to `key`, also considering individual tokens in frag
function bestTokenDist(frag: string, key: string): number {
  const full = normalizedDist(frag, key);
  const tokMin = frag
    .split(" ")
    .filter((t) => t.length >= 2)
    .reduce((min, t) => Math.min(min, normalizedDist(t, key)), 1);
  return Math.min(full, tokMin);
}

const TEAM_MAX_DIST  = 0.55; // reject if best match is farther than this
const TEAM_AMB_MARGIN = 0.12; // second must be at least this much farther to be unambiguous

export function fuzzyMatchTeam(fragment: string, squadre: Squadra[]): Squadra | null {
  if (!fragment || squadre.length === 0) return null;
  const frag = norm(fragment);
  const ranked = squadre
    .map((s) => ({ s, d: bestTokenDist(frag, norm(s.name_auction?.trim() || s.name)) }))
    .sort((a, b) => a.d - b.d);
  const best = ranked[0];
  if (best.d > TEAM_MAX_DIST) return null;
  if (ranked.length > 1 && ranked[1].d - best.d < TEAM_AMB_MARGIN) return null;
  return best.s;
}

// ── Voice-name conflict check (VV4) ──────────────────────────────────────────
// Returns pairs of voice names that are too similar and risk being confused.
export function checkVoiceNameConflicts(
  squadre: Squadra[],
  threshold = 0.35,
): Array<{ a: string; b: string }> {
  const entries = squadre
    .map((s) => ({
      display: s.name_auction?.trim() || s.name,
      key: norm(s.name_auction?.trim() || s.name),
    }))
    .filter((e) => e.key !== "");
  const conflicts: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (normalizedDist(entries[i].key, entries[j].key) <= threshold) {
        conflicts.push({ a: entries[i].display, b: entries[j].display });
      }
    }
  }
  return conflicts;
}

// ── Fuzzy player matching (chiamata voce) ─────────────────────────────────────
export interface PlayerVoice { id: number; name: string; real_team: string; }

function fuzzyMatchAll(fragment: string, players: PlayerVoice[]): PlayerVoice[] {
  if (!fragment || players.length === 0) return [];
  const frag = norm(fragment);
  let results: PlayerVoice[];

  results = players.filter((p) => norm(p.name) === frag);
  if (results.length > 0) return results;

  results = players.filter((p) => `${norm(p.name)} ${norm(p.real_team)}` === frag);
  if (results.length > 0) return results;

  results = players.filter((p) => { const pn = norm(p.name); return pn.startsWith(frag) || frag.startsWith(pn); });
  if (results.length > 0) return results;

  const fragTokens = frag.split(" ");
  return players.filter((p) => {
    const pTokens = norm(p.name).split(" ");
    return fragTokens.some((t) => t.length >= 3 && pTokens.includes(t));
  });
}

// ── Pure intent parser (exported for unit testing) ───────────────────────────
export type Intent =
  | { type: "bid"; teamId: string; teamName: string; amount: number }
  | { type: "aggiudica" }
  | { type: "salta" }
  | { type: "pausa" }
  | { type: "riprendi" }
  | { type: "chiama"; playerId: number; playerName: string }
  | { type: "chiama_ambiguous"; candidates: PlayerVoice[] }
  | { type: "chiama_notfound"; fragment: string }
  | { type: "seleziona"; n: number }
  | null;

export function parseIntent(
  rawText: string,
  squadre: Squadra[],
  svincolati?: PlayerVoice[],
): Intent {
  const text   = norm(rawText);
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  // ── 0. Chiamata giocatore — "chiamo [nome] [squadra_reale]" ──────────────
  // First token fuzzy-close to "chiamo"
  if (svincolati?.length && normalizedDist(tokens[0], "chiamo") <= 0.35) {
    const rest = tokens.slice(1).join(" ");
    if (rest) {
      const matches = fuzzyMatchAll(rest, svincolati);
      if (matches.length === 1) return { type: "chiama", playerId: matches[0].id, playerName: matches[0].name };
      if (matches.length > 1)   return { type: "chiama_ambiguous", candidates: matches };
      // Nessuna corrispondenza in coda: il giocatore potrebbe essere già aggiudicato
      return { type: "chiama_notfound", fragment: rest };
    }
    return null;
  }

  // ── 0b. Selezione da disambiguazione — "seleziona (il numero)? N" ────────
  const selMatch = /^seleziona(?:\s+il\s+numero)?\s+(\S+)$/.exec(text);
  if (selMatch) {
    const n = parseNumber(selMatch[1]);
    if (n !== null) return { type: "seleziona", n };
  }

  // ── 1. Commands: aggiudica ────────────────────────────────────────────────
  if (
    fuzzyContainsKeyword(text, "aggiudica") ||
    fuzzyContainsKeyword(text, "aggiudicato")
  ) {
    return { type: "aggiudica" };
  }

  // ── 2. Commands: mister salta / pausa / riprendi ──────────────────────────
  if (fuzzyContainsKeyword(text, "mister")) {
    if (fuzzyContainsKeyword(text, "salta"))    return { type: "salta" };
    if (fuzzyContainsKeyword(text, "pausa"))    return { type: "pausa" };
    if (fuzzyContainsKeyword(text, "riprendi")) return { type: "riprendi" };
  }

  // ── 3. Bid: "[nome squadra] [numero]" ─────────────────────────────────────
  // Try last token as number, then second-to-last (multi-word team names)
  if (tokens.length >= 2) {
    for (const offset of [1, 2]) {
      if (tokens.length <= offset) continue;
      const numTok = tokens[tokens.length - offset];
      const amount = parseNumber(numTok);
      if (amount === null) continue;
      const frag = tokens.slice(0, tokens.length - offset).join(" ");
      const team = fuzzyMatchTeam(frag, squadre);
      if (team) {
        return { type: "bid", teamId: team.id, teamName: team.name_auction?.trim() || team.name, amount };
      }
    }
  }

  return null;
}

// ── Public interface ──────────────────────────────────────────────────────────
export interface UseVoiceBidderOptions {
  squadre: Squadra[];
  onPlaceBid: (teamId: string, amountAbsoluto: number) => void;
  onAggiudica: () => void;
  onSalta: () => void;
  onPausa: () => void;
  onRiprendi: () => void;
  svincolati?: PlayerVoice[];
  onChiama?: (playerId: number) => void;
  onChiamaAmbiguous?: (candidates: PlayerVoice[]) => void;
  onChiamaNotFound?: (fragment: string) => void;
  onSeleziona?: (n: number) => void;
}

export interface UseVoiceBidderResult {
  isActive: boolean;
  transcript: string;
  lastCommand: string | null;
  supported: boolean;
  toggle: () => void;
  /** Coppie di nomi voce troppo simili — mostrare avviso in UI */
  voiceNameConflicts: Array<{ a: string; b: string }>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVoiceBidder({
  squadre,
  onPlaceBid,
  onAggiudica,
  onSalta,
  onPausa,
  onRiprendi,
  svincolati,
  onChiama,
  onChiamaAmbiguous,
  onChiamaNotFound,
  onSeleziona,
}: UseVoiceBidderOptions): UseVoiceBidderResult {
  const [isActive, setIsActive]       = useState(false);
  const [transcript, setTranscript]   = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const isActiveRef     = useRef(false);
  const recRef          = useRef<SRRecognition | null>(null);
  const debounceRef     = useRef<{ key: string; ts: number } | null>(null);
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef       = useRef({ onPlaceBid, onAggiudica, onSalta, onPausa, onRiprendi, squadre, svincolati, onChiama, onChiamaAmbiguous, onChiamaNotFound, onSeleziona });

  useEffect(() => {
    cbRef.current = { onPlaceBid, onAggiudica, onSalta, onPausa, onRiprendi, squadre, svincolati, onChiama, onChiamaAmbiguous, onChiamaNotFound, onSeleziona };
  });

  const supported = !!getSRCtor();

  const flash = useCallback((label: string) => {
    setLastCommand(label);
    setTimeout(() => setLastCommand((p) => (p === label ? null : p)), 1800);
  }, []);

  const dispatch = useCallback(
    (text: string) => {
      const now  = Date.now();
      const nKey = norm(text);

      if (debounceRef.current?.key === nKey && now - debounceRef.current.ts < 1500) return;

      const intent = parseIntent(text, cbRef.current.squadre, cbRef.current.svincolati);
      if (!intent) return;

      // Debounce key per evitare doppi dispatch
      debounceRef.current = { key: nKey, ts: now };

      switch (intent.type) {
        case "chiama":
          if (cbRef.current.onChiama) {
            flash(`Chiamata: ${intent.playerName}`);
            cbRef.current.onChiama(intent.playerId);
          }
          break;
        case "chiama_ambiguous":
          if (cbRef.current.onChiamaAmbiguous) {
            flash(`Disambiguazione: ${intent.candidates.length} giocatori`);
            cbRef.current.onChiamaAmbiguous(intent.candidates);
          }
          break;
        case "chiama_notfound":
          cbRef.current.onChiamaNotFound?.(intent.fragment);
          break;
        case "seleziona":
          if (cbRef.current.onSeleziona) {
            flash(`Selezione: ${intent.n}`);
            cbRef.current.onSeleziona(intent.n);
          }
          break;
        case "aggiudica":
          flash("Comando: aggiudicato");
          cbRef.current.onAggiudica();
          break;
        case "salta":
          flash("Comando: salta");
          cbRef.current.onSalta();
          break;
        case "pausa":
          flash("Comando: pausa");
          cbRef.current.onPausa();
          break;
        case "riprendi":
          flash("Comando: riprendi");
          cbRef.current.onRiprendi();
          break;
        case "bid":
          flash(`Offerta: ${intent.teamName} ${intent.amount}`);
          cbRef.current.onPlaceBid(intent.teamId, intent.amount);
          break;
      }
    },
    [flash],
  );

  const startRec = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang           = "it-IT";
    rec.continuous     = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SREvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          // Risultato definitivo: cancella il timer interim e processa subito
          if (interimTimerRef.current) { clearTimeout(interimTimerRef.current); interimTimerRef.current = null; }
          dispatch(r[0].transcript);
          setTranscript("");
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) {
        setTranscript(interim);
        // Fallback: se isFinal non scatta mai (comportamento Replit preview),
        // processiamo il testo interim come finale dopo 600 ms di silenzio.
        if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
        interimTimerRef.current = setTimeout(() => {
          interimTimerRef.current = null;
          dispatch(interim);
          setTranscript("");
        }, 600);
      }
    };

    rec.onend = () => {
      if (interimTimerRef.current) { clearTimeout(interimTimerRef.current); interimTimerRef.current = null; }
      setTranscript("");
      if (isActiveRef.current) {
        setTimeout(() => {
          if (isActiveRef.current) { try { rec.start(); } catch { /* già avviato */ } }
        }, 150);
      }
    };

    rec.onerror = (event: SRErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        isActiveRef.current = false;
        setIsActive(false);
      }
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

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (interimTimerRef.current) { clearTimeout(interimTimerRef.current); interimTimerRef.current = null; }
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  const voiceNameConflicts = checkVoiceNameConflicts(squadre);

  return { isActive, transcript, lastCommand, supported, toggle, voiceNameConflicts };
}
