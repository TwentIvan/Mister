import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { teamColors } from "../schema/team-colors";
import { sql } from "drizzle-orm";

const teamColorsSeed = [
  { teamId: 487,  teamName: "Lazio",         primaryHex: "#87CEEB", secondaryHex: "#FFFFFF", textHex: "#0A1F17" },
  { teamId: 489,  teamName: "AC Milan",      primaryHex: "#FB090B", secondaryHex: "#000000", textHex: "#FFFFFF" },
  { teamId: 490,  teamName: "Cagliari",      primaryHex: "#C8102E", secondaryHex: "#002654", textHex: "#FFFFFF" },
  { teamId: 492,  teamName: "Napoli",        primaryHex: "#009EE0", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 494,  teamName: "Udinese",       primaryHex: "#000000", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 495,  teamName: "Genoa",         primaryHex: "#C8102E", secondaryHex: "#002654", textHex: "#FFFFFF" },
  { teamId: 496,  teamName: "Juventus",      primaryHex: "#000000", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 497,  teamName: "AS Roma",       primaryHex: "#8E1F2F", secondaryHex: "#F0BC42", textHex: "#FFFFFF" },
  { teamId: 499,  teamName: "Atalanta",      primaryHex: "#1565C0", secondaryHex: "#000000", textHex: "#FFFFFF" },
  { teamId: 500,  teamName: "Bologna",       primaryHex: "#D6263A", secondaryHex: "#1B3B6F", textHex: "#FFFFFF" },
  { teamId: 502,  teamName: "Fiorentina",    primaryHex: "#6F2DA8", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 503,  teamName: "Torino",        primaryHex: "#8B1A1A", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 504,  teamName: "Hellas Verona", primaryHex: "#FFD700", secondaryHex: "#1F4E8C", textHex: "#0A1F17" },
  { teamId: 505,  teamName: "Inter",         primaryHex: "#0067B1", secondaryHex: "#000000", textHex: "#FFFFFF" },
  { teamId: 511,  teamName: "Empoli",        primaryHex: "#1976D2", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 517,  teamName: "Venezia",       primaryHex: "#006633", secondaryHex: "#000000", textHex: "#FFFFFF" },
  { teamId: 523,  teamName: "Parma",         primaryHex: "#FFD700", secondaryHex: "#003E7E", textHex: "#0A1F17" },
  { teamId: 867,  teamName: "Lecce",         primaryHex: "#FFD700", secondaryHex: "#C8102E", textHex: "#0A1F17" },
  { teamId: 895,  teamName: "Como",          primaryHex: "#0066CC", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
  { teamId: 1579, teamName: "Monza",         primaryHex: "#D90E2E", secondaryHex: "#FFFFFF", textHex: "#FFFFFF" },
];

export async function seedTeamColors(db: NodePgDatabase<Record<string, never>>) {
  console.log("Seed team_colors...");
  for (const row of teamColorsSeed) {
    await db
      .insert(teamColors)
      .values({ ...row, source: "manual_seed_v1" })
      .onConflictDoNothing();
  }
  console.log(`team_colors: ${teamColorsSeed.length} righe processate (skip se già esistenti).`);
}
