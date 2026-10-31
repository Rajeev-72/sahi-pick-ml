/* Sahi Pick · store.js — your profile and basket, saved in this browser only */
(() => {
  'use strict';
  const P = 'sahipick.';
  const read = (k, fb) => { try { const r = localStorage.getItem(P + k); return r ? JSON.parse(r) : fb; } catch (_) { return fb; } };
  const write = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (_) { return false; } };

  /* ---- Profile: rating scale, goals, allergens ---- */
  SP.GOALS = [
    { id: 'lowSugar',    label: 'Less sugar',        hint: 'Counts sugar more heavily' },
    { id: 'lowSalt',     label: 'Less salt',         hint: 'Counts sodium more heavily' },
    { id: 'highProtein', label: 'More protein',      hint: 'Rewards protein more' },
    { id: 'moreFibre',   label: 'More fibre',        hint: 'Rewards fibre more' },
    { id: 'lowCal',      label: 'Fewer calories',    hint: 'Counts energy density more heavily' },
    { id: 'lowFat',      label: 'Less saturated fat', hint: 'Counts saturated fat more heavily' },
  ];
  const DEFAULT_PROFILE = { scale: 'india', goals: [], allergens: [], set: false };
  SP.getProfile = () => Object.assign({}, DEFAULT_PROFILE, read('profile', {}));
  SP.saveProfile = (p) => write('profile', Object.assign({}, p, { set: true }));
  SP.clearProfile = () => { try { localStorage.removeItem(P + 'profile'); } catch (_) {} };

  /* ---- Basket: [{ p: product snapshot, qty }] ---- */
  SP.snapshot = (p) => ({
    code: p.code, product_name: p.product_name, brands: p.brands, quantity: p.quantity,
    image_front_small_url: p.image_front_small_url, nutriments: p.nutriments, nutriscore_grade: p.nutriscore_grade,
    categories_tags: (p.categories_tags || []).slice(-6), allergens_tags: p.allergens_tags, traces_tags: p.traces_tags,
    ingredients_text: (p.ingredients_text || '').slice(0, 700), countries_tags: p.countries_tags, nova_group: p.nova_group,
    fresh: p.fresh, approx: p.approx,
  });
  SP.getBasket = () => read('basket', []);
  const saveBasket = (b) => { write('basket', b); SP.updateBasketBadge(); };
  SP.inBasket = (code) => SP.getBasket().some((i) => i.p.code === String(code));
  SP.addToBasket = (p) => {
    const b = SP.getBasket();
    const hit = b.find((i) => i.p.code === String(p.code));
    if (hit) hit.qty = Math.min(20, hit.qty + 1); else b.push({ p: SP.snapshot(p), qty: 1 });
    saveBasket(b);
  };
  SP.setQty = (code, qty) => {
    let b = SP.getBasket();
    b = qty <= 0 ? b.filter((i) => i.p.code !== String(code)) : b.map((i) => (i.p.code === String(code) ? { ...i, qty: Math.min(20, qty) } : i));
    saveBasket(b);
  };
  SP.removeFromBasket = (code) => SP.setQty(code, 0);
  SP.clearBasket = () => saveBasket([]);
  SP.updateBasketBadge = () => {
    const n = SP.getBasket().reduce((s, i) => s + i.qty, 0);
    const el = document.querySelector('[data-nav="basket"] .count');
    if (el) { el.textContent = n; el.hidden = n === 0; }
  };
})();
