/**
 * test-toy-style.ts
 * Chiama fofr/face-to-many con style="Toy" sui 5 cutout PicWish del Task 117.
 * NON tocca cartoonize-photos.ts né gli avatar di produzione.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:test-toy
 */

import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPLICATE_MODEL = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;

const REPLICATE_INPUT = {
  style:                    "Toy",
  prompt:                   "Toy style, face portrait, white background, centered face",
  negative_prompt:          "neck, shoulders, chest, body, torso, blurry, watermark, text, logo",
  lora_scale:               1.0,
  prompt_strength:          4.5,
  denoising_strength:       0.65,
  instant_id_strength:      0.85,
  control_depth_strength:   0.8,
};

const SAMPLE_IDS = [1624, 35544, 6409, 1358, 30509];

const IN_DIR  = path.resolve(__dirname, "../../artifacts/mister-web/public/avatars/picwish-test");
const OUT_DIR = path.resolve(__dirname, "../../artifacts/mister-web/public/avatars/toy-test");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Utility ──────────────────────────────────────────────────────────────────

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== face-to-many style=Toy — Test 5 cutout PicWish ===\n");

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const results: Array<{ id: number; outPath: string; cost?: string }> = [];

  for (let i = 0; i < SAMPLE_IDS.length; i++) {
    const id      = SAMPLE_IDS[i];
    const inPath  = path.join(IN_DIR, `${id}.png`);
    const outPath = path.join(OUT_DIR, `${id}.webp`);

    console.log(`[${i + 1}/${SAMPLE_IDS.length}] Player #${id}`);

    if (!fs.existsSync(inPath)) {
      console.log(`  SKIP: file non trovato → ${inPath}`);
      continue;
    }

    const t0 = Date.now();
    try {
      const buf  = fs.readFileSync(inPath);
      const blob = new Blob([buf], { type: "image/png" });

      console.log(`  Invio a Replicate (style=Toy)…`);
      // Retry con backoff per 429
      let output: unknown;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          output = await replicate.run(REPLICATE_MODEL, {
            input: { image: blob, ...REPLICATE_INPUT },
          });
          break;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429") && attempt < 5) {
            const wait = attempt * 15000;
            console.log(`  Rate limit 429 — attendo ${wait / 1000}s (tentativo ${attempt}/5)…`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            throw err;
          }
        }
      }

      // Estrai URL dall'output
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
      console.log(`  Output URL: ${imageUrl}`);

      // Download → trim → 512×512 webp
      const rawBuf     = await downloadBuffer(imageUrl);
      const trimmedBuf = await sharp(rawBuf).trim({ threshold: 20 }).toBuffer();
      await sharp(trimmedBuf)
        .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .webp({ quality: 85 })
        .toFile(outPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  Salvato: ${outPath} (${elapsed}s)`);
      results.push({ id, outPath });
    } catch (err) {
      console.error(`  ERRORE: ${(err as Error).message}`);
    }
    console.log();
  }

  console.log("=== Riepilogo ===");
  results.forEach(r => console.log(`  #${r.id} → ${r.outPath}`));
  console.log(
    "\nCosto Replicate: ~$0.0115 per predizione (hardware Nvidia A40 Large, ~25–35s)." +
    `\nStima per ${results.length} immagini: ~$${(results.length * 0.0115).toFixed(3)}`
  );
  console.log("\nFatto. Valida visivamente i 5 WebP prima del prossimo step.");
}

main().catch(e => { console.error(e); process.exit(1); });
