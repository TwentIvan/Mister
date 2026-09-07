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
  { id: "stripes_horizontal", label: "Cerchiato" },
  { id: "chest_band", label: "Blucerchiata" },
  { id: "halved", label: "Metà" },
  { id: "quarters", label: "Quarti" },
  { id: "sash", label: "Banda" },
  { id: "chevron", label: "V sul petto" },
  { id: "sleeves", label: "Maniche" },
  { id: "checkered", label: "Scacchi" },
  { id: "cross", label: "Croce" },
];

export const COLOR_KEYS = ["color_primary", "color_secondary", "color_tertiary", "color_quaternary"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

const SHIRT = "M30 12 L42 6 Q50 12 58 6 L70 12 L84 24 L74 36 L70 32 L70 90 L30 90 L30 32 L26 36 L16 24 Z";

export function Maglia({ c1, c2, c3, c4, pattern, size = 112 }: {
  c1: string; c2: string; c3?: string; c4?: string; pattern: JerseyPattern; size?: number;
}) {
  const t = c3 ?? c2;
  const q = c4 ?? c1;
  const clip = useMemo(() => `jc-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="drop-shadow">
      <defs><clipPath id={clip}><path d={SHIRT} /></clipPath></defs>
      <path d={SHIRT} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        {pattern === "stripes_vertical" && [30, 42, 54, 66].map((x, i) => (
          <rect key={x} x={x} y={0} width={7} height={100} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "pinstripes" && [30, 37, 44, 51, 58, 65, 72].map((x) => (
          <rect key={x} x={x} y={0} width={2} height={100} fill={c2} />
        ))}
        {pattern === "stripes_horizontal" && [20, 36, 52, 68, 84].map((y, i) => (
          <rect key={y} x={0} y={y} width={100} height={8} fill={i % 2 ? t : c2} />
        ))}
        {pattern === "chest_band" && (<>
          <rect x={0} y={38} width={100} height={5} fill={t} />
          <rect x={0} y={43} width={100} height={7} fill={c2} />
          <rect x={0} y={50} width={100} height={5} fill={q} />
        </>)}
        {pattern === "halved" && <rect x={50} y={0} width={50} height={100} fill={c2} />}
        {pattern === "quarters" && (<>
          <rect x={50} y={0} width={50} height={50} fill={c2} />
          <rect x={0} y={50} width={50} height={50} fill={t} />
          <rect x={50} y={50} width={50} height={50} fill={q} />
        </>)}
        {pattern === "sash" && <path d="M12 0 L34 0 L88 100 L66 100 Z" fill={c2} stroke={t} strokeWidth="2" />}
        {pattern === "chevron" && (<>
          <path d="M20 30 L50 52 L80 30 L80 42 L50 64 L20 42 Z" fill={c2} />
          <path d="M20 26 L50 48 L80 26" fill="none" stroke={t} strokeWidth="3" />
        </>)}
        {pattern === "sleeves" && (<>
          <path d="M30 12 L16 24 L26 36 L30 32 Z" fill={c2} />
          <path d="M70 12 L84 24 L74 36 L70 32 Z" fill={c2} />
        </>)}
        {pattern === "checkered" && [0,1,2,3,4].flatMap((r) => [0,1,2,3,4].map((c) => (
          (r + c) % 2 === 0 ? <rect key={`${r}-${c}`} x={c*20} y={r*20} width={20} height={20} fill={c2} /> : null
        )))}
        {pattern === "cross" && (<>
          <rect x={44} y={0} width={12} height={100} fill={c2} />
          <rect x={0} y={34} width={100} height={12} fill={c2} />
          <rect x={47} y={0} width={6} height={100} fill={t} />
          <rect x={0} y={37} width={100} height={6} fill={t} />
        </>)}
      </g>
      <path d={SHIRT} fill="none" stroke={t} strokeWidth="2.5" />
      <path d="M42 6 Q50 12 58 6 L56 14 Q50 18 44 14 Z" fill={q} />
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
