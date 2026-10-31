/* Sahi Pick · app.js — boot. Pages live in pages*.js / scan.js, routing in router.js. */
document.getElementById('logo').innerHTML = SP.logoMark();
SP.$$('#nav [data-i]').forEach((i) => { i.outerHTML = SP.icon(i.dataset.i); });
SP.updateBasketBadge();
SP.startRouter();
