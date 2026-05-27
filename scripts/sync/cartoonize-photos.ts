/**
 * cartoonize-photos.ts
 * Pipeline: download originale → face-detect CJS (blazeface, landmark-based)
 *           → crop viso con padding bianco → Replicate (3D Pixar) → webp 512×512
 *
 * Uso (players — backward compatible):
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --players 1624,35544,6409
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --all-mario [--force]
 *
 * Uso (coaches):
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --target coaches --all [--force]
 *   pnpm --filter @workspace/scripts run sync:cartoonize -- --target coaches --players 3386,2425
 */

import { db } from "@workspace/db";
import { players, coaches } from "@workspace/db/schema";
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
const COACHES_DIR = path.join(AVATARS_DIR, "coaches");
const FACE_DETECT_SCRIPT = path.resolve(__dirname, "face-detect.cjs");
const NODE_BIN = process.execPath;

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type Target = "players" | "coaches";

/** Output di face-detect.cjs — coordinate grezze (possono sforare i bordi). */
interface FaceDetectResult {
  fallback?: boolean;
  rawLeft?: number;
  rawTop?: number;
  size?: number;
  w: number;
  h: number;
  bbox?: boolean;
}

interface Subject {
  id: number;
  name: string;
  photoUrl: string | null;
  photoCartoonUrl: string | null;
}

// ─── Face-crop via subprocess CJS ─────────────────────────────────────────────

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

async function applyCrop(
  imageBuffer: Buffer,
  det: FaceDetectResult,
): Promise<Buffer> {
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

  const { rawLeft, rawTop, size, w, h } = det;
  const actualLeft   = Math.max(0, Math.round(rawLeft));
  const actualTop    = Math.max(0, Math.round(rawTop));
  const actualRight  = Math.min(w, Math.round(rawLeft + size));
  const actualBottom = Math.min(h, Math.round(rawTop + size));
  const actualWidth  = actualRight - actualLeft;
  const actualHeight = actualBottom - actualTop;

  const padTop    = actualTop  - Math.round(rawTop)  > 0 ? actualTop  - Math.round(rawTop)  : 0;
  const padLeft   = actualLeft - Math.round(rawLeft) > 0 ? actualLeft - Math.round(rawLeft) : 0;
  const padBottom = Math.round(rawTop  + size) - actualBottom > 0 ? Math.round(rawTop  + size) - actualBottom : 0;
  const padRight  = Math.round(rawLeft + size) - actualRight  > 0 ? Math.round(rawLeft + size) - actualRight  : 0;

  const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
  let pipeline = sharp(imageBuffer)
    .extract({ left: actualLeft, top: actualTop, width: actualWidth, height: actualHeight });

  if (padTop > 0 || padBottom > 0 || padLeft > 0 || padRight > 0) {
    pipeline = pipeline.extend({ top: padTop, bottom: padBottom, left: padLeft, right: padRight, background: WHITE });
  }

  return pipeline.flatten({ background: WHITE }).resize(512, 512, { fit: "fill" }).png().toBuffer();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(): { target: Target; ids: number[] | "all"; force: boolean } {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  // --target coaches | players (default: players)
  const targetFlag = args.indexOf("--target");
  const target: Target =
    targetFlag !== -1 && args[targetFlag + 1] === "coaches" ? "coaches" : "players";

  // --all: tutti i record del target
  if (args.includes("--all")) {
    return { target, ids: "all", force };
  }

  // --all-mario: shortcut per i 25 giocatori di Mario's Squad (solo players)
  if (args.includes("--all-mario")) {
    return { target: "players", ids: MARIO_SQUAD_IDS, force };
  }

  // --players <id1,id2,...>
  const playersFlag = args.indexOf("--players");
  if (playersFlag !== -1 && args[playersFlag + 1]) {
    const ids = args[playersFlag + 1]
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return { target, ids, force };
  }

  console.error(
    "Uso:\n" +
    "  --players <id1,id2,...> [--target coaches] [--force]\n" +
    "  --all-mario [--force]\n" +
    "  --target coaches --all [--force]",
  );
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

// ─── Carica soggetti dal DB ───────────────────────────────────────────────────

async function loadSubjects(target: Target, ids: number[] | "all"): Promise<Subject[]> {
  if (target === "coaches") {
    const rows =
      ids === "all"
        ? await db.select({ id: coaches.id, name: coaches.name, photoUrl: coaches.photoUrl, photoCartoonUrl: coaches.photoCartoonUrl }).from(coaches)
        : await db.select({ id: coaches.id, name: coaches.name, photoUrl: coaches.photoUrl, photoCartoonUrl: coaches.photoCartoonUrl }).from(coaches).where(inArray(coaches.id, ids));
    return rows;
  } else {
    const playerIds = ids === "all" ? [] : (ids as number[]);
    if (playerIds.length === 0) {
      console.error("--target players richiede --players <ids> o --all-mario, non --all");
      process.exit(1);
    }
    const rows = await db
      .select({ id: players.id, name: players.name, photoUrl: players.photoUrl, photoCartoonUrl: players.photoCartoonUrl })
      .from(players)
      .where(inArray(players.id, playerIds));
    return rows;
  }
}

// ─── Aggiorna DB ──────────────────────────────────────────────────────────────

async function saveCartoonUrl(target: Target, id: number, relPath: string) {
  if (target === "coaches") {
    await db.update(coaches).set({ photoCartoonUrl: relPath, updatedAt: new Date() }).where(eq(coaches.id, id));
  } else {
    await db.update(players).set({ photoCartoonUrl: relPath }).where(eq(players.id, id));
  }
}

// ─── Processamento singolo soggetto ──────────────────────────────────────────

async function processSubject(
  replicate: Replicate,
  subject: Subject,
  idx: number,
  total: number,
  target: Target,
  force: boolean,
): Promise<void> {
  const tag = `[${idx + 1}/${total}] ${subject.name} (${subject.id})`;

  if (!subject.photoUrl) {
    console.log(`${tag} — SKIP: nessun photoUrl`);
    return;
  }
  if (subject.photoCartoonUrl && !force) {
    console.log(`${tag} — SKIP: già cartoonizzato (${subject.photoCartoonUrl})`);
    return;
  }

  const outDir  = target === "coaches" ? COACHES_DIR : AVATARS_DIR;
  const outPath = path.join(outDir, `${subject.id}.webp`);
  const relPath = target === "coaches" ? `/avatars/coaches/${subject.id}.webp` : `/avatars/${subject.id}.webp`;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const t0 = Date.now();
      console.log(`${tag} — avvio (tentativo ${attempt})…`);

      // ── Step 1: scarica → face-detect → crop ──────────────────────────────
      const originalBuf = await downloadBuffer(subject.photoUrl);
      console.log(`${tag} — face detect…`);
      const det = await detectFace(originalBuf);
      const croppedBuf = await applyCrop(originalBuf, det);

      if (det.fallback) {
        console.log(`${tag} — nessun viso, center crop`);
      } else {
        const method = det.bbox ? "bbox" : "landmark";
        const s = Math.round(det.size ?? 0);
        console.log(`${tag} — crop OK [${method}]: ${s}×${s} @ (${Math.round(det.rawLeft!)},${Math.round(det.rawTop!)})`);
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
      fs.mkdirSync(outDir, { recursive: true });

      const trimmedBuf = await sharp(workingBuf).trim({ threshold: 20 }).toBuffer();
      await sharp(trimmedBuf)
        .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .webp({ quality: 85 })
        .toFile(outPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${tag} — salvato (${elapsed}s)`);

      await saveCartoonUrl(target, subject.id, relPath);
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
  const { target, ids, force } = parseArgs();
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("Variabile REPLICATE_API_TOKEN mancante");
    process.exit(1);
  }

  const replicate = new Replicate({ auth: token });
  const targets = await loadSubjects(target, ids);

  console.log(
    `\n─── Cartoonize [${target}]: ${targets.length} soggetti, concorrenza ${CONCURRENCY}${force ? ", --force" : ""} ───\n`,
  );

  // Ordina per ID corrispondente all'input se fornito come lista
  const orderedTargets =
    ids !== "all" && Array.isArray(ids)
      ? ids.map((id) => targets.find((r) => r.id === id)).filter((r): r is Subject => {
          if (!r) return false;
          return true;
        })
      : targets;

  await runWithConcurrency(
    orderedTargets,
    (subject, idx) => processSubject(replicate, subject, idx, orderedTargets.length, target, force),
    CONCURRENCY,
  );

  console.log("\n─── Sommario ───");
  for (const subject of orderedTargets) {
    const url =
      target === "coaches"
        ? (await db.select({ u: coaches.photoCartoonUrl }).from(coaches).where(eq(coaches.id, subject.id)))[0]?.u
        : (await db.select({ u: players.photoCartoonUrl }).from(players).where(eq(players.id, subject.id)))[0]?.u;
    console.log(`  ${subject.id} ${subject.name}: ${url ?? "NON AGGIORNATO"}`);
  }
  console.log("───────────────\n");
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
