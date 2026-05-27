import { pgTable, serial, text, jsonb, boolean, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { federations } from "./federations";

export const votoAlgorithmConfig = pgTable(
  "voto_algorithm_config",
  {
    id: serial("id").primaryKey(),
    federationId: text("federation_id").references(() => federations.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    configJson: jsonb("config_json").notNull(),
    status: text("status").notNull(),
    isProtected: boolean("is_protected").notNull().default(false),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check("voto_config_status_check", sql`${table.status} IN ('draft', 'active', 'archived')`),
  })
);
