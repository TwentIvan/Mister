/**
 * persist-voto-mister.ts — Persiste voto_synthesis come voto_mister in DB.
 *
 * Legge player_giornata_stats, computa i 4 voti con la config attiva,
 * aggiorna voto_mister in batch usando un single UPDATE con VALUES.
 * Le 71 righe sotto soglia 15' rimangono NULL (semanticamente corretto).
 *
 * Uso: pnpm --filter @workspace/scripts run voto:persist
 */

import { pool } from "@workspace/db";
import { defaultVotoConfig } from "./config.js";
import { computeVoti } from "./compute.js";
import type { StatsJson } from "./compute.js";

interface Row {
  id: number;
  stats_json: StatsJson;
}

async function fetchRows(): Promise<Row[]> {
  const res = await pool.query<Row>(`
    SELECT id, stats_json
    FROM player_giornata_stats
    ORDER BY id
  `);
  return res.rows;
}

async function main() {
  const rows = await fetchRows();
  console.log(`Righe lette: ${rows.length}`);

  // Computa voti in memoria
  const updates: Array<{ id: number; voto: number }> = [];
  let nullCount = 0;

  for (const r of rows) {
    const v = computeVoti(r.stats_json, defaultVotoConfig);
    if (v.votoSynthesis !== null) {
      updates.push({ id: r.id, voto: v.votoSynthesis });
    } else {
      nullCount++;
    }
  }

  console.log(`Da aggiornare: ${updates.length}  |  Restano NULL (sotto soglia): ${nullCount}`);

  if (updates.length === 0) {
    console.log("Niente da aggiornare — uscita.");
    await pool.end();
    return;
  }

  // UPDATE batchato: un singolo round-trip con VALUES
  const valuesClause = updates
    .map(u => `(${u.id}, ${u.voto})`)
    .join(",\n  ");

  const sql = `
    UPDATE player_giornata_stats AS t
    SET voto_mister = v.voto
    FROM (VALUES
      ${valuesClause}
    ) AS v(id, voto)
    WHERE t.id = v.id
  `;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(sql);
    console.log(`Righe aggiornate: ${res.rowCount}`);

    // Sanity check in-transaction
    const check = await client.query<{
      total: string;
      popolati: string;
      null_rimasti: string;
      media: string;
      std: string;
      minimo: string;
      massimo: string;
    }>(`
      SELECT
        COUNT(*)                                               AS total,
        COUNT(*) FILTER (WHERE voto_mister IS NOT NULL)       AS popolati,
        COUNT(*) FILTER (WHERE voto_mister IS NULL)           AS null_rimasti,
        ROUND(AVG(voto_mister)::numeric, 4)                   AS media,
        ROUND(STDDEV(voto_mister)::numeric, 4)                AS std,
        MIN(voto_mister)                                      AS minimo,
        MAX(voto_mister)                                      AS massimo
      FROM player_giornata_stats
    `);

    const row = check.rows[0]!;
    console.log("\n=== Sanity check in-transaction ===");
    console.log(`total=${row.total}  popolati=${row.popolati}  null_rimasti=${row.null_rimasti}`);
    console.log(`media=${row.media}  std=${row.std}  min=${row.minimo}  max=${row.massimo}`);

    // Soglie di accettazione (da backtest v2)
    const total      = parseInt(row.total);
    const popolati   = parseInt(row.popolati);
    const nullRimasti = parseInt(row.null_rimasti);
    const media      = parseFloat(row.media);
    const stdDev     = parseFloat(row.std);
    const minimo     = parseFloat(row.minimo);
    const massimo    = parseFloat(row.massimo);

    const ok =
      total      === 623   &&
      popolati   === 552   &&
      nullRimasti === 71   &&
      media      >= 6.50 && media  <= 6.80  &&
      stdDev     >= 0.30 && stdDev <= 0.45  &&
      minimo     >= 5.50 && minimo <= 5.90  &&
      massimo    >= 8.30 && massimo <= 8.70;

    if (ok) {
      await client.query("COMMIT");
      console.log("\n✓ COMMIT — tutti i check superati.");
    } else {
      await client.query("ROLLBACK");
      console.error("\n✗ ROLLBACK — uno o più check falliti. Valori attesi:");
      console.error("  total=623, popolati=552, null_rimasti=71");
      console.error("  media [6.50-6.80], std [0.30-0.45], min [5.50-5.90], max [8.30-8.70]");
      process.exit(1);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ROLLBACK per eccezione:", err);
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
