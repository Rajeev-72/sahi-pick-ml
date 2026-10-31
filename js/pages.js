/* ==========================================================================
   Sahi Pick · pages.js — home, search, barcode, product, about, 404.
   Compare / basket / profile / kitchen-test live in pages2.js; scanning in scan.js.
   Each page receives { el, params, query, isCurrent } and returns { title, nav, cleanup? }.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, esc, toNumber, format, percentOfDaily, message, loading, pageHead, icon, LEVEL_LABEL, DAILY } = SP;

  const IDEAS = ['Atta', 'Dahi', 'Masala oats', 'Biscuits', 'Banana'];
  const ideaLinks = () => IDEAS.map((t) => `<a class="chip" href="${SP.href('/search', t)}">${esc(t)}</a>`).join('');

  const demoNote = () => window.NS_DEMO_DATA
    ? '<p class="demo">Sample mode: this preview shows a few built-in products. Run the project locally to search the live database.</p>' : '';

  /* ---------- shared pieces (also used by pages2.js) ---------- */
  const ui = SP.ui = {};

  ui.verdictClass = (v) => ({ good: 'good', ok: 'ok', limit: 'limit' }[v] || 'ok');

  ui.scoreBadge = (r) =>
    `<span class="score-badge ${ui.verdictClass(r.verdict)}" title="${esc(SP.VERDICT_TEXT[r.verdict])}"><b>${r.score}</b><small>/100</small></span>`;

  ui.allergyBanner = (r, profile) => {
    const a = r.allergy;
    if (!a.checked) return '';
    if (a.contains.length) return `<div class="alert danger" role="alert">${icon('alert')}<div><b>Contains ${esc(a.contains.join(', '))}</b><span>You marked this as something to avoid. Confirm on the pack before you buy.</span></div></div>`;
    if (a.may.length) return `<div class="alert warn" role="alert">${icon('alert')}<div><b>May contain traces of ${esc(a.may.join(', '))}</b><span>Cross-contact warning from the pack data.</span></div></div>`;
    if (a.unknown) return `<div class="alert warn">${icon('info')}<div><b>No allergen data for this product</b><span>We can’t tell if it suits your allergy list. Read the pack.</span></div></div>`;
    return `<div class="alert ok">${icon('check')}<div><b>None of your listed allergens found in the data</b><span>Data can be wrong or old. Always read the pack.</span></div></div>`;
  };

  ui.matchRow = (p, profile) => {
    const r = SP.rate(p, profile);
    const thumb = p.image_front_small_url ? `<img class="thumb" alt="" loading="lazy" src="${esc(p.image_front_small_url)}">` : `<span class="thumb ph">${icon(p.fresh ? 'leaf' : 'barcode')}</span>`;
    const tag = p.fresh ? '<span class="mini">Fresh · typical</span>' : (p.countries_tags || []).includes('en:india') ? '<span class="mini in">India</span>' : '';
    return `<a href="${SP.href('/product', p.code)}">${thumb}
      <span><span class="m-name">${esc(p.product_name)}</span><span class="m-brand">${esc(p.brands || 'Unknown brand')} ${tag}</span></span>
      ${ui.scoreBadge(r)}</a>`;
  };

  const isCode = (v) => /^\d{8,14}$/.test(v.replace(/[\s-]/g, ''));
  const goSearchOrCode = (v) => {
    if (isCode(v)) SP.go('/product/' + v.replace(/[\s-]/g, ''));
    else SP.go(v ? '/search/' + encodeURIComponent(v) : '/search');
  };
  const barcodeForm = (id) => `
    <form class="barcode-inline" id="${id}">
      <label for="${id}-in">${icon('barcode')} Have the barcode? Type the number under the bars</label>
      <div class="row"><input id="${id}-in" inputmode="numeric" placeholder="8 to 13 digits" autocomplete="off">
      <button class="btn ghost" type="submit">Look up</button></div>
      <p class="form-err" id="${id}-err" role="alert"></p>
    </form>`;
  const bindBarcodeForm = (id) => {
    const f = $('#' + id);
    if (!f) return;
    f.onsubmit = (e) => {
      e.preventDefault();
      const code = $('#' + id + '-in').value.replace(/\D/g, '');
      if (code.length < 8 || code.length > 14) { $('#' + id + '-err').textContent = 'Barcodes have 8 to 13 digits. Check the number under the bars.'; return; }
      SP.go('/product/' + code);
    };
  };

  /* ---------------- Home ---------------- */
  SP.route('/', ({ el }) => {
    const prof = SP.getProfile();
    el.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">Built for Indian shelves</p>
          <h1>Two packs. One shelf. <span class="hl">Pick the better one.</span></h1>
          <p class="lead">Scan or search any packed or fresh food, compare it with another, and see what suits <em>your</em> goals and allergies. Ratings use India’s ICMR-NIN reference values.</p>

          <form class="hero-search" id="home-search" role="search">
            <label class="visually-hidden" for="home-q">Search for a food</label>
            <div class="row">
              <input id="home-q" type="search" placeholder="Try “atta”, “dahi” or a brand name" autocomplete="off">
              <button class="btn" type="submit">Search</button>
            </div>
          </form>
          <div class="chips"><span class="chips-label">Quick ideas:</span>${ideaLinks()}</div>
          ${barcodeForm('home-bc')}
        </div>

        <div class="hero-art" aria-hidden="true">
          <div class="mock">
            <p class="mock-cap">Example comparison</p>
            <div class="mock-col"><span class="mock-name">Biscuit A</span><span class="mock-bar"><i style="width:21%"></i></span><span class="mock-num bad">21</span></div>
            <div class="mock-col win"><span class="mock-name">Biscuit B</span><span class="mock-bar"><i style="width:68%"></i></span><span class="mock-num good">68</span></div>
            <p class="mock-pick">${icon('check')} Pick B: less sugar, less salt</p>
          </div>
        </div>
      </section>

      ${prof.set ? '' : `<div class="callout"><div>${icon('user')}<span><b>Make it personal.</b> Add your goals and allergies once and every rating adjusts.</span></div><a class="btn" href="#/profile">Set up my profile</a></div>`}

      <section aria-labelledby="ways">
        <h2 class="section-title" id="ways">What you can do</h2>
        <div class="feature-grid">
          <a class="feature" href="#/compare"><span class="f-ico c1">${icon('compare', 'lg')}</span><h3>Compare two</h3><p>Standing in the aisle? Put two products side by side and get a clear pick.</p><span class="go">Compare →</span></a>
          <a class="feature" href="#/scan"><span class="f-ico c2">${icon('scan', 'lg')}</span><h3>Scan a barcode</h3><p>Point your camera at the pack. We’ll suggest healthier swaps in the same category.</p><span class="go">Open camera →</span></a>
          <a class="feature" href="#/basket"><span class="f-ico c3">${icon('basket', 'lg')}</span><h3>Check your basket</h3><p>Add what you plan to buy and see the total sugar and salt that brings home.</p><span class="go">See basket →</span></a>
        </div>
        <p class="hint center">No barcode? Fruit, vegetables, dal and other loose foods are in <a href="#/search">Search</a> too.</p>
      </section>`;

    $('#home-search').onsubmit = (e) => {
      e.preventDefault();
      goSearchOrCode($('#home-q').value.trim());
    };
    bindBarcodeForm('home-bc');
    return { title: 'Pick the better one', nav: 'home' };
  });

  /* ---------------- Search:  #/search  and  #/search/:q ---------------- */
  SP.route('/search/:q?', async ({ el, params, isCurrent }) => {
    const q = params.q;
    el.innerHTML = `
      ${pageHead('Search', 'Find a food', 'Packed foods from Open Food Facts (Indian products first) and common fresh foods.')}
      <section class="finder">
        <form id="name-form" role="search">
          <label for="q">What are you curious about?</label>
          <div class="row">
            <input id="q" type="search" placeholder="Try “atta”, “banana” or a brand" autocomplete="off" value="${esc(q || '')}">
            <button class="btn" type="submit">Search</button>
          </div>
          <div class="chips"><span class="chips-label">Quick ideas:</span>${ideaLinks()}</div>
        </form>
        ${barcodeForm('search-bc')}
      </section>
      <section id="results" aria-live="polite"></section>`;
    bindBarcodeForm('search-bc');

    $('#name-form').onsubmit = (e) => {
      e.preventDefault();
      const v = $('#q').value.trim();
      if (!v) { $('#results').innerHTML = message('Type a product name first, then press Search.', true); return; }
      goSearchOrCode(v);
    };

    const box = $('#results');
    if (!q) return { title: 'Search', nav: 'search' };

    SP.lastSearch = q;
    box.innerHTML = loading(`Searching for “${q}”…`);
    try {
      const list = await SP.findByName(q);
      if (!isCurrent()) return;
      if (!list.length) {
        box.innerHTML = message(`Nothing with nutrition info matched “${q}”. Try a simpler name, or look it up by barcode.`, true) +
          '<p class="hint">Indian brands are still patchy in the database. If you have the pack, <a href="#/barcode">enter the barcode</a>.</p>';
      } else {
        const prof = SP.getProfile();
        const rows = list.map((p) => `<li>${ui.matchRow(p, prof)}</li>`).join('');
        box.innerHTML = `${demoNote()}<div class="matches"><h2>${list.length} matches for “${esc(q)}”</h2><ul>${rows}</ul>
          <p class="hint">The badge is the Sahi score (0–100, higher is better) using your profile.</p></div>`;
      }
    } catch (err) {
      if (isCurrent()) box.innerHTML = message(err.message || 'Something went wrong. Check your connection and try again.', true);
    }
    return { title: `“${q}”`, nav: 'search', keepFocus: false };
  });

  /* ---------------- Barcode:  #/barcode ---------------- */
  SP.route('/barcode', ({ el }) => {
    el.innerHTML = `
      ${pageHead('Barcode', 'Look up a barcode', 'Find the number printed under the bars on the pack.')}
      <section class="finder">
        <form id="code-form">
          <label for="barcode">Barcode number</label>
          <div class="row">
            <input id="barcode" inputmode="numeric" placeholder="8 to 13 digits, printed under the bars" autocomplete="off">
            <button class="btn" type="submit">Look up</button>
          </div>
        </form>
      </section>
      <section id="results" aria-live="polite"></section>`;

    $('#code-form').onsubmit = (e) => {
      e.preventDefault();
      const code = $('#barcode').value.replace(/\D/g, '');
      if (code.length < 8 || code.length > 14) {
        $('#results').innerHTML = message('Barcodes have 8 to 13 digits. Check the number under the bars.', true);
        return;
      }
      SP.go('/product/' + code);
    };
    return { title: 'Barcode lookup', nav: 'search' };
  });

  /* ---------------- Product:  #/product/:code ---------------- */
  const factsRow = ({ label, value, unit, ref, level, sub }) => {
    const pill = level ? `<span class="lvl ${level}">${LEVEL_LABEL[level]}</span>` : '';
    return `<div class="line ${sub ? 'sub' : 'main'}"><span class="n">${label} ${format(value)}${unit} ${pill}</span><span class="dv">${percentOfDaily(value, ref)}</span></div>`;
  };

  const nutriScoreHTML = (grade) => {
    if (!/^[a-e]$/.test(grade)) return '<p class="score-none">No Nutri-Score published for this product. That’s common for Indian packs, so we use the Sahi score instead.</p>';
    const dots = ['a', 'b', 'c', 'd', 'e'].map((g) => `<span class="g-${g}${g === grade ? ' on' : ''}">${g.toUpperCase()}</span>`).join('');
    return `<p class="score-title">Nutri-Score ${grade.toUpperCase()} <span class="muted">(European label, A best)</span></p>
      <div class="scale" role="img" aria-label="Nutri-Score ${grade.toUpperCase()} out of A to E">${dots}</div>`;
  };

  const highlightsHTML = (v, lv, p) => {
    const t = [];
    if (v.protein >= 12) t.push(['good', 'High in protein']);
    if (v.fiber >= 6) t.push(['good', 'High in fibre']);
    if (lv.sugar === 'low') t.push(['good', 'Low in sugar']);
    if (lv.sugar === 'high') t.push(['warn', 'High in sugar']);
    if (lv.sat === 'high') t.push(['warn', 'High in saturated fat']);
    if (lv.fat === 'high' && lv.sat !== 'high') t.push(['warn', 'High in fat']);
    if (lv.sodium === 'high') t.push(['warn', 'High in salt']);
    if (lv.sodium === 'low') t.push(['good', 'Low in salt']);
    if (v.kcal !== null && v.kcal > (SP.isLiquid(p) ? 70 : 250) && !p.fresh) t.push(['warn', 'Energy-dense']);
    if (!t.length) return '';
    return `<div class="card"><h3>Good to know</h3><ul class="tags">${t.map(([k, x]) => `<li class="tag ${k}">${x}</li>`).join('')}</ul></div>`;
  };

  /* ML card: Nutri-Score and NOVA estimated by the trained models (js/ml.js) */
  const mlHTML = (p) => {
    if (!SP.mlReady) return '';
    const h = SP.mlHealth(p), n = SP.mlNova(p);
    if (!h && !n) return '';
    const official = (p.nutriscore_grade || '').toUpperCase();
    let hh = '';
    if (h) {
      const why = h.drivers.map((d) => `<li class="${d.pts > 0 ? 'bad' : 'good'}">${icon(d.pts > 0 ? 'alert' : 'check')}<span>${d.pts > 0 ? 'Pushes the grade down' : 'Helps the grade'}: ${esc(d.label)} <b>${d.pts > 0 ? '+' : ''}${format(d.pts, 1)} pts</b></span></li>`).join('');
      hh = `<div class="ml-row"><span class="ml-grade g-${h.grade.toLowerCase()}">${h.grade}</span>
        <div><p class="ml-title">Estimated Nutri-Score ${h.grade} <span class="muted">(${format(h.points, 1)} points, lower is better)</span></p>
        <p class="muted">${/^[A-E]$/.test(official) ? `Official label on file: <b>${official}</b>.` : 'No official label on file, so this is our model’s estimate.'}</p></div></div>
        ${why ? `<ul class="reasons ml-why">${why}</ul>` : ''}`;
    }
    let nn = '';
    if (n) {
      const pct = Math.round(n.conf * 100);
      const official4 = Number(p.nova_group);
      nn = `<div class="ml-row"><span class="ml-grade nova-${n.group}">${n.group}</span>
        <div><p class="ml-title">Processing level: ${n.conf < 0.75 ? 'leaning' : ''} NOVA ${n.group} <span class="muted">(${pct}% confident${n.conf < 0.75 ? ', so check the ingredients' : ''})</span></p>
        <p class="muted">${SP.NOVA_TEXT[n.group]}.${official4 ? ` Official group on file: <b>${official4}</b>.` : ''}${n.noAdditiveInfo ? ' Additive count was missing, so this leans on the category and nutrients.' : ''}</p></div></div>`;
    }
    return `<div class="card ml-card"><h3>Smart estimate <span class="mini in">ML</span></h3>${hh}${nn}
      <p class="foot">Two small gradient-boosted models trained on Open Food Facts products (Swiss snapshot) run in your browser. Estimates, not official labels. <a href="#/about">How it works</a></p></div>`;
  };

  function productHTML(p, profile) {
    const r = SP.rate(p, profile);
    const v = r.v;
    const lv = SP.levels(v, p, profile.scale);
    const grade = (p.nutriscore_grade || '').toLowerCase();

    const fP = (v.protein || 0) * 4, fC = (v.carbs || 0) * 4, fF = (v.fat || 0) * 9, total = fP + fC + fF;
    const pct = (x) => (total ? Math.round((x / total) * 100) : 0);
    const w = (x) => (total ? (x / total) * 100 : 0);
    const split = total ? `<div class="card"><h3>Where the calories come from</h3>
      <div class="bar" role="img" aria-label="Protein ${pct(fP)}%, carbs ${pct(fC)}%, fat ${pct(fF)}%">
        <i class="p" style="width:${w(fP)}%"></i><i class="c" style="width:${w(fC)}%"></i><i class="f" style="width:${w(fF)}%"></i></div>
      <ul class="legend"><li class="p">Protein ${pct(fP)}%</li><li class="c">Carbs ${pct(fC)}%</li><li class="f">Fat ${pct(fF)}%</li></ul></div>` : '';

    const image = p.image_front_small_url ? `<img alt="" src="${esc(p.image_front_small_url)}">` : `<span class="pimg ph">${icon(p.fresh ? 'leaf' : 'barcode', 'lg')}</span>`;
    const meta = esc(p.brands || 'Unknown brand') + (p.quantity ? ` · ${esc(p.quantity)}` : '');
    const badges = [];
    if (p.fresh) badges.push('<span class="mini">Typical value · approximate</span>');
    else if (r.dq.indiaTagged) badges.push('<span class="mini in">Listed for India</span>');
    else badges.push('<span class="mini warn">Not tagged as sold in India</span>');
    if (Number(p.nova_group) === 4) badges.push('<span class="mini warn">Ultra-processed (NOVA 4)</span>');

    const reasons = SP.reasons(r).map((x) => `<li class="${x.good ? 'good' : 'bad'}">${icon(x.good ? 'check' : 'alert')}<span>${esc(x.text)}</span></li>`).join('');
    const goalsTxt = profile.goals.length ? `Tuned for: ${profile.goals.map((id) => SP.GOALS.find((g) => g.id === id).label.toLowerCase()).join(', ')}.` : 'General rating. <a href="#/profile">Add your goals</a> to tune it.';
    const dq = r.dq.missing.length ? `<p class="hint warnline">${icon('info')} Missing data: ${esc(r.dq.missing.join(', '))}. The score may be off.</p>` : '';
    const sugarNote = SP.hasNaturalSugar(p) && v.added === null && profile.scale === 'india'
      ? '<p class="foot">Sugar isn’t rated here because this food’s sugar is mostly natural (milk, curd or fruit).</p>' : '';
    const scaleNote = profile.scale === 'india'
      ? 'Low / Medium / High uses ICMR-NIN 2024 reference values (the basis of FSSAI’s front-of-pack proposal). Not an official FSSAI label.'
      : 'Low / Medium / High follows the UK traffic-light scale.';
    const inBasket = SP.inBasket(p.code);

    return `${demoNote()}
    ${ui.allergyBanner(r, profile)}
    <article class="result">
      <div>
        <div class="card">
          <div class="product">${image}<div><h1>${esc(p.product_name)}</h1><p>${meta}</p><div class="badges">${badges.join('')}</div></div></div>
          <div class="verdict ${ui.verdictClass(r.verdict)}">
            <div class="v-score"><b>${r.score}</b><small>/100</small></div>
            <div><p class="v-title">${SP.VERDICT_TEXT[r.verdict]}</p><p class="v-sub">${goalsTxt}</p></div>
          </div>
          <ul class="reasons">${reasons}</ul>
          ${dq}
          <div class="actions">
            <button class="btn" id="add-basket" type="button">${icon(inBasket ? 'check' : 'plus')} ${inBasket ? 'In basket · add another' : 'Add to basket'}</button>
            <a class="btn ghost" href="${SP.href('/compare', p.code, '-')}">${icon('compare')} Compare with another</a>
          </div>
          <div class="score">${nutriScoreHTML(grade)}</div>
        </div>
        ${mlHTML(p)}
        ${highlightsHTML(v, lv, p)}
        <div class="card"><h3>At a glance, per 100 g</h3><div class="macros">
          <div class="macro kcal"><b>${format(v.kcal, 0)}<small>kcal</small></b><span class="lbl">Calories</span></div>
          <div class="macro pro"><b>${format(v.protein)}<small>g</small></b><span class="lbl">Protein</span></div>
          <div class="macro carb"><b>${format(v.carbs)}<small>g</small></b><span class="lbl">Carbs</span></div>
          <div class="macro fat"><b>${format(v.fat)}<small>g</small></b><span class="lbl">Fat</span></div>
        </div></div>
        ${split}
        <section class="card" id="alts" aria-live="polite"><h3>Healthier swaps</h3>${loading('Looking for better options in the same category…')}</section>
        <p class="note">${icon('info')}<span><b>Check the pack.</b> Data comes from volunteers and can be wrong or out of date, especially for allergens. Ratings are general guidance, not medical advice. If you have a health condition, ask your doctor or dietitian.</span></p>
      </div>
      <aside class="facts" aria-label="Nutrition facts">
        <h2>Nutrition facts</h2><p class="basis">Per 100 g${SP.isLiquid(p) ? ' / 100 ml' : ''}</p>
        <div class="cal"><span>Calories</span><b>${format(v.kcal, 0)}</b></div>
        <div class="dvh">% of daily guide*</div>
        ${factsRow({ label: 'Total fat', value: v.fat, unit: ' g', ref: DAILY.fat, level: lv.fat })}
        ${factsRow({ label: 'Saturated fat', value: v.sat, unit: ' g', ref: DAILY.sat, level: lv.sat, sub: true })}
        ${factsRow({ label: 'Sodium', value: v.sodium, unit: ' mg', ref: DAILY.sodium, level: lv.sodium })}
        ${factsRow({ label: 'Total carbohydrate', value: v.carbs, unit: ' g', ref: DAILY.carbs })}
        ${factsRow({ label: 'Dietary fibre', value: v.fiber, unit: ' g', ref: DAILY.fiber, sub: true })}
        ${factsRow({ label: 'Total sugars', value: v.sugar, unit: ' g', ref: DAILY.sugar, level: lv.sugar, sub: true })}
        ${v.added !== null ? factsRow({ label: 'Added sugars', value: v.added, unit: ' g', sub: true }) : ''}
        ${factsRow({ label: 'Protein', value: v.protein, unit: ' g', ref: DAILY.protein })}
        <p class="foot">*Rounded guide for a 2,000 kcal day (salt 5 g, sugar 25 g are WHO / ICMR-NIN limits). ${scaleNote} “—” means no data.</p>
        ${sugarNote}
      </aside>
    </article>`;
  }

  const altsHTML = (list, p) => {
    if (!list.length) return `<p class="muted">We couldn’t find a clearly better product in the same category${p.fresh ? '' : ' (the database may simply not have enough Indian products for it yet)'}.</p>`;
    const prof = SP.getProfile();
    const base = SP.rate(p, prof).score;
    return `<ul class="alts">${list.map(({ p: a, r }) => `<li>
      <a class="alt-main" href="${SP.href('/product', a.code)}">${a.image_front_small_url ? `<img class="thumb" alt="" loading="lazy" src="${esc(a.image_front_small_url)}">` : `<span class="thumb ph">${icon(a.fresh ? 'leaf' : 'barcode')}</span>`}
        <span><span class="m-name">${esc(a.product_name)}</span><span class="m-brand">${esc(a.brands || 'Unknown brand')} · <b class="up">+${r.score - base} points</b></span></span></a>
      ${ui.scoreBadge(r)}
      <a class="btn ghost sm" href="${SP.href('/compare', p.code, a.code)}">Compare</a></li>`).join('')}</ul>`;
  };

  SP.route('/product/:code', async ({ el, params, isCurrent }) => {
    const back = SP.lastSearch
      ? `<a class="back" href="${SP.href('/search', SP.lastSearch)}">← Back to “${esc(SP.lastSearch)}”</a>`
      : '<a class="back" href="#/search">← New search</a>';

    el.innerHTML = `<div class="crumbs">${back}</div><div id="product">${loading(`Looking up ${params.code}…`)}</div>`;
    try {
      const p = await SP.findByBarcode(params.code);
      if (!isCurrent()) return;
      const profile = SP.getProfile();
      $('#product').innerHTML = productHTML(p, profile);

      $('#add-basket').onclick = () => {
        SP.addToBasket(p);
        $('#add-basket').innerHTML = `${icon('check')} Added. <span class="u">Add another</span>`;
      };
      SP.findAlternatives(p, profile).then((list) => {
        if (isCurrent() && $('#alts')) $('#alts').innerHTML = '<h3>Healthier swaps</h3>' + altsHTML(list, p);
      }).catch(() => {
        if (isCurrent() && $('#alts')) $('#alts').innerHTML = '<h3>Healthier swaps</h3><p class="muted">Couldn’t load swaps right now. Check your connection.</p>';
      });
      return { title: p.product_name, nav: 'search' };
    } catch (err) {
      if (!isCurrent()) return;
      const nf = err.notFound;
      $('#product').innerHTML = message(err.message || 'Something went wrong. Check your connection and try again.', true) +
        (nf ? `<div class="card gap"><h3>Help fill the gap</h3><p>Open Food Facts is built by volunteers, and many Indian products aren’t in it yet. You can add this one in a minute with a photo of the pack, and it will be there for everyone.</p>
          <p><a class="btn" target="_blank" rel="noopener" href="https://world.openfoodfacts.org/cgi/product.pl?type=add&code=${encodeURIComponent(params.code)}">Add it to Open Food Facts</a></p></div>` : '') +
        '<p class="hint"><a href="#/barcode">Try another barcode</a> or <a href="#/search">search by name</a>.</p>';
      return { title: 'Product not found', nav: 'search' };
    }
  });

  /* ---------------- About:  #/about ---------------- */
  SP.route('/about', ({ el }) => {
    el.innerHTML = `
      ${pageHead('About', 'How Sahi Pick rates food', 'Plain answers on where the numbers come from and what they mean.')}
      <div class="about-grid">
        <div class="card"><h3>The Sahi score (0–100)</h3><p>Starts at 100. Sugar, saturated fat, salt, calories and fat take points away; protein and fibre add some back. Ultra-processed foods lose 10. Your goals make the matching nutrient count more. 70+ is a good pick, 50–69 is okay now and then, below 50 is better limited.</p></div>
        <div class="card"><h3>Low / Medium / High (India)</h3><p>Uses the ICMR-NIN <i>Dietary Guidelines for Indians 2024</i> reference values that FSSAI’s front-of-pack proposal is based on: for 100 g of solid food, 250 kcal, 4.2 g added fat, 3 g added sugar and 625 mg salt; for 100 ml of drinks, 70 kcal, 1.5 g, 2 g and 175 mg. Where a pack only lists total sugar or fat, we use the guideline’s energy-share limits (total sugar ≤10%, total fat ≤30% of energy).</p></div>
        <div class="card"><h3>Is this the FSSAI rule?</h3><p>Not yet. FSSAI’s red-hexagon warning labels are still a proposal that the Supreme Court is examining (as of late 2026), so there’s no final legal threshold. We show them as “reference values, not an official label” and you can switch to the UK scale in your profile.</p></div>
        <div class="card"><h3>The smart estimate (machine learning)</h3><p>Two small models trained on about 42,000 (health) and 28,000 (processing level) Open Food Facts products. One predicts Nutri-Score points from nutrients, the other predicts the NOVA group from the food category, additive count and nutrients. They run in your browser, so nothing you search is sent anywhere for prediction. On held-out products the health model lands within one grade 98.7% of the time, and the NOVA model is right 84% of the time (against 57% for always guessing “ultra-processed”). The training data is Swiss, so treat Indian products as an estimate. The Sahi score itself stays rule-based so you can see exactly why it moved.</p></div>
        <div class="card"><h3>Nutri-Score</h3><p>A European A–E grade. Many Indian products don’t have one, so it’s shown when available but isn’t used in the Sahi score.</p></div>
        <div class="card"><h3>Fresh and loose foods</h3><p>Fruit, vegetables, dal and similar have no barcode. We include a short list of typical values per 100 g, marked approximate. For exact Indian values see the IFCT 2017 tables.</p></div>
        <div class="card"><h3>Personal, but not medical</h3><p>Goals and allergy settings stay in this browser. They tune the rating but are not medical advice. If you have diabetes, an allergy or any condition, follow your doctor or dietitian.</p></div>
      </div>
      <div class="card about-data"><h3>Where the data comes from</h3>
        <p>Packed-food data is read live from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, a free database kept up by volunteers. It is stronger for Europe than India, so some Indian products will be missing or incomplete. You can test your own pantry on the <a href="#/coverage">Kitchen test</a> page, and add missing products to the database yourself.</p>
        <p><a class="btn" href="#/search">Start a search</a></p>
      </div>`;
    return { title: 'About', nav: 'about' };
  });

  /* ---------------- 404 ---------------- */
  SP.routeNotFound(({ el }) => {
    el.innerHTML = `
      <div class="empty">
        <span class="empty-ico" aria-hidden="true">${icon('search', 'xl')}</span>
        <h1>That page isn’t on the shelf</h1>
        <p class="lead">We couldn’t find what you were looking for.</p>
        <p><a class="btn" href="#/">Back to home</a></p>
      </div>`;
    return { title: 'Page not found', nav: '' };
  });
})();
