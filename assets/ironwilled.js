/* ============================================================
   IRONWILLED — Theme JS
   Handles: nav scroll, announcement bar, cart drawer,
            shop menu, product rail scroll progress
   ============================================================ */

(function () {
  'use strict';

  /* ---- Announcement bar ---------------------------------------- */
  function initAnnouncement() {
    const bar = document.querySelector('.iw-ann');
    if (!bar) return;
    const msgs = bar.querySelectorAll('.iw-ann__msg-item');
    if (msgs.length <= 1) return;
    let current = 0;

    function show(i) {
      msgs.forEach((m, idx) => {
        m.style.display = idx === i ? 'inline' : 'none';
        if (idx === i) m.style.animation = 'none', m.offsetHeight, m.style.animation = 'iwFadeUp 400ms ease-out';
      });
    }
    show(0);

    const prevBtn = bar.querySelector('.iw-ann__arrow--prev');
    const nextBtn = bar.querySelector('.iw-ann__arrow--next');

    function next() { current = (current + 1) % msgs.length; show(current); }
    function prev() { current = (current - 1 + msgs.length) % msgs.length; show(current); }

    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);
    setInterval(next, 3200);
  }

  /* ---- Nav scroll behavior ------------------------------------- */
  function initNav() {
    const nav = document.querySelector('.iw-nav');
    if (!nav) return;
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Cart drawer --------------------------------------------- */
  function initCart() {
    const panel  = document.getElementById('iw-cart-panel');
    const scrim  = document.getElementById('iw-cart-scrim');
    if (!panel || !scrim) return;

    function openCart() {
      panel.classList.add('active');
      scrim.classList.add('active');
      document.body.style.overflow = 'hidden';
      fetchCart();
    }

    function closeCart() {
      panel.classList.remove('active');
      scrim.classList.remove('active');
      document.body.style.overflow = '';
    }

    scrim.addEventListener('click', closeCart);

    const closeBtn = panel.querySelector('.iw-cart-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCart);

    const continueBtn = panel.querySelector('.iw-cart-continue');
    if (continueBtn) continueBtn.addEventListener('click', closeCart);

    // Open cart from nav
    document.querySelectorAll('[data-open-cart]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
    });

    // Add to cart buttons
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const variantId = btn.dataset.variantId || btn.closest('[data-variant-id]')?.dataset.variantId;
        if (!variantId) return;
        await addToCart(variantId, 1);
        openCart();
      });
    });

    window.IW = window.IW || {};
    window.IW.openCart = openCart;
    window.IW.closeCart = closeCart;
    window.IW.addToCart = addToCart;
  }

  async function addToCart(variantId, qty) {
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty }),
      });
      if (!res.ok) throw new Error('Add to cart failed');
      await fetchCart();
    } catch (err) {
      console.error('[IW] addToCart error:', err);
    }
  }

  async function fetchCart() {
    try {
      const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      const cart = await res.json();
      renderCart(cart);
      updateCartCount(cart.item_count);
    } catch (err) {
      console.error('[IW] fetchCart error:', err);
    }
  }

  function renderCart(cart) {
    const list = document.getElementById('iw-cart-list');
    const eyebrow = document.getElementById('iw-cart-eyebrow');
    const subtotalVal = document.getElementById('iw-cart-subtotal');
    const checkoutBtn = document.getElementById('iw-cart-checkout');

    if (eyebrow) eyebrow.textContent = `YOUR CART · ${cart.item_count} ITEMS`;
    if (subtotalVal) subtotalVal.textContent = formatMoney(cart.total_price);
    if (checkoutBtn) {
      checkoutBtn.textContent = `CHECKOUT — ${formatMoney(cart.total_price)}`;
      checkoutBtn.disabled = cart.item_count === 0;
    }

    if (!list) return;

    if (cart.item_count === 0) {
      list.innerHTML = `
        <div class="iw-cart-empty">
          <img src="{{ 'dagger-white.png' | asset_url }}" class="iw-cart-empty__dagger" alt="">
          <div class="iw-cart-empty__text">THE CART IS EMPTY.</div>
          <div class="iw-cart-empty__sub">GO EARN IT.</div>
        </div>`;
      return;
    }

    list.innerHTML = cart.items.map((item, i) => `
      <div class="iw-cart-row" data-line="${i + 1}">
        <div class="iw-cart-row__media">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" class="iw-cart-row__img">
        </div>
        <div class="iw-cart-row__body">
          <div class="iw-cart-row__top">
            <span class="iw-cart-row__name">${escapeHtml(item.product_title)}</span>
            <span class="iw-cart-row__price">${formatMoney(item.final_line_price)}</span>
          </div>
          <div class="iw-cart-row__meta">
            ${item.variant_title && item.variant_title !== 'Default Title' ? `<span>SIZE ${escapeHtml(item.variant_title)}</span><span style="color:#333">·</span>` : ''}
            <span>QTY ${String(item.quantity).padStart(2, '0')}</span>
          </div>
          <button class="iw-cart-row__remove" data-line="${i + 1}">REMOVE</button>
        </div>
      </div>`
    ).join('');

    list.querySelectorAll('.iw-cart-row__remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const line = parseInt(btn.dataset.line, 10);
        await removeCartItem(line);
      });
    });
  }

  async function removeCartItem(line) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ line, quantity: 0 }),
      });
      if (!res.ok) throw new Error('Remove failed');
      await fetchCart();
    } catch (err) {
      console.error('[IW] removeCartItem error:', err);
    }
  }

  function updateCartCount(count) {
    document.querySelectorAll('.iw-nav__cart-count').forEach(el => {
      el.textContent = String(count).padStart(2, '0');
    });
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- Shop menu ----------------------------------------------- */
  function initShopMenu() {
    const panel  = document.getElementById('iw-menu-panel');
    const scrim  = document.getElementById('iw-menu-scrim');
    if (!panel || !scrim) return;

    function openMenu(kind) {
      kind = kind || 'shop';
      panel.classList.add('active');
      scrim.classList.add('active');
      document.body.style.overflow = 'hidden';
      switchTab(kind);
    }

    function closeMenu() {
      panel.classList.remove('active');
      scrim.classList.remove('active');
      document.body.style.overflow = '';
    }

    scrim.addEventListener('click', closeMenu);

    const closeBtn = panel.querySelector('.iw-menu__close');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // Tab switching
    panel.querySelectorAll('.iw-menu__tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(tab.dataset.kind);
      });
    });

    function switchTab(kind) {
      panel.querySelectorAll('.iw-menu__tab').forEach(t => {
        t.classList.toggle('active', t.dataset.kind === kind);
      });
      panel.querySelectorAll('.iw-menu__pane').forEach(p => {
        p.style.display = p.dataset.kind === kind ? 'flex' : 'none';
      });
      panel.querySelectorAll('.iw-menu__feature-pane').forEach(p => {
        p.style.display = p.dataset.kind === kind ? 'block' : 'none';
      });
    }

    // Open from nav links
    document.querySelectorAll('[data-open-menu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openMenu(btn.dataset.openMenu);
      });
    });

    window.IW = window.IW || {};
    window.IW.openMenu = openMenu;
    window.IW.closeMenu = closeMenu;
  }

  /* ---- Product rail scroll progress ---------------------------- */
  function initRails() {
    document.querySelectorAll('.iw-rail__scroller').forEach(scroller => {
      const bar = scroller.closest('.iw-rail')?.querySelector('.iw-rail__progress-bar');
      if (!bar) return;

      function onScroll() {
        const max = scroller.scrollWidth - scroller.clientWidth;
        const pct = max > 0 ? (scroller.scrollLeft / max) * 100 : 0;
        bar.style.width = Math.max(12, pct) + '%';
      }

      scroller.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      // Arrow buttons
      const rail = scroller.closest('.iw-rail');
      rail?.querySelector('.iw-rail__arrow--prev')?.addEventListener('click', () => {
        scroller.scrollBy({ left: -(scroller.clientWidth * 0.8), behavior: 'smooth' });
      });
      rail?.querySelector('.iw-rail__arrow--next')?.addEventListener('click', () => {
        scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' });
      });
    });
  }

  /* ---- Init ---------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initAnnouncement();
    initNav();
    initCart();
    initShopMenu();
    initRails();
  });

})();
