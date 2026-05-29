/**
 * normalize-avatars.ts — Task 120e Parte 1
 * Re-normalizza i 25 avatar esistenti di Mario's Squad.
 *
 * Algoritmo (puro sharp, locale, nessuna API esterna):
 *   1. Raw extract canale alfa
 *   2. Bbox pixel non-trasparenti (alpha > 16)
 *   3. scaleFactor = 487 / axisMax  (TARGET = 512 * 0.95)
 *   4. extract bbox → resize → extend centrato su 512×512 trasparente
 *
 * Uso: pnpm --filter @workspace/scripts run sync:normalize-avatars
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "../..");
const AVATARS_DIR = path.join(ROOT, "artifacts/mister-web/public/avatars");
const BACKUP_DIR  = "/tmp/avatars-backup-120e";
const CANVAS      = 512;
const TARGET_AXIS = Math.round(CANVAS * 0.95); // 487 px

const IDS = [
  // ATT
  31094, 147859, 2495, 1922, 30440, 31507,
  // DEF
  1844, 31521, 18797, 105, 30425, 162141, 396637, 127631,
  // GK
  312, 46988, 143648,
  // MID
  30561, 31871, 136016, 951, 30533, 31555, 2292, 15673,
];

// IDs per cui stampare dettaglio PRE/POST (Okoye≈31094, Ketelaere≈396637, Ballo-Touré≈30533, Ramadani=15673)
const REPORT_IDS = new Set([31094, 396637, 30533, 15673]);

// ─── BBox ─────────────────────────────────────────────────────────────────────

type BBoxInfo = {
  minX: number; minY: number; maxX: number; maxY: number;
  bboxW: number; bboxH: number; axisMax: number;
  scaleFactor: number; newW: number; newH: number;
};

async function computeBBox(buf: Buffer): Promise<BBoxInfo | null> {
  const { data, info } = await sharp(buf)
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

  if (maxX < 0) return null;

  const bboxW      = maxX - minX + 1;
  const bboxH      = maxY - minY + 1;
  const axisMax    = Math.max(bboxW, bboxH);
  const scaleFactor = TARGET_AXIS / axisMax;
  const newW       = Math.round(bboxW * scaleFactor);
  const newH       = Math.round(bboxH * scaleFactor);

  return { minX, minY, maxX, maxY, bboxW, bboxH, axisMax, scaleFactor, newW, newH };
}

// ─── Normalizza → canvas 512×512 ─────────────────────────────────────────────

export async function normalizeToCanvas(inputBuf: Buffer): Promise<Buffer> {
  const bbox = await computeBBox(inputBuf);

  if (!bbox) {
    return sharp({
      create: { width: CANVAS, height: CANVAS, channels: 4 as const, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).webp({ quality: 85 }).toBuffer();
  }

  const { minX, minY, bboxW, bboxH, newW, newH } = bbox;
  const padLeft   = Math.floor((CANVAS - newW) / 2);
  const padRight  = CANVAS - newW - padLeft;
  const padTop    = Math.floor((CANVAS - newH) / 2);
  const padBottom = CANVAS - newH - padTop;

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Task 120e — Normalizzazione avatar (axisMax → ${TARGET_AXIS}px) ===`);
  console.log(`Canvas: ${CANVAS}×${CANVAS}   Target axis: ${TARGET_AXIS}px (95%)\n`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  let ok = 0, skipped = 0, failed = 0;
  const reportRows: Array<{ id: number; pre: BBoxInfo; post: BBoxInfo }> = [];

  for (const id of IDS) {
    const filePath = path.join(AVATARS_DIR, `${id}.webp`);

    if (!fs.existsSync(filePath)) {
      console.log(`  #${id} → SKIP (file non trovato)`);
      skipped++;
      continue;
    }

    const inputBuf = fs.readFileSync(filePath);
    const preBBox  = await computeBBox(inputBuf);

    if (!preBBox) {
      console.log(`  #${id} → SKIP (immagine vuota)`);
      skipped++;
      continue;
    }

    // Backup prima di sovrascrivere
    fs.copyFileSync(filePath, path.join(BACKUP_DIR, `${id}.webp`));

    try {
      const outBuf  = await normalizeToCanvas(inputBuf);
      fs.writeFileSync(filePath, outBuf);

      // Calcola bbox POST per verifica (ricalcola sul buffer prodotto)
      const postBBox = await computeBBox(outBuf);

      if (REPORT_IDS.has(id) && postBBox) {
        reportRows.push({ id, pre: preBBox, post: postBBox });
      }

      const postAxis = postBBox ? Math.max(postBBox.bboxW, postBBox.bboxH) : "?";
      console.log(`  #${id} → ok  PRE axisMax=${preBBox.axisMax}px  scale=${preBBox.scaleFactor.toFixed(4)}  POST axisMax=${postAxis}px`);
      ok++;
    } catch (err) {
      console.error(`  #${id} → ERRORE: ${(err as Error).message}`);
      failed++;
    }
  }

  // ─── Report dettagliato ───
  if (reportRows.length) {
    console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
    console.log("│  Report PRE/POST bbox (4 esempi)                                    │");
    console.log("├─────────────────────────────────────────────────────────────────────┤");
    for (const { id, pre, post } of reportRows) {
      console.log(`│  #${String(id).padEnd(7)} PRE  bbox=${pre.bboxW}×${pre.bboxH}  axisMax=${String(pre.axisMax).padEnd(4)}  scaleFactor=${pre.scaleFactor.toFixed(4)}`);
      console.log(`│           POST bbox=${post.bboxW}×${post.bboxH}  axisMax=${Math.max(post.bboxW, post.bboxH)}  (target=${TARGET_AXIS})`);
      console.log("│");
    }
    console.log("└─────────────────────────────────────────────────────────────────────┘");
  }

  // ─── Riepilogo ───
  console.log(`\n─── Riepilogo ───────────────────────────────────`);
  console.log(`OK:      ${ok}/25`);
  console.log(`Saltati: ${skipped}`);
  console.log(`Falliti: ${failed}`);
  console.log(`Backup:  ${BACKUP_DIR}`);

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
