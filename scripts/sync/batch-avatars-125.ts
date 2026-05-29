/**
 * batch-avatars-125.ts — Task 125
 * Batch Toy avatar per 6 fanta-team (ft-mvp-2, 3, 4, 5, 6, 8)
 *
 * Pool: 6 × 25 = 150 player da contracts (season_start = 2024).
 * Pipeline identica a T121: PicWish cutout → normalize bbox → matte bianco
 *   → face-to-many Toy Combo B (instant_id 0.55, denoising 0.78)
 *   → BiRefNet BG removal → normalizeToCanvas 95% bbox
 *   → save /avatars/<id>.webp → UPDATE players.photo_cartoon_url
 *
 * Diff logic:
 *   SKIP        — file esiste E photo_cartoon_url popolato
 *   UPDATE-ONLY — file esiste ma photo_cartoon_url NULL → solo UPDATE DB
 *   PROCESS     — file mancante → pipeline completa
 *
 * Sanity check: pausa dopo i primi 3 PROCESS per conferma esplicita.
 * Salvataggio incrementale: ogni player aggiornato subito in DB.
 *
 * Uso: pnpm --filter @workspace/scripts run sync:batch-avatars-125
 */

import { db } from "@workspace/db";
import { players, contracts } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import os from "os";
import { fileURLToPath } from "url";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, "../..");
const AVATARS_DIR = path.join(ROOT, "artifacts/mister-web/public/avatars");
const TMP_DIR     = path.join(os.tmpdir(), "mister-batch-125");

for (const d of [AVATARS_DIR, TMP_DIR]) fs.mkdirSync(d, { recursive: true });

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TEAMS  = ["ft-mvp-2","ft-mvp-3","ft-mvp-4","ft-mvp-5","ft-mvp-6","ft-mvp-8"];
const SEASON = 2024;

const PICWISH_API_KEY = process.env.PICWISH_API_KEY;
if (!PICWISH_API_KEY) { console.error("PICWISH_API_KEY mancante"); process.exit(1); }

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) { console.error("REPLICATE_API_TOKEN mancante"); process.exit(1); }

const TOY_MODEL   = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;
const BGREM_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc" as `${string}/${string}:${string}`;

const COMBO_B = {
  style:                  "Toy",
  prompt:                 "plastic toy figurine, vinyl figure, glossy plastic, smooth, action figure, stylized cartoon, uniform plastic sheen, matte plastic figurine, smooth surface, no skin texture",
  negative_prompt:        "realistic, photo, photographic, photorealistic, human skin, real person, detailed pores, hyperrealism, skin texture, pores",
  lora_scale:             1.0,
  prompt_strength:        5.0,
  denoising_strength:     0.78,
  instant_id_strength:    0.55,
  control_depth_strength: 0.8,
};

const PICWISH_BASE = "https://techhk.aoscdn.com";
const POLL_MAX     = 40;
const POLL_MS      = 2000;

const CANVAS_SZ   = 512;
const TARGET_AXIS = Math.round(CANVAS_SZ * 0.95); // 486 px

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

// ─── PicWish balance ──────────────────────────────────────────────────────────

async function checkPicWishBalance(): Promise<number | null> {
  const endpoints = [
    `${PICWISH_BASE}/api/open/account/credits`,
    `${PICWISH_BASE}/api/open/account/balance`,
    `${PICWISH_BASE}/api/open/account`,
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { headers: { "X-API-KEY": PICWISH_API_KEY! } });
      const j = await r.json() as { status: number; data?: { credits?: number; total_credits?: number; balance?: number } };
      if (j.status === 200 && j.data) {
        const credits = j.data.credits ?? j.data.total_credits ?? j.data.balance;
        if (credits !== undefined) {
          console.log(`PicWish saldo: ${credits} crediti`);
          return credits;
        }
        console.log(`PicWish saldo: ${JSON.stringify(j.data)}`);
        return null;
      }
    } catch (_) { /* continua */ }
  }
  console.log("PicWish saldo: endpoint non disponibile — procedo comunque.");
  return null;
}

// ─── Step 1: PicWish face cutout ──────────────────────────────────────────────

interface PicWishResp {
  status: number;
  data?: { task_id?: string; state?: number; image?: string; credits_cost?: number };
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

// ─── Step 2: Normalize bbox iniziale ─────────────────────────────────────────

async function normalizeBbox(cutoutPath: string, id: number): Promise<string> {
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

// ─── Step 3: Matte bianco ─────────────────────────────────────────────────────

async function matteWhite(normPath: string, id: number): Promise<string> {
  const outPath = path.join(TMP_DIR, `${id}-matte.png`);
  await sharp(normPath).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toFile(outPath);
  return outPath;
}

// ─── Step 4: face-to-many Toy (Combo B) ──────────────────────────────────────

async function runToy(replicate: Replicate, mattePath: string, id: number): Promise<string> {
  const blob = new Blob([fs.readFileSync(mattePath)], { type: "image/png" });
  console.log(`  #${id} → Toy…`);
  const urls = await replicateRun(replicate, TOY_MODEL, { image: blob, ...COMBO_B }, `Toy-${id}`);
  if (!urls.length) throw new Error("Toy: nessun URL");
  console.log(`  #${id} → Toy OK`);
  return urls[0];
}

// ─── Step 5: BG removal + normalizzazione iconografica (95%) ─────────────────

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
  }, `BGRem-${id}`);
  if (!urls.length) throw new Error("BGRem: nessun URL");

  const cleanBuf = await downloadBuffer(urls[0]);
  console.log(`  #${id} → normalizza (axisMax → ${TARGET_AXIS}px)…`);
  const normBuf  = await normalizeToCanvas(cleanBuf);
  fs.writeFileSync(outPath, normBuf);
  console.log(`  #${id} → salvato ${path.relative(ROOT, outPath)}`);
}

// ─── Pipeline completa per un player ─────────────────────────────────────────

async function runFullPipeline(
  replicate: Replicate,
  photoUrl: string,
  id: number,
  outPath: string,
): Promise<void> {
  const cutoutPath = await picwishCutout(photoUrl, id);
  console.log(`  #${id} → PicWish OK`);

  const normPath  = await normalizeBbox(cutoutPath, id);
  const mattePath = await matteWhite(normPath, id);

  const toyUrl = await runToy(replicate, mattePath, id);
  await removeBgAndNormalize(replicate, toyUrl, id, outPath);

  for (const f of [cutoutPath, normPath, mattePath]) {
    try { fs.unlinkSync(f); } catch (_) { /* ignora */ }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CONCURRENCY = 1; // sequenziale: meno 429 Replicate, throughput netto superiore

async function processOne(
  replicate: Replicate,
  id: number,
  name: string,
  photoUrl: string,
  team: string,
  label: string,
): Promise<"ok" | "fail"> {
  const outPath = path.join(AVATARS_DIR, `${id}.webp`);
  console.log(`${label} #${id} ${name} (${team})`);
  try {
    await runFullPipeline(replicate, photoUrl, id, outPath);
    await db.update(players)
      .set({ photoCartoonUrl: `/avatars/${id}.webp` })
      .where(eq(players.id, id));
    console.log(`  #${id} → DB aggiornato ✓`);
    return "ok";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ERRORE #${id} ${name}: ${msg}`);
    return "fail";
  }
}

async function main() {
  console.log("=== T125 — Batch Toy avatar: 6 fanta-team (concurrency=3) ===\n");

  // 0. Saldo PicWish
  const balance = await checkPicWishBalance();
  if (balance !== null && balance < 30) {
    console.error(`\nSTOP: saldo PicWish troppo basso (${balance} < 30). Topup necessario.`);
    process.exit(1);
  }
  console.log();

  // 1. Query player pool da contracts (source of truth)
  const contractRows = await db
    .select({ playerId: contracts.playerId, fantaTeamId: contracts.fantaTeamId })
    .from(contracts)
    .where(and(
      inArray(contracts.fantaTeamId, TEAMS),
      eq(contracts.seasonStart, SEASON),
    ));

  if (contractRows.length === 0) throw new Error("Nessun contratto trovato per le 6 fanta-team");
  const allPlayerIds = contractRows.map(r => r.playerId);

  const playerRows = await db
    .select({ id: players.id, name: players.name, photoUrl: players.photoUrl, photoCartoonUrl: players.photoCartoonUrl })
    .from(players)
    .where(inArray(players.id, allPlayerIds));

  const playerMap = new Map(playerRows.map(p => [p.id, p]));

  // 2. Diff
  const toSkip:       Array<{ id: number; team: string }> = [];
  const toUpdateOnly: Array<{ id: number; team: string }> = [];
  const toProcess:    Array<{ id: number; team: string; name: string; photoUrl: string }> = [];
  const noPhotoUrl:   Array<{ id: number; team: string }> = [];

  for (const { playerId, fantaTeamId } of contractRows) {
    const p          = playerMap.get(playerId);
    const outPath    = path.join(AVATARS_DIR, `${playerId}.webp`);
    const fileExists = fs.existsSync(outPath);

    if (!p?.photoUrl)                     { noPhotoUrl.push({ id: playerId, team: fantaTeamId }); continue; }
    if (fileExists && p.photoCartoonUrl)  { toSkip.push({ id: playerId, team: fantaTeamId });     continue; }
    if (fileExists && !p.photoCartoonUrl) { toUpdateOnly.push({ id: playerId, team: fantaTeamId }); continue; }
    toProcess.push({ id: playerId, team: fantaTeamId, name: p.name, photoUrl: p.photoUrl });
  }

  console.log("─── Diff ────────────────────────────────────────────────────────");
  console.log(`  SKIP (file+DB ok):         ${toSkip.length}`);
  console.log(`  UPDATE-ONLY (file, no DB): ${toUpdateOnly.length}`);
  console.log(`  PROCESS (pipeline):        ${toProcess.length}`);
  console.log(`  NO PHOTO_URL (skip):       ${noPhotoUrl.length}${noPhotoUrl.length ? "  → " + noPhotoUrl.map(p => p.id).join(", ") : ""}`);
  console.log();

  // UPDATE-ONLY: solo DB, gratis
  for (const { id } of toUpdateOnly) {
    await db.update(players).set({ photoCartoonUrl: `/avatars/${id}.webp` }).where(eq(players.id, id));
  }
  if (toUpdateOnly.length) console.log(`UPDATE-ONLY: ${toUpdateOnly.length} DB entries aggiornate ✓\n`);

  if (toProcess.length === 0) {
    console.log("Nessun player da processare — tutto completato.");
    return;
  }

  const replicate = new Replicate({ auth: REPLICATE_TOKEN! });
  let picwishUsed = 0;
  const succeeded: number[] = [];
  const failed: Array<{ id: number; name: string; err: string }> = [];

  // 3. Sanity check: prima tripletta in PARALLELO
  const first3 = toProcess.slice(0, Math.min(3, toProcess.length));
  console.log(`─── Sanity check: ${first3.length} player in parallelo ──────────────────────`);
  {
    const results = await Promise.allSettled(
      first3.map((p, i) => processOne(replicate, p.id, p.name, p.photoUrl, p.team, `[SANITY ${i+1}/${first3.length}]`))
    );
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value === "ok") {
        picwishUsed++;
        succeeded.push(first3[i].id);
      } else {
        const msg = r.status === "rejected" ? String(r.reason) : "pipeline fallita";
        failed.push({ id: first3[i].id, name: first3[i].name, err: msg });
      }
    });
  }

  const sanityOk     = first3.filter(p => succeeded.includes(p.id)).length;
  const sanityFailed = first3.filter(p => failed.some(f => f.id === p.id)).length;
  console.log(`\n─── Sanity check: ${sanityOk} ok, ${sanityFailed} falliti ─────────────────────`);

  if (sanityFailed >= 2) {
    console.error("STOP: ≥2 fallimenti nel sanity check. Diagnosi prima di continuare.");
    failed.forEach(f => console.error(`  #${f.id} ${f.name}: ${f.err}`));
    process.exit(1);
  }
  console.log("Sanity check superato — procedo col batch in parallelo.\n");

  // 4. Batch principale: chunks da CONCURRENCY in parallelo
  const remaining = toProcess.slice(first3.length);
  const totalChunks = Math.ceil(remaining.length / CONCURRENCY);
  console.log(`─── Batch principale: ${remaining.length} player in ${totalChunks} batch da ${CONCURRENCY} ──`);

  for (let c = 0; c < totalChunks; c++) {
    const chunk = remaining.slice(c * CONCURRENCY, (c + 1) * CONCURRENCY);
    const batchLabel = `[B${c + 1}/${totalChunks}]`;
    console.log(`\n${batchLabel} processa ${chunk.map(p => `#${p.id}`).join(", ")}`);

    const results = await Promise.allSettled(
      chunk.map((p, i) =>
        processOne(replicate, p.id, p.name, p.photoUrl, p.team,
          `  [${(first3.length + c * CONCURRENCY) + i + 1}/${toProcess.length}]`)
      )
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value === "ok") {
        picwishUsed++;
        succeeded.push(chunk[i].id);
      } else {
        const msg = r.status === "rejected" ? String(r.reason) : "pipeline fallita";
        failed.push({ id: chunk[i].id, name: chunk[i].name, err: msg });
        console.error(`  ERRORE #${chunk[i].id}: ${msg}`);
      }
    });
  }

  // 5. Riepilogo
  const toyReplCost = succeeded.length * 0.0115;
  const bgReplCost  = succeeded.length * 0.007;

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("RIEPILOGO T125");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`\nDiff: SKIP=${toSkip.length} UPDATE-ONLY=${toUpdateOnly.length} PROCESS=${toProcess.length}`);
  console.log(`Risultati: successi=${succeeded.length}  falliti=${failed.length}`);
  if (failed.length > 0) {
    console.log(`\nPlayer falliti:`);
    failed.forEach(f => console.log(`  #${f.id} ${f.name}: ${f.err}`));
  }
  console.log(`\nCosti:`);
  console.log(`  PicWish crediti:      ~${picwishUsed}`);
  console.log(`  Replicate Toy:        ~$${toyReplCost.toFixed(3)}`);
  console.log(`  Replicate BGRem:      ~$${bgReplCost.toFixed(3)}`);
  console.log(`  Totale Replicate:     ~$${(toyReplCost + bgReplCost).toFixed(3)}`);

  const sandhagen = succeeded.find(id => contractRows.find(r => r.playerId === id && r.fantaTeamId === "ft-mvp-4"));
  const pancho    = succeeded.find(id => contractRows.find(r => r.playerId === id && r.fantaTeamId === "ft-mvp-5"));
  if (sandhagen) console.log(`\nSpot check ft-mvp-4 (Pancho Boys): #${sandhagen} → /avatars/${sandhagen}.webp`);
  if (pancho)    console.log(`Spot check ft-mvp-5 (Sandhagen FC): #${pancho}    → /avatars/${pancho}.webp`);

  console.log("\n=== T125 completato ===");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
