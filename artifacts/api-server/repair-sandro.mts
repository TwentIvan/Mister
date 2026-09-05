/**
 * Riparazione one-shot del claim errato (Sandro ↔ Alby) — 5 set 2026.
 * Autosufficiente: individua lo slot di Sandro dal CONTENUTO (possiede
 * Lautaro), riattacca la società originale "Sandro" se esiste, altrimenti
 * la RICREA; sposta l'account alby@gmail.com sullo slot con società "Alby".
 * Output: UNA riga di verdetto (canale chat-friendly).
 * Idempotente: rieseguirlo riafferma lo stato corretto.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const LID = "lg-DI0IWqa7";

async function main() {
  const out: string[] = [];

  // 1) Slot di Sandro = possiede Lautaro
  const t = await db.execute(sql`
    SELECT DISTINCT ft.id FROM fanta_teams ft
    JOIN contracts c ON c.fanta_team_id = ft.id
    JOIN players p ON p.id = c.player_id
    WHERE ft.league_id = ${LID} AND p.name ILIKE '%lautaro%'`);
  const tid = (t.rows[0] as { id?: string })?.id;
  if (!tid) { console.log("KO: slot con Lautaro non trovato"); process.exit(1); }

  // 2) Società "Sandro": orfana se c'è, altrimenti si ricrea
  const admin = await db.execute(sql`SELECT id FROM users WHERE email = 'ivan.lotorto@gmail.com'`);
  const adminId = (admin.rows[0] as { id?: string })?.id ?? null;

  const orph = await db.execute(sql`
    SELECT id FROM societa WHERE lower(name) = 'sandro'
    AND id NOT IN (SELECT societa_id FROM fanta_teams WHERE societa_id IS NOT NULL)
    LIMIT 1`);
  let sid = (orph.rows[0] as { id?: string })?.id ?? null;
  if (sid) {
    out.push("società Sandro riattaccata");
  } else {
    sid = `soc-${nanoid(8)}`;
    await db.execute(sql`
      INSERT INTO societa (id, owner_user_id, name, name_auction, jersey)
      VALUES (${sid}, ${adminId}, 'Sandro', 'Sandro',
              '{"primaryColor":"#1f4733","secondaryColor":"#efe6d3","pattern":"solid"}'::jsonb)`);
    out.push("società Sandro RICREATA");
  }

  // 3) Slot di Sandro: società giusta, manager libero
  await db.execute(sql`UPDATE fanta_teams SET societa_id = ${sid}, manager_user_id = NULL WHERE id = ${tid}`);

  // 4) Alby sul suo slot (società di nome 'alby'), MAI su quello di Sandro
  const alby = await db.execute(sql`SELECT id FROM users WHERE lower(email) = 'alby@gmail.com'`);
  const aid = (alby.rows[0] as { id?: string })?.id ?? null;
  if (aid) {
    const r = await db.execute(sql`
      UPDATE fanta_teams ft SET manager_user_id = ${aid}
      FROM societa s WHERE s.id = ft.societa_id AND ft.league_id = ${LID}
      AND lower(s.name) = 'alby' AND ft.id != ${tid}
      RETURNING ft.id`);
    out.push(r.rows.length ? "Alby sul suo slot" : "slot 'Alby' non trovato per Alby");
  } else {
    out.push("account alby@gmail.com non trovato");
  }

  // 5) Verdetto monoriga
  const check = await db.execute(sql`
    SELECT s.name FROM fanta_teams ft JOIN societa s ON s.id = ft.societa_id WHERE ft.id = ${tid}`);
  const nome = (check.rows[0] as { name?: string })?.name ?? "?";
  console.log(`VERDETTO: slot-di-Lautaro ora si chiama "${nome}" | ${out.join(" | ")}`);
  process.exit(0);
}
main().catch((e) => { console.log("KO:", String(e).slice(0, 120)); process.exit(1); });
