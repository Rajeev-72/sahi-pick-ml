/* Sahi Pick · api.js — Open Food Facts lookups (India first) + fresh-food list + alternatives */
(() => {
  'use strict';
  const { toNumber } = SP;

  const API = 'https://world.openfoodfacts.org';
  const FIELDS = 'code,product_name,brands,image_front_small_url,nutriments,nutriscore_grade,nova_group,quantity,' +
                 'categories_tags,additives_n,allergens_tags,traces_tags,ingredients_text,countries_tags';

  // Products we've already seen, so opening one from a list is instant.
  const cache = new Map();
  SP.remember = (p) => { if (p && p.code) cache.set(String(p.code), p); return p; };

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The food database returned an error (${res.status}). Try again in a moment.`);
    return res.json();
  }

  const hasCalories = (p) =>
    p && p.product_name && p.nutriments && toNumber(p.nutriments['energy-kcal_100g']) !== null;

  /* ---- One product by barcode (or a fresh food by its id) ---- */
  SP.findByBarcode = async (code) => {
    code = String(code);
    if (SP.isFresh(code)) {
      const f = SP.getFresh(code);
      if (!f) throw new Error('We don’t have that fresh food in the list.');
      return f;
    }
    if (cache.has(code)) return cache.get(code);

    if (window.NS_DEMO_DATA) {
      const match = window.NS_DEMO_DATA.find((p) => p.code === code);
      if (!match) throw new Error('Sample mode only knows the sample barcodes.');
      return SP.remember(match);
    }
    const data = await getJSON(`${API}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    if (data.status === 0 || !data.product) {
      const err = new Error(`We couldn’t find barcode ${code} in the database. Indian packs are still patchy in Open Food Facts.`);
      err.notFound = true;
      throw err;
    }
    data.product.code = data.product.code || code;
    return SP.remember(data.product);
  };

  /* ---- Search by name: fresh foods first, then Indian products, then the rest of the world ---- */
  SP.findByName = async (query) => {
    const fresh = SP.searchFresh(query);
    if (window.NS_DEMO_DATA) {
      const q = query.toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const demo = window.NS_DEMO_DATA.filter((p) => {
        const text = `${p.product_name} ${p.brands}`.toLowerCase();
        return text.includes(q) || words.some((w) => text.includes(w));
      }).map(SP.remember);
      return fresh.concat(demo);
    }
    const base = `${API}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
                 `&search_simple=1&action=process&json=1&page_size=15&fields=${FIELDS}`;
    const india = `${base}&tagtype_0=countries&tag_contains_0=contains&tag_0=india`;
    const [inRes, worldRes] = await Promise.allSettled([getJSON(india), getJSON(base)]);
    if (inRes.status === 'rejected' && worldRes.status === 'rejected') throw inRes.reason;

    const seen = new Set();
    const merged = [];
    [inRes, worldRes].forEach((r) => {
      if (r.status !== 'fulfilled') return;
      (r.value.products || []).filter(hasCalories).forEach((p) => {
        if (seen.has(p.code)) return;
        seen.add(p.code);
        merged.push(SP.remember(p));
      });
    });
    return fresh.concat(merged);
  };

  /* ---- Better picks in the same category (India first), ranked by Sahi score ---- */
  SP.findAlternatives = async (p, profile) => {
    const mine = SP.rate(p, profile).score;
    let pool = [];

    if (p.fresh) {
      pool = SP.FRESH_LIST.filter((x) => x.code !== p.code && x.group === p.group);
    } else {
      const cats = (p.categories_tags || []).filter((c) => c.startsWith('en:')).slice(-3).reverse(); // most specific first
      const grab = async (cat, indiaOnly) => {
        const url = `${API}/api/v2/search?categories_tags=${encodeURIComponent(cat)}` +
                    (indiaOnly ? '&countries_tags=en:india' : '') +
                    `&fields=${FIELDS}&page_size=30&sort_by=unique_scans_n`;
        try { return ((await getJSON(url)).products || []).filter(hasCalories); } catch (_) { return []; }
      };
      for (const cat of cats.slice(0, 2)) {
        pool = pool.concat(await grab(cat, true));
        if (pool.length >= 8) break;
      }
      if (pool.length < 8 && cats[0]) pool = pool.concat(await grab(cats[0], false));
    }

    const seen = new Set([String(p.code)]);
    return pool
      .filter((x) => { if (seen.has(String(x.code))) return false; seen.add(String(x.code)); return true; })
      .map((x) => ({ p: SP.remember(x), r: SP.rate(x, profile) }))
      .filter((x) => x.r.score >= mine + 6 && x.r.allergy.contains.length === 0 && !x.r.dq.missing.includes('calories'))
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, 5);
  };
})();
