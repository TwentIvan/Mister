/**
 * Listoni — import quotazioni esterne (fantacalcio.it) e matching anagrafica.
 *
 * POST /listoni/import  — body binario xlsx (application/octet-stream),
 *                         query: season, label, fileName?. Parsea il file
 *                         (exceljs → matrice celle → parseListoneRows),
 *                         matcha contro players (matchBatch) e salva batch +
 *                         entries in transazione. Risponde col report.
 * GET  /listoni         — elenco batch con report aggregato dal DB.
 * GET  /listoni/:id/entries — entries filtrabili per match_method (base
 *                         della UI di riconciliazione, T151).
 *
 * Il matching qui è SOLO automatico (exact/normalized/fuzzy/none): la
 * correzione manuale (manual/excluded) arriva con T151.
 */

import { Router, type IRouter, raw } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@workspace/db";
import { listoni, listoneEntries, playersTable } from "@workspace/db";
import {
  parseListoneRows,
  matchBatch,
  type Cell,
  type CandidatePlayer,
} from "@workspace/listone-matcher";
import {
  ImportListoneQueryParams,
  ListListoniResponse,
  ListListoneEntriesParams,
  ListListoneEntriesQueryParams,
  ListListoneEntriesResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/** Converte un worksheet exceljs in matrice di celle primitive per il parser puro. */
function worksheetToCells(ws: ExcelJS.Worksheet): Cell[][] {
  const out: Cell[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: Cell[] = [];
    // row.values è 1-indexed (indice 0 vuoto)
    const values = row.values as ExcelJS.CellValue[];
    for (let c = 1; c < values.length; c++) {
      const v = values[c];
      if (v === null || v === undefined) cells.push(null);
      else if (typeof v === "number" || typeof v === "string") cells.push(v);
      else if (typeof v === "object") {
        // celle "ricche": formula → result, richText → concatenazione, altro → testo
        if ("result" in v && (typeof v.result === "string" || typeof v.result === "number")) {
          cells.push(v.result);
        } else if ("richText" in v && Array.isArray(v.richText)) {
          cells.push(v.richText.map((r) => r.text).join(""));
        } else if (v instanceof Date) {
          cells.push(v.toISOString());
        } else {
          cells.push(String(v));
        }
      } else {
        cells.push(String(v));
      }
    }
    out[rowNumber - 1] = cells;
  });
  return out;
}

// ── POST /listoni/import ──────────────────────────────────────────────────────
router.post(
  "/listoni/import",
  requireAuth,
  raw({ type: ["application/octet-stream", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], limit: "10mb" }),
  async (req, res): Promise<void> => {
    const parsedQ = ImportListoneQueryParams.safeParse(req.query);
    if (!parsedQ.success) {
      res.status(400).json({ error: parsedQ.error.message });
      return;
    }
    const { season, label, fileName } = parsedQ.data;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Body binario mancante: inviare il file xlsx come application/octet-stream" });
      return;
    }

    // 1) Parsing del file
    let cells: Cell[][];
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.body as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      if (!ws) {
        res.status(400).json({ error: "Il file non contiene fogli" });
        return;
      }
      cells = worksheetToCells(ws);
    } catch (e) {
      req.log.warn({ err: String(e) }, "listone: xlsx non parsabile");
      res.status(400).json({ error: "File non parsabile: atteso un xlsx valido" });
      return;
    }

    const outcome = parseListoneRows(cells);
    if (outcome.rows.length === 0) {
      res.status(400).json({
        error: "Nessuna riga valida nel file",
        skipped: outcome.skipped,
      });
      return;
    }

    // 2) Matching contro l'anagrafica
    const anagrafica = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        fullName: playersTable.fullName,
        realTeam: playersTable.realTeam,
        roleClassic: playersTable.roleClassic,
      })
      .from(playersTable);

    const { results, report } = matchBatch(outcome.rows, anagrafica as CandidatePlayer[]);

    // 3) Persistenza in transazione
    const listoneId = await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(listoni)
        .values({
          season,
          label,
          fileName: fileName ?? null,
          source: "fantacalcio_it",
          createdBy: req.user?.sub ?? null,
        })
        .returning({ id: listoni.id });

      const now = new Date();
      const rows = outcome.rows.map((r, i) => ({
        listoneId: batch!.id,
        sourcePlayerId: r.sourcePlayerId,
        rawName: r.rawName,
        rawTeam: r.rawTeam,
        rawRoleClassic: r.rawRoleClassic,
        rawRolesMantra: r.rawRolesMantra,
        qtA: r.qtA,
        qtI: r.qtI,
        fvm: r.fvm,
        fuoriLista: r.fuoriLista,
        pgv: r.pgv,
        mv: r.mv,
        fm: r.fm,
        rawFantaSquadra: r.rawFantaSquadra,
        costo: r.costo,
        matchedPlayerId: results[i]!.playerId,
        matchMethod: results[i]!.method,
        matchConfidence: results[i]!.confidence,
        matchedAt: results[i]!.playerId ? now : null,
      }));

      // insert a blocchi (700+ righe: restiamo sotto i limiti di parametri pg)
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx.insert(listoneEntries).values(rows.slice(i, i + CHUNK));
      }
      return batch!.id;
    });

    req.log.info({ listoneId, report }, "listone importato");
    // Convenzione della casa: le 201 rispondono senza zod-parse (orval genera
    // gli schemi zod solo per le 200); la shape è comunque quella della spec.
    res.status(201).json({
      listone_id: listoneId,
      report,
      skipped: outcome.skipped,
    });
  },
);

// ── GET /listoni ──────────────────────────────────────────────────────────────
router.get("/listoni", async (_req, res): Promise<void> => {
  const batches = await db.select().from(listoni).orderBy(desc(listoni.createdAt));

  // report aggregato per batch in una query sola
  const counts = await db
    .select({
      listoneId: listoneEntries.listoneId,
      method: listoneEntries.matchMethod,
      n: count(),
    })
    .from(listoneEntries)
    .groupBy(listoneEntries.listoneId, listoneEntries.matchMethod);

  const byId = new Map<number, Record<string, number>>();
  for (const c of counts) {
    const m = byId.get(c.listoneId) ?? {};
    m[c.method] = Number(c.n);
    byId.set(c.listoneId, m);
  }

  res.json(
    ListListoniResponse.parse({
      items: batches.map((b) => {
        const m = byId.get(b.id) ?? {};
        const report = {
          exact: m.exact ?? 0,
          normalized: m.normalized ?? 0,
          fuzzy: m.fuzzy ?? 0,
          none: m.none ?? 0,
          total: Object.values(m).reduce((a, x) => a + x, 0),
        };
        return {
          id: b.id,
          season: b.season,
          source: b.source,
          label: b.label,
          file_name: b.fileName,
          created_at: b.createdAt.toISOString(),
          report,
        };
      }),
    }),
  );
});

// ── GET /listoni/:id/entries ──────────────────────────────────────────────────
router.get("/listoni/:id/entries", async (req, res): Promise<void> => {
  const parsedP = ListListoneEntriesParams.safeParse(req.params);
  const parsedQ = ListListoneEntriesQueryParams.safeParse(req.query);
  if (!parsedP.success || !parsedQ.success) {
    res.status(400).json({ error: (parsedP.success ? parsedQ : parsedP).error?.message ?? "parametri invalidi" });
    return;
  }
  const { id } = parsedP.data;
  const { method, limit, offset } = parsedQ.data;

  const [batch] = await db.select().from(listoni).where(eq(listoni.id, id)).limit(1);
  if (!batch) {
    res.status(404).json({ error: "Listone inesistente" });
    return;
  }

  const where = method
    ? and(eq(listoneEntries.listoneId, id), eq(listoneEntries.matchMethod, method))
    : eq(listoneEntries.listoneId, id);

  const lim = limit ?? 100;
  const off = offset ?? 0;

  const items = await db
    .select({
      entry: listoneEntries,
      matchedName: playersTable.name,
    })
    .from(listoneEntries)
    .leftJoin(playersTable, eq(listoneEntries.matchedPlayerId, playersTable.id))
    .where(where)
    .orderBy(listoneEntries.id)
    .limit(lim)
    .offset(off);

  const [{ total }] = await db
    .select({ total: count() })
    .from(listoneEntries)
    .where(where);

  res.json(
    ListListoneEntriesResponse.parse({
      items: items.map(({ entry: e, matchedName }) => ({
        id: e.id,
        listone_id: e.listoneId,
        source_player_id: e.sourcePlayerId,
        raw_name: e.rawName,
        raw_team: e.rawTeam,
        raw_role_classic: e.rawRoleClassic,
        raw_roles_mantra: e.rawRolesMantra,
        qt_a: e.qtA,
        qt_i: e.qtI,
        fvm: e.fvm,
        fuori_lista: e.fuoriLista,
        mv: e.mv,
        fm: e.fm,
        fanta_squadra: e.rawFantaSquadra,
        costo: e.costo,
        matched_player_id: e.matchedPlayerId,
        matched_player_name: matchedName,
        match_method: e.matchMethod,
        match_confidence: e.matchConfidence,
      })),
      total: Number(total),
      limit: lim,
      offset: off,
    }),
  );
});

export default router;
