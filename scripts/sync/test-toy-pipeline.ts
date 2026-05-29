/**
 * test-toy-pipeline.ts — Task 119
 * Pipeline: PicWish cutout → normalizza → matte bianco → Toy → BG removal trasparente
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:test-toy-pipeline
 */

import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DIRS = {
  input:      path.join(ROOT, "artifacts/mister-web/public/avatars/picwish-test"),
  normalized: path.join(ROOT, "artifacts/mister-web/public/avatars/normalized-test"),
  matted:     path.join(ROOT, "artifacts/mister-web/public/avatars/matted-test"),
  output:     path.join(ROOT, "artifacts/mister-web/public/avatars/toy-normalized-test"),
};
for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

const SAMPLE_IDS = [1624, 35544, 6409, 1358, 30509];

const TOY_MODEL    = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;
const BGREM_MODEL  = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc" as `${string}/${string}:${string}`;

const TOY_INPUT = {
  style:                  "Toy",
  prompt:                 "Toy style face portrait, pure white background",
  negative_prompt:        "black background, dark background, neck, shoulders, body, blurry, watermark, text",
  lora_scale:             1.0,
  prompt_strength:        4.5,
  denoising_strength:     0.65,
  instant_id_strength:    0.85,
  control_depth_strength: 0.8,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function replicateRun(
  replicate: Replicate,
  model: `${string}/${string}:${string}`,
  input: Record<string, unknown>,
  label: string,
): Promise<string[]> {
  for (let attempt = 1; attempt <= 6; attempt++) {
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
      if (msg.includes("429") && attempt < 6) {
        const wait = attempt * 12000;
        console.log(`    ${label} rate-limit 429 — attendo ${wait / 1000}s (${attempt}/6)…`);
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
  throw new Error("Max retry superato");
}

// ─── Step 1: Normalizzazione ──────────────────────────────────────────────────

async function normalize(id: number): Promise<string> {
  const inPath  = path.join(DIRS.input, `${id}.png`);
  const outPath = path.join(DIRS.normalized, `${id}.png`);

  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ch = 4;

  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * ch + 3];
      if (a > 16) {
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

  await sharp(inPath)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);

  console.log(`  Normalize → bbox ${bboxW}×${bboxH}, headSize=${headSize}, margin=${margin}`);
  return outPath;
}

// ─── Step 2: Matte su bianco ──────────────────────────────────────────────────

async function matteOnWhite(id: number): Promise<string> {
  const inPath  = path.join(DIRS.normalized, `${id}.png`);
  const outPath = path.join(DIRS.matted, `${id}.png`);
  await sharp(inPath).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toFile(outPath);
  return outPath;
}

// ─── Step 3: face-to-many Toy ────────────────────────────────────────────────

async function runToy(replicate: Replicate, id: number): Promise<string> {
  const inPath = path.join(DIRS.matted, `${id}.png`);
  const blob   = new Blob([fs.readFileSync(inPath)], { type: "image/png" });
  console.log(`  Toy → invio a Replicate…`);
  const urls = await replicateRun(replicate, TOY_MODEL, { image: blob, ...TOY_INPUT }, "Toy");
  if (!urls.length) throw new Error("Toy: nessun URL restituito");
  console.log(`  Toy → ${urls[0]}`);
  return urls[0];
}

// ─── Step 4: Rimozione sfondo (851-labs) ─────────────────────────────────────

async function removeBg(replicate: Replicate, toyUrl: string, id: number): Promise<string> {
  const outPath = path.join(DIRS.output, `${id}.webp`);

  const toyBuf = await downloadBuffer(toyUrl);
  const blob   = new Blob([new Uint8Array(toyBuf)], { type: "image/png" });

  console.log(`  BG remove → invio a 851-labs…`);
  const urls = await replicateRun(replicate, BGREM_MODEL, {
    image:           blob,
    format:          "png",
    background_type: "rgba",
    threshold:       0,      // soft alpha
  }, "BGRem");
  if (!urls.length) throw new Error("BGRem: nessun URL restituito");
  console.log(`  BG remove → ${urls[0]}`);

  const cleanBuf = await downloadBuffer(urls[0]);

  // Salva come webp con alpha (NO flatten — mantieni trasparenza)
  await sharp(cleanBuf)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toFile(outPath);

  return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Task 119 — Pipeline Toy normalizzata + trasparente ===\n");
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const results: Array<{ id: number; outPath: string }> = [];
  let toyPredictions = 0, bgPredictions = 0;

  for (let i = 0; i < SAMPLE_IDS.length; i++) {
    const id = SAMPLE_IDS[i];
    console.log(`\n[${i + 1}/${SAMPLE_IDS.length}] Player #${id}`);
    try {
      await normalize(id);
      await matteOnWhite(id);
      const toyUrl = await runToy(replicate, id); toyPredictions++;
      const outPath = await removeBg(replicate, toyUrl, id);  bgPredictions++;
      console.log(`  → Salvato: ${outPath}`);
      results.push({ id, outPath });
    } catch (err) {
      console.error(`  ERRORE: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Riepilogo ===");
  results.forEach(r => console.log(`  #${r.id} → ${r.outPath}`));
  console.log(`\nModello BG remover: 851-labs/background-remover (BiRefNet non disponibile su Replicate)`);
  console.log(`Predizioni Replicate: ${toyPredictions} Toy (~$${(toyPredictions * 0.0115).toFixed(3)}) + ${bgPredictions} BGRem (~$${(bgPredictions * 0.007).toFixed(3)})`);
  console.log(`Stima costo totale: ~$${(toyPredictions * 0.0115 + bgPredictions * 0.007).toFixed(3)}`);
  console.log("\nFatto.");
}

main().catch(e => { console.error(e); process.exit(1); });
