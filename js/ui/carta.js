/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/carta.js
   Versión: 2.1.4
   Propósito: Carta de productos. Sin autoactivación.
              Ciclo de vida controlado por el modal de pedido.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { formatearDinero, $id } from '../utils.js';

const Carta = (() => {
  let _categoriaActiva = 'Todos';
  let _terminoBusqueda = '';
  let _activada = false;
  let _unsubscribeStore = null;
  let _unsubscribeEventBus = null;

  function activar() {
    if (_activada) return;
    _activada = true;

    try {
      _unsubscribeStore = Store.suscribir((state, action) => {
        if (action.type.startsWith('PRODUCTO')) {
          render();
        }
      });
    } catch (e) {
      Logger.error('[Carta] Error al suscribirse al Store:', e);
    }

    try {
      _unsubscribeEventBus = EventBus.on('vista:cambiada', (vista) => {
        if (vista === 'mesas') render();
      });
    } catch (e) {
      Logger.error('[Carta] Error al suscribirse a EventBus:', e);
    }
  }

  function limpiar() {
    try {
      if (_unsubscribeStore) {
        _unsubscribeStore();
        _unsubscribeStore = null;
      }
    } catch (e) {
      Logger.error('[Carta] Error al desuscribirse del Store:', e);
    }

    try {
      if (_unsubscribeEventBus) {
        _unsubscribeEventBus();
        _unsubscribeEventBus = null;
      }
    } catch (e) {
      Logger.error('[Carta] Error al desuscribirse de EventBus:', e);
    }

    _activada = false;
  }

  function render() {
    _renderCategorias();
    _renderProductos();
  }

  function _renderCategorias() {
    const container = $id('categoriasTabs');
    if (!container) return;

    const productos = Store.obtenerEstado().productos || [];
    const categorias = ['Todos', ...new Set(
      productos.filter(p => p.activo !== false).map(p => p.categoria)
    )].filter(Boolean);

    container.innerHTML = categorias
      .map(cat => `<button class="cat-tab${cat === _categoriaActiva ? ' active' : ''}" data-categoria="${cat}">${cat}</button>`)
      .join('');

    container.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', () => establecerCategoria(btn.dataset.categoria));
    });
  }

  function establecerCategoria(cat) {
    _categoriaActiva = cat;
    render();
  }

  function filtrar() {
    _terminoBusqueda = ($id('searchProducto')?.value || '').toLowerCase();
    _renderProductos();
  }

  function _renderProductos() {
    const cont = $id('cartaProductos');
    if (!cont) return;

    let productosFiltrados = (Store.obtenerEstado().productos || []).filter(p => p.activo !== false);

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

    cont.innerHTML = productosFiltrados.map(_htmlProducto).join('');

    cont.querySelectorAll('.prod-card').forEach(card => {
      card.addEventListener('click', () => seleccionarProducto(card.dataset.prodId));
    });
  }

  function _htmlProducto(p) {
    const destinoIcon = { barra: 'fa-wine-glass', cocina: 'fa-fire-burner', ambos: 'fa-arrows-split-up-and-left' }[p.destino] || 'fa-fire-burner';
    return `
      <article class="prod-card" data-prod-id="${p.id}" role="button" tabindex="0">
        <div class="prod-nombre">${p.nombre}</div>
        ${p.descripcion ? `<div class="prod-desc">${p.descripcion}</div>` : ''}
        <div class="prod-footer">
          <span class="prod-precio">${formatearDinero(p.precio)}</span>
          <span class="prod-destino-tag ${p.destino}">
            <i class="fas ${destinoIcon}"></i> ${p.destino}
          </span>
        </div>
      </article>`;
  }

  function seleccionarProducto(prodId) {
    const producto = (Store.obtenerEstado().productos || []).find(p => p.id === prodId);
    if (producto) {
      EventBus.emit('producto:seleccionado', producto);
    }
  }

  // Sin autoactivación. El modal de pedido activa/limpia.

  return {
    activar,
    limpiar,
    render,
    establecerCategoria,
    filtrar,
    seleccionarProducto
  };
})();

export { Carta };