import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { seedSystemTemplates } from "./templates";
import { seedVotoAlgorithmConfig } from "./voto-algorithm-config";
import { seedTeamColors } from "./team-colors";
import { seedTestLeagueMvp } from "./test-league-mvp";
import { seedTestCompetition } from "./test-competition";
import { seedDefaultLineups } from "./default-lineups";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

Promise.resolve()
  .then(() => seedSystemTemplates(db))
  .then(() => seedVotoAlgorithmConfig(db))
  .then(() => seedTeamColors(db))
  .then(() => seedTestLeagueMvp(db))
  .then(() => seedTestCompetition(db))
  .then(() => seedDefaultLineups(db))
  .then(() => {
    console.log("Seed completato.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed fallito:", err);
    process.exit(1);
  });
