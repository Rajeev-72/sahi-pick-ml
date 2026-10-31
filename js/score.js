/* Sahi Pick · score.js — the rating engine.
   1) Low / Medium / High labels on an India scale (ICMR-NIN 2024 reference values that
      FSSAI's front-of-pack proposal is built on) or the UK traffic-light scale.
   2) A 0–100 "Sahi score", tuned by the person's goals.
   3) Allergen checks.
   The rules are general guidance, not medical advice. */
(() => {
  'use strict';
  const { toNumber } = SP;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const s = (x, max) => (x === null || x === undefined ? 0 : clamp(x / max, 0, 1));

  /* ---------- Read the numbers out of an Open Food Facts product ---------- */
  SP.values = (p) => {
    const n = p.nutriments || {};
    const v = {
      kcal: toNumber(n['energy-kcal_100g']), protein: toNumber(n['proteins_100g']), fat: toNumber(n['fat_100g']),
      sat: toNumber(n['saturated-fat_100g']), carbs: toNumber(n['carbohydrates_100g']), sugar: toNumber(n['sugars_100g']),
      added: toNumber(n['added-sugars_100g']), fiber: toNumber(n['fiber_100g']), sodium: toNumber(n['sodium_100g']),
    };
    if (v.sodium !== null) v.sodium *= 1000;               // g → mg
    v.salt = v.sodium === null ? null : v.sodium * 2.5 / 1000; // g of salt
    return v;
  };

  SP.isLiquid = (p) => {
    const q = String(p.quantity || '').toLowerCase();
    const cats = (p.categories_tags || []).join(' ');
    return /\b\d+(\.\d+)?\s*(ml|l|ltr|litre|liter)\b/.test(q) || /beverage|drinks|juices|waters|sodas/.test(cats);
  };

  // Foods whose sugar is mostly natural (milk, curd, fruit) shouldn't be flagged as "high sugar".
  SP.hasNaturalSugar = (p) => {
    if (p.fresh) return p.group === 'fruit' || p.group === 'dairy' || p.group === 'drink';
    const cats = (p.categories_tags || []).join(' ');
    const natural = /en:(milks|yogurts|fermented-milks|dairies|fruits|fruits-and-vegetables|plant-based-foods|vegetables)\b|fresh-/.test(cats);
    const sweetened = /sweet|biscuit|chocolate|candy|confection|dessert|cake|cookie|beverage|soda|juice|spread|cereal|snack|ice-cream/.test(cats);
    return natural && !sweetened;
  };

  /* ---------- Low / Medium / High ---------- */
  // Returns { fat, sat, sugar, sodium } → 'low' | 'med' | 'high' | '' (not rated)
  SP.levels = (v, p, scale) => {
    const out = { fat: '', sat: '', sugar: '', sodium: '' };
    const liquid = SP.isLiquid(p);
    if (scale === 'uk') {
      const L = { fat: [3, 17.5], sat: [1.5, 5], sugar: [5, 22.5], sodium: [120, 600] };
      const lv = (x, k) => (x === null ? '' : x <= L[k][0] ? 'low' : x > L[k][1] ? 'high' : 'med');
      return { fat: lv(v.fat, 'fat'), sat: lv(v.sat, 'sat'), sugar: lv(v.sugar, 'sugar'), sodium: lv(v.sodium, 'sodium') };
    }
    // India: energy-share rules (ICMR-NIN: total fat ≤30 % of energy, total sugar ≤10 %, saturated fat ≤10 % per WHO)
    // plus the 625 mg salt / 3 g added sugar per 100 g reference limits (liquids: 175 mg salt, 2 g added sugar per 100 ml).
    const share = (g, perG) => (v.kcal && g !== null ? (g * perG) / v.kcal : null);
    const tier = (x, lo, hi) => (x === null ? '' : x <= lo ? 'low' : x > hi ? 'high' : 'med');
    out.fat = tier(share(v.fat, 9), 0.15, 0.30);
    out.sat = tier(share(v.sat, 9), 0.05, 0.10);
    if (v.added !== null) out.sugar = tier(v.added, liquid ? 1 : 1.5, liquid ? 2 : 3);
    else if (!SP.hasNaturalSugar(p)) out.sugar = tier(share(v.sugar, 4), 0.05, 0.10);
    out.sodium = v.sodium === null ? '' : tier(v.sodium, liquid ? 35 : 125, liquid ? 70 : 250);
    return out;
  };

  /* ---------- Allergens ---------- */
  SP.ALLERGENS = [
    { id: 'milk', label: 'Milk', tags: ['en:milk'], kw: ['milk', 'dairy', 'whey', 'casein', 'lactose', 'butter', 'ghee', 'paneer', 'curd', 'cream', 'cheese', 'khoa', 'mawa'] },
    { id: 'gluten', label: 'Gluten (wheat, barley, rye)', tags: ['en:gluten'], kw: ['wheat', 'gluten', 'barley', 'rye', 'maida', 'atta', 'semolina', 'suji', 'rava', 'malt'] },
    { id: 'peanuts', label: 'Peanuts', tags: ['en:peanuts'], kw: ['peanut', 'groundnut', 'moongfali'] },
    { id: 'nuts', label: 'Tree nuts', tags: ['en:nuts'], kw: ['almond', 'cashew', 'walnut', 'pistachio', 'hazelnut', 'pecan', 'tree nut', 'badam', 'kaju'] },
    { id: 'soy', label: 'Soy', tags: ['en:soybeans'], kw: ['soy', 'soya', 'soybean'] },
    { id: 'eggs', label: 'Eggs', tags: ['en:eggs'], kw: ['egg', 'albumen'] },
    { id: 'fish', label: 'Fish', tags: ['en:fish'], kw: ['fish', 'anchovy'] },
    { id: 'shellfish', label: 'Shellfish', tags: ['en:crustaceans', 'en:molluscs'], kw: ['prawn', 'shrimp', 'crab', 'lobster', 'squid'] },
    { id: 'sesame', label: 'Sesame', tags: ['en:sesame-seeds'], kw: ['sesame', 'gingelly', 'til '] },
    { id: 'mustard', label: 'Mustard', tags: ['en:mustard'], kw: ['mustard', 'sarson'] },
  ];

  // → { contains:[labels], may:[labels], unknown:boolean }  (only for the allergens in the profile)
  SP.allergenCheck = (p, profile) => {
    const mine = SP.ALLERGENS.filter((a) => (profile.allergens || []).includes(a.id));
    const own = (p.allergens_tags || []), traces = (p.traces_tags || []);
    const text = ' ' + String(p.ingredients_text || '').toLowerCase() + ' ';
    const contains = [], may = [];
    mine.forEach((a) => {
      const inTags = a.tags.some((t) => own.includes(t));
      const inText = a.kw.some((k) => new RegExp('\\b' + k.trim() + (k.endsWith(' ') ? '\\b' : ''), 'i').test(text));
      if (inTags || inText) contains.push(a.label);
      else if (a.tags.some((t) => traces.includes(t))) may.push(a.label);
    });
    const unknown = !own.length && !traces.length && !String(p.ingredients_text || '').trim();
    return { contains, may, unknown, checked: mine.length > 0 };
  };

  /* ---------- Data quality ---------- */
  SP.dataQuality = (p) => {
    const v = SP.values(p);
    const names = { kcal: 'calories', protein: 'protein', fat: 'fat', sat: 'saturated fat', carbs: 'carbs', sugar: 'sugar', fiber: 'fibre', sodium: 'sodium' };
    const missing = Object.keys(names).filter((k) => v[k] === null).map((k) => names[k]);
    return { missing, complete: missing.length === 0, indiaTagged: (p.countries_tags || []).includes('en:india') };
  };

  /* ---------- The 0–100 Sahi score ---------- */
  SP.rate = (p, profile) => {
    profile = profile || SP.getProfile();
    const g = new Set(profile.goals || []);
    const v = SP.values(p);
    const liquid = SP.isLiquid(p);
    const natural = SP.hasNaturalSugar(p) && v.added === null;
    const sugarVal = v.added !== null ? v.added : v.sugar;
    const satVal = v.sat !== null ? v.sat : (v.fat !== null ? v.fat / 3 : null);
    const fatShare = v.kcal && v.fat !== null ? (v.fat * 9) / v.kcal : null;

    const W = {
      sugar: 28 * (g.has('lowSugar') ? 1.8 : 1) * (natural ? 0.35 : liquid ? 2 : 1),
      sat: 16 * (g.has('lowFat') ? 1.8 : 1),
      salt: 24 * (g.has('lowSalt') ? 1.8 : 1),
      kcal: 15 * (g.has('lowCal') ? 1.8 : 1),
      fat: 10 * (g.has('lowFat') ? 1.5 : 1),
      protein: 14 * (g.has('highProtein') ? 2 : 1),
      fiber: 12 * (g.has('moreFibre') ? 2 : 1),
    };

    const comps = [
      { key: 'sugar',   label: 'sugar',          unit: 'g',   value: sugarVal, pts: -W.sugar * s(sugarVal, liquid ? 10 : 25) },
      { key: 'sat',     label: 'saturated fat',  unit: 'g',   value: satVal,   pts: -W.sat * s(satVal, 8) },
      { key: 'sodium',  label: 'salt',           unit: 'mg',  value: v.sodium, pts: -W.salt * s(v.sodium, liquid ? 200 : 900), shown: v.sodium },
      { key: 'kcal',    label: 'calories',       unit: 'kcal', value: v.kcal,  pts: -W.kcal * s(v.kcal, liquid ? 120 : 500) },
      { key: 'fat',     label: 'total fat',      unit: '%',   value: fatShare, pts: -W.fat * s(fatShare, 0.5) },
      { key: 'protein', label: 'protein',        unit: 'g',   value: v.protein, pts: W.protein * s(v.protein, 20) },
      { key: 'fiber',   label: 'fibre',          unit: 'g',   value: v.fiber,  pts: W.fiber * s(v.fiber, 8) },
    ];
    let score = 100 + comps.reduce((t, c) => t + c.pts, 0);
    if (Number(p.nova_group) === 4) { score -= 10; comps.push({ key: 'nova', label: 'ultra-processed', value: 4, pts: -10 }); }
    score = Math.round(clamp(score, 0, 100));

    const verdict = score >= 70 ? 'good' : score >= 50 ? 'ok' : 'limit';
    const allergy = SP.allergenCheck(p, profile);
    const dq = SP.dataQuality(p);
    return { score, verdict, comps, v, allergy, dq };
  };

  SP.VERDICT_TEXT = { good: 'Good pick', ok: 'Okay now and then', limit: 'Better to limit' };

  // Short plain-language reasons for a rating (strongest first)
  SP.reasons = (r) => {
    const f = (x, d = 1) => SP.format(x, d);
    const out = [];
    const sorted = r.comps.filter((c) => c.value !== null && Math.abs(c.pts) >= 3).sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
    sorted.slice(0, 4).forEach((c) => {
      const good = c.pts > 0;
      let t;
      if (c.key === 'sugar') t = `${good ? 'Low' : 'High'} in sugar (${f(c.value)} g per 100 g)`;
      else if (c.key === 'sat') t = `${good ? 'Low' : 'High'} in saturated fat (${f(c.value)} g)`;
      else if (c.key === 'sodium') t = `${good ? 'Low' : 'High'} in salt (${f(c.value, 0)} mg sodium)`;
      else if (c.key === 'kcal') t = `${good ? 'Light' : 'Energy-dense'}: ${f(c.value, 0)} kcal per 100 g`;
      else if (c.key === 'fat') t = `Fat supplies ${Math.round(c.value * 100)}% of its calories`;
      else if (c.key === 'protein') t = `Good protein (${f(c.value)} g)`;
      else if (c.key === 'fiber') t = `Good fibre (${f(c.value)} g)`;
      else if (c.key === 'nova') t = 'Ultra-processed (NOVA group 4)';
      if (t) out.push({ good, text: t });
    });
    return out;
  };
})();
