/**
 * test-picwish-cutout.ts
 * Valida la qualità del face cutout PicWish su 5 giocatori sample.
 * NON sovrascrive avatar di produzione.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:test-picwish
 */

import { db } from "@workspace/db";
import { players } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PICWISH_API_KEY = process.env.PICWISH_API_KEY;
if (!PICWISH_API_KEY) {
  console.error("PICWISH_API_KEY non trovata nei secrets.");
  process.exit(1);
}

const SAMPLE_IDS = [1624, 35544, 6409, 1358, 30509];
const POLL_MAX   = 30;
const POLL_MS    = 1500;
const BASE_URL   = "https://techhk.aoscdn.com";

const OUT_DIR = path.resolve(
  __dirname,
  "../../artifacts/mister-web/public/avatars/picwish-test"
);
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Utility HTTP ─────────────────────────────────────────────────────────────

function fetchJson(url: string, options: RequestInit = {}): Promise<unknown> {
  return fetch(url, options).then(r => r.json());
}

async function downloadBinary(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(destPath);
    proto.get(url, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        downloadBinary(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    }).on("error", reject);
  });
}

// ─── PicWish API ──────────────────────────────────────────────────────────────

interface PicWishTaskResp {
  status: number;
  message?: string;
  data?: {
    task_id?: string;
    state?:   number;
    image?:   string;
    mask?:    string;
    face_analysis?: { face_num: number };
    credits_cost?: number;
  };
}

async function submitTask(imageUrl: string): Promise<string> {
  const resp = await fetchJson(`${BASE_URL}/api/tasks/visual/self-face-cutout`, {
    method:  "POST",
    headers: { "X-API-KEY": PICWISH_API_KEY!, "Content-Type": "application/json" },
    body:    JSON.stringify({ image_url: imageUrl }),
  }) as PicWishTaskResp;

  if (resp.status !== 200 || !resp.data?.task_id) {
    throw new Error(`Errore submit: ${JSON.stringify(resp)}`);
  }
  return resp.data.task_id;
}

async function pollTask(taskId: string): Promise<PicWishTaskResp["data"]> {
  for (let i = 0; i < POLL_MAX; i++) {
    const resp = await fetchJson(
      `${BASE_URL}/api/tasks/visual/self-face-cutout/${taskId}`,
      { headers: { "X-API-KEY": PICWISH_API_KEY! } }
    ) as PicWishTaskResp;

    const d = resp.data;
    if (resp.status !== 200) throw new Error(`Errore poll: ${JSON.stringify(resp)}`);
    if (d?.image) return d;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timeout polling task ${taskId}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== PicWish Face Cutout — Test 5 player sample ===\n");

  const rows = await db
    .select({ id: players.id, name: players.name, photoUrl: players.photoUrl })
    .from(players)
    .where(inArray(players.id, SAMPLE_IDS));

  if (rows.length === 0) {
    console.error("Nessun player trovato nel DB per gli ID sample.");
    process.exit(1);
  }

  console.log(`Player trovati nel DB: ${rows.length}/${SAMPLE_IDS.length}`);
  rows.forEach(r => console.log(`  #${r.id} ${r.name} → ${r.photoUrl ?? "(nessuna foto)"}`));
  console.log();

  const results: Array<{ id: number; name: string; outPath: string; faceNum: number; cost?: number }> = [];
  let totalCost = 0;

  for (const player of rows) {
    const photoUrl = player.photoUrl;
    if (!photoUrl) {
      console.log(`  #${player.id} ${player.name} — photo_url mancante, skip`);
      continue;
    }

    console.log(`→ #${player.id} ${player.name}`);
    console.log(`  Foto originale: ${photoUrl}`);

    try {
      const taskId = await submitTask(photoUrl);
      console.log(`  Task inviato: ${taskId}`);

      const data = await pollTask(taskId);
      const faceNum  = data?.face_analysis?.face_num ?? -1;
      const cost     = data?.credits_cost;
      const imageUrl = data?.image!;

      console.log(`  Volti rilevati: ${faceNum}`);
      if (cost !== undefined) {
        console.log(`  Costo crediti: ${cost}`);
        totalCost += cost;
      }

      const outPath = path.join(OUT_DIR, `${player.id}.png`);
      await downloadBinary(imageUrl, outPath);
      console.log(`  Salvato: ${outPath}`);

      results.push({ id: player.id, name: player.name, outPath, faceNum, cost });
    } catch (err) {
      console.error(`  ERRORE: ${(err as Error).message}`);
    }
    console.log();
  }

  console.log("=== Riepilogo ===");
  results.forEach(r =>
    console.log(
      `  #${r.id} ${r.name.padEnd(20)} volti=${r.faceNum}  costo=${r.cost ?? "n/d"}  → ${r.outPath}`
    )
  );
  console.log(`\n  Costo totale rilevato: ${totalCost > 0 ? totalCost : "n/d (API non restituisce il campo credits_cost nella response)"}`);
  console.log("  Nota: 1 credito già utilizzato nel test preliminare dell'endpoint.");
  console.log("\nFatto. Valida visivamente i PNG prima del prossimo step.");
}

main().catch(e => { console.error(e); process.exit(1); });
