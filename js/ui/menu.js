/* =======================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/menu.js
   Versión: 1.0.3
   Propósito: Vista de menú para el mesero. Utiliza la función unificada
              obtenerColorDesdeNombre desde utils.js.
   ==================================================== */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { $id, fmtMoney, obtenerColorDesdeNombre } from '../utils.js';

const Menu = (() => {
  let _categoriaActiva = 'Todos';
  let _terminoBusqueda = '';

  function _asegurarVista() {
    if ($id('view-menu')) return;

    const main = document.createElement('main');
    main.id = 'view-menu';
    main.className = 'view';
    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-utensils"></i> Menú</h2>
        <div class="toolbar-actions">
          <div class="menu-search">
            <i class="fas fa-search"></i>
            <input type="text" id="menuSearch" placeholder="Buscar producto..." autocomplete="off">
          </div>
          <div class="menu-categorias" id="menuCategorias"></div>
        </div>
      </div>
      <div class="menu-grid" id="menuGrid"></div>
    `;
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  function render() {
    _asegurarVista();
    _renderCategorias();
    _renderProductos();

    $id('menuSearch').addEventListener('input', filtrar);
  }

  function _renderCategorias() {
    const container = document.getElementById('menuCategorias');
    if (!container) return;

    const productos = Store.getState().productos || [];
    const categorias = ['Todos', ...new Set(
      productos.filter(p => p.activo !== false).map(p => p.categoria)
    )].filter(Boolean);

    container.innerHTML = categorias
      .map(cat => `
        <button class="cat-tab${cat === _categoriaActiva ? ' active' : ''}"
                data-categoria="${cat}">${cat}</button>
      `).join('');

    container.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', () => setCategoria(btn.dataset.categoria));
    });
  }

  function setCategoria(cat) {
    _categoriaActiva = cat;
    _renderProductos();
    _renderCategorias();
  }

  function filtrar() {
    _terminoBusqueda = ($id('menuSearch')?.value || '').toLowerCase();
    _renderProductos();
  }

  function _renderProductos() {
    const cont = $id('menuGrid');
    if (!cont) return;

    let productosFiltrados = (Store.getState().productos || []).filter(p => p.activo !== false);

    if (_categoriaActiva !== 'Todos') {
      productosFiltrados = productosFiltrados.filter(p => p.categoria === _categoriaActiva);
    }
    if (_terminoBusqueda) {
      productosFiltrados = productosFiltrados.filter(p =>
        p.nombre.toLowerCase().includes(_terminoBusqueda) ||
        (p.descripcion || '').toLowerCase().includes(_terminoBusqueda)
      );
    }

    if (!productosFiltrados.length) {
      cont.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--color-text-muted)">
          <i class="fas fa-search" style="font-size:32px;opacity:.25;display:block;margin-bottom:12px"></i>
          Sin resultados
        </div>`;
      return;
    }

    cont.innerHTML = productosFiltrados.map(p => {
      const color = obtenerColorDesdeNombre(p.nombre);
      const destinoIcon = { barra: 'fa-wine-glass', cocina: 'fa-fire-burner', ambos: 'fa-arrows-split-up-and-left' }[p.destino] || 'fa-fire-burner';
      return `
        <article class="menu-card" data-prod-id="${p.id}" style="border-left: 5px solid ${color}; background: linear-gradient(135deg, ${color}10 0%, var(--color-card) 100%);">
          <div class="menu-nombre">${p.nombre}</div>
          ${p.descripcion ? `<div class="menu-desc">${p.descripcion}</div>` : ''}
          <div class="menu-footer">
            <span class="menu-precio">${fmtMoney(p.precio)}</span>
            <span class="menu-destino-tag ${p.destino}">
              <i class="fas ${destinoIcon}"></i> ${p.destino}
            </span>
          </div>
        </article>`;
    }).join('');

    cont.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => mostrarDetalle(card.dataset.prodId));
    });
  }

  function mostrarDetalle(prodId) {
    const state = Store.getState();
    const producto = (state.productos || []).find(p => p.id == prodId);
    if (!producto) return;

    let recetaHTML = '';
    const receta = (state.recetas || []).find(r => r.productoId == prodId);
    if (receta && receta.ingredientes && receta.ingredientes.length) {
      const nombres = receta.ingredientes.map(ing => {
        const ingData = (state.ingredientes || []).find(i => i.id == ing.ingredienteId);
        return ingData ? `${ingData.nombre}: ${ing.cantidad} ${ingData.unidad || 'u'}` : '—';
      }).join(', ');
      recetaHTML = `<p style="font-size:12px;color:var(--color-text-muted);margin-top:6px;"><i class="fas fa-clipboard-list"></i> ${nombres}</p>`;
    }

    const color = obtenerColorDesdeNombre(producto.nombre);

    let modal = $id('modalMenuDetalle');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modalMenuDetalle';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-small" style="max-width:400px;">
        <div class="modal-header" style="border-left:5px solid ${color};">
          <h3><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:8px;"></span>${producto.nombre}</h3>
          <button class="modal-close" id="btnCerrarMenuDetalle"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body">
          ${producto.descripcion ? `<p>${producto.descripcion}</p>` : ''}
          <div class="menu-detalle-precio">${fmtMoney(producto.precio)}</div>
          ${recetaHTML}
          <p style="font-size:12px;color:var(--color-text-muted);margin-top:8px;">Destino: ${producto.destino} | Categoría: ${producto.categoria}</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $id('btnCerrarMenuDetalle').addEventListener('click', cerrarDetalle);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarDetalle(); });
  }

  function cerrarDetalle() {
    const modal = $id('modalMenuDetalle');
    if (modal) modal.remove();
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('PRODUCTO')) {
        _renderProductos();
        _renderCategorias();
      }
    });

    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'menu') render();
    });
  }

  _initListeners();

  return {
    render,
    setCategoria,
    filtrar,
    mostrarDetalle,
    cerrarDetalle
  };
})();

export { Menu };