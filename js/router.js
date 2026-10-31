/* ==========================================================================
   Sahi Pick · router.js
   A tiny hash router:  #/search/greek%20yogurt  →  route "/search/:q?"
   Hashes work on any static host AND when index.html is opened from disk,
   and the Back / Forward buttons just work.
   ========================================================================== */
(() => {
  'use strict';

  const routes = [];
  let notFound = null;
  let cleanup = null;     // function returned by the previous page, run when leaving it
  let token = 0;          // guards against slow async pages finishing after you've moved on

  // "/product/:code" → regex + list of param names. A trailing "?" makes a param optional.
  function compile(path) {
    const keys = [];
    const src = path
      .replace(/\/:(\w+)\?/g, (_, k) => { keys.push(k); return '(?:/([^/]+))?'; })
      .replace(/:(\w+)/g,     (_, k) => { keys.push(k); return '([^/]+)'; });
    return { re: new RegExp(`^${src}/?$`), keys };
  }

  SP.route = (path, page) => routes.push({ ...compile(path), page });
  SP.routeNotFound = (page) => { notFound = page; };

  // Navigate from code:  SP.go('/search/oats')
  SP.go = (path) => { location.hash = '#' + path; };

  // Link builder (keeps encoding in one place)
  SP.href = (path, ...parts) => '#' + path + parts.map((p) => '/' + encodeURIComponent(p)).join('');

  // Split "#/search/oats?x=1" into a path and query params.
  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    return { path: path.startsWith('/') ? path : '/' + path, query: new URLSearchParams(query) };
  }

  const view = () => document.getElementById('view');

  function setActiveNav(name) {
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  async function render() {
    const my = ++token;
    const { path, query } = parse();

    let match = null;
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : ''; });
        match = { page: r.page, params };
        break;
      }
    }
    const page = match ? match.page : notFound;
    const params = match ? match.params : {};

    if (cleanup) { try { cleanup(); } catch (_) {} cleanup = null; }

    const el = view();
    el.classList.remove('is-ready');
    const result = await page({ el, params, query, path, isCurrent: () => my === token });
    if (my !== token) return; // user already went somewhere else

    document.title = (result && result.title ? result.title + ' · ' : '') + SP.APP_NAME;
    setActiveNav(result && result.nav);
    cleanup = result && result.cleanup;

    el.classList.add('is-ready');
    window.scrollTo({ top: 0 });
    if (!result || !result.keepFocus) el.focus({ preventScroll: true }); // screen readers hear the new page
  }

  SP.startRouter = () => {
    window.addEventListener('hashchange', render);
    render();
  };
})();
