'use strict';
/**
 * face-detect.cjs — helper CJS per face detection via blazeface.
 * Invocato come subprocess da cartoonize-photos.ts:
 *   node face-detect.cjs <base64-png>
 *
 * Stampa su stdout un JSON:
 *   { rawLeft, rawTop, size, w, h }          crop landmark-based (coordinate grezze, possono sforare)
 *   { rawLeft, rawTop, size, w, h, bbox:true} fallback bounding-box (landmark invalidi)
 *   { fallback: true, w, h }                  nessun viso trovato
 *
 * NOTE: il chiamante (cartoonize-photos.ts) applica il clamping + sharp.extend() per il padding.
 *
 * PATCH NODE_MODULES: @tensorflow/tfjs-node@4.22 usa util.isNullOrUndefined (rimossa in Node 16+).
 * La patch è applicata direttamente su dist/nodejs_kernel_backend.js (sostituisce la chiamata
 * con un check == null inline). Vedi POSTINSTALL.md per istruzioni su come riapplicarla dopo
 * un reinstall dei pacchetti.
 */

// 1) Carica TF — registra il backend Node.js (deve venire PRIMA di blazeface)
const tf = require('@tensorflow/tfjs-node');
const blazeface = require('@tensorflow-models/blazeface');
const sharp = require('sharp');

/**
 * Crop landmark-based.
 * BlazeFace landmark order: [rightEye, leftEye, nose, mouth, rightEarTragion, leftEarTragion]
 *
 * Parametri calibrati per composizione uniforme:
 *   K = 3.8   → crop size = ~3.8x distanza occhi-bocca
 *   EYE_OFFSET = 0.38 → occhi al 38% dall'alto del quadrato
 * Risultato atteso: occhi alla stessa altezza relativa su tutti i player,
 * bocca al ~64% dall'alto, nessun collo visibile.
 */
function landmarkCrop(detection, w, h) {
  const lm = detection.landmarks; // array di [x,y]
  const rightEye = lm[0];
  const leftEye  = lm[1];
  const mouth    = lm[3];

  const eyeCenterX = (leftEye[0] + rightEye[0]) / 2;
  const eyeCenterY = (leftEye[1] + rightEye[1]) / 2;
  const mouthY     = mouth[1];
  const eyeToMouth = mouthY - eyeCenterY;

  // Validazione: distanza anomala → fallback bounding-box
  if (eyeToMouth < 5 || eyeToMouth > h * 0.6) {
    return null;
  }

  const K              = 3.8;
  const EYE_OFFSET     = 0.38;
  const size           = eyeToMouth * K;
  const rawTop         = eyeCenterY - EYE_OFFSET * size;
  const rawLeft        = eyeCenterX - size / 2;

  return { rawLeft, rawTop, size };
}

/**
 * Fallback: crop basato sul bounding-box (faceH × 1.6, centrato, offset verso l'alto).
 */
function bboxCrop(detection) {
  const faceX1 = detection.topLeft[0];
  const faceY1 = detection.topLeft[1];
  const faceX2 = detection.bottomRight[0];
  const faceY2 = detection.bottomRight[1];
  const faceW  = faceX2 - faceX1;
  const faceH  = faceY2 - faceY1;
  const cx     = (faceX1 + faceX2) / 2;
  const cy     = faceY1 + faceH * 0.45;
  const size   = faceH * 1.6;
  return { rawLeft: cx - size / 2, rawTop: cy - size / 2, size };
}

async function main() {
  const b64 = process.argv[2];
  if (!b64) {
    process.stderr.write('Usage: node face-detect.cjs <base64-png>\n');
    process.exit(1);
  }

  const imageBuf = Buffer.from(b64, 'base64');
  const model = await blazeface.load();

  const { data, info } = await sharp(imageBuf)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const tensor = tf.tensor3d(new Uint8Array(data), [h, w, 3]);
  const preds  = await model.estimateFaces(tensor, false);
  tensor.dispose();

  if (preds.length === 0) {
    process.stdout.write(JSON.stringify({ fallback: true, w, h }));
    return;
  }

  // Viso con area maggiore
  const best = preds.reduce((a, b) => {
    const areaA = (a.bottomRight[0] - a.topLeft[0]) * (a.bottomRight[1] - a.topLeft[1]);
    const areaB = (b.bottomRight[0] - b.topLeft[0]) * (b.bottomRight[1] - b.topLeft[1]);
    return areaA >= areaB ? a : b;
  });

  // Area minima: scarta volti troppo piccoli (probabilmente falsi positivi)
  const faceW   = best.bottomRight[0] - best.topLeft[0];
  const faceH   = best.bottomRight[1] - best.topLeft[1];
  const faceArea = faceW * faceH;
  if (faceArea < w * h * 0.04) {
    process.stdout.write(JSON.stringify({ fallback: true, w, h }));
    return;
  }

  // Tenta landmark-based; fallback a bbox se landmark invalidi
  const lm = landmarkCrop(best, w, h);
  if (lm) {
    process.stdout.write(JSON.stringify({ rawLeft: lm.rawLeft, rawTop: lm.rawTop, size: lm.size, w, h }));
  } else {
    const bb = bboxCrop(best);
    process.stdout.write(JSON.stringify({ rawLeft: bb.rawLeft, rawTop: bb.rawTop, size: bb.size, w, h, bbox: true }));
  }
}

main().catch((err) => {
  process.stderr.write('face-detect error: ' + err.message + '\n');
  process.stdout.write(JSON.stringify({ fallback: true, w: 0, h: 0 }));
});
