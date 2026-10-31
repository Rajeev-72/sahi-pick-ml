/* Sahi Pick · utils.js — shared helpers, icons and small UI pieces */
window.SP = window.SP || {};

(() => {
  'use strict';

  SP.APP_NAME = 'Sahi Pick';

  // Rounded guideline amounts for a 2,000 kcal day (not personal targets).
  // Salt ≤ 5 g (= 2,000 mg sodium) and sugar ≤ 25 g follow WHO / ICMR-NIN guidance.
  SP.DAILY = { fat: 67, sat: 22, carbs: 250, fiber: 25, protein: 50, sodium: 2000, sugar: 25 };

  SP.LEVEL_LABEL = { low: 'Low', med: 'Medium', high: 'High' };

  SP.$ = (sel, root = document) => root.querySelector(sel);
  SP.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  SP.toNumber = (v) => (v === undefined || v === null || v === '' || isNaN(+v) ? null : +v);
  SP.format = (v, d = 1) => (v === null || v === undefined ? '—' : String(+v.toFixed(d)));
  SP.percentOfDaily = (v, ref) => (v === null || !ref ? '' : Math.round((v / ref) * 100) + '%');

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  SP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ESC[c]);

  /* ---- Icons: simple 24px line icons, drawn inline (no emoji, no image files) ---- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    barcode: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10"/>',
    compare: '<path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/>',
    basket: '<path d="M3 4h2l2.4 11h10.2l2-8H6"/><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alert: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>',
  };
  SP.icon = (name, cls = '') =>
    `<svg class="ico ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  SP.logoMark = () => `<svg viewBox="0 0 32 32" width="38" height="38" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill="#1b844b"/>
    <path d="M9 17l5 5 9-11" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ---- Small UI builders shared by all pages ---- */
  SP.message = (text, err = false) => `<div class="msg${err ? ' err' : ''}">${SP.esc(text)}</div>`;
  SP.loading = (text) => `<div class="msg"><span class="spinner" aria-hidden="true"></span><span>${SP.esc(text)}</span></div>`;
  SP.pageHead = (eyebrow, title, lead) => `
    <header class="page-head">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
    </header>`;

  // "500 g", "1 kg", "250 ml", "1.5 L"  →  grams (ml treated as g). null if unknown.
  SP.parseQuantity = (q) => {
    if (!q) return null;
    const m = String(q).toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|l|ltr|litre|liter|ml)\b/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2];
    if (u === 'kg' || u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter') return n * 1000;
    return n;
  };
})();
