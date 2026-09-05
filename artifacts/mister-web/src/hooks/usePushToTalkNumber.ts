/**
 * usePushToTalkNumber — riconoscimento vocale SOLO-NUMERI a finestra (T170).
 *
 * Filosofia anti-rumore (le tre barriere):
 *  1. il microfono vive SOLO tra start() e stop() (push-to-talk): niente
 *     ascolto continuo, niente sessioni zombie — istanza NUOVA a ogni
 *     pressione, mai riavvii fragili;
 *  2. dal parlato si estraggono SOLTANTO numeri (cifre e parole it):
 *     chiacchiere e nomi vengono ignorati;
 *  3. l'hook NON piazza offerte: restituisce i CANDIDATI sentiti nella
 *     finestra — la conferma è sempre un tap del proprietario.
 */

import { useCallback, useRef, useState } from "react";

// ── Web Speech API minimal types ──────────────────────────────────────────────
interface SRAlt { readonly transcript: string }
interface SRRes { readonly isFinal: boolean; readonly length: number; readonly [i: number]: SRAlt }
interface SRList { readonly length: number; readonly [i: number]: SRRes }
interface SREvt { readonly resultIndex: number; readonly results: SRList }
interface SRErrEvt { readonly error: string }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvt) => void) | null;
  onerror: ((e: SRErrEvt) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SR;
const getSR = (): SRCtor | null =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition ??
      null);

// ── Estrazione numeri dal parlato italiano ────────────────────────────────────
const UNITS: Record<string, number> = {
  zero: 0, uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6,
  sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13,
  quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
  diciannove: 19,
};
const TENS: Record<string, number> = {
  venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60,
  settanta: 70, ottanta: 80, novanta: 90,
};

/** Estrae TUTTI i numeri (1..999) da un transcript: cifre + parole composte. */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const t = text.toLowerCase();

  // 1) cifre esplicite ("40", "125")
  for (const m of t.matchAll(/\d{1,3}/g)) out.push(parseInt(m[0]!, 10));

  // 2) parole: token per token, gestendo composti tipo "centoventicinque"
  for (const raw of t.replace(/[^a-zà-ù ]/g, " ").split(/\s+/)) {
    if (!raw) continue;
    let w = raw;
    let val = 0;
    if (w.startsWith("cento")) { val += 100; w = w.slice(5); }
    else if (/^(due|tre|quattro|cinque|sei|sette|otto|nove)cento/.test(w)) {
      const pre = w.match(/^(due|tre|quattro|cinque|sei|sette|otto|nove)/)![0];
      val += UNITS[pre]! * 100;
      w = w.slice(pre.length + 5);
    }
    if (w) {
      // decina (con elisione: ventuno/ventotto → vent + uno/otto)
      let matched = false;
      for (const [tw, tv] of Object.entries(TENS)) {
        if (w === tw) { val += tv; w = ""; matched = true; break; }
        const stem = tw.slice(0, -1); // vent, trent, ...
        if (w.startsWith(tw)) { val += tv; w = w.slice(tw.length); matched = true; break; }
        if (w.startsWith(stem) && /^(uno|otto)/.test(w.slice(stem.length))) {
          val += tv; w = w.slice(stem.length); matched = true; break;
        }
      }
      if (w) {
        if (UNITS[w] !== undefined) { val += UNITS[w]!; w = ""; }
        else if (!matched && val === 0) continue; // parola non numerica
        else if (w) continue; // resto non riconosciuto: scarta il token
      }
    }
    if (val > 0 && val < 1000) out.push(val);
  }

  return out;
}

export interface PushToTalkState {
  supported: boolean;
  /** true tra start() e la fine effettiva del riconoscimento */
  listening: boolean;
  /** trascrizione live (feedback visivo mentre si preme) */
  transcript: string;
  /** candidati numerici sentiti nella finestra, deduplicati in ordine */
  candidates: number[];
  start: () => void;
  /** rilascio del dito: chiude la finestra; i candidati restano per la conferma */
  stop: () => void;
  /** pulisce candidati e transcript (dopo conferma o annulla) */
  reset: () => void;
}

export function usePushToTalkNumber(): PushToTalkState {
  const Ctor = getSR();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [candidates, setCandidates] = useState<number[]>([]);
  const recRef = useRef<SR | null>(null);
  const heardRef = useRef<Set<number>>(new Set());

  const start = useCallback(() => {
    if (!Ctor || recRef.current) return;
    heardRef.current = new Set();
    setCandidates([]);
    setTranscript("");

    const rec = new Ctor(); // istanza FRESCA a ogni pressione
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]?.transcript ?? "";
      setTranscript(text);
      for (const n of extractNumbers(text)) heardRef.current.add(n);
      setCandidates([...heardRef.current]);
    };
    rec.onerror = () => { /* la finestra si chiude comunque su stop/onend */ };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  }, [Ctor]);

  const stop = useCallback(() => {
    // stop (non abort): lascia arrivare il risultato finale della finestra
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    setCandidates([]);
    setTranscript("");
    heardRef.current = new Set();
  }, []);

  return { supported: !!Ctor, listening, transcript, candidates, start, stop, reset };
}
