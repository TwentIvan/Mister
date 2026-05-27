/**
 * cartoonize-photos.ts
 * Pipeline: download originale → face-detect CJS (blazeface, landmark-based)
 *           → crop viso con padding bianco → Replicate (3D Pixar) → webp 512×512
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --players 1624,35544,6409
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --all-mario [--force]
 */

import { db } from "@workspace/db";
import { players } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─── Configurazione ───────────────────────────────────────────────────────────

const REPLICATE_MODEL =
  "fofr/face-to-many:35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9";

const REPLICATE_INPUT = {
  style: "3D",
  prompt:
    "3D Pixar animation style, face portrait, white background, centered face",
  negative_prompt:
    "neck, shoulders, chest, body, torso, collar, shirt, jacket, blurry, watermark, text, logo",
  lora_scale: 1.0,
  prompt_strength: 4.5,
  denoising_strength: 0.65,
  instant_id_strength: 0.85,
  control_depth_strength: 0.8,
};

const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const MARIO_SQUAD_IDS = [
  30419, 30913, 1624, 446092, 162570, 25911, 35544, 6931, 1084, 40392, 353417,
  42007, 1358, 342074, 484411, 129687, 2055, 6409, 1920, 30509, 30879, 30414,
  449638, 443141, 31031,
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.resolve(
  __dirname,
  "../../artifacts/mister-web/public/avatars",
);
const FACE_DETECT_SCRIPT = path.resolve(__dirname, "face-detect.cjs");
const NODE_BIN = process.execPath;

// ─── Tipi ─────────────────────────────────────────────────────────────────────

/** Output di face-detect.cjs — coordinate grezze (possono sforare i bordi). */
interface FaceDetectResult {
  /** Nessun viso trovato: usa center-crop come fallback. */
  fallback?: boolean;
  /** Coordinata sinistra del crop (può essere negativa). */
  rawLeft?: number;
  /** Coordinata superiore del crop (può essere negativa). */
  rawTop?: number;
  /** Lato del quadrato di crop. */
  size?: number;
  /** Larghezza immagine originale. */
  w: number;
  /** Altezza immagine originale. */
  h: number;
  /** true se il crop è stato calcolato dal bounding-box (landmark invalidi). */
  bbox?: boolean;
}

// ─── Face-crop via subprocess CJS ─────────────────────────────────────────────

/**
 * Richiama face-detect.cjs (subprocess CJS) che usa blazeface per rilevare il viso
 * e calcola le coordinate di crop (landmark-based con fallback bbox).
 */
async function detectFace(imageBuffer: Buffer): Promise<FaceDetectResult> {
  const b64 = imageBuffer.toString("base64");
  try {
    const { stdout, stderr } = await execFileAsync(
      NODE_BIN,
      [FACE_DETECT_SCRIPT, b64],
      { maxBuffer: 1024 * 1024 * 10 },
    );
    if (stderr) process.stderr.write(stderr);
    return JSON.parse(stdout.trim()) as FaceDetectResult;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  face-detect subprocess error: ${msg}\n`);
    return { fallback: true, w: 0, h: 0 };
  }
}

/**
 * Applica il crop al buffer originale e restituisce un PNG 512×512.
 *
 * Algoritmo:
 * 1. Se nessun viso rilevato → center-crop quadrato dell'immagine.
 * 2. Se crop landmark/bbox → clamp ai bordi + .extend() con sfondo bianco
 *    per i margini mancanti → resize 512×512 con fit:'fill'.
 */
async function applyCrop(
  imageBuffer: Buffer,
  det: FaceDetectResult,
): Promise<Buffer> {
  // ── Caso: nessun viso ──────────────────────────────────────────────────────
  if (det.fallback || det.rawLeft === undefined) {
    const meta = await sharp(imageBuffer).metadata();
    const size = Math.min(meta.width ?? 512, meta.height ?? 512);
    const left = Math.round(((meta.width ?? size) - size) / 2);
    const top  = Math.round(((meta.height ?? size) - size) / 2);
    return sharp(imageBuffer)
      .extract({ left, top, width: size, height: size })
      .resize(512, 512, { fit: "fill" })
      .png()
      .toBuffer();
  }

  // ── Caso: crop con coordinate grezze (possono sforare) ────────────────────
  const { rawLeft, rawTop, size, w, h } = det;

  // Coordinate clamped ai bordi dell'immagine
  const actualLeft   = Math.max(0, Math.round(rawLeft));
  const actualTop    = Math.max(0, Math.round(rawTop));
  const actualRight  = Math.min(w, Math.round(rawLeft + size));
  const actualBottom = Math.min(h, Math.round(rawTop + size));
  const actualWidth  = actualRight - actualLeft;
  const actualHeight = actualBottom - actualTop;

  // Padding necessario per le zone fuori bordo
  const padTop    = actualTop  - Math.round(rawTop)  > 0 ? actualTop  - Math.round(rawTop)  : 0;
  const padLeft   = actualLeft - Math.round(rawLeft) > 0 ? actualLeft - Math.round(rawLeft) : 0;
  const padBottom = Math.round(rawTop  + size) - actualBottom > 0 ? Math.round(rawTop  + size) - actualBottom : 0;
  const padRight  = Math.round(rawLeft + size) - actualRight  > 0 ? Math.round(rawLeft + size) - actualRight  : 0;

  const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

  let pipeline = sharp(imageBuffer)
    .extract({ left: actualLeft, top: actualTop, width: actualWidth, height: actualHeight });

  // Aggiunge padding bianco solo se necessario
  if (padTop > 0 || padBottom > 0 || padLeft > 0 || padRight > 0) {
    pipeline = pipeline.extend({
      top:    padTop,
      bottom: padBottom,
      left:   padLeft,
      right:  padRight,
      background: WHITE,
    });
  }

  return pipeline
    .flatten({ background: WHITE })
    .resize(512, 512, { fit: "fill" })
    .png()
    .toBuffer();
}

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
  player: {
    id: number;
    name: string;
    photoUrl: string | null;
    photoCartoonUrl: string | null;
  },
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

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const t0 = Date.now();
      console.log(`${tag} — avvio (tentativo ${attempt})…`);

      // ── Step 1: scarica originale → face-detect → crop ────────────────────
      const originalBuf = await downloadBuffer(player.photoUrl);
      console.log(`${tag} — face detect…`);
      const det = await detectFace(originalBuf);
      const croppedBuf = await applyCrop(originalBuf, det);

      if (det.fallback) {
        console.log(`${tag} — nessun viso, center crop`);
      } else {
        const method = det.bbox ? "bbox" : "landmark";
        const s = Math.round(det.size ?? 0);
        console.log(
          `${tag} — crop OK [${method}]: ${s}×${s} @ (${Math.round(det.rawLeft!)},${Math.round(det.rawTop!)})`,
        );
      }

      const imageBlob = new Blob([croppedBuf], { type: "image/png" });

      // ── Step 2: Replicate ─────────────────────────────────────────────────
      let output: unknown;
      try {
        output = await replicate.run(
          REPLICATE_MODEL as `${string}/${string}:${string}`,
          { input: { image: imageBlob, ...REPLICATE_INPUT } },
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("version") || msg.includes("not found")) {
          output = await replicate.run("fofr/face-to-many" as `${string}/${string}`, {
            input: { image: imageBlob, ...REPLICATE_INPUT },
          });
        } else {
          throw err;
        }
      }

      const urls: string[] = [];
      if (Array.isArray(output)) {
        for (const item of output) {
          if (typeof item === "string") urls.push(item);
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

      // ── Step 3: download → trim → 512×512 webp ───────────────────────────
      const workingBuf = await downloadBuffer(imageUrl);

      fs.mkdirSync(AVATARS_DIR, { recursive: true });

      const trimmedBuf = await sharp(workingBuf)
        .trim({ threshold: 20 })
        .toBuffer();

      await sharp(trimmedBuf)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .webp({ quality: 85 })
        .toFile(outPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${tag} — salvato (${elapsed}s)`);

      const relPath = `/avatars/${player.id}.webp`;
      await db
        .update(players)
        .set({ photoCartoonUrl: relPath })
        .where(eq(players.id, player.id));
      console.log(`${tag} — ✓ DB aggiornato: ${relPath}`);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("422") || msg.includes("Unprocessable")) {
        console.error(`${tag} — ERRORE INPUT (non riprovabile): ${msg}`);
        return;
      }
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

  console.log(
    `\n─── Cartoonize: ${playerIds.length} giocatori, concorrenza ${CONCURRENCY}${force ? ", --force" : ""} ───\n`,
  );

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
  const targets = playerIds
    .map((id) => {
      const r = rowMap.get(id);
      if (!r) {
        console.warn(`Player ${id} non trovato in DB — skip`);
        return null;
      }
      return r;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  await runWithConcurrency(
    targets,
    (player, idx) => processPlayer(replicate, player, idx, targets.length, force),
    CONCURRENCY,
  );

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
