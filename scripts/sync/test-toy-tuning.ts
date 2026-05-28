/**
 * test-toy-tuning.ts — Task 119c
 * Combo A (moderata) e B (aggressiva) sui 5 matted-test.
 * Per ogni combo: face-to-many Toy → 851-labs BG removal → webp trasparente.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:test-toy-tuning
 */

import Replicate from "replicate";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const IN_DIR  = path.join(ROOT, "artifacts/mister-web/public/avatars/matted-test");
const OUT_A   = path.join(ROOT, "artifacts/mister-web/public/avatars/toy-tuning-A");
const OUT_B   = path.join(ROOT, "artifacts/mister-web/public/avatars/toy-tuning-B");
for (const d of [OUT_A, OUT_B]) fs.mkdirSync(d, { recursive: true });

const SAMPLE_IDS = [1624, 35544, 6409, 1358, 30509];

const TOY_MODEL   = "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf" as `${string}/${string}:${string}`;
const BGREM_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc" as `${string}/${string}:${string}`;

// ─── Parametri schemi input (nomi esatti da schema modello) ───────────────────
// image, style, prompt, negative_prompt, lora_scale, prompt_strength,
// denoising_strength, instant_id_strength, control_depth_strength, seed

const BASE = {
  style:                 "Toy",
  lora_scale:            1.0,
  control_depth_strength: 0.8,
};

const COMBO_A = {
  ...BASE,
  prompt: "plastic toy figurine, vinyl figure, glossy plastic, smooth, action figure, stylized cartoon",
  negative_prompt: "realistic, photo, photographic, photorealistic, human skin, real person, detailed pores, hyperrealism",
  instant_id_strength: 0.65,
  denoising_strength:  0.72,
  prompt_strength:     4.5,
};

const COMBO_B = {
  ...BASE,
  prompt: "plastic toy figurine, vinyl figure, glossy plastic, smooth, action figure, stylized cartoon, uniform plastic sheen, matte plastic figurine, smooth surface, no skin texture",
  negative_prompt: "realistic, photo, photographic, photorealistic, human skin, real person, detailed pores, hyperrealism, skin texture, pores",
  instant_id_strength: 0.55,
  denoising_strength:  0.78,
  prompt_strength:     5.0,
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
  for (let attempt = 1; attempt <= 8; attempt++) {
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
      if (msg.includes("429") && attempt < 8) {
        const wait = retryAfter ? (parseInt(retryAfter) + 2) * 1000 : attempt * 12000;
        console.log(`    ${label} 429 — attendo ${Math.round(wait / 1000)}s (tentativo ${attempt}/8)…`);
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
  throw new Error("Max retry superato");
}

async function runOne(
  replicate: Replicate,
  id: number,
  params: Record<string, unknown>,
  outDir: string,
  comboLabel: string,
): Promise<string> {
  const inPath  = path.join(IN_DIR, `${id}.png`);
  const outPath = path.join(outDir, `${id}.webp`);

  const blob = new Blob([fs.readFileSync(inPath)], { type: "image/png" });

  // Step 1: face-to-many Toy
  console.log(`  [${comboLabel}] #${id} → Toy…`);
  const toyUrls = await replicateRun(replicate, TOY_MODEL, { image: blob, ...params }, `Toy-${comboLabel}`);
  if (!toyUrls.length) throw new Error("Toy: nessun URL");
  console.log(`  [${comboLabel}] #${id} → toy: ${toyUrls[0]}`);

  // Step 2: BG removal (851-labs, background_type: "rgba", threshold: 0 = soft alpha)
  const toyBuf  = await downloadBuffer(toyUrls[0]);
  const bgBlob  = new Blob([toyBuf], { type: "image/png" });
  console.log(`  [${comboLabel}] #${id} → BG remove…`);
  const bgUrls  = await replicateRun(replicate, BGREM_MODEL, {
    image:           bgBlob,
    format:          "png",
    background_type: "rgba",
    threshold:       0,
  }, `BGRem-${comboLabel}`);
  if (!bgUrls.length) throw new Error("BGRem: nessun URL");

  const cleanBuf = await downloadBuffer(bgUrls[0]);
  await sharp(cleanBuf)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toFile(outPath);

  console.log(`  [${comboLabel}] #${id} → salvato ${outPath}`);
  return outPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Task 119c — Toy tuning Combo A + B ===");
  console.log("\nParametri schema modello (nomi esatti):");
  console.log("  image, style, prompt, negative_prompt, lora_scale,");
  console.log("  prompt_strength (CFG), denoising_strength, instant_id_strength,");
  console.log("  control_depth_strength, seed\n");

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const results: Record<string, string[]> = { A: [], B: [] };
  let toyCount = 0, bgCount = 0;

  for (const [label, params, outDir] of [
    ["A", COMBO_A, OUT_A],
    ["B", COMBO_B, OUT_B],
  ] as const) {
    console.log(`\n─── Combo ${label} ─── instant_id=${(params as typeof COMBO_A).instant_id_strength} denoising=${(params as typeof COMBO_A).denoising_strength}`);
    for (const id of SAMPLE_IDS) {
      try {
        const out = await runOne(replicate, id, params as Record<string, unknown>, outDir, label);
        results[label].push(out);
        toyCount++; bgCount++;
      } catch (err) {
        console.error(`  ERRORE ${label}/#${id}: ${(err as Error).message}`);
      }
    }
  }

  const toyEst  = toyCount  * 0.0115;
  const bgEst   = bgCount   * 0.007;
  console.log("\n=== Riepilogo ===");
  console.log("\nCombo A:");
  results.A.forEach(p => console.log(`  ${p}`));
  console.log("\nCombo B:");
  results.B.forEach(p => console.log(`  ${p}`));
  console.log(`\nPredizioni: ${toyCount} Toy + ${bgCount} BGRem`);
  console.log(`Costo stimato: $${toyEst.toFixed(3)} (Toy) + $${bgEst.toFixed(3)} (BGRem) = ~$${(toyEst + bgEst).toFixed(3)}`);
  console.log("\nFatto.");
}

main().catch(e => { console.error(e); process.exit(1); });
