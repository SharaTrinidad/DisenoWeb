/* app.js
   Sweet Kitty Bakery - Interactividad para proyecto (Consolidado 2)
   Implementa:
   - Productos / Carrito (persistencia localStorage)
   - Eventos (click, teclado, scroll, focus, load)
   - Ejemplos: valores/tipos/operadores, estructuras de control, funciones (flecha, recursiva, closure)
   - Encapsulamiento con clases y #privadas, prototipos, Map, polimorfismo
   - Propagación de eventos (captura / burbuja demo)
   - UI: botón flotante de carrito, modal, toast, contador
*/

(function () {
  'use strict';

  /* ============================
     Helpers: parse / format price
     ============================ */
  function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const cleaned = priceStr.toString().replace(/[^\d.,]/g, '').replace(',', '.');
    return Number(parseFloat(cleaned)) || 0;
  }

  function formatPrice(num) {
    return `S/ ${Number(num).toFixed(2)}`;
  }

  /* ============================
     Clase Producto (POO moderna)
     ============================ */
  class Producto {
    #id;
    constructor({ id, nombre, precio, categoria = 'general' }) {
      this.#id = id;
      this.nombre = nombre;
      this.precio = precio;
      this.categoria = categoria;
      this.cantidad = 1;
    }
    getId() { return this.#id; }
    mostrarInfo() { return `${this.nombre} — ${formatPrice(this.precio)}`; }
  }
  Producto.prototype.getLabel = function () { return `${this.nombre} (${this.categoria})`; };

  /* ============================
     Clase Carrito (encapsulado con Map)
     ============================ */
  class Carrito {
    #items;
    constructor() {
      this.#items = new Map();
      this.loadFromStorage();
    }
    add(producto) {
      const id = producto.getId();
      if (this.#items.has(id)) {
        this.#items.get(id).cantidad += 1;
      } else {
        this.#items.set(id, producto);
      }
      this.saveToStorage();
    }
    remove(id) { this.#items.delete(id); this.saveToStorage(); }
    updateQty(id, qty) {
      if (!this.#items.has(id)) return;
      const p = this.#items.get(id);
      p.cantidad = qty;
      if (p.cantidad <= 0) this.#items.delete(id);
      this.saveToStorage();
    }
    clear() { this.#items.clear(); this.saveToStorage(); }
    getItemsArray() { return Array.from(this.#items.values()); }
    getTotal() {
      let total = 0;
      for (const p of this.#items.values()) total += p.precio * p.cantidad;
      return total;
    }
    getCount() {
      let c = 0; for (const p of this.#items.values()) c += p.cantidad; return c;
    }
    saveToStorage() {
      try {
        const arr = this.getItemsArray().map(p => ({
          id: p.getId(), nombre: p.nombre, precio: p.precio, categoria: p.categoria, cantidad: p.cantidad
        }));
        localStorage.setItem('skb_carrito', JSON.stringify(arr));
      } catch (e) { console.error('guardar carrito', e); }
    }
    loadFromStorage() {
      try {
        const raw = localStorage.getItem('skb_carrito'); if (!raw) return;
        const arr = JSON.parse(raw);
        for (const o of arr) {
          const p = new Producto({ id: o.id, nombre: o.nombre, precio: o.precio, categoria: o.categoria });
          p.cantidad = o.cantidad; this.#items.set(p.getId(), p);
        }
      } catch (e) { console.error('cargar carrito', e); }
    }
  }

  /* ============================
     Estado / estructuras
     ============================ */
  const carrito = new Carrito();
  const productosMap = new Map();

  /* ============================
     ID generator (closure)
     ============================ */
  const generarId = (() => {
    let contador = Date.now() % 100000;
    return () => `p-${++contador}`;
  })();

  /* ============================
     Detectar productos en DOM
     - reconoce .product-card, lee h3, .price, data-id
     - añade botón Agregar si no existe
     ============================ */
  function descubrirProductosEnPagina() {
    const cards = document.querySelectorAll('.product-card');
    let i = 0;
    for (const card of cards) {
      i++;
      let id = card.getAttribute('data-id') || card.id || generarId();
      card.dataset.productId = id;
      if (productosMap.has(id)) continue;

      const h3 = card.querySelector('h3, h2');
      const nombre = h3 ? h3.textContent.trim() : `Producto ${i}`;
      const priceEl = card.querySelector('.price');
      const precio = priceEl ? parsePrice(priceEl.textContent) : 0;
      const producto = new Producto({ id, nombre, precio });
      productosMap.set(id, producto);

      // Si no tiene botón "Agregar" crea uno
      if (!card.querySelector('.btn-add-cart')) {
        const actions = card.querySelector('.card-actions') || card;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn btn-add-cart';
        btn.textContent = 'Agregar'; btn.dataset.productId = id;
        // evitar propagación
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          agregarProductoAlCarritoDesdeBoton(id);
          mostrarToast(`${nombre} agregado al carrito`);
        });
        actions.appendChild(btn);

        // demostración de click en tarjeta (burbuja)
        card.addEventListener('click', () => {
          console.log(`Seleccionado: ${producto.mostrarInfo()}`);
        });
      }
    }
  }

  /* ============================
     Carrito UI helpers
     ============================ */
  function ensureCartButton() {
    let btn = document.getElementById('skb-cart-btn');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'skb-cart-btn'; btn.className = 'skb-cart-btn'; btn.setAttribute('aria-label', 'Abrir carrito');
    btn.innerHTML = `🛒 <span id="skb-cart-count">0</span>`;
    Object.assign(btn.style, {
      position: 'fixed', right: '18px', bottom: '18px', zIndex: 9999, padding: '10px 14px',
      borderRadius: '28px', border: 'none', cursor: 'pointer', background: '#ff7ab6', color: '#fff',
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
    });
    btn.addEventListener('click', openCartModal);
    document.body.appendChild(btn);
    return btn;
  }

  function actualizarContadorCarrito() {
    const btn = ensureCartButton(); const span = btn.querySelector('#skb-cart-count');
    if (span) span.textContent = carrito.getCount();
  }

  let modal = null;
  function openCartModal() {
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'skb-cart-modal'; modal.className = 'skb-cart-modal';
      Object.assign(modal.style, {
        position: 'fixed', right: '20px', bottom: '70px', width: '340px', maxHeight: '60vh', overflowY: 'auto',
        background: '#fff', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 10000, padding: '12px'
      });

      const header = document.createElement('div'); header.style.display = 'flex'; header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center'; header.innerHTML = `<strong>Tu carrito</strong>`;
      const closeBtn = document.createElement('button'); closeBtn.textContent = '✕'; closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none'; closeBtn.style.cursor = 'pointer'; closeBtn.addEventListener('click', () => modal.remove());
      header.appendChild(closeBtn); modal.appendChild(header);

      const content = document.createElement('div'); content.id = 'skb-cart-content'; content.style.marginTop = '8px';
      modal.appendChild(content);

      const footer = document.createElement('div'); footer.style.marginTop = '8px'; footer.style.display = 'flex';
      footer.style.flexDirection = 'column'; footer.innerHTML = `
        <div id="skb-cart-total" style="margin-bottom:8px"><strong>Total: ${formatPrice(carrito.getTotal())}</strong></div>
        <div style="display:flex; gap:8px;">
          <button id="skb-clear-cart" class="btn">Vaciar</button>
          <button id="skb-checkout" class="btn">Finalizar</button>
        </div>
      `;
      modal.appendChild(footer); document.body.appendChild(modal);

      document.getElementById('skb-clear-cart').addEventListener('click', () => {
        carrito.clear(); renderMiniCarrito(); actualizarContadorCarrito();
      });
      document.getElementById('skb-checkout').addEventListener('click', () => {
        if (carrito.getCount() === 0) { alert('El carrito está vacío.'); return; }
        alert(`Gracias por tu compra (simulación). Total: ${formatPrice(carrito.getTotal())}`);
        carrito.clear(); renderMiniCarrito(); actualizarContadorCarrito();
      });
    }
    renderMiniCarrito();
  }

  function renderMiniCarrito() {
    const content = document.getElementById('skb-cart-content');
    const totalEl = document.getElementById('skb-cart-total');
    if (!content || !totalEl) return;
    content.innerHTML = '';
    const items = carrito.getItemsArray();
    if (items.length === 0) { content.innerHTML = '<p>Tu carrito está vacío.</p>'; }
    else {
      for (const p of items) {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.marginBottom = '6px';
        row.innerHTML = `
          <div style="flex:1;">
            <div style="font-weight:600">${p.nombre}</div>
            <div style="font-size:0.9rem">${formatPrice(p.precio)} x ${p.cantidad}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="skb-decrease" data-id="${p.getId()}" aria-label="Disminuir">-</button>
            <button class="skb-increase" data-id="${p.getId()}" aria-label="Aumentar">+</button>
            <button class="skb-remove" data-id="${p.getId()}" aria-label="Eliminar">🗑</button>
          </div>
        `;
        content.appendChild(row);
      }
    }
    totalEl.innerHTML = `<strong>Total: ${formatPrice(carrito.getTotal())}</strong>`;

    // enlazar botones
    document.querySelectorAll('.skb-decrease').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.id; const p = carrito.getItemsArray().find(x => x.getId() === id);
      if (!p) return; carrito.updateQty(id, p.cantidad - 1); renderMiniCarrito(); actualizarContadorCarrito();
    });
    document.querySelectorAll('.skb-increase').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.id; const p = carrito.getItemsArray().find(x => x.getId() === id);
      if (!p) return; carrito.updateQty(id, p.cantidad + 1); renderMiniCarrito(); actualizarContadorCarrito();
    });
    document.querySelectorAll('.skb-remove').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.id; carrito.remove(id); renderMiniCarrito(); actualizarContadorCarrito();
    });
  }

  /* toast */
  let toastTimer = null;
  function mostrarToast(text) {
    let t = document.getElementById('skb-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'skb-toast'; Object.assign(t.style, {
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '120px', padding: '10px 14px',
        background: '#333', color: '#fff', borderRadius: '8px', zIndex: 10001, opacity: 0, transition: 'opacity .25s'
      });
      document.body.appendChild(t);
    }
    t.textContent = text; t.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  /* Agregar producto */
  function agregarProductoAlCarritoDesdeBoton(id) {
    const p = productosMap.get(id); if (!p) return;
    const nuevo = new Producto({ id: p.getId(), nombre: p.nombre, precio: p.precio, categoria: p.categoria });
    carrito.add(nuevo); actualizarContadorCarrito(); renderMiniCarrito();
  }

  /* ============================
     Ejemplos didácticos para la rúbrica
     ============================ */

  // función flecha y operadores
  const calcularDescuento = (subtotal) => subtotal > 500 ? subtotal * 0.07 : subtotal > 300 ? subtotal * 0.04 : 0;

  // función recursiva (factorial)
  function factorial(n) { if (n < 0) return null; if (n === 0) return 1; return n * factorial(n - 1); }

  // closure ejemplo (generador de descuento por cupón)
  function generadorDescuentoPorCupon(porcentaje) { return function (monto) { return monto * (porcentaje / 100); }; }
  const descuento10 = generadorDescuentoPorCupon(10);

  // reporte inventario (for + if + while demo)
  function reporteInventario() {
    const arr = Array.from(productosMap.values()); let reporte = '';
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].precio === 0) { reporte += `${arr[i].nombre}: precio no disponible\n`; continue; }
      reporte += `${arr[i].nombre}: ${formatPrice(arr[i].precio)}\n`;
    }
    let count = 0; while (count < 1) { count++; } return reporte;
  }

  /* ============================
     Eventos Globales
     ============================ */
  function registrarEventosGlobales() {
    // asignar listener a todos los toggles de nav (soporta varias páginas con distintos ids)
    document.querySelectorAll('.nav-toggle').forEach(toggle => {
      const controls = toggle.getAttribute('aria-controls');
      if (!controls) return;
      const nav = document.getElementById(controls) || document.querySelector('#main-nav');
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
        if (nav) nav.classList.toggle('open');
      });
    });

    // keydown: 'c' abre carrito, Esc cierra modal
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'c') openCartModal();
      if (e.key === 'Escape') document.getElementById('skb-cart-modal')?.remove();
    });

    // scroll: agregar clase al body al bajar
    window.addEventListener('scroll', () => {
      const y = window.scrollY || window.pageYOffset;
      document.body.classList.toggle('scrolled-300', y > 300);
    });

    // focus en formulario contacto (si existe)
    const contactoForm = document.getElementById('contact-form');
    if (contactoForm) {
      contactoForm.addEventListener('focusin', (e) => {
        const t = e.target; if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') t.style.boxShadow = '0 0 0 3px rgba(255,122,182,0.18)';
      });
      contactoForm.addEventListener('focusout', (e) => {
        const t = e.target; if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') t.style.boxShadow = '';
      });

      // Validación simple de envío: usa novalidate en HTML y JS para simulación
      contactoForm.addEventListener('submit', (e) => {
        if (!contactoForm.checkValidity()) { e.preventDefault(); contactoForm.reportValidity(); return; }
        e.preventDefault();
        alert('Gracias — tu mensaje ha sido recibido (simulación).');
        contactoForm.reset();
      });
    }

    // load: rotador de promos
    window.addEventListener('load', () => {
      const promos = [
        'Promo: 10% en packs de cupcakes los fines de semana',
        'Nuevo: Servicio de delivery disponible',
        'Pide tu torta personalizada con 3 semanas de anticipación'
      ];
      let idx = 0;
      const promoContainer = document.getElementById('skb-promo') || (() => {
        const el = document.createElement('div'); el.id = 'skb-promo';
        Object.assign(el.style, { position: 'fixed', left: '12px', bottom: '18px', padding: '8px 10px', background: '#fff',
          borderRadius: '8px', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 9999 });
        document.body.appendChild(el); return el;
      })();
      promoContainer.textContent = promos[idx];
      setInterval(() => { idx = (idx + 1) % promos.length; promoContainer.textContent = promos[idx]; }, 10000);
    });
  }

  /* ============================
     Demo Propagación (captura vs burbuja)
     ============================ */
  function demoPropagacion() {
    const container = document.querySelector('.products-grid');
    if (container) {
      container.addEventListener('click', (e) => {
        console.log('Click capturado en container (fase captura/burbuja):', e.target);
      }, true); // true => captura
    }
  }

  /* ============================
     Auto-detección y init
     ============================ */
  function setYearForAll() {
    ['year','year2','year3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = new Date().getFullYear();
    });
  }

  function inicializarApp() {
    descubrirProductosEnPagina();
    ensureCartButton();
    actualizarContadorCarrito();
    registrarEventosGlobales();
    demoPropagacion();
    setYearForAll();

    // Construir Map de nombres (ejemplo uso Map)
    const nombreMap = new Map();
    for (const p of productosMap.values()) nombreMap.set(p.nombre.toLowerCase(), p);
    if (nombreMap.has('torta personalizada')) console.info('Torta personalizada detectada.');

    // Mostrar ejemplos en consola para la rúbrica
    console.info('Factorial 5 =', factorial(5));
    console.info('Descuento10 sobre 400 =', descuento10(400));
    console.info('Reporte inventario:\n', reporteInventario());
  }

  document.addEventListener('DOMContentLoaded', inicializarApp);
})();
