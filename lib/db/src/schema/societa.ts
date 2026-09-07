/**
 * Società — identità persistente cross-lega posseduta dall'utente.
 *
 * Contiene SOLO i campi identità (nome, stemma, colori, stadio).
 * Roster, budget e crediti vivono sulla partecipazione (fanta_teams).
 */

import {
  pgTable,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ============================================================
// TIPI DI SUPPORTO
// ============================================================

/** Maglia personalizzata (colori, dettagli). Definita qui, fonte di verità. */
export interface JerseyConfig {
  primaryColor: string;
  secondaryColor: string;
  /** T173.b: terzo e quarto colore (bordi, dettagli, banda) */
  tertiaryColor?: string;
  quaternaryColor?: string;
  pattern: "solid" | "stripes_vertical" | "stripes_horizontal" | "halved" | "checkered" | "sash" | "quarters";
  /** Sponsor testuale opzionale sul petto */
  sponsor?: string;
}

// ============================================================
// TABELLA
// ============================================================

export const societa = pgTable("societa", {
  id: text("id").primaryKey(),

  /** Utente proprietario — l'identità è sua, cross-lega. */
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /** Nome ufficiale della società (es. "Champions del Bar Roma 2025"). */
  name: text("name").notNull(),

  /**
   * Nome pronunciato dal battitore in asta — può differire dal nome
   * ufficiale per ragioni di pronuncia (es. "Bar Roma").
   */
  nameAuction: text("name_auction"),

  /** URL dello stemma/logo caricato dal manager. */
  logoUrl: text("logo_url"),

  /** Configurazione visuale della maglia. */
  jersey: jsonb("jersey").$type<JerseyConfig>(),

  /** Nome dello stadio della società (facoltativo). */
  stadio: text("stadio"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Societa = typeof societa.$inferSelect;
export type NewSocieta = typeof societa.$inferInsert;
