/**
 * run-backtest.ts — Voto Mister v0 backtest runner.
 *
 * Legge player_giornata_stats (JOIN players), computa i 4 voti in memoria,
 * produce un report markdown. NON esegue UPDATE sul DB.
 *
 * Uso: tsx scripts/voto-mister/run-backtest.ts
 */

import { pool } from "@workspace/db";
import { loadActiveConfig } from "./load-config.js";
import type { VotoMisterConfig } from "./config.js";
import { computeVoti } from "./compute.js";
import type { StatsJson, ComputedVoti } from "./compute.js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------

interface Row {
  player_id: number;
  name: string;
  real_team: string;
  role_classic: string;
  round: number;
  fixture_id: number;
  stats_json: StatsJson;
}

async function fetchRows(): Promise<Row[]> {
  const res = await pool.query<Row>(`
    SELECT
      pgs.player_id,
      p.name,
      p.real_team,
      p.role_classic,
      pgs.round,
      pgs.fixture_id,
      pgs.stats_json
    FROM player_giornata_stats pgs
    JOIN players p ON p.id = pgs.player_id
    ORDER BY pgs.round, pgs.fixture_id, p.name
  `);
  return res.rows;
}

// ---------------------------------------------------------------------------
// Stat helpers
// ---------------------------------------------------------------------------

function stats(values: number[]): { n: number; min: number; mean: number; median: number; std: number; max: number } {
  const n = values.length;
  if (n === 0) return { n: 0, min: 0, mean: 0, median: 0, std: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
    : sorted[Math.floor(n / 2)]!;
  return { n, min: sorted[0]!, mean, median, std, max: sorted[n - 1]! };
}

function r2(v: number): string {
  return v.toFixed(2);
}

function r3(v: number): string {
  return v.toFixed(3);
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i]! - my), 0);
  const den = Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0));
  return den === 0 ? NaN : num / den;
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

function mdTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? "").length))
  );
  const fmt = (cells: string[]) =>
    "| " + cells.map((c, i) => c.padEnd(widths[i]!)).join(" | ") + " |";
  const sep = "| " + widths.map(w => "-".repeat(w)).join(" | ") + " |";
  return [fmt(headers), sep, ...rows.map(fmt)].join("\n");
}

function configYaml(cfg: VotoMisterConfig): string {
  return [
    `anchor: ${cfg.anchor}`,
    `minutes:`,
    `  threshold: ${cfg.minutes.threshold}`,
    `  fullSample: ${cfg.minutes.fullSample}`,
    `  extrapolationCap: ${cfg.minutes.extrapolationCap}`,
    `stripping:`,
    ...Object.entries(cfg.stripping).map(([k, v]) => `  ${k}: ${v}`),
    `blend:`,
    `  alphaStats: ${cfg.blend.alphaStats}`,
    `  betaRating: ${cfg.blend.betaRating}`,
    `stats:`,
    ...Object.entries(cfg.stats).map(([k, v]) =>
      `  ${k}: { ${Object.entries(v).map(([kk, vv]) => `${kk}: ${vv}`).join(", ")} }`
    ),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Computed extends Row, ComputedVoti {}

async function main() {
  const config = await loadActiveConfig();
  console.log(`[backtest] Config sourced from DB: ${config ? "OK" : "FAILED"}`);
  console.log(`[backtest] anchor=${config.anchor}, alpha=${config.blend.alphaStats}, beta=${config.blend.betaRating}`);

  const rows = await fetchRows();

  // Computa voti
  const computed: Computed[] = rows.map(r => ({
    ...r,
    ...computeVoti(r.stats_json, config),
  }));

  // ---------------------------------------------------------------------------
  // Distribuzione 4 voti
  // ---------------------------------------------------------------------------

  const vsOnly   = computed.filter(r => r.votoStatsOnly      !== null).map(r => r.votoStatsOnly!);
  const vsStrip  = computed.filter(r => r.votoRatingStripped  !== null).map(r => r.votoRatingStripped!);
  const vsBlend  = computed.filter(r => r.votoBlend           !== null).map(r => r.votoBlend!);
  const vsSynth  = computed.filter(r => r.votoSynthesis       !== null).map(r => r.votoSynthesis!);

  const distStats = {
    stats_only:      stats(vsOnly),
    rating_stripped: stats(vsStrip),
    blend:           stats(vsBlend),
    synthesis:       stats(vsSynth),
  };

  // ---------------------------------------------------------------------------
  // Top / Bottom 10 per voto_synthesis
  // ---------------------------------------------------------------------------

  const withSynth = computed.filter(r => r.votoSynthesis !== null);
  const sorted    = [...withSynth].sort((a, b) => b.votoSynthesis! - a.votoSynthesis!);
  const top10     = sorted.slice(0, 10);
  const bot10     = sorted.slice(-10).reverse();

  function rowToTableCells(r: Computed): string[] {
    const gol    = r.stats_json.goals.total    ?? 0;
    const ass    = r.stats_json.goals.assists  ?? 0;
    const gialli = r.stats_json.cards.yellow   ?? 0;
    const min    = r.stats_json.games.minutes  ?? 0;
    const api    = r.stats_json.games.rating   ?? "—";
    return [
      r.name,
      r.real_team,
      r.role_classic,
      String(min),
      String(r.round),
      String(api),
      r2(r.votoStatsOnly!),
      r2(r.votoRatingStripped ?? 0),
      r2(r.votoBlend ?? 0),
      r2(r.votoSynthesis!),
      String(gol),
      String(ass),
      String(gialli),
    ];
  }

  const tableHeaders = ["Nome", "Squadra", "Ruolo", "Min", "R", "API", "Stats", "Stripped", "Blend", "SYNTH", "Gol", "Ass", "Gialli"];

  // ---------------------------------------------------------------------------
  // Correlazioni
  // ---------------------------------------------------------------------------

  const forCorr = computed.filter(
    r => r.votoStatsOnly !== null && r.votoRatingStripped !== null && r.votoBlend !== null
  );
  const corrSO  = forCorr.map(r => r.votoStatsOnly!);
  const corrST  = forCorr.map(r => r.votoRatingStripped!);
  const corrBL  = forCorr.map(r => r.votoBlend!);

  const corrMatrix = {
    "stats_only × stripped": pearson(corrSO, corrST),
    "stats_only × blend":    pearson(corrSO, corrBL),
    "stripped  × blend":     pearson(corrST, corrBL),
  };

  // ---------------------------------------------------------------------------
  // Distribuzione per ruolo
  // ---------------------------------------------------------------------------

  const roles = ["GK", "DEF", "MID", "ATT"];
  const byRole = roles.map(role => {
    const vals = withSynth.filter(r => r.role_classic === role).map(r => r.votoSynthesis!);
    return { role, ...stats(vals) };
  });

  // ---------------------------------------------------------------------------
  // Sample diagnostici
  // ---------------------------------------------------------------------------

  function findPlayer(name: string, round?: number): Computed | undefined {
    return computed.find(r =>
      r.name.toLowerCase().includes(name.toLowerCase()) &&
      (round === undefined || r.round === round)
    );
  }

  const mosquera = findPlayer("Mosquera", 1);
  const thuram   = findPlayer("Thuram", 1);

  const under15  = computed.filter(r => {
    const min = r.stats_json.games.minutes;
    return min !== null && min < 15;
  }).slice(0, 5);

  const nullRating = computed.filter(r => r.stats_json.games.rating === null).slice(0, 5);

  // ---------------------------------------------------------------------------
  // Stampa stdout
  // ---------------------------------------------------------------------------

  console.log("\n=== Voto Mister v0 — Backtest round 1-2 ===\n");
  console.log(`Righe totali:        ${computed.length}`);
  console.log(`Con voto_synthesis:  ${withSynth.length}`);
  console.log(`NULL (sotto soglia): ${computed.length - withSynth.length}`);
  console.log("");
  console.log("Distribuzione voto_synthesis:");
  const ss = distStats.synthesis;
  console.log(`  n=${ss.n}  min=${r2(ss.min)}  avg=${r2(ss.mean)}  median=${r2(ss.median)}  std=${r2(ss.std)}  max=${r2(ss.max)}`);
  console.log("");
  console.log("Distribuzione voto_stats_only:");
  const so = distStats.stats_only;
  console.log(`  n=${so.n}  min=${r2(so.min)}  avg=${r2(so.mean)}  median=${r2(so.median)}  std=${r2(so.std)}  max=${r2(so.max)}`);
  console.log("");
  console.log("Correlazioni:");
  Object.entries(corrMatrix).forEach(([k, v]) => {
    console.log(`  ${k}: ${isNaN(v) ? "N/A" : r3(v)}`);
  });
  console.log("");

  // ---------------------------------------------------------------------------
  // Costruzione markdown
  // ---------------------------------------------------------------------------

  const distRows = Object.entries(distStats).map(([nome, s]) => [
    nome,
    String(s.n),
    r2(s.min),
    r2(s.mean),
    r2(s.median),
    r2(s.std),
    r2(s.max),
  ]);

  const corrRows = Object.entries(corrMatrix).map(([k, v]) => [k, isNaN(v) ? "N/A" : r3(v)]);

  const roleRows = byRole.map(r => [
    r.role, String(r.n), r2(r.mean), r2(r.std),
  ]);

  function diagnosticBlock(label: string, row: Computed | undefined): string {
    if (!row) return `**${label}**: non trovato nel dataset\n`;
    return [
      `**${label}** — ${row.name} (${row.real_team}, ${row.role_classic}, round ${row.round})`,
      `- Minuti: ${row.stats_json.games.minutes ?? "null"}`,
      `- Rating API: ${row.stats_json.games.rating ?? "null"}`,
      `- Gol: ${row.stats_json.goals.total ?? 0} | Assist: ${row.stats_json.goals.assists ?? 0}`,
      `- voto_stats_only:      ${row.votoStatsOnly      ?? "NULL"}`,
      `- voto_rating_stripped: ${row.votoRatingStripped ?? "NULL"}`,
      `- voto_blend:           ${row.votoBlend          ?? "NULL"}`,
      `- voto_synthesis:       ${row.votoSynthesis      ?? "NULL"}`,
    ].join("\n");
  }

  const under15Blocks = under15.map(r =>
    diagnosticBlock(`Sub-15' (${r.stats_json.games.minutes} min)`, r)
  ).join("\n\n");

  const nullRatingBlocks = nullRating.map(r =>
    diagnosticBlock(`Rating NULL`, r)
  ).join("\n\n");

  const md = `# Voto Mister v0 — Backtest report round 1-2

Generato il ${new Date().toISOString()}

## Configurazione

\`\`\`yaml
${configYaml(config)}
\`\`\`

## Distribuzione 4 voti

${mdTable(
  ["Voto", "n_validi", "min", "mean", "median", "std", "max"],
  distRows
)}

## Top 10 per voto_synthesis

${mdTable(tableHeaders, top10.map(rowToTableCells))}

## Bottom 10 per voto_synthesis

${mdTable(tableHeaders, bot10.map(rowToTableCells))}

## Correlazioni (n=${forCorr.length} righe con tutti e tre i voti)

${mdTable(["Coppia"], corrRows.map(r => [r[0]!, r[1]!]))}

Nota: la correlazione strips × blend sarà alta per costruzione (β=0.65 sul rating stripped).

## Distribuzione per ruolo (voto_synthesis)

${mdTable(["Ruolo", "n", "mean", "std"], roleRows)}

## Sample diagnostici

### Mosquera 17' — 2 gol da subentrato

${diagnosticBlock("Mosquera (round 1)", mosquera)}

### Thuram 90' — 2 gol titular

${diagnosticBlock("Thuram (round 1)", thuram)}

### Giocatori sotto 15' — devono avere voto NULL

${under15.length > 0 ? under15Blocks : "_Nessun giocatore sotto 15' nel dataset (tutti gli skip avvengono prima dell'inserimento)._"}

### Giocatori con rating API NULL — voto_synthesis cade su stats_only

${nullRating.length > 0 ? nullRatingBlocks : "_Nessun giocatore con rating NULL nel dataset corrente._"}
`;

  const reportsDir = join(__dirname, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = join(reportsDir, `backtest-v0-${timestamp}.md`);
  writeFileSync(outPath, md, "utf8");

  console.log(`Report scritto in ${outPath}`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
