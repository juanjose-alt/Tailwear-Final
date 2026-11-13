/* cart.js — Carrito lateral GLOBAL de Tailwear
   Se carga en TODAS las páginas (index, collections, size_guide, about_us, contact_us,
   star_product y checkout). Crea el panel del carrito, guarda los productos en localStorage
   (así todas las páginas comparten el mismo carrito) y rellena el resumen del checkout.

   Cómo se conecta con el HTML (sin tocar el contenido de las páginas):
   - Icono del carrito en el menú:  <button data-cart-open> con una insignia <span data-cart="badge">
   - Botones "Add to Cart / Add to Bag" y el "+" de las tarjetas se detectan solos.
   - Checkout: <ul data-cart="summary-items">, <dl data-cart="summary-totals"> y <form data-checkout-form>.

   NOTA sobre precios: cada página muestra su precio en un formato distinto ($240.000, $240.000,
   $280.00 USD). Este archivo toma solo los dígitos del precio tal como se ve en la página. */
(() => {
  'use strict';

  const KEY = 'tailwear-cart';
  const MAX_QTY = 99;
  /* Carpeta donde vive cart.js (la raíz del proyecto). Sirve para armar rutas correctas
     desde index.html y desde /pages sin escribir "../" a mano. */
  const ROOT = new URL('./', document.currentScript ? document.currentScript.src : location.href);

  /* ---------- Utilidades ---------- */
  const $ = id => document.getElementById(id);
  const money = n => '$' + n.toLocaleString('es-CO');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toAbs = rel => new URL(rel, ROOT).href;
  const toRel = src => { const h = new URL(src, location.href).href; return h.startsWith(ROOT.href) ? h.slice(ROOT.href.length) : h; };
  const normImg = s => (/^[a-z][a-z0-9+.-]*:|^\//i.test(s) ? s : String(s).replace(/^(\.{1,2}\/)+/, ''));
  const keyOf = i => i.name + '|' + i.size;

  /* ---------- Estado del carrito ---------- */
  let items = [];
  const total = () => items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = () => items.reduce((s, i) => s + i.qty, 0);

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      items = Array.isArray(raw)
        ? raw.filter(i => i && i.name && Number.isFinite(+i.price) && +i.qty > 0)
            .map(i => ({ name: String(i.name), price: +i.price, img: normImg(i.img || ''), size: String(i.size || 'Única'), qty: Math.min(+i.qty | 0, MAX_QTY) }))
        : [];
    } catch { items = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* modo privado: el carrito sigue funcionando en memoria */ }
    render();
  }

  /* ---------- Panel lateral (solo clases de Tailwind) ---------- */
  const btnQty = 'h-8 w-8 border border-neutral-600 text-white transition-colors hover:border-orange-500 hover:text-orange-500';

  function injectDrawer() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="twcOverlay" data-cart-close class="pointer-events-none fixed inset-0 z-[60] bg-black/60 opacity-0 transition-opacity duration-300 data-[open=true]:pointer-events-auto data-[open=true]:opacity-100"></div>
      <aside id="twCart" role="dialog" aria-modal="true" aria-label="Shopping cart" aria-hidden="true" inert
        class="invisible fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm translate-x-full flex-col border-l border-neutral-800 bg-neutral-950 text-sm text-neutral-200 transition-[transform,visibility] duration-300 data-[open=true]:visible data-[open=true]:translate-x-0 sm:w-96">
        <div class="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <span class="text-xs uppercase tracking-[0.2em]">Shopping cart</span>
          <button type="button" id="twcClose" data-cart-close aria-label="Close cart"
            class="flex h-9 w-9 items-center justify-center text-xl text-white transition-colors hover:text-orange-500">&#10005;</button>
        </div>
        <div id="twcItems" class="flex-1 overflow-y-auto px-5"></div>
        <div class="space-y-3 border-t border-neutral-800 px-5 py-4">
          <p class="flex justify-between text-white"><span>Subtotal</span><span id="twcSub">$0</span></p>
          <a id="twcGo" href="${toAbs('pages/checkout.html')}" data-empty="true"
            class="block bg-orange-600 py-3 text-center text-xs uppercase tracking-[0.15em] text-white transition-colors hover:bg-orange-500 data-[empty=true]:pointer-events-none data-[empty=true]:opacity-40">Checkout</a>
        </div>
      </aside>`);
  }

  const itemHTML = i => `
    <li class="grid grid-cols-[64px_1fr] gap-4 border-b border-neutral-800 py-4" data-key="${esc(keyOf(i))}">
      ${i.img
        ? `<img src="${esc(toAbs(i.img))}" alt="${esc(i.name)}" class="h-16 w-16 border border-neutral-800 bg-neutral-900 object-cover">`
        : '<div class="h-16 w-16 border border-neutral-800 bg-neutral-900"></div>'}
      <div class="min-w-0">
        <p class="truncate text-white">${esc(i.name)}</p>
        <p class="mb-2 mt-1 text-xs text-neutral-500">SIZE ${esc(i.size)} · ${money(i.price)}</p>
        <div class="flex items-center gap-2">
          <button type="button" data-act="minus" aria-label="Remove one unit" class="${btnQty}">−</button>
          <span class="w-6 text-center" aria-live="polite">${i.qty}</span>
          <button type="button" data-act="plus" aria-label="Add one unit" class="${btnQty}">+</button>
          <button type="button" data-act="remove" class="ml-auto text-xs uppercase text-neutral-500 transition-colors hover:text-orange-500">Remove</button>
        </div>
      </div>
    </li>`;

  /* ---------- Abrir / cerrar ---------- */
  let lastOpener = null;
  function toggle(open) {
    const panel = $('twCart'), overlay = $('twcOverlay');
    if (open) {
      const menu = $('menu-toggle'); if (menu) menu.checked = false;   // nunca dos paneles a la vez
      lastOpener = document.activeElement;
    }
    panel.dataset.open = overlay.dataset.open = String(open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('overflow-hidden', open);
    if (open) $('twcClose').focus();
    else if (lastOpener && lastOpener.focus) lastOpener.focus();
  }

  /* ---------- Pintar la pantalla ---------- */
  function render() {
    const n = count();

    $('twcItems').innerHTML = items.length
      ? `<ul>${items.map(itemHTML).join('')}</ul>`
      : '<p class="mt-12 text-center text-neutral-500">Your cart is empty</p>';
    $('twcSub').textContent = money(total());
    $('twcGo').dataset.empty = String(!items.length);

    document.querySelectorAll('[data-cart="badge"]').forEach(b => {
      b.textContent = n > 99 ? '99+' : n;
      b.dataset.empty = String(!n);
    });
    document.querySelectorAll('[data-cart-open]').forEach(b => b.setAttribute('aria-label', `Open cart, ${n} item${n === 1 ? '' : 's'}`));

    renderSummary();
  }

  /* Columna "Order summary" del checkout (solo existe en checkout.html) */
  function renderSummary() {
    const list = document.querySelector('[data-cart="summary-items"]');
    if (!list) return;
    const tpl = document.querySelector('[data-cart="summary-item-template"]');
    const empty = document.querySelector('[data-cart="summary-empty"]');
    const totals = document.querySelector('[data-cart="summary-totals"]');

    list.replaceChildren(...items.map(i => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      const set = (f, v) => { const el = li.querySelector(`[data-field="${f}"]`); if (el) el.textContent = v; };
      const img = li.querySelector('[data-field="img"]');
      if (img) { img.src = i.img ? toAbs(i.img) : ''; img.alt = i.name; }
      set('qty', i.qty); set('name', i.name); set('size', `SIZE ${i.size}`); set('line-total', money(i.price * i.qty));
      return li;
    }));
    if (empty) empty.hidden = items.length > 0;
    if (totals) totals.hidden = !items.length;
    document.querySelectorAll('[data-cart="subtotal"], [data-cart="total"]').forEach(el => { if (!el.closest('#twCart')) el.textContent = money(total()); });
  }

  /* ---------- Agregar productos ---------- */
  function add(p) {
    const found = items.find(i => keyOf(i) === keyOf(p));
    if (found) found.qty = Math.min(found.qty + 1, MAX_QTY); else items.push({ ...p, qty: 1 });
    save(); toggle(true);
  }

  /* Lee nombre, precio, imagen y talla a partir del botón pulsado (sin tocar el HTML de la página) */
  function productFrom(btn) {
    const hasSizes = el => el.querySelector('input[type="radio"][name*="size"]');
    let box = btn;
    while (box && box !== document.body && !(box.querySelector('h2,h3') && hasSizes(box))) box = box.parentElement;
    if (!box || box === document.body) return null;

    const priceEl = [...box.querySelectorAll('p,span')].find(e => /^\$\s*\d[\d.,]*(\s*USD)?$/i.test(e.textContent.trim()));
    let imgBox = box; while (imgBox && !imgBox.querySelector('img')) imgBox = imgBox.parentElement;
    if (!priceEl || !imgBox) return null;

    const checked = box.querySelector('input[type="radio"][name*="size"]:checked');
    if (!checked) { flashSizes(box); return null; }                    // hay tallas pero ninguna elegida

    return {
      name: box.querySelector('h2,h3').textContent.trim().replace(/\s+/g, ' '),
      price: Number(priceEl.textContent.replace(/\D/g, '')),
      img: toRel(imgBox.querySelector('img').currentSrc || imgBox.querySelector('img').src),
      size: (checked.parentElement.textContent.trim() || checked.value || 'Única')
    };
  }

  function flashSizes(box) {
    const grid = box.querySelector('input[type="radio"][name*="size"]').closest('.grid');
    if (!grid) return;
    grid.classList.add('ring-1', 'ring-orange-500');
    setTimeout(() => grid.classList.remove('ring-1', 'ring-orange-500'), 1500);
  }

  /* En index.html todos los radios de talla se llaman "size" (así solo una talla quedaba marcada en
     TODA la página). Le damos un nombre distinto a cada grupo y restauramos el "checked" original. */
  function fixSizeGroups() {
    const groups = new Map();
    document.querySelectorAll('input[type="radio"][name="size"]').forEach(r => {
      const g = r.closest('.grid') || r.parentElement.parentElement;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    });
    let n = 0;
    groups.forEach(radios => { n++; radios.forEach(r => { r.name = 'size-' + n; r.checked = r.defaultChecked; }); });
  }

  /* ---------- Checkout: botón "Pay now" ---------- */
  function onCheckoutSubmit(e) {
    const form = e.target.closest('[data-checkout-form]');
    if (!form) return;
    e.preventDefault();
    const status = form.querySelector('[data-checkout-status]');
    const say = (msg, error) => {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('text-red-400', !!error);
      status.classList.toggle('text-orange-500', !error);
    };
    if (!items.length) { say('Your cart is empty. Add a product before paying.', true); return; }
    const summary = `${count()} item${count() === 1 ? '' : 's'} · ${money(total())} COP`;
    items = []; save(); form.reset();
    say(`Order placed! ${summary}. (!THANSK FOR YOU BUY, WE WILL CONTACT YOU SOON!)`);
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', e => {
    if (e.target.closest('[data-cart-open]')) { toggle(true); return; }
    if (e.target.closest('[data-cart-close]')) { toggle(false); return; }

    const btn = e.target.closest('button');
    if (!btn) return;

    const act = btn.dataset.act;                                      // botones dentro del panel
    if (act) {
      const row = btn.closest('[data-key]');
      const it = row && items.find(i => keyOf(i) === row.dataset.key);
      if (!it) return;
      if (act === 'plus') it.qty = Math.min(it.qty + 1, MAX_QTY);
      if (act === 'minus') it.qty--;
      if (act === 'remove' || it.qty < 1) items = items.filter(i => i !== it);
      save();
      return;
    }

    const isAdd = /add\s+to\s+(cart|bag)/i.test(btn.textContent) || (btn.textContent.trim() === '+' && btn.closest('article'));
    if (isAdd && !btn.closest('#twCart')) { const p = productFrom(btn); if (p) add(p); }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('twCart').dataset.open === 'true') toggle(false);
    const menu = $('menu-toggle'); if (menu) menu.checked = false;
  });
  document.addEventListener('submit', onCheckoutSubmit);
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); render(); } });   // otra pestaña
  window.addEventListener('pageshow', e => {                                              // botón "atrás" del navegador
    if (!e.persisted) return;
    load(); render();
    const menu = $('menu-toggle'); if (menu) menu.checked = false;
    if ($('twCart').dataset.open === 'true') toggle(false);
  });

  /* ---------- Inicio ---------- */
  function init() { load(); injectDrawer(); fixSizeGroups(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
