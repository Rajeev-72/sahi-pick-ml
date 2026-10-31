/* ==========================================================================
   Sahi Pick · pages2.js — compare, basket, profile, kitchen test.
   ========================================================================== */
(() => {
  'use strict';
  const { $, $$, esc, format, message, loading, pageHead, icon } = SP;
  const ui = SP.ui;

  /* ---------------- Picker: search box + results that choose a product ---------------- */
  function pickerHTML(slot) {
    return `<div class="picker" data-slot="${slot}">
      <label for="pk-${slot}">Choose product ${slot === 'a' ? '1' : '2'}</label>
      <div class="row"><input id="pk-${slot}" type="search" placeholder="Name or barcode" autocomplete="off"><button class="btn" type="button">Find</button></div>
      <div class="pk-res" aria-live="polite"></div></div>`;
  }

  function bindPicker(root, onPick) {
    const input = $('input', root), btn = $('button', root), res = $('.pk-res', root);
    const run = async () => {
      const q = input.value.trim();
      if (!q) return;
      if (/^\d{8,14}$/.test(q)) { onPick(q); return; }
      res.innerHTML = loading('Searching…');
      try {
        const list = (await SP.findByName(q)).slice(0, 8);
        const prof = SP.getProfile();
        res.innerHTML = list.length
          ? `<ul class="pk-list">${list.map((p) => `<li><button type="button" data-code="${esc(p.code)}">${ui.matchRow(p, prof).replace(/^<a [^>]*>/, '<span class="rowlike">').replace(/<\/a>$/, '</span>')}</button></li>`).join('')}</ul>`
          : message('No matches. Try a simpler name or paste the barcode.', true);
        $$('button[data-code]', res).forEach((b) => { b.onclick = () => onPick(b.dataset.code); });
      } catch (e) { res.innerHTML = message(e.message || 'Search failed.', true); }
    };
    btn.onclick = run;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } };
  }

  /* ---------------- Compare:  #/compare/:a/:b ---------------- */
  const ROWS = [
    { k: 'kcal',    label: 'Calories',        unit: 'kcal', better: 'low',  d: 0 },
    { k: 'sugarX',  label: 'Sugar',           unit: 'g',    better: 'low',  d: 1 },
    { k: 'sat',     label: 'Saturated fat',   unit: 'g',    better: 'low',  d: 1 },
    { k: 'fat',     label: 'Total fat',       unit: 'g',    better: 'low',  d: 1 },
    { k: 'sodium',  label: 'Sodium',          unit: 'mg',   better: 'low',  d: 0 },
    { k: 'protein', label: 'Protein',         unit: 'g',    better: 'high', d: 1 },
    { k: 'fiber',   label: 'Fibre',           unit: 'g',    better: 'high', d: 1 },
    { k: 'carbs',   label: 'Carbohydrate',    unit: 'g',    better: null,   d: 1 },
  ];

  function decide(a, ra, b, rb) {
    const A = a.product_name, B = b.product_name;
    const ca = ra.allergy.contains.length, cb = rb.allergy.contains.length;
    if (ca !== cb) {
      const safe = ca < cb ? 0 : 1, bad = safe ? ra : rb;
      return { winner: safe, text: `Pick ${safe ? B : A}`, why: [`The other one contains ${bad.allergy.contains.join(', ')}, which you avoid.`], close: false };
    }
    const diff = ra.score - rb.score;
    if (Math.abs(diff) < 6) {
      return { winner: -1, text: 'Too close to call', why: ['Both score about the same for you. Choose on taste, price or what you’ll actually finish.'], close: true };
    }
    const win = diff > 0 ? 0 : 1, rw = win ? rb : ra, rl = win ? ra : rb;
    const phrase = { sugar: ['less sugar', 'more sugar'], sat: ['less saturated fat', 'more saturated fat'], sodium: ['less salt', 'more salt'],
      kcal: ['fewer calories', 'more calories'], fat: ['less fat', 'more fat'], protein: ['more protein', 'less protein'], fiber: ['more fibre', 'less fibre'], nova: ['less processed', 'more processed'] };
    const gains = rw.comps.map((c) => {
      const o = rl.comps.find((x) => x.key === c.key);
      return { key: c.key, delta: c.pts - (o ? o.pts : 0), w: c.value, l: o ? o.value : null };
    }).filter((g) => g.delta >= 3 && phrase[g.key]).sort((x, y) => y.delta - x.delta).slice(0, 3);
    const unit = { sugar: ' g', sat: ' g', sodium: ' mg', kcal: ' kcal', protein: ' g', fiber: ' g' };
    const why = gains.map((g) => {
      const nums = g.key in unit && g.w !== null && g.l !== null ? ` (${format(g.w, g.key === 'kcal' || g.key === 'sodium' ? 0 : 1)} vs ${format(g.l, g.key === 'kcal' || g.key === 'sodium' ? 0 : 1)}${unit[g.key]})` : '';
      return phrase[g.key][0].charAt(0).toUpperCase() + phrase[g.key][0].slice(1) + nums;
    });
    if (!why.length) why.push('It scores higher overall for you.');
    if (rw.score < 50) why.push('Still rated “better to limit”. It’s the better of the two, not a great choice.');
    return { winner: win, text: `Pick ${win ? B : A}`, why, close: false, gap: Math.abs(diff) };
  }

  function cell(p, r, key, row, other) {
    let val = r.v[key === 'sugarX' ? 'sugar' : key];
    if (key === 'sugarX' && r.v.added !== null) val = r.v.added;
    return val;
  }

  function compareHTML(a, b, profile) {
    const ra = SP.rate(a, profile), rb = SP.rate(b, profile);
    const d = decide(a, ra, b, rb);
    const head = (p, r, i) => `<div class="cmp-head ${d.winner === i ? 'winner' : ''}">
      ${d.winner === i ? `<span class="crown">${icon('check')} Better pick</span>` : ''}
      ${p.image_front_small_url ? `<img alt="" src="${esc(p.image_front_small_url)}">` : `<span class="pimg ph">${icon(p.fresh ? 'leaf' : 'barcode', 'lg')}</span>`}
      <a class="cmp-name" href="${SP.href('/product', p.code)}">${esc(p.product_name)}</a>
      <span class="m-brand">${esc(p.brands || 'Unknown brand')}</span>
      <div class="verdict compact ${ui.verdictClass(r.verdict)}"><div class="v-score"><b>${r.score}</b><small>/100</small></div><p class="v-title">${SP.VERDICT_TEXT[r.verdict]}</p></div>
      <button class="btn ghost sm add" data-i="${i}" type="button">${icon('plus')} Basket</button>
    </div>`;

    const rows = ROWS.map((row) => {
      const va = cell(a, ra, row.k), vb = cell(b, rb, row.k);
      let wa = '', wb = '';
      if (row.better && va !== null && vb !== null && Math.abs(va - vb) > 1e-9) {
        const aWins = row.better === 'low' ? va < vb : va > vb;
        wa = aWins ? 'win' : ''; wb = aWins ? '' : 'win';
      }
      const fmt = (v) => (v === null ? '—' : format(v, row.d) + ' ' + row.unit);
      return `<tr><th scope="row">${row.label}</th><td class="${wa}">${fmt(va)}</td><td class="${wb}">${fmt(vb)}</td></tr>`;
    }).join('');

    const verdictCard = `<div class="pick ${d.close ? 'close' : ''}">
      <p class="pick-title">${icon(d.close ? 'info' : 'check')} ${esc(d.text)}</p>
      <ul>${d.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      ${!d.close && d.gap ? `<p class="hint">Sahi score gap: ${d.gap} points${profile.goals.length ? ' (with your goals)' : ''}.</p>` : ''}
    </div>`;

    const named = (p, r) => {
      const html = ui.allergyBanner(r, profile);
      return html ? html.replace(/<b>/, `<b>${esc(p.product_name)}: `) : '';
    };
    return `${named(a, ra)}
      ${named(b, rb)}
      ${verdictCard}
      <div class="cmp">
        <div class="cmp-heads">${head(a, ra, 0)}${head(b, rb, 1)}</div>
        <div class="table-wrap"><table class="cmp-table"><caption class="visually-hidden">Nutrition per 100 g</caption>
          <thead><tr><th></th><th>${esc(a.product_name)}</th><th>${esc(b.product_name)}</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="foot">Per 100 g (or 100 ml). Green marks the better value for that row. Sugar shows added sugar when the pack lists it, otherwise total sugar.</p>
      </div>
      <p class="note">${icon('info')}<span><b>Check the pack.</b> Volunteer data can be wrong, and ratings are general guidance, not medical advice.</span></p>`;
  }

  SP.route('/compare/:a?/:b?', async ({ el, params, isCurrent }) => {
    const A = params.a && params.a !== '-' ? params.a : '';
    const B = params.b && params.b !== '-' ? params.b : '';
    const go = (x, y) => SP.go(`/compare/${encodeURIComponent(x || '-')}/${encodeURIComponent(y || '-')}`);

    el.innerHTML = `${pageHead('Compare', 'Which one should I buy?', 'Pick two products. We’ll tell you which is the better choice for you, and why.')}
      <div id="cmp-body">${loading('Loading…')}</div>`;
    const body = $('#cmp-body');

    if (!A || !B) {
      let first = null;
      if (A || B) {
        try { first = await SP.findByBarcode(A || B); } catch (e) { body.innerHTML = message(e.message, true); return { title: 'Compare', nav: 'compare' }; }
        if (!isCurrent()) return;
      }
      body.innerHTML = `<div class="pickers">
        ${first ? `<div class="picked"><span class="eyebrow">Product 1</span><div class="matches"><ul><li>${ui.matchRow(first, SP.getProfile())}</li></ul></div><button class="btn ghost sm" id="clear1" type="button">${icon('x')} Change</button></div>` : pickerHTML('a')}
        ${pickerHTML('b').replace('Choose product 2', first ? 'Compare it with…' : 'Choose product 2')}
      </div>
      <p class="hint">Tip: when you’re looking at a product, tap “Compare with another”, or scan the second one and come back here.</p>`;
      const other = first ? (A || B) : '';
      if (first) $('#clear1').onclick = () => go('', '');
      $$('.picker', body).forEach((pk) => bindPicker(pk, (code) => {
        if (first) go(other, code);
        else if (pk.dataset.slot === 'a') go(code, '');
        else go('', code);
      }));
      return { title: 'Compare', nav: 'compare' };
    }

    try {
      const [a, b] = await Promise.all([SP.findByBarcode(A), SP.findByBarcode(B)]);
      if (!isCurrent()) return;
      body.innerHTML = compareHTML(a, b, SP.getProfile()) +
        `<p class="actions"><a class="btn ghost" href="#/compare">${icon('compare')} New comparison</a>
         <a class="btn ghost" href="${SP.href('/compare', B, A)}">${icon('arrow')} Swap sides</a></p>`;
      $$('.add', body).forEach((btn) => { btn.onclick = () => { SP.addToBasket(+btn.dataset.i ? b : a); btn.innerHTML = `${icon('check')} Added`; }; });
      return { title: `${a.product_name} vs ${b.product_name}`, nav: 'compare' };
    } catch (e) {
      if (isCurrent()) body.innerHTML = message(e.message || 'Could not load one of the products.', true) + '<p><a class="btn ghost" href="#/compare">Start again</a></p>';
      return { title: 'Compare', nav: 'compare' };
    }
  });

  /* ---------------- Basket:  #/basket ---------------- */
  SP.route('/basket', ({ el }) => {
    const render = () => {
      const items = SP.getBasket();
      const prof = SP.getProfile();
      if (!items.length) {
        el.innerHTML = `${pageHead('Basket', 'Your basket', 'Add what you plan to buy and see what the whole trip brings home.')}
          <div class="empty small"><span class="empty-ico" aria-hidden="true">${icon('basket', 'xl')}</span><p class="lead">Nothing here yet.</p>
          <p><a class="btn" href="#/search">Find a product</a> <a class="btn ghost" href="#/scan">Scan one</a></p></div>`;
        return;
      }
      let g = 0, sugar = 0, salt = 0, kcal = 0, fat = 0, counted = 0, unknown = 0, sum = 0, n = 0, limit = 0, allergyHits = 0;
      const rows = items.map(({ p, qty }) => {
        const r = SP.rate(p, prof);
        const grams = SP.parseQuantity(p.quantity);
        if (grams) {
          const f = (grams * qty) / 100, v = r.v;
          g += grams * qty; counted += 1;
          sugar += (v.added !== null ? v.added : v.sugar || 0) * f; salt += (v.salt || 0) * f; kcal += (v.kcal || 0) * f; fat += (v.fat || 0) * f;
        } else unknown += 1;
        sum += r.score * qty; n += qty; if (r.verdict === 'limit') limit += 1; if (r.allergy.contains.length) allergyHits += 1;
        const thumb = p.image_front_small_url ? `<img class="thumb" alt="" src="${esc(p.image_front_small_url)}">` : `<span class="thumb ph">${icon(p.fresh ? 'leaf' : 'barcode')}</span>`;
        return `<li class="b-item">
          <a class="b-main" href="${SP.href('/product', p.code)}">${thumb}<span><span class="m-name">${esc(p.product_name)}</span>
            <span class="m-brand">${esc(p.brands || '')}${p.quantity ? ' · ' + esc(p.quantity) : ''}</span>
            ${r.allergy.contains.length ? `<span class="mini bad">Contains ${esc(r.allergy.contains.join(', '))}</span>` : ''}</span></a>
          ${ui.scoreBadge(r)}
          <div class="qty" role="group" aria-label="Quantity of ${esc(p.product_name)}">
            <button type="button" data-act="dec" data-code="${esc(p.code)}" aria-label="One less">${icon('minus')}</button><span>${qty}</span>
            <button type="button" data-act="inc" data-code="${esc(p.code)}" aria-label="One more">${icon('plus')}</button></div>
          ${r.verdict === 'limit' ? `<a class="btn ghost sm" href="${SP.href('/product', p.code)}">See swaps</a>` : '<span></span>'}
        </li>`;
      }).join('');

      const avg = Math.round(sum / n);
      const av = avg >= 70 ? 'good' : avg >= 50 ? 'ok' : 'limit';
      const tsp = sugar / 4;
      el.innerHTML = `${pageHead('Basket', 'Your basket', `${n} item${n === 1 ? '' : 's'} · average Sahi score ${avg}`)}
        ${allergyHits ? `<div class="alert danger" role="alert">${icon('alert')}<div><b>${allergyHits} item${allergyHits === 1 ? ' contains' : 's contain'} something you avoid</b><span>Look for the red tags below.</span></div></div>` : ''}
        <div class="b-summary">
          <div class="card"><p class="eyebrow">Whole basket</p>
            <div class="verdict ${av}"><div class="v-score"><b>${avg}</b><small>/100</small></div><div><p class="v-title">${SP.VERDICT_TEXT[av]}</p><p class="v-sub">${limit ? `${limit} item${limit === 1 ? '' : 's'} worth swapping` : 'No items rated “better to limit”'}</p></div></div></div>
          <div class="card"><p class="eyebrow">What it brings home</p>
            <div class="macros">
              <div class="macro kcal"><b>${format(kcal, 0)}<small>kcal</small></b><span class="lbl">Energy</span></div>
              <div class="macro fat"><b>${format(sugar, 0)}<small>g</small></b><span class="lbl">Sugar (≈${format(tsp, 0)} tsp)</span></div>
              <div class="macro carb"><b>${format(salt, 1)}<small>g</small></b><span class="lbl">Salt</span></div>
              <div class="macro pro"><b>${format(g / 1000, 2)}<small>kg</small></b><span class="lbl">Weight counted</span></div>
            </div>
            ${unknown ? `<p class="hint">${unknown} item${unknown === 1 ? ' has' : 's have'} no pack size in the database, so ${unknown === 1 ? 'it isn’t' : 'they aren’t'} in these totals.</p>` : ''}
            <p class="hint">Totals are for the whole packs, not per person per day.</p></div>
        </div>
        <ul class="b-list">${rows}</ul>
        <p class="actions"><a class="btn ghost" href="#/search">${icon('plus')} Add more</a><button class="btn ghost" id="clear-basket" type="button">${icon('trash')} Empty basket</button></p>
        <p class="note">${icon('info')}<span><b>Check the pack.</b> Totals are estimates from volunteer data and pack sizes. General guidance, not medical advice.</span></p>`;

      $$('.qty button', el).forEach((b) => {
        b.onclick = () => {
          const it = SP.getBasket().find((i) => i.p.code === b.dataset.code);
          if (it) SP.setQty(b.dataset.code, it.qty + (b.dataset.act === 'inc' ? 1 : -1));
          render();
        };
      });
      $('#clear-basket').onclick = () => { SP.clearBasket(); render(); };
    };
    render();
    return { title: 'Basket', nav: 'basket' };
  });

  /* ---------------- Profile:  #/profile ---------------- */
  SP.route('/profile', ({ el }) => {
    const prof = SP.getProfile();
    el.innerHTML = `${pageHead('My profile', 'What matters to you?', 'Tell us once. Every rating, comparison and basket total adjusts. This stays in your browser and is never sent anywhere.')}
      <form id="prof" class="card prof">
        <fieldset><legend>My goals</legend><p class="hint">Pick any. These make the matching nutrient count more in the score.</p>
          <div class="checks">${SP.GOALS.map((g) => `<label class="check"><input type="checkbox" name="goal" value="${g.id}" ${prof.goals.includes(g.id) ? 'checked' : ''}><span><b>${g.label}</b><small>${g.hint}</small></span></label>`).join('')}</div>
        </fieldset>
        <fieldset><legend>Allergies and things to avoid</legend><p class="hint">We’ll flag products that contain these, or may contain traces.</p>
          <div class="checks">${SP.ALLERGENS.map((a) => `<label class="check"><input type="checkbox" name="alg" value="${a.id}" ${prof.allergens.includes(a.id) ? 'checked' : ''}><span><b>${a.label}</b></span></label>`).join('')}</div>
        </fieldset>
        <fieldset><legend>Rating scale</legend>
          <div class="checks">
            <label class="check"><input type="radio" name="scale" value="india" ${prof.scale === 'india' ? 'checked' : ''}><span><b>India (ICMR-NIN)</b><small>Reference values behind FSSAI’s proposal</small></span></label>
            <label class="check"><input type="radio" name="scale" value="uk" ${prof.scale === 'uk' ? 'checked' : ''}><span><b>UK traffic light</b><small>The older Low / Medium / High cut-offs</small></span></label>
          </div></fieldset>
        <p class="note">${icon('info')}<span>This tunes ratings to your preferences. It is <b>not medical advice</b>. If you have diabetes, a food allergy or another condition, follow your doctor or dietitian.</span></p>
        <div class="actions"><button class="btn" type="submit">Save profile</button><button class="btn ghost" type="button" id="reset">Reset</button><span id="saved" class="hint" role="status"></span></div>
      </form>`;

    $('#prof').onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const ok = SP.saveProfile({ scale: f.get('scale') || 'india', goals: f.getAll('goal'), allergens: f.getAll('alg') });
      if (ok) SP.go('/');
      else $('#saved').textContent = 'Couldn’t save. Your browser may be blocking storage.';
    };
    $('#reset').onclick = () => { SP.clearProfile(); SP.go('/profile'); location.reload(); };
    return { title: 'My profile', nav: 'profile' };
  });

  /* ---------------- Kitchen test:  #/coverage ---------------- */
  SP.route('/coverage', ({ el }) => {
    el.innerHTML = `${pageHead('Kitchen test', 'How well does the data cover your pantry?', 'Paste the barcodes of 10 products from your kitchen (one per line). We’ll show which ones the database knows and how complete they are.')}
      <section class="finder"><form id="cov"><label for="codes">Barcodes</label>
        <textarea id="codes" rows="6" placeholder="8901234567890&#10;8909876543210"></textarea>
        <div class="row"><button class="btn" type="submit">Run test</button></div></form></section>
      <section id="cov-out" aria-live="polite"></section>`;

    $('#cov').onsubmit = async (e) => {
      e.preventDefault();
      const codes = [...new Set($('#codes').value.split(/[\s,;]+/).map((c) => c.replace(/\D/g, '')).filter((c) => c.length >= 8 && c.length <= 14))].slice(0, 25);
      const out = $('#cov-out');
      if (!codes.length) { out.innerHTML = message('Paste at least one barcode (8 to 14 digits).', true); return; }
      const rows = []; let found = 0, complete = 0, india = 0;
      for (let i = 0; i < codes.length; i++) {
        out.innerHTML = loading(`Checking ${i + 1} of ${codes.length}…`);
        try {
          const p = await SP.findByBarcode(codes[i]);
          const dq = SP.dataQuality(p);
          found++; if (dq.complete) complete++; if (dq.indiaTagged) india++;
          rows.push(`<tr><td>${esc(codes[i])}</td><td><a href="${SP.href('/product', codes[i])}">${esc(p.product_name || 'Unnamed')}</a></td><td>${dq.complete ? 'Complete' : 'Missing: ' + esc(dq.missing.join(', '))}</td><td>${dq.indiaTagged ? 'Yes' : 'No'}</td></tr>`);
        } catch (err) {
          rows.push(`<tr class="miss"><td>${esc(codes[i])}</td><td colspan="2">Not found</td><td><a target="_blank" rel="noopener" href="https://world.openfoodfacts.org/cgi/product.pl?type=add&code=${esc(codes[i])}">Add it</a></td></tr>`);
        }
      }
      out.innerHTML = `<div class="card"><h3>${found} of ${codes.length} found</h3>
        <p>${complete} have all the key nutrition values · ${india} are tagged as sold in India.</p>
        <div class="table-wrap"><table class="cmp-table"><thead><tr><th>Barcode</th><th>Product</th><th>Data</th><th>India tag</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
        <p class="hint">Any “Not found” is a chance to help: add it to Open Food Facts from the link and it will work for everyone.</p></div>`;
    };
    return { title: 'Kitchen test', nav: 'about' };
  });
})();
