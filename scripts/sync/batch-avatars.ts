/**
 * batch-avatars.ts — Task 120
 * Pipeline completa per i 20 player mancanti di Mario's Squad.
 * Passo: PicWish cutout → normalize → matte bianco → face-to-many Toy (Combo B) → BG removal
 * Output diretto: mister-web/public/avatars/<id>.webp
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:batch-avatars
 */

import { db } from "@workspace/db";
import { players } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const AVATARS_DIR = path.join(ROOT, "artifacts/mister-web/public/avatars");
const TMP_DIR = path.join(os.tmpdir(), "mister-batch-avatars");

for (const d of [AVATARS_DIR, TMP_DIR]) fs.mkdirSync(d, { recursive: true });

// Task 120b — rosa attuale ft-mvp-1 (25 player, nessun avatar presente)
const REMAINING_IDS = [
  // ATT
  31094, 147859, 2495, 1922, 30440, 31507,
  // DEF
  1844, 31521, 18797, 105, 30425, 162141, 396637, 127631,
  // GK
  312, 46988, 143648,
  // MID
  30561, 31871, 136016, 951, 30533, 31555, 2292, 15673,
];

const PICWISH_API_KEY = process.env.PICWISH_API_KEY;
if (!PICWISH_API_KEY) { console.error("PICWISH_API_KEY mancante"); process.exit(1); }

const TOY_MODEL   = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;
const BGREM_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc" as `${string}/${string}:${string}`;

// ─── Parametri Combo B (validata) ─────────────────────────────────────────────
const COMBO_B = {
  style: "Toy",
  prompt: "plastic toy figurine, vinyl figure, glossy plastic, smooth, action figure, stylized cartoon, uniform plastic sheen, matte plastic figurine, smooth surface, no skin texture",
  negative_prompt: "realistic, photo, photographic, photorealistic, human skin, real person, detailed pores, hyperrealism, skin texture, pores",
  lora_scale:             1.0,
  prompt_strength:        5.0,
  denoising_strength:     0.78,
  instant_id_strength:    0.55,
  control_depth_strength: 0.8,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
  return Buffer.from(await res.arrayBuffer());
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

async function replicateRun(
  replicate: Replicate,
  model: `${string}/${string}:${string}`,
  input: Record<string, unknown>,
  label: string,
): Promise<string[]> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const output = await replicate.run(model, { input });
      const urls: string[] = [];
      const items = Array.isArray(output) ? output : [output];
      for (const item of items) {
        if (typeof item === "string") urls.push(item);
        else if (item && typeof (item as { url?: () => Promise<URL> }).url === "function") {
          urls.push((await (item as { url: () => Promise<URL> }).url()).toString());
        }
      }
      return urls;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryAfter = msg.match(/~(\d+)s/)?.[1];
      if (msg.includes("429") && attempt < 10) {
        const wait = retryAfter ? (parseInt(retryAfter) + 3) * 1000 : attempt * 14000;
        console.log(`    ${label} 429 — attendo ${Math.round(wait / 1000)}s (tentativo ${attempt}/10)…`);
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
  throw new Error("Max retry superato");
}

// ─── Step 1: PicWish face cutout ──────────────────────────────────────────────

const PICWISH_BASE = "https://techhk.aoscdn.com";
const POLL_MAX = 40;
const POLL_MS  = 2000;

interface PicWishResp {
  status: number;
  data?: {
    task_id?: string;
    state?:   number;
    image?:   string;
    face_analysis?: { face_num: number };
    credits_cost?: number;
  };
}

async function picwishCutout(photoUrl: string, id: number): Promise<string> {
  const outPath = path.join(TMP_DIR, `${id}-cutout.png`);

  const submit = await fetch(`${PICWISH_BASE}/api/tasks/visual/self-face-cutout`, {
    method:  "POST",
    headers: { "X-API-KEY": PICWISH_API_KEY!, "Content-Type": "application/json" },
    body:    JSON.stringify({ image_url: photoUrl }),
  }).then(r => r.json()) as PicWishResp;

  if (submit.status !== 200 || !submit.data?.task_id) {
    throw new Error(`PicWish submit: ${JSON.stringify(submit)}`);
  }
  const taskId = submit.data.task_id;

  for (let i = 0; i < POLL_MAX; i++) {
    const poll = await fetch(`${PICWISH_BASE}/api/tasks/visual/self-face-cutout/${taskId}`, {
      headers: { "X-API-KEY": PICWISH_API_KEY! },
    }).then(r => r.json()) as PicWishResp;
    if (poll.status !== 200) throw new Error(`PicWish poll: ${JSON.stringify(poll)}`);
    if (poll.data?.image) {
      await downloadBinary(poll.data.image, outPath);
      return outPath;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`PicWish timeout task ${taskId}`);
}

// ─── Step 2: Normalize (bbox crop + 512×512 con alpha) ────────────────────────

async function normalize(cutoutPath: string, id: number): Promise<string> {
  const outPath = path.join(TMP_DIR, `${id}-norm.png`);
  const { data, info } = await sharp(cutoutPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ch = 4;

  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * ch + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bboxW    = maxX - minX + 1;
  const bboxH    = maxY - minY + 1;
  const headSize = Math.max(bboxW, bboxH);
  const margin   = Math.round(headSize * 0.15);
  const sqSize   = headSize + margin * 2;
  const centerX  = Math.round((minX + maxX) / 2);
  const centerY  = Math.round((minY + maxY) / 2);
  const cropLeft = Math.max(0, centerX - Math.round(sqSize / 2));
  const cropTop  = Math.max(0, centerY - Math.round(sqSize / 2));
  const cropW    = Math.min(sqSize, width  - cropLeft);
  const cropH    = Math.min(sqSize, height - cropTop);

  await sharp(cutoutPath)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  return outPath;
}

// ─── Step 3: Matte su sfondo bianco ───────────────────────────────────────────

async function matteWhite(normPath: string, id: number): Promise<string> {
  const outPath = path.join(TMP_DIR, `${id}-matte.png`);
  await sharp(normPath).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toFile(outPath);
  return outPath;
}

// ─── Step 4: face-to-many Toy (Combo B) ───────────────────────────────────────

async function runToy(replicate: Replicate, mattePath: string, id: number): Promise<string> {
  const blob = new Blob([fs.readFileSync(mattePath)], { type: "image/png" });
  console.log(`  #${id} → Toy…`);
  const urls = await replicateRun(replicate, TOY_MODEL, { image: blob, ...COMBO_B }, `Toy-${id}`);
  if (!urls.length) throw new Error("Toy: nessun URL");
  console.log(`  #${id} → toy OK`);
  return urls[0];
}

// ─── Step 5: BG removal + normalizzazione → webp finale ──────────────────────

const CANVAS_SZ   = 512;
const TARGET_AXIS = Math.round(CANVAS_SZ * 0.95); // 487 px

async function normalizeToCanvas(inputBuf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width, H = info.height, C = info.channels;
  let minX = W, minY = H, maxX = -1, maxY = -1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return sharp({
      create: { width: CANVAS_SZ, height: CANVAS_SZ, channels: 4 as const, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).webp({ quality: 85 }).toBuffer();
  }

  const bboxW       = maxX - minX + 1;
  const bboxH       = maxY - minY + 1;
  const axisMax     = Math.max(bboxW, bboxH);
  const scaleFactor = TARGET_AXIS / axisMax;
  const newW        = Math.round(bboxW * scaleFactor);
  const newH        = Math.round(bboxH * scaleFactor);
  const padLeft     = Math.floor((CANVAS_SZ - newW) / 2);
  const padRight    = CANVAS_SZ - newW - padLeft;
  const padTop      = Math.floor((CANVAS_SZ - newH) / 2);
  const padBottom   = CANVAS_SZ - newH - padTop;

  return sharp(inputBuf)
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: bboxW, height: bboxH })
    .resize(newW, newH, { kernel: "lanczos3", withoutEnlargement: false })
    .extend({
      top:    Math.max(0, padTop),
      bottom: Math.max(0, padBottom),
      left:   Math.max(0, padLeft),
      right:  Math.max(0, padRight),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 85 })
    .toBuffer();
}

async function removeBg(replicate: Replicate, toyUrl: string, id: number): Promise<string> {
  const outPath = path.join(AVATARS_DIR, `${id}.webp`);
  const toyBuf  = await downloadBuffer(toyUrl);
  const blob    = new Blob([new Uint8Array(toyBuf)], { type: "image/png" });

  console.log(`  #${id} → BG remove…`);
  const urls = await replicateRun(replicate, BGREM_MODEL, {
    image:           blob,
    format:          "png",
    background_type: "rgba",
    threshold:       0,
  }, `BGRem-${id}`);
  if (!urls.length) throw new Error("BGRem: nessun URL");

  const cleanBuf = await downloadBuffer(urls[0]);
  console.log(`  #${id} → normalizza (axisMax → ${TARGET_AXIS}px)…`);
  const normBuf  = await normalizeToCanvas(cleanBuf);
  fs.writeFileSync(outPath, normBuf);

  console.log(`  #${id} → salvato ${outPath}`);
  return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Task 120 — Batch avatar Mario's Squad (20 rimanenti) ===\n");

  const rows = await db
    .select({ id: players.id, name: players.name, photoUrl: players.photoUrl })
    .from(players)
    .where(inArray(players.id, REMAINING_IDS));

  const rowMap = new Map(rows.map(r => [r.id, r]));
  console.log(`Player trovati nel DB: ${rows.length}/${REMAINING_IDS.length}\n`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const success: number[] = [];
  const failed:  Array<{ id: number; err: string }> = [];
  let toyCount = 0, bgCount = 0;

  for (let i = 0; i < REMAINING_IDS.length; i++) {
    const id     = REMAINING_IDS[i];
    const player = rowMap.get(id);
    console.log(`\n[${i + 1}/${REMAINING_IDS.length}] #${id} ${player?.name ?? "(non in DB)"}`);

    if (!player?.photoUrl) {
      const msg = player ? "photoUrl mancante" : "non trovato nel DB";
      console.log(`  SKIP — ${msg}`);
      failed.push({ id, err: msg });
      continue;
    }

    try {
      const cutoutPath = await picwishCutout(player.photoUrl, id);
      console.log(`  #${id} → PicWish OK`);

      const normPath   = await normalize(cutoutPath, id);
      const mattePath  = await matteWhite(normPath, id);

      const toyUrl     = await runToy(replicate, mattePath, id); toyCount++;
      await removeBg(replicate, toyUrl, id); bgCount++;

      // Aggiorna DB in modo atomico dopo ogni file salvato
      await db.update(players)
        .set({ photoCartoonUrl: `/avatars/${id}.webp` })
        .where(eq(players.id, id));
      console.log(`  #${id} → DB aggiornato`);

      success.push(id);

      // pulizia file intermedi
      for (const f of [cutoutPath, normPath, mattePath]) {
        try { fs.unlinkSync(f); } catch (_) { /* ignora */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERRORE: ${msg}`);
      failed.push({ id, err: msg });
    }
  }

  const toyCost = toyCount * 0.0115;
  const bgCost  = bgCount  * 0.007;

  console.log("\n=== Riepilogo ===");
  console.log(`\nSuccesso (${success.length}): ${success.join(", ")}`);
  if (failed.length > 0) {
    console.log(`\nFalliti (${failed.length}):`);
    failed.forEach(f => console.log(`  #${f.id} — ${f.err}`));
  }
  console.log(`\nReplicate: ${toyCount} Toy + ${bgCount} BGRem`);
  console.log(`Costo stimato: $${toyCost.toFixed(3)} (Toy) + $${bgCost.toFixed(3)} (BGRem) = ~$${(toyCost + bgCost).toFixed(3)}`);
  console.log("\nFatto.");
}

main().catch(e => { console.error(e); process.exit(1); });
