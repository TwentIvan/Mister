/**
 * Listone — quotazioni importate da fonti esterne (fantacalcio.it & simili).
 *
 * Un `listone` è un batch di import (file caricato dall'admin): stagione,
 * fonte, etichetta. Le `listone_entries` sono le righe del file, con i dati
 * grezzi COME SCRITTI NEL FILE (rawName, rawTeam, ruoli loro) più l'esito
 * del matching verso la nostra anagrafica `players` (API-Football).
 *
 * Filosofia (bussola): il listone è una SORGENTE AFFIANCATA, non un
 * rimpiazzo — la lega sceglie via config (`price_source`, T151) se i prezzi
 * base d'asta vengono da qui o dall'anagrafica. L'anagrafica resta players.
 *
 * Il matching è a più stadi (exact → normalized → fuzzy → none) e ogni entry
 * ricorda COME è stata matchata (`matchMethod`) e con che confidenza, così la
 * UI di riconciliazione (T151) mostra solo i casi dubbi e l'admin può
 * correggere a mano (`manual`) o escludere (`excluded`).
 */

import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  serial,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";
import { users } from "./users";

// ============================================================
// ENUMS (union types, come da convenzione dello schema)
// ============================================================

/** Fonte del listone. Per ora solo fantacalcio.it; enum aperto per il futuro. */
export type ListoneSource = "fantacalcio_it" | "custom";

/**
 * Metodo con cui l'entry è stata associata a un player:
 * - exact:      nome+squadra identici (case-insensitive)
 * - normalized: identici dopo normalizzazione (accenti, punteggiatura, iniziali)
 * - fuzzy:      distanza di edit sotto soglia, stessa squadra e ruolo compatibile
 * - manual:     scelto dall'admin nella UI di riconciliazione (T151)
 * - none:       nessun match trovato (orfano, da risolvere o escludere)
 * - excluded:   l'admin ha deciso che questa entry non entra nel pool
 */
export type ListoneMatchMethod =
  | "exact"
  | "normalized"
  | "fuzzy"
  | "manual"
  | "none"
  | "excluded";

// ============================================================
// LISTONI (batch di import)
// ============================================================

export const listoni = pgTable("listoni", {
  id: serial("id").primaryKey(),

  /** Stagione in formato "2026-27" */
  season: text("season").notNull(),

  source: text("source").$type<ListoneSource>().notNull().default("fantacalcio_it"),

  /** Etichetta libera, es. "Quotazioni ufficiali 4 agosto" */
  label: text("label").notNull(),

  /** Nome del file originale caricato (tracciabilità) */
  fileName: text("file_name"),

  /** Chi ha importato */
  createdBy: text("created_by").references(() => users.id),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Listone = typeof listoni.$inferSelect;
export type NewListone = typeof listoni.$inferInsert;

// ============================================================
// LISTONE ENTRIES (righe del file + esito matching)
// ============================================================

export const listoneEntries = pgTable(
  "listone_entries",
  {
    id: serial("id").primaryKey(),

    listoneId: integer("listone_id")
      .notNull()
      .references(() => listoni.id, { onDelete: "cascade" }),

    /** ID del giocatore NEL SISTEMA DELLA FONTE (colonna "Id" del file), se presente.
     *  Prezioso: su re-import della stessa fonte il match diventa una join. */
    sourcePlayerId: integer("source_player_id"),

    /** Nome come scritto nel file, non normalizzato */
    rawName: text("raw_name").notNull(),
    /** Squadra come scritta nel file */
    rawTeam: text("raw_team").notNull(),

    /** Ruolo Classic della fonte: P/D/C/A */
    rawRoleClassic: text("raw_role_classic").notNull(),
    /** Ruoli Mantra della fonte, stringa grezza es. "Dd;E" o "W/T" */
    rawRolesMantra: text("raw_roles_mantra"),

    /** Quotazione attuale (Qt.A / QUOT.) — la colonna usata come prezzo base d'asta */
    qtA: real("qt_a"),
    /** Quotazione iniziale di stagione (Qt.I), assente nel formato leghe */
    qtI: real("qt_i"),
    /** FVM (Fantavalore di mercato), scala /1000 della fonte */
    fvm: real("fvm"),

    /** "Fuori lista": giocatore uscito dalla Serie A ma ancora nel file */
    fuoriLista: boolean("fuori_lista").notNull().default(false),
    /** Presenze a voto / media voto / fantamedia (formato leghe) */
    pgv: real("pgv"),
    mv: real("mv"),
    fm: real("fm"),
    /** Stato rosa nella lega di origine: nome fantasquadra e costo pagato.
     *  È il ponte per l'import rose (T152): qui restano dati GREZZI. */
    rawFantaSquadra: text("raw_fanta_squadra"),
    costo: real("costo"),

    // ── Esito matching ──────────────────────────────────────
    matchedPlayerId: integer("matched_player_id").references(() => players.id),
    matchMethod: text("match_method").$type<ListoneMatchMethod>().notNull().default("none"),
    /** 0..1 — 1 per exact/manual, decrescente per fuzzy */
    matchConfidence: real("match_confidence"),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
  },
  (t) => [
    index("listone_entries_listone_idx").on(t.listoneId),
    index("listone_entries_matched_player_idx").on(t.matchedPlayerId),
    // Una sola entry per giocatore-fonte dentro lo stesso listone
    uniqueIndex("listone_entries_source_unique")
      .on(t.listoneId, t.sourcePlayerId)
      .where(sql`${t.sourcePlayerId} IS NOT NULL`),
  ],
);

export type ListoneEntry = typeof listoneEntries.$inferSelect;
export type NewListoneEntry = typeof listoneEntries.$inferInsert;
