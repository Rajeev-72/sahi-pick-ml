/* Sahi Pick · ml.js — runs the two trained models (js/model-data.js) in the browser.
   Models are small gradient-boosted trees trained by ml/train.py, so there is no server and no library.
   1) SP.mlHealth(p) → predicted Nutri-Score points, A–E grade and the nutrients that drove it
   2) SP.mlNova(p)   → predicted NOVA group (1–4) with probabilities
   Both return null when there isn't enough data. They are estimates, not official labels. */
(() => {
  'use strict';
  const M = window.SP_MODELS;
  if (!M) { SP.mlHealth = () => null; SP.mlNova = () => null; SP.mlReady = false; return; }
  SP.mlReady = true;

  const walk = (t, x) => {
    let i = 0;
    while (t.l[i] !== -1) i = x[t.f[i]] <= t.t[i] ? t.l[i] : t.r[i];
    return t.v[i];
  };

  const catSet = (p) => new Set(p.categories_tags || []);
  const catStr = (p) => (p.categories_tags || []).join(' ');
  const has = (re, p) => (re.test(catStr(p)) ? 1 : 0);

  /* ---- build the feature vectors exactly like train.py does ---- */
  function healthVector(p) {
    const v = SP.values(p);
    const known = (x) => x !== null && x !== undefined;
    if (![v.kcal, v.fat, v.sat, v.sugar, v.protein, v.salt].every(known)) return null;
    const f = {
      energy_kcal: v.kcal, fat: v.fat, saturated_fat: v.sat, carbohydrates: known(v.carbs) ? v.carbs : v.sugar,
      sugars: v.sugar, proteins: v.protein, salt: v.salt, fiber: known(v.fiber) ? v.fiber : 0,
      fiber_missing: known(v.fiber) ? 0 : 1,
      is_beverage: has(/en:beverages/, p) || (p.fresh && p.group === 'drink') ? 1 : 0,
      is_cheese: has(/en:cheeses/, p), is_fat_oil: has(/en:fats|en:oils|en:butters/, p),
      is_dairy: has(/en:dairies|en:milks|en:yogurts/, p),
    };
    return f;
  }

  const gradeOf = (pts, bev) => {
    const cuts = bev ? [1, 5, 9] : [-1, 2, 10, 18];       // upper bounds for A,B,C,(D)
    const letters = bev ? ['B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D', 'E'];
    let i = 0; while (i < cuts.length && pts > cuts[i]) i++;
    return letters[i];
  };

  const predictHealth = (vec) => {
    const H = M.health;
    const x = H.features.map((k) => vec[k]);
    return H.init + H.lr * H.trees.reduce((s, t) => s + walk(t, x), 0);
  };

  SP.mlHealth = (p) => {
    const vec = healthVector(p);
    if (!vec) return null;
    const points = predictHealth(vec);
    // "Why?": switch one nutrient off at a time and see how many Nutri-Score points it was worth.
    const parts = [
      ['sugars', 'sugar', ['sugars']], ['saturated_fat', 'saturated fat', ['saturated_fat']], ['salt', 'salt', ['salt']],
      ['energy_kcal', 'calories', ['energy_kcal']], ['proteins', 'protein', ['proteins']], ['fiber', 'fibre', ['fiber', 'fiber_missing']],
    ];
    const drivers = parts.map(([, label, keys]) => {
      const alt = { ...vec }; keys.forEach((k) => { alt[k] = 0; });
      return { label, pts: points - predictHealth(alt) };      // + = pushes towards a worse grade
    }).filter((d) => Math.abs(d.pts) >= 0.8).sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)).slice(0, 3);
    return { points: Math.round(points * 10) / 10, grade: gradeOf(points, vec.is_beverage === 1), drivers };
  };

  SP.mlNova = (p) => {
    if (p.fresh) return null;
    const cats = catSet(p);
    if (!cats.size) return null;
    const v = SP.values(p);
    const z = (x) => (x === null || x === undefined ? 0 : x);
    const base = {
      energy_kcal: z(v.kcal), fat: z(v.fat), saturated_fat: z(v.sat), sugars: z(v.sugar), proteins: z(v.protein),
      salt: z(v.salt), fiber: z(v.fiber),
      additives_n: Number.isFinite(Number(p.additives_n)) && p.additives_n !== undefined && p.additives_n !== null ? Number(p.additives_n) : 0,
      additives_missing: p.additives_n === undefined || p.additives_n === null ? 1 : 0,
      nut_missing: [v.kcal, v.fat, v.sugar].some((q) => q === null || q === undefined) ? 1 : 0,
    };
    const N = M.nova;
    const x = N.features.map((k) => (k.startsWith('cat:') ? (cats.has(k.slice(4)) ? 1 : 0) : base[k]));
    const raw = N.prior.slice();
    N.trees.forEach((stage) => stage.forEach((t, k) => { raw[k] += N.lr * walk(t, x); }));
    const mx = Math.max(...raw), e = raw.map((r) => Math.exp(r - mx)), sum = e.reduce((a, b) => a + b, 0);
    const probs = e.map((r) => r / sum);
    let best = 0; probs.forEach((q, i) => { if (q > probs[best]) best = i; });
    return { group: N.classes[best], conf: probs[best], probs, noAdditiveInfo: base.additives_missing === 1 };
  };

  SP.NOVA_TEXT = { 1: 'Unprocessed or minimally processed', 2: 'Processed culinary ingredient', 3: 'Processed food', 4: 'Ultra-processed' };
})();
