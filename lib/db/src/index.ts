import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error(
    "DATABASE_URL (o PGHOST) must be set. Did you forget to provision a database?",
  );
}

// Se PGHOST è disponibile, usa le PG* vars native (più affidabili in Replit).
// Il connectionString da DATABASE_URL può avere sslmode=disable che causa timeout.
const poolConfig: ConstructorParameters<typeof Pool>[0] = process.env.PGHOST
  ? {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    }
  : {
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    };

export const pool = new Pool(poolConfig);
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
