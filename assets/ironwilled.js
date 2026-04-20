/* ============================================================
   IRONWILLED — Theme JS
   ============================================================ */

(function () {
  'use strict';

  var assets   = (window.IW && window.IW.assets)  || {};
  var routes   = (window.IW && window.IW.routes)  || { cart: '/cart.js', cartAdd: '/cart/add.js', cartChange: '/cart/change.js', checkout: '/checkout' };

  /* ---- Announcement bar ------------------------------------ */
  function initAnnouncement() {
    var bar = document.querySelector('.iw-ann');
    if (!bar) return;
    var msgs = Array.from(bar.querySelectorAll('.iw-ann__msg-item'));
    if (msgs.length <= 1) return;
    var current = 0;

    function show(i) {
      msgs.forEach(function(m, idx) {
        m.style.display = idx === i ? 'inline' : 'none';
        if (idx === i) { m.style.animation = 'none'; m.offsetHeight; m.style.animation = 'iwFadeUp 400ms ease-out'; }
      });
    }
    show(0);

    var prev = bar.querySelector('.iw-ann__arrow--prev');
    var next = bar.querySelector('.iw-ann__arrow--next');
    function goNext() { current = (current + 1) % msgs.length; show(current); }
    function goPrev() { current = (current - 1 + msgs.length) % msgs.length; show(current); }
    if (next) next.addEventListener('click', goNext);
    if (prev) prev.addEventListener('click', goPrev);
    setInterval(goNext, 3200);
  }

  /* ---- Nav scroll ----------------------------------------- */
  function initNav() {
    var nav = document.querySelector('.iw-nav');
    if (!nav) return;
    function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 40); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Cart ----------------------------------------------- */
  function initCart() {
    var panel  = document.getElementById('iw-cart-panel');
    var scrim  = document.getElementById('iw-cart-scrim');
    if (!panel || !scrim) return;

    function openCart()  { panel.classList.add('active'); scrim.classList.add('active'); document.body.style.overflow = 'hidden'; fetchCart(); }
    function closeCart() { panel.classList.remove('active'); scrim.classList.remove('active'); document.body.style.overflow = ''; }

    scrim.addEventListener('click', closeCart);
    var closeBtn = panel.querySelector('.iw-cart-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    var continueBtn = panel.querySelector('.iw-cart-continue');
    if (continueBtn) continueBtn.addEventListener('click', closeCart);

    document.querySelectorAll('[data-open-cart]').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.preventDefault(); openCart(); });
    });

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-add-to-cart]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var variantId = btn.dataset.variantId || (btn.closest('[data-variant-id]') && btn.closest('[data-variant-id]').dataset.variantId);
      if (!variantId) return;
      btn.disabled = true;
      addToCart(variantId, 1).then(function() {
        btn.disabled = false;
        openCart();
      });
    });

    window.IW = window.IW || {};
    window.IW.openCart  = openCart;
    window.IW.closeCart = closeCart;
    window.IW.addToCart = addToCart;
  }

  function addToCart(variantId, qty) {
    return fetch(routes.cartAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty })
    }).then(function(r) {
      if (!r.ok) throw new Error('Add to cart failed');
      return fetchCart();
    }).catch(function(err) { console.error('[IW] addToCart:', err); });
  }

  function fetchCart() {
    return fetch(routes.cart, { headers: { 'Accept': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(cart) { renderCart(cart); updateCartCount(cart.item_count); return cart; })
      .catch(function(err) { console.error('[IW] fetchCart:', err); });
  }

  function renderCart(cart) {
    var list        = document.getElementById('iw-cart-list');
    var eyebrow     = document.getElementById('iw-cart-eyebrow');
    var subtotalEl  = document.getElementById('iw-cart-subtotal');
    var checkoutBtn = document.getElementById('iw-cart-checkout');

    if (eyebrow)    eyebrow.textContent = 'YOUR CART \u00b7 ' + cart.item_count + ' ITEMS';
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);
    if (checkoutBtn) {
      checkoutBtn.textContent = 'CHECKOUT \u2014 ' + formatMoney(cart.total_price);
      checkoutBtn.disabled = cart.item_count === 0;
    }
    if (!list) return;

    if (cart.item_count === 0) {
      list.innerHTML =
        '<div class="iw-cart-empty">' +
          '<img src="' + (assets.daggerWhite || '') + '" class="iw-cart-empty__dagger" alt="">' +
          '<div class="iw-cart-empty__text">THE CART IS EMPTY.</div>' +
          '<div class="iw-cart-empty__sub">GO EARN IT.</div>' +
        '</div>';
      return;
    }

    list.innerHTML = cart.items.map(function(item, i) {
      return '<div class="iw-cart-row" data-line="' + (i + 1) + '">' +
        '<div class="iw-cart-row__media">' +
          '<img src="' + item.image + '" alt="' + esc(item.title) + '" class="iw-cart-row__img">' +
        '</div>' +
        '<div class="iw-cart-row__body">' +
          '<div class="iw-cart-row__top">' +
            '<span class="iw-cart-row__name">' + esc(item.product_title) + '</span>' +
            '<span class="iw-cart-row__price">' + formatMoney(item.final_line_price) + '</span>' +
          '</div>' +
          '<div class="iw-cart-row__meta">' +
            (item.variant_title && item.variant_title !== 'Default Title' ? '<span>SIZE ' + esc(item.variant_title) + '</span><span style="color:#333">\u00b7</span>' : '') +
            '<span>QTY ' + pad(item.quantity) + '</span>' +
          '</div>' +
          '<button class="iw-cart-row__remove" data-line="' + (i + 1) + '">REMOVE</button>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.iw-cart-row__remove').forEach(function(btn) {
      btn.addEventListener('click', function() { removeCartItem(parseInt(btn.dataset.line, 10)); });
    });
  }

  function removeCartItem(line) {
    fetch(routes.cartChange, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ line: line, quantity: 0 })
    }).then(function(r) {
      if (!r.ok) throw new Error('Remove failed');
      return fetchCart();
    }).catch(function(err) { console.error('[IW] removeCartItem:', err); });
  }

  function updateCartCount(count) {
    document.querySelectorAll('.iw-nav__cart-count').forEach(function(el) {
      el.textContent = pad(count);
    });
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(0);
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---- Shop menu ------------------------------------------ */
  function initShopMenu() {
    var panel = document.getElementById('iw-menu-panel');
    var scrim = document.getElementById('iw-menu-scrim');
    if (!panel || !scrim) return;

    function openMenu(kind) {
      panel.classList.add('active');
      scrim.classList.add('active');
      document.body.style.overflow = 'hidden';
      switchTab(kind || 'shop');
    }
    function closeMenu() {
      panel.classList.remove('active');
      scrim.classList.remove('active');
      document.body.style.overflow = '';
    }

    scrim.addEventListener('click', closeMenu);
    var closeBtn = panel.querySelector('.iw-menu__close');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    panel.querySelectorAll('.iw-menu__tab').forEach(function(tab) {
      tab.addEventListener('click', function(e) { e.preventDefault(); switchTab(tab.dataset.kind); });
    });

    function switchTab(kind) {
      panel.querySelectorAll('.iw-menu__tab').forEach(function(t) { t.classList.toggle('active', t.dataset.kind === kind); });
      panel.querySelectorAll('.iw-menu__pane').forEach(function(p) { p.style.display = p.dataset.kind === kind ? 'flex' : 'none'; });
      panel.querySelectorAll('.iw-menu__feature-pane').forEach(function(p) { p.style.display = p.dataset.kind === kind ? 'block' : 'none'; });
    }

    document.querySelectorAll('[data-open-menu]').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.preventDefault(); openMenu(btn.dataset.openMenu); });
    });

    window.IW = window.IW || {};
    window.IW.openMenu  = openMenu;
    window.IW.closeMenu = closeMenu;
  }

  /* ---- Product rail scroll progress ----------------------- */
  function initRails() {
    document.querySelectorAll('.iw-rail__scroller').forEach(function(scroller) {
      var rail = scroller.closest('.iw-rail');
      var bar  = rail && rail.querySelector('.iw-rail__progress-bar');

      if (bar) {
        scroller.addEventListener('scroll', function() {
          var max = scroller.scrollWidth - scroller.clientWidth;
          var pct = max > 0 ? (scroller.scrollLeft / max) * 100 : 0;
          bar.style.width = Math.max(12, pct) + '%';
        }, { passive: true });
      }

      if (rail) {
        var prev = rail.querySelector('.iw-rail__arrow--prev');
        var next = rail.querySelector('.iw-rail__arrow--next');
        if (prev) prev.addEventListener('click', function() { scroller.scrollBy({ left: -(scroller.clientWidth * 0.8), behavior: 'smooth' }); });
        if (next) next.addEventListener('click', function() { scroller.scrollBy({ left:  scroller.clientWidth * 0.8,  behavior: 'smooth' }); });
      }
    });
  }

  /* ---- Product page variant selection --------------------- */
  function initProductPage() {
    var form = document.getElementById('iw-pdp-form');
    if (!form) return;

    var variantInput = form.querySelector('input[name="id"]');

    document.querySelectorAll('.iw-pdp__swatch').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = btn.dataset.optionIndex;
        form.querySelectorAll('[data-option-index="' + idx + '"].iw-pdp__swatch').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var label = btn.closest('.iw-pdp__option') && btn.closest('.iw-pdp__option').querySelector('.iw-pdp__option-selected');
        if (label) label.textContent = btn.dataset.value;

        // Find matching variant
        var selectedOptions = [];
        form.querySelectorAll('.iw-pdp__option').forEach(function(opt) {
          var active = opt.querySelector('.iw-pdp__swatch.active');
          if (active) selectedOptions.push(active.dataset.value);
        });

        if (window.IW && window.IW.variants) {
          var match = window.IW.variants.find(function(v) {
            return v.options.every(function(o, i) { return o === selectedOptions[i]; });
          });
          if (match && variantInput) {
            variantInput.value = match.id;
            var addBtn = form.querySelector('.iw-pdp__add');
            if (addBtn) {
              addBtn.disabled = !match.available;
              addBtn.textContent = match.available
                ? 'ADD TO THE RACK \u2014 $' + (match.price / 100).toFixed(0)
                : 'SOLD OUT';
              addBtn.dataset.variantId = match.id;
            }
          }
        }
      });
    });

    // Add to cart from PDP form submit
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = variantInput && variantInput.value;
      if (!id) return;
      var btn = form.querySelector('.iw-pdp__add');
      if (btn) btn.textContent = 'ADDING...';
      addToCart(id, 1).then(function() {
        if (btn) btn.textContent = 'ADDED \u2014 VIEW CART';
        if (window.IW && window.IW.openCart) window.IW.openCart();
        setTimeout(function() {
          if (btn) btn.textContent = btn.dataset.original || 'ADD TO THE RACK';
        }, 2000);
      });
    });

    var addBtn = form.querySelector('.iw-pdp__add');
    if (addBtn) addBtn.dataset.original = addBtn.textContent;
  }

  /* ---- Image thumb switcher (PDP) ------------------------- */
  function initThumbs() {
    document.querySelectorAll('.iw-pdp__thumb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.iw-pdp__thumb').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var mainImg = document.getElementById('iw-pdp-main-img');
        if (mainImg && btn.dataset.imgSrc) mainImg.src = btn.dataset.imgSrc;
      });
    });
  }

  /* ---- Init ----------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function() {
    initAnnouncement();
    initNav();
    initCart();
    initShopMenu();
    initRails();
    initProductPage();
    initThumbs();
  });

})();
