# Post-install patch: @tensorflow/tfjs-node@4.22

## Problema

`@tensorflow/tfjs-node@4.22` chiama `util.isNullOrUndefined` dal modulo built-in `node:util`
di Node.js. Questa funzione è stata rimossa in Node.js 16 (deprecata da Node 4).
Il file che la chiama è:

```
node_modules/@tensorflow/tfjs-node/dist/nodejs_kernel_backend.js
```

Righe interessate (~675, ~689, ~697):

```js
if ((0, util_1.isNullOrUndefined)(tensorsOrDtype)) {
```

Queste chiamate causano `TypeError: (0 , util_1.isNullOrUndefined) is not a function`
durante l'esecuzione di blazeface (face detection nella pipeline cartoonize-photos).

## Fix

Il fix consiste nel rimpiazzare le chiamate con un check `== null` inline,
direttamente nel file compilato nel pnpm store.

Il sed da rieseguire dopo `pnpm install` (o dopo un reset del pnpm store):

```bash
sed -i 's/(0, util_1\.isNullOrUndefined)(\([^)]*\))/((\1) == null)/g' \
  node_modules/.pnpm/@tensorflow+tfjs-node@4.22.0_seedrandom@3.0.5/node_modules/@tensorflow/tfjs-node/dist/nodejs_kernel_backend.js
```

Oppure, dalla root del monorepo:

```bash
BACKEND=$(find node_modules/.pnpm -path "*/tfjs-node/dist/nodejs_kernel_backend.js" | head -1)
sed -i 's/(0, util_1\.isNullOrUndefined)(\([^)]*\))/((\1) == null)/g' "$BACKEND"
```

## Verifica

```bash
cd scripts && node -e "
  const tf = require('@tensorflow/tfjs-node');
  const bf = require('@tensorflow-models/blazeface');
  bf.load()
    .then(m => m.estimateFaces(tf.zeros([100,100,3],'int32'), false))
    .then(r => console.log('OK, preds:', r.length))
    .catch(e => console.error('FAIL:', e.message));
" 2>&1 | grep -v 'oneDNN\|AVX\|rebuild\|tensorflow/core\|cpu_feature'
```

Output atteso: `OK, preds: 0`
