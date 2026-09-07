/** Componenti maglia/stemma condivisi (T173.d): Maglia, Stemma, fantasie, palette. */
import { useMemo } from "react";

export type JerseyPattern =
  | "solid" | "stripes_vertical" | "pinstripes" | "stripes_horizontal"
  | "chest_band" | "halved" | "quarters" | "sash" | "chevron"
  | "sleeves" | "checkered" | "cross";

export const PATTERNS: Array<{ id: JerseyPattern; label: string }> = [
  { id: "solid", label: "Tinta unita" },
  { id: "stripes_vertical", label: "Palato" },
  { id: "pinstripes", label: "Gessato" },
  { id: "stripes_horizontal", label: "Fasce" },
  { id: "chest_band", label: "Cerchiato" },
  { id: "halved", label: "Metà" },
  { id: "quarters", label: "Quarti" },
  { id: "sash", label: "Banda" },
  { id: "chevron", label: "V sul petto" },
  { id: "sleeves", label: "Maniche" },
  { id: "checkered", label: "Scacchi" },
  { id: "cross", label: "Croce" },
];

export type CollarType = "round" | "v";
export type ClosureType = "none" | "buttons" | "laces";
export interface JerseyShape { collar: CollarType; polo: boolean; closure: ClosureType }

export const COLOR_KEYS = ["color_primary", "color_secondary", "color_tertiary", "color_quaternary"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

const SHIRT = "M22 14 L38 7 Q50 15 62 7 L78 14 L95 30 L83 46 L76 39 L76 87 L24 87 L24 39 L17 46 L5 30 Z";

export function Maglia({ c1, c2, c3, c4, pattern, size = 112, shape }: {
  c1: string; c2: string; c3?: string; c4?: string; pattern: JerseyPattern; size?: number;
  shape?: Partial<JerseyShape>;
}) {
  const t = c3 ?? c2;                 // 3º colore: dettaglio del pattern
  const q = c4 ?? "#efe6d3";          // 4º colore: colletto, polsini, allacciatura
  const collar = shape?.collar ?? "round";
  const polo = shape?.polo ?? false;
  const closure = shape?.closure ?? "none";
  const OUT = "rgba(20,25,20,0.55)";  // contorno NEUTRO fisso (mai un colore sociale)
  const clip = useMemo(() => `jb-${Math.random().toString(36).slice(2, 8)}`, []);

  const BODY = "M24 16 Q24 14 26 14 L74 14 Q76 14 76 16 Q77.5 50 76 83 Q76 87 72 87 L28 87 Q24 87 24 83 Q22.5 50 24 16 Z";
  const SLEEVE_L = "M24 15 L5 29 L16 46 L24 40 Z";
  const SLEEVE_R = "M76 15 L95 29 L84 46 L76 40 Z";
  const sleeveFill = pattern === "sleeves" ? c2 : c1;

  // palato SIMMETRICO: 7 doghe uguali, base c1 ai due bordi (mai contro le maniche)
  const W = 52 / 7;
  const palato = [1, 3, 5].map((i) => 24 + i * W);

  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="drop-shadow">
      <defs><clipPath id={clip}><path d={BODY} /></clipPath></defs>

      {/* maniche (pulite: mai attraversate dal pattern) + polsini nel 4º colore */}
      <path d={SLEEVE_L} fill={sleeveFill} stroke={OUT} strokeWidth="1.6" />
      <path d={SLEEVE_R} fill={sleeveFill} stroke={OUT} strokeWidth="1.6" />
      <path d="M5 29 L16 46 L13 48 L2 31 Z" fill={q} />
      <path d="M95 29 L84 46 L87 48 L98 31 Z" fill={q} />

      {/* corpo + pattern clippato */}
      <path d={BODY} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        {pattern === "stripes_vertical" && palato.map((x) => (
          <rect key={x} x={x} y={0} width={W} height={100} fill={c2} />
        ))}
        {pattern === "pinstripes" && [28, 34, 40, 46, 52, 58, 64, 70].map((x) => (
          <rect key={x} x={x} y={0} width={1.8} height={100} fill={c2} />
        ))}
        {pattern === "stripes_horizontal" && [20, 34, 48, 62, 76].map((y, i) => (
          <rect key={y} x={0} y={y} width={100} height={9} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "chest_band" && (<>
          <rect x={0} y={36} width={100} height={6} fill={t} />
          <rect x={0} y={42} width={100} height={9} fill={c2} />
          <rect x={0} y={51} width={100} height={6} fill={q} />
        </>)}
        {pattern === "halved" && <rect x={50} y={0} width={50} height={100} fill={c2} />}
        {pattern === "quarters" && (<>
          <rect x={50} y={0} width={50} height={50} fill={c2} />
          <rect x={0} y={50} width={50} height={50} fill={t} />
          <rect x={50} y={50} width={50} height={50} fill={q} />
        </>)}
        {pattern === "sash" && <path d="M18 0 L36 0 L82 100 L64 100 Z" fill={c2} stroke={t} strokeWidth="1.5" />}
        {pattern === "chevron" && (<>
          <path d="M24 30 L50 52 L76 30 L76 44 L50 66 L24 44 Z" fill={c2} />
          <path d="M24 26 L50 48 L76 26" fill="none" stroke={t} strokeWidth="3" />
        </>)}
        {pattern === "checkered" && [0,1,2,3,4,5].flatMap((r) => [0,1,2,3,4].map((c) => (
          (r + c) % 2 === 0 ? <rect key={`${r}-${c}`} x={24 + c*10.4} y={r*14} width={10.4} height={14} fill={c2} /> : null
        )))}
        {pattern === "cross" && (<>
          <rect x={43} y={0} width={14} height={100} fill={c2} />
          <rect x={0} y={30} width={100} height={14} fill={c2} />
          <rect x={46} y={0} width={8} height={100} fill={t} />
          <rect x={0} y={33} width={100} height={8} fill={t} />
        </>)}
      </g>
      <path d={BODY} fill="none" stroke={OUT} strokeWidth="1.6" />

      {/* retro-collo: fondo c1 bordato del 4º colore (il colletto "gira" dietro) */}
      <path d="M41.5 14 Q50 8.5 58.5 14 Z" fill={c1} stroke={q} strokeWidth="1.6" />

      {/* colletto (4º colore): rotondo stretto o a V, con lembi opzionali */}
      {collar === "round" ? (
        <path d="M42 14 Q50 21 58 14 L56 14 Q50 18.5 44 14 Z" fill={q} stroke={OUT} strokeWidth="0.8" />
      ) : (
        <path d="M42 14 L50 27 L58 14 L54.5 14 L50 22 L45.5 14 Z" fill={q} stroke={OUT} strokeWidth="0.8" />
      )}
      {polo && (<>
        <path d="M43 14 L50 24 L47 14 Z" fill={q} stroke={OUT} strokeWidth="0.8" />
        <path d="M57 14 L50 24 L53 14 Z" fill={q} stroke={OUT} strokeWidth="0.8" />
      </>)}

      {/* allacciatura (4º colore) */}
      {closure === "buttons" && [29, 34.5, 40].map((cy) => (
        <circle key={cy} cx={50} cy={cy} r={1.6} fill={q} stroke={OUT} strokeWidth="0.5" />
      ))}
      {closure === "laces" && (<>
        <path d="M46 26 L54 31 M54 26 L46 31 M46 31 L54 36 M54 31 L46 36" stroke={q} strokeWidth="1.4" fill="none" />
      </>)}
    </svg>
  );
}

export function Stemma({ c1, c2, c4, initials, logoUrl, size = 72 }: {
  c1: string; c2: string; c4?: string; initials: string; logoUrl?: string | null; size?: number;
}) {
  const q = c4 ?? c1;
  if (logoUrl) {
    return <img src={logoUrl} alt="stemma" style={{ width: size, height: size }} className="object-contain drop-shadow" />;
  }
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="drop-shadow">
      <path d="M50 4 L88 16 L88 52 Q88 80 50 96 Q12 80 12 52 L12 16 Z" fill={c2} stroke={q} strokeWidth="4" />
      <path d="M50 12 L80 21 L80 51 Q80 73 50 87 Q20 73 20 51 L20 21 Z" fill={c1} />
      <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="bold" fontFamily="serif" fill={c2}>{initials}</text>
    </svg>
  );
}

/** HSL→hex corretto (il bug del bianco-e-nero è morto qui). */
function hslHex(h: number, sPct: number, lPct: number): string {
  const s = sPct / 100, l = lPct / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const PALETTE: string[] = (() => {
  const out: string[] = [];
  const hues = [0, 18, 36, 52, 90, 140, 165, 190, 210, 230, 262, 290, 320, 345];
  for (const h of hues) for (const l of [30, 44, 58, 72]) out.push(hslHex(h, 78, l));
  out.push("#000000", "#3a3a3a", "#6b6b6b", "#9c9c9c", "#c9c9c9", "#efe6d3", "#f7f3ea", "#ffffff");
  return out;
})();
