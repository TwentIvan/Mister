/**
 * batch-avatars-121.ts — Task 121
 * PARTE 1: Atletico Caffeina (ft-mvp-7) — 24 player mancanti
 * PARTE 2: Coach (8) — rigenerazione forzata in stile Toy,
 *          path nuovo /avatars/coaches/<id>.webp
 *
 * Diff player (T121):
 *   #30509 Belotti: file EXISTS + photo_cartoon_url SET → SKIP
 *   24 restanti: file MISSING, photo_cartoon_url NULL → pipeline completa
 *
 * Coach: bypass skip-logic totale — tutti e 8 rigenerati indipendentemente
 *   dal file esistente (file vecchi sono stile Pixar pre-T117).
 *   UPDATE coaches SET photo_cartoon_url = '/avatars/coaches/<id>.webp'
 *
 * Pipeline: PicWish cutout → normalize bbox → matte bianco →
 *           face-to-many Toy Combo B → BiRefNet BG removal →
 *           normalizeToCanvas 95% → save webp → UPDATE DB
 *
 * Uso: pnpm --filter @workspace/scripts run sync:batch-avatars-121
 */

import { db } from "@workspace/db";
import { players, coaches } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import os from "os";
import { fileURLToPath } from "url";

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const ROOT           = path.resolve(__dirname, "../..");
const AVATARS_DIR    = path.join(ROOT, "artifacts/mister-web/public/avatars");
const COACHES_DIR    = path.join(AVATARS_DIR, "coaches");
const TMP_DIR        = path.join(os.tmpdir(), "mister-batch-121");

for (const d of [AVATARS_DIR, COACHES_DIR, TMP_DIR]) fs.mkdirSync(d, { recursive: true });

// ─── IDs ──────────────────────────────────────────────────────────────────────

// Parte 1: 24 player AC mancanti (30509 Belotti SKIP — file + DB ok)
const AC_PLAYER_IDS = [
  9975, 2738, 877, 875, 43056,         // ATT
  18799, 180763, 41144, 227, 37250,    // DEF
  15909, 180510, 40582,                 // DEF cont.
  22221, 30418, 56459,                  // GK
  37437, 22174, 30932, 162266,          // MID
  309388, 128353, 288769, 266813,       // MID cont.
];

// Parte 2: 8 coach — rigenerazione forzata
const COACH_IDS = [3386, 2915, 15642, 2425, 2393, 2408, 2412, 2432];

// ─── Config modelli ───────────────────────────────────────────────────────────

const PICWISH_API_KEY = process.env.PICWISH_API_KEY;
if (!PICWISH_API_KEY) { console.error("PICWISH_API_KEY mancante"); process.exit(1); }

const TOY_MODEL   = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;
const BGREM_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc" as `${string}/${string}:${string}`;

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

const PICWISH_BASE = "https://techhk.aoscdn.com";
const POLL_MAX     = 40;
const POLL_MS      = 2000;

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

// ─── PicWish balance (best effort) ───────────────────────────────────────────

async function checkPicWishBalance(): Promise<void> {
  interface BalanceResp { status: number; data?: { credits?: number; total_credits?: number; balance?: number } }
  const endpoints = [
    `${PICWISH_BASE}/api/open/account/credits`,
    `${PICWISH_BASE}/api/open/account/balance`,
    `${PICWISH_BASE}/api/open/account`,
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { headers: { "X-API-KEY": PICWISH_API_KEY! } });
      const j = await r.json() as BalanceResp;
      if (j.status === 200 && j.data) {
        const credits = j.data.credits ?? j.data.total_credits ?? j.data.balance;
        console.log(`PicWish saldo: ${credits !== undefined ? credits + " crediti" : JSON.stringify(j.data)}`);
        return;
      }
    } catch (_) { /* ignora */ }
  }
  console.log("PicWish saldo: endpoint non disponibile — procedo comunque.");
}

// ─── Step 1: PicWish face cutout ──────────────────────────────────────────────

interface PicWishResp {
  status: number;
  data?: { task_id?: string; state?: number; image?: string; credits_cost?: number };
}

async function picwishCutout(photoUrl: string, id: number, label: string): Promise<string> {
  const outPath = path.join(TMP_DIR, `${label}-${id}-cutout.png`);

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

// ─── Step 2: Normalize bbox iniziale ─────────────────────────────────────────

async function normalizeBbox(cutoutPath: string, id: number, label: string): Promise<string> {
  const outPath = path.join(TMP_DIR, `${label}-${id}-norm.png`);
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

// ─── Step 3: Matte bianco ─────────────────────────────────────────────────────

async function matteWhite(normPath: string, id: number, label: string): Promise<string> {
  const outPath = path.join(TMP_DIR, `${label}-${id}-matte.png`);
  await sharp(normPath).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toFile(outPath);
  return outPath;
}

// ─── Step 4: face-to-many Toy (Combo B) ──────────────────────────────────────

async function runToy(replicate: Replicate, mattePath: string, id: number, label: string): Promise<string> {
  const blob = new Blob([fs.readFileSync(mattePath)], { type: "image/png" });
  console.log(`  #${id} → Toy…`);
  const urls = await replicateRun(replicate, TOY_MODEL, { image: blob, ...COMBO_B }, `Toy-${label}-${id}`);
  if (!urls.length) throw new Error("Toy: nessun URL");
  console.log(`  #${id} → Toy OK`);
  return urls[0];
}

// ─── Step 5: BG removal + normalizzazione iconografica (95%) ─────────────────

const CANVAS_SZ   = 512;
const TARGET_AXIS = Math.round(CANVAS_SZ * 0.95); // 486 px

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

async function removeBgAndNormalize(
  replicate: Replicate,
  toyUrl: string,
  id: number,
  label: string,
  outPath: string,
): Promise<void> {
  const toyBuf = await downloadBuffer(toyUrl);
  const blob   = new Blob([new Uint8Array(toyBuf)], { type: "image/png" });

  console.log(`  #${id} → BG remove…`);
  const urls = await replicateRun(replicate, BGREM_MODEL, {
    image:           blob,
    format:          "png",
    background_type: "rgba",
    threshold:       0,
  }, `BGRem-${label}-${id}`);
  if (!urls.length) throw new Error("BGRem: nessun URL");

  const cleanBuf = await downloadBuffer(urls[0]);
  console.log(`  #${id} → normalizza (axisMax → ${TARGET_AXIS}px)…`);
  const normBuf  = await normalizeToCanvas(cleanBuf);
  fs.writeFileSync(outPath, normBuf);
  console.log(`  #${id} → salvato ${path.relative(ROOT, outPath)}`);
}

// ─── Pipeline completa ────────────────────────────────────────────────────────

async function runFullPipeline(
  replicate: Replicate,
  photoUrl: string,
  id: number,
  label: string,
  outPath: string,
): Promise<{ picwish: number; toy: number; bg: number }> {
  const cutoutPath = await picwishCutout(photoUrl, id, label);
  console.log(`  #${id} → PicWish OK`);

  const normPath  = await normalizeBbox(cutoutPath, id, label);
  const mattePath = await matteWhite(normPath, id, label);

  const toyUrl = await runToy(replicate, mattePath, id, label);
  await removeBgAndNormalize(replicate, toyUrl, id, label, outPath);

  for (const f of [cutoutPath, normPath, mattePath]) {
    try { fs.unlinkSync(f); } catch (_) { /* ignora */ }
  }
  return { picwish: 1, toy: 1, bg: 1 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Task 121 — Atletico Caffeina + Coach (Toy pipeline) ===\n");

  await checkPicWishBalance();
  console.log();

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  let totalPicwish = 0, totalToy = 0, totalBg = 0;

  // ═══════════════════════════════════════════════════════════════
  // PARTE 1: Player Atletico Caffeina (24)
  // ═══════════════════════════════════════════════════════════════
  console.log("══════════════════════════════════════════════════════════");
  console.log("PARTE 1 — Player Atletico Caffeina");
  console.log("══════════════════════════════════════════════════════════");
  console.log("  #30509 Belotti → SKIP (file + photo_cartoon_url già presenti)\n");

  const playerRows = await db
    .select({ id: players.id, name: players.name, photoUrl: players.photoUrl, photoCartoonUrl: players.photoCartoonUrl })
    .from(players)
    .where(inArray(players.id, AC_PLAYER_IDS));

  const playerMap = new Map(playerRows.map(r => [r.id, r]));
  console.log(`Player trovati nel DB: ${playerRows.length}/${AC_PLAYER_IDS.length}\n`);

  const playerSuccess: number[] = [];
  const playerUpdateOnly: number[] = [];
  const playerFailed: Array<{ id: number; err: string }> = [];

  for (let i = 0; i < AC_PLAYER_IDS.length; i++) {
    const id     = AC_PLAYER_IDS[i];
    const p      = playerMap.get(id);
    const outPath = path.join(AVATARS_DIR, `${id}.webp`);
    const fileExists = fs.existsSync(outPath);

    console.log(`\n[P ${i + 1}/${AC_PLAYER_IDS.length}] #${id} ${p?.name ?? "(non in DB)"}`);

    if (!p?.photoUrl) {
      const msg = p ? "photoUrl mancante" : "non trovato nel DB";
      console.log(`  SKIP — ${msg}`);
      playerFailed.push({ id, err: msg });
      continue;
    }

    // Toy file già ok + DB ok → skip completo
    if (fileExists && p.photoCartoonUrl) {
      console.log(`  SKIP — file Toy + photo_cartoon_url già presenti`);
      playerSuccess.push(id);
      continue;
    }

    // File già ok ma DB null → solo UPDATE DB
    if (fileExists && !p.photoCartoonUrl) {
      console.log(`  UPDATE-ONLY — file ok, aggiorno photo_cartoon_url nel DB`);
      await db.update(players)
        .set({ photoCartoonUrl: `/avatars/${id}.webp` })
        .where(eq(players.id, id));
      console.log(`  #${id} → DB aggiornato`);
      playerUpdateOnly.push(id);
      continue;
    }

    // File mancante → pipeline completa
    try {
      const cost = await runFullPipeline(replicate, p.photoUrl, id, "p", outPath);
      totalPicwish += cost.picwish; totalToy += cost.toy; totalBg += cost.bg;

      await db.update(players)
        .set({ photoCartoonUrl: `/avatars/${id}.webp` })
        .where(eq(players.id, id));
      console.log(`  #${id} → DB aggiornato`);
      playerSuccess.push(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERRORE: ${msg}`);
      playerFailed.push({ id, err: msg });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PARTE 2: Coach (8) — rigenerazione forzata
  // ═══════════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("PARTE 2 — Coach (rigenerazione forzata, stile Toy)");
  console.log("══════════════════════════════════════════════════════════\n");

  const coachRows = await db
    .select({ id: coaches.id, name: coaches.name, lastname: coaches.lastname, photoUrl: coaches.photoUrl })
    .from(coaches)
    .where(inArray(coaches.id, COACH_IDS));

  const coachMap = new Map(coachRows.map(r => [r.id, r]));
  console.log(`Coach trovati nel DB: ${coachRows.length}/${COACH_IDS.length}\n`);

  const coachSuccess: number[] = [];
  const coachFailed: Array<{ id: number; err: string }> = [];

  for (let i = 0; i < COACH_IDS.length; i++) {
    const id    = COACH_IDS[i];
    const c     = coachMap.get(id);
    const outPath = path.join(COACHES_DIR, `${id}.webp`);
    const displayName = c?.lastname ?? c?.name ?? "(non in DB)";

    console.log(`\n[C ${i + 1}/${COACH_IDS.length}] #${id} ${displayName}`);

    if (!c?.photoUrl) {
      const msg = c ? "photoUrl mancante" : "non trovato nel DB";
      console.log(`  SKIP — ${msg}`);
      coachFailed.push({ id, err: msg });
      continue;
    }

    // Nessun check file precedente: rigenerazione forzata
    try {
      const cost = await runFullPipeline(replicate, c.photoUrl, id, "c", outPath);
      totalPicwish += cost.picwish; totalToy += cost.toy; totalBg += cost.bg;

      await db.update(coaches)
        .set({ photoCartoonUrl: `/avatars/coaches/${id}.webp` })
        .where(eq(coaches.id, id));
      console.log(`  #${id} → DB aggiornato (coaches.photo_cartoon_url = '/avatars/coaches/${id}.webp')`);
      coachSuccess.push(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERRORE: ${msg}`);
      coachFailed.push({ id, err: msg });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RIEPILOGO
  // ═══════════════════════════════════════════════════════════════
  const toyCost = totalToy * 0.0115;
  const bgCost  = totalBg  * 0.007;

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("RIEPILOGO Task 121");
  console.log("══════════════════════════════════════════════════════════");

  const pSkip   = playerSuccess.filter(id => {
    const p = playerMap.get(id);
    return p?.photoCartoonUrl != null; // era già ok
  });
  const pNew    = playerSuccess.filter(id => !pSkip.includes(id) && !playerUpdateOnly.includes(id));
  console.log(`\nParte 1 — Player AC (24 target):`);
  console.log(`  SKIP     (Toy+DB ok): ${pSkip.length}`);
  console.log(`  UPDATE-ONLY (DB):     ${playerUpdateOnly.length}${playerUpdateOnly.length ? " — " + playerUpdateOnly.join(", ") : ""}`);
  console.log(`  PROCESSED:            ${pNew.length}${pNew.length ? " — " + pNew.join(", ") : ""}`);
  if (playerFailed.length) {
    console.log(`  FALLITI:              ${playerFailed.length}`);
    playerFailed.forEach(f => console.log(`    #${f.id} — ${f.err}`));
  }

  console.log(`\nParte 2 — Coach (8 target, rigenerazione forzata):`);
  console.log(`  PROCESSED:  ${coachSuccess.length} — ${coachSuccess.join(", ")}`);
  if (coachFailed.length) {
    console.log(`  FALLITI:    ${coachFailed.length}`);
    coachFailed.forEach(f => console.log(`    #${f.id} — ${f.err}`));
  }
  console.log(`  photo_cartoon_url aggiornato per: ${coachSuccess.map(id => "#" + id).join(", ")}`);

  console.log(`\nPicWish: ~${totalPicwish} crediti consumati`);
  console.log(`Replicate: ${totalToy} Toy + ${totalBg} BGRem`);
  console.log(`Costo stimato: $${toyCost.toFixed(3)} (Toy) + $${bgCost.toFixed(3)} (BGRem) = ~$${(toyCost + bgCost).toFixed(3)}`);

  const samplePlayer = pNew[0] ?? playerUpdateOnly[0] ?? playerSuccess[0];
  const sampleCoach  = coachSuccess[0];
  if (samplePlayer) console.log(`\nSpot check player: /avatars/${samplePlayer}.webp`);
  if (sampleCoach)  console.log(`Spot check coach:  /avatars/coaches/${sampleCoach}.webp`);

  console.log("\nFatto.");

  const anyFailed = playerFailed.length + coachFailed.length;
  if (anyFailed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
