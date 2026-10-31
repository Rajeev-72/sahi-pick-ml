// node tests/ml-parity.js — checks the browser models against scikit-learn's own predictions.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {}, console }; ctx.SP = {}; vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
['js/utils.js', 'js/store.js', 'js/fresh.js', 'js/model-data.js', 'js/score.js', 'js/ml.js'].forEach((f) => {
  try { load(f); } catch (e) { if (!/localStorage|document|navigator/.test(String(e))) throw e; }
});
const SP = ctx.SP;
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'parity_fixture.json'), 'utf8'));
const prod = (r) => ({
  categories_tags: r.cats, additives_n: r.additives_n ?? undefined,
  nutriments: {
    'energy-kcal_100g': r.nut.energy_kcal, 'fat_100g': r.nut.fat, 'saturated-fat_100g': r.nut.saturated_fat,
    'carbohydrates_100g': r.nut.carbohydrates, 'sugars_100g': r.nut.sugars, 'proteins_100g': r.nut.proteins,
    'sodium_100g': r.nut.salt === null ? null : r.nut.salt / 2.5, 'fiber_100g': r.nut.fiber,
  },
});
let worstH = 0, worstN = 0, hN = 0, nN = 0, fail = 0;
fx.forEach((r) => {
  const p = prod(r);
  if (r.kind === 'health') {
    const out = SP.mlHealth(p); if (!out) { fail++; return; }
    // mlHealth rounds to 0.1, so compare with that tolerance
    worstH = Math.max(worstH, Math.abs(out.points - r.py)); hN++;
  } else {
    const out = SP.mlNova(p); if (!out) { fail++; return; }
    worstN = Math.max(worstN, ...out.probs.map((q, i) => Math.abs(q - r.py[i]))); nN++;
  }
});
console.log(`health rows ${hN}: max |JS - sklearn| = ${worstH.toFixed(3)} points (rounding to 0.1 expected)`);
console.log(`nova rows ${nN}: max probability difference = ${worstN.toExponential(2)}`);
console.log(`rows the JS refused: ${fail}`);
if (worstH > 0.06 || worstN > 1e-3 || fail) { console.error('PARITY FAILED'); process.exit(1); }
console.log('PARITY OK');
