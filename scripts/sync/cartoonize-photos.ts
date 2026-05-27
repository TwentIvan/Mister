/**
 * cartoonize-photos.ts
 * Converte le foto giocatori in stile cartoon via Replicate fofr/face-to-many.
 *
 * Uso:
 *   pnpm tsx scripts/sync/cartoonize-photos.ts --players 1624,35544,6409
 *   pnpm tsx scripts/sync/cartoonize-photos.ts --all-mario
 *   pnpm tsx scripts/sync/cartoonize-photos.ts --players 1624 --force
 */

import { db } from "@workspace/db";
import { players } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Configurazione ───────────────────────────────────────────────────────────

const REPLICATE_MODEL =
  "fofr/face-to-many:35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9";

const REPLICATE_INPUT = {
  style: "Cartoon",
  prompt: "a person, classic cartoon style portrait",
  negative_prompt: "anime, 3d render, photorealistic, sketch",
  lora_scale: 1.0,
  prompt_strength: 4.5,
  denoising_strength: 0.65,
  instant_id_strength: 0.85,
  control_depth_strength: 0.8,
};

const CONCURRENCY = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

// ID giocatori di Mario's Squad (ft-mvp-1)
const MARIO_SQUAD_IDS = [
  30419, 30913, 1624, 446092, 162570, 25911, 35544, 6931, 1084, 40392, 353417,
  42007, 1358, 342074, 484411, 129687, 2055, 6409, 1920, 30509, 30879, 30414,
  449638, 443141, 31031,
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.resolve(__dirname, "../../artifacts/mister-web/public/avatars");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(): { playerIds: number[]; force: boolean } {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const allMario = args.includes("--all-mario");
  const playersFlag = args.indexOf("--players");

  if (allMario) return { playerIds: MARIO_SQUAD_IDS, force };

  if (playersFlag !== -1 && args[playersFlag + 1]) {
    const ids = args[playersFlag + 1]
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return { playerIds: ids, force };
  }

  console.error("Uso: --players <id1,id2,...> | --all-mario  [--force]");
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Processamento singolo giocatore ─────────────────────────────────────────

async function processPlayer(
  replicate: Replicate,
  player: { id: number; name: string; photoUrl: string | null; photoCartoonUrl: string | null },
  idx: number,
  total: number,
  force: boolean,
): Promise<void> {
  const tag = `[${idx + 1}/${total}] ${player.name} (${player.id})`;

  if (!player.photoUrl) {
    console.log(`${tag} — SKIP: nessun photoUrl`);
    return;
  }

  if (player.photoCartoonUrl && !force) {
    console.log(`${tag} — SKIP: già cartoonizzato (${player.photoCartoonUrl})`);
    return;
  }

  const outPath = path.join(AVATARS_DIR, `${player.id}.webp`);

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const t0 = Date.now();
      console.log(`${tag} — avvio Replicate (tentativo ${attempt})…`);

      let output: unknown;
      try {
        output = await replicate.run(REPLICATE_MODEL as `${string}/${string}:${string}`, {
          input: { image: player.photoUrl, ...REPLICATE_INPUT },
        });
      } catch (err: unknown) {
        // Fallback: prova con latest se versione non trovata
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("version") || msg.includes("not found")) {
          console.warn(`${tag} — versione fissa non trovata, provo latest…`);
          output = await replicate.run("fofr/face-to-many" as `${string}/${string}`, {
            input: { image: player.photoUrl, ...REPLICATE_INPUT },
          });
        } else {
          throw err;
        }
      }

      // output è array di URL o ReadableStream
      const urls: string[] = [];
      if (Array.isArray(output)) {
        for (const item of output) {
          if (typeof item === "string") urls.push(item);
          // ReadableStream (Replicate streaming)
          else if (item && typeof (item as { url?: () => Promise<URL> }).url === "function") {
            const u = await (item as { url: () => Promise<URL> }).url();
            urls.push(u.toString());
          }
        }
      } else if (typeof output === "string") {
        urls.push(output);
      }

      if (urls.length === 0) throw new Error("Replicate non ha restituito URL");

      const imageUrl = urls[0];
      console.log(`${tag} — scarico immagine da ${imageUrl.slice(0, 60)}…`);

      const buf = await downloadBuffer(imageUrl);
      fs.mkdirSync(AVATARS_DIR, { recursive: true });

      // Converti in webp 512×512
      await sharp(buf)
        .resize(512, 512, { fit: "cover", position: "face" })
        .webp({ quality: 85 })
        .toFile(outPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${tag} — salvato in ${outPath} (${elapsed}s)`);

      // Aggiorna DB
      const relPath = `/avatars/${player.id}.webp`;
      await db
        .update(players)
        .set({ photoCartoonUrl: relPath })
        .where(eq(players.id, player.id));

      console.log(`${tag} — ✓ DB aggiornato: ${relPath}`);
      return; // successo
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt <= MAX_RETRIES) {
        console.warn(`${tag} — errore tentativo ${attempt}: ${msg}. Retry tra ${RETRY_DELAY_MS / 1000}s…`);
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        console.error(`${tag} — FALLITO dopo ${MAX_RETRIES + 1} tentativi: ${msg}`);
      }
    }
  }
}

// ─── Runner con concorrenza limitata ─────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, idx: number) => Promise<void>,
  limit: number,
): Promise<void> {
  const queue = [...items.entries()];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    let next = queue.shift();
    while (next !== undefined) {
      const [idx, item] = next;
      await fn(item, idx);
      next = queue.shift();
    }
  });
  await Promise.all(workers);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { playerIds, force } = parseArgs();
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("Variabile REPLICATE_API_TOKEN mancante");
    process.exit(1);
  }

  const replicate = new Replicate({ auth: token });

  console.log(`\n─── Cartoonize: ${playerIds.length} giocatori, concorrenza ${CONCURRENCY}${force ? ", --force" : ""} ───\n`);

  // Carica dati dal DB
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      photoUrl: players.photoUrl,
      photoCartoonUrl: players.photoCartoonUrl,
    })
    .from(players)
    .where(inArray(players.id, playerIds));

  const rowMap = new Map(rows.map((r) => [r.id, r]));

  const targets = playerIds.map((id) => {
    const r = rowMap.get(id);
    if (!r) {
      console.warn(`Player ${id} non trovato in DB — skip`);
      return null;
    }
    return r;
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  await runWithConcurrency(
    targets,
    (player, idx) => processPlayer(replicate, player, idx, targets.length, force),
    CONCURRENCY,
  );

  // Sommario finale
  console.log("\n─── Sommario ───");
  for (const player of targets) {
    const updated = await db
      .select({ photoCartoonUrl: players.photoCartoonUrl })
      .from(players)
      .where(eq(players.id, player.id));
    const url = updated[0]?.photoCartoonUrl ?? null;
    console.log(`  ${player.id} ${player.name}: ${url ?? "NON AGGIORNATO"}`);
  }
  console.log("───────────────\n");
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
