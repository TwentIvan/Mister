'use strict';
/**
 * face-detect.cjs — helper CJS per face detection via blazeface.
 * Viene invocato come subprocess da cartoonize-photos.ts con:
 *   node face-detect.cjs <base64-png>
 * Stampa su stdout un JSON: { left, top, width, height } oppure { fallback: true }
 */

// 1) Carica TF PRIMA di tutto — registra il backend Node.js
const tf = require('@tensorflow/tfjs-node');

// 2) Patch SINCRONA: isNullOrUndefined è stata rimossa in TF 4.x,
//    ma blazeface@0.1.0 la usa ancora. In CJS il require è sequenziale,
//    quindi questa patch è attiva PRIMA che blazeface venga caricato.
if (!tf.util.isNullOrUndefined) {
  tf.util.isNullOrUndefined = (v) => v == null;
}

// 3) Ora carica blazeface (CJS — i require sono sincroni)
const blazeface = require('@tensorflow-models/blazeface');
const sharp = require('sharp');

async function main() {
  const b64 = process.argv[2];
  if (!b64) {
    process.stderr.write('Usage: node face-detect.cjs <base64-png>\n');
    process.exit(1);
  }

  const imageBuf = Buffer.from(b64, 'base64');

  // Scarica i pesi del modello (dalla cache TF Hub)
  const model = await blazeface.load();

  // Converti in raw RGB per TF tensor
  const { data, info } = await sharp(imageBuf)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const tensor = tf.tensor3d(new Uint8Array(data), [h, w, 3]);
  const preds = await model.estimateFaces(tensor, false);
  tensor.dispose();

  if (preds.length === 0) {
    // Nessun viso trovato → center crop
    process.stdout.write(JSON.stringify({ fallback: true, w, h }));
    return;
  }

  // Viso più grande
  const best = preds.reduce((a, b) => {
    const areaA = (a.bottomRight[0] - a.topLeft[0]) * (a.bottomRight[1] - a.topLeft[1]);
    const areaB = (b.bottomRight[0] - b.topLeft[0]) * (b.bottomRight[1] - b.topLeft[1]);
    return areaA >= areaB ? a : b;
  });

  const faceX1 = best.topLeft[0];
  const faceY1 = best.topLeft[1];
  const faceX2 = best.bottomRight[0];
  const faceY2 = best.bottomRight[1];
  const faceW = faceX2 - faceX1;
  const faceH = faceY2 - faceY1;
  const faceArea = faceW * faceH;

  if (faceArea < w * h * 0.04) {
    process.stdout.write(JSON.stringify({ fallback: true, w, h }));
    return;
  }

  // Crop quadrato: faceH × 1.6, centrato sul viso
  const cropSize = Math.round(faceH * 1.6);
  const cx = Math.round((faceX1 + faceX2) / 2);
  // Centra verticalmente con lieve offset verso l'alto (più fronte, meno mento)
  const cy = Math.round(faceY1 + faceH * 0.45);
  const cropX = cx - Math.round(cropSize / 2);
  const cropY = cy - Math.round(cropSize / 2);

  // Clamp ai bordi
  const left = Math.max(0, Math.min(cropX, w - 1));
  const top  = Math.max(0, Math.min(cropY, h - 1));
  const width  = Math.min(cropSize, w - left);
  const height = Math.min(cropSize, h - top);

  process.stdout.write(JSON.stringify({ left, top, width, height, w, h }));
}

main().catch((err) => {
  process.stderr.write('face-detect error: ' + err.message + '\n');
  process.stdout.write(JSON.stringify({ fallback: true, w: 0, h: 0 }));
});
