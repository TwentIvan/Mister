import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./flags";

export {
  templateProfiles as templateProfilesTable,
  federations as federationsTable,
  leagues as leaguesTable,
  competitions as competitionsTable,
  marketEvents as marketEventsTable,
  fantaTeams as fantaTeamsTable,
  contracts as contractsTable,
  players as playersTable,
} from "./schema";
