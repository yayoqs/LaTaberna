/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/menu.js
   Versión: 1.0.5
   Propósito: Vista de menú digital para garzón/admin.
              v1.0.5: implementa ciclo de vida activar/limpiar.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Auth } from '../auth.js';
import { $id, showToast, fmtMoney } from '../utils.js';

const Menu = (() => {

  let _categoriaActiva = 'Todos';
  let _terminoBusqueda = '';
  let _abortController = null;
  let _desuscripciones = [];

  function _asegurarVista() {
    let main = document.getElementById('view-menu');
    if (main && main.querySelector('.view-toolbar')) return;
    
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-menu';
      main.className = 'view';
      const referencia = document.getElementById('toastContainer') || document.body.lastChild;
      document.body.insertBefore(main, referencia);
    }

    main.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-utensils"></i> Menú Digital</h2>
        <div class="toolbar-actions">
          <div class="menu-search">
            <i class="fas fa-search"></i>
            <input type="text" id="menuSearch" placeholder="Buscar producto..." autocomplete="off">
          </div>
          <div class="menu-categorias" id="menuCategorias"></div>
          <button class="btn-primary" id="btnNuevoProductoMenu" data-rol="admin,master">
            <i class="fas fa-plus"></i> Nuevo Producto
          </button>
        </div>
      </div>
      <div id="menuGrid" class="menu-grid"></div>
    `;

    const { signal } = _abortController || {};
    document.getElementById('menuSearch').addEventListener('input', () => filtrar(), { signal });
    document.getElementById('btnNuevoProductoMenu')?.addEventListener('click', () => {
      if (typeof Config !== 'undefined' && Config.abrirModalProducto) {
        Config.abrirModalProducto();
      }
    }, { signal });
    document.getElementById('menuCategorias').addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-cat-btn');
      if (btn) {
        document.querySelectorAll('.menu-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtrar(btn.dataset.categoria);
      }
    }, { signal });
  }

  function activar() {
    limpiar();
    _abortController = new AbortController();

    const unsubscribeStore = Store.subscribe((state, action) => {
      if (action.type.startsWith('PRODUCTO')) {
        render();
      }
    });
    _desuscripciones.push(unsubscribeStore);

    _desuscripciones.push(EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    }));
    _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'menu') render();
    }));
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _desuscripciones.forEach(fn => fn());
    _desuscripciones = [];
  }

  function render() {
    _asegurarVista();
    _renderCategorias();
    filtrar(_categoriaActiva);
  }

  function _renderCategorias() {
    const container = document.getElementById('menuCategorias');
    if (!container) return;

    const productos = Store.getState().productos || [];
    const categorias = new Set();
    categorias.add('Todos');
    productos.forEach(p => {
      if (p.categoria) categorias.add(p.categoria);
    });

    container.innerHTML = Array.from(categorias).map(cat => {
      const activo = cat === _categoriaActiva ? ' active' : '';
      return `<button class="menu-cat-btn${activo}" data-categoria="${cat}">${cat}</button>`;
    }).join('');
  }

  function filtrar(categoria) {
    if (categoria !== undefined) {
      _categoriaActiva = categoria;
    }
    _terminoBusqueda = document.getElementById('menuSearch')?.value?.trim().toLowerCase() || '';

    const grid = document.getElementById('menuGrid');
    if (!grid) return;

    let productos = Store.getState().productos || [];

    if (_categoriaActiva !== 'Todos') {
      productos = productos.filter(p => p.categoria === _categoriaActiva);
    }

    if (_terminoBusqueda) {
      productos = productos.filter(p => p.nombre.toLowerCase().includes(_terminoBusqueda));
    }

    if (!productos.length) {
      grid.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-text-muted);">No se encontraron productos.</p>';
      return;
    }

    grid.innerHTML = productos.map(p => {
      const disponible = p.disponible !== false;
      const clase = disponible ? '' : ' no-disponible';
      return `
        <div class="menu-item${clase}" data-id="${p.id}">
          <div class="menu-item-img" style="background:var(--color-accent);">
            <span>${p.nombre.charAt(0).toUpperCase()}</span>
          </div>
          <div class="menu-item-info">
            <div class="menu-item-nombre">${p.nombre}</div>
            <div class="menu-item-precio">${fmtMoney(p.precio)}</div>
          </div>
          ${disponible ? '' : '<div class="menu-item-agotado">Agotado</div>'}
        </div>
      `;
    }).join('');
  }

  // ── Inicialización ──
  activar();

  return {
    activar,
    limpiar,
    render,
    filtrar
  };
})();

export { Menu };