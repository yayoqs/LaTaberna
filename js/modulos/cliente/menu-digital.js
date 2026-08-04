/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/menu-digital.js
   Versión: 2.0.6
   Propósito: Menú digital interactivo.
              AbortController para limpiar listeners del DOM.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast, formatearDinero, obtenerColorDesdeNombre } from '../../utils.js';
import { Orden } from './orden.js';

const MenuDigital = (() => {
  let _vista = null;
  let _panelOrden = null;
  let _categoriaActiva = 'Todas';
  let _terminoBusqueda = '';
  let _activada = false;

  let _abortController = null;        // listeners fijos
  let _abortControllerOrden = null;   // listeners del panel de orden
  let _abortControllerGrilla = null;  // listeners de la grilla de productos

  let _cbProductosActualizada, _cbMesasActualizada;

  function _asegurarVista() {
    if (_vista) return;

    let main = document.getElementById('view-menu-digital');
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-menu-digital';
      main.className = 'view';
      document.body.appendChild(main);
    }

    _vista = main;

    if (_vista.querySelector('.menu-estado')) return;

    _vista.innerHTML = `
      <button class="btn-volver" id="btnVolverMenu" style="position:absolute; top:10px; left:10px; z-index:10; background:transparent; border:none; color:var(--color-text-sec); font-size:1.3rem; cursor:pointer; transition: color 0.2s;" title="Volver a la bienvenida"><i class="fas fa-arrow-left"></i></button>
      <div class="menu-estado" id="menuEstado"><span id="menuEstadoCliente"></span><span id="menuEstadoMesa"></span></div>
      <div class="menu-banner-espera" id="menuBannerEspera"><i class="fas fa-clock"></i><p>Ponte cómodo. El garzón activará tu pantalla en unos instantes.</p></div>
      <div class="menu-banner"><div class="menu-banner-content"><p>🗺️ "Donde cada trago es una aventura"</p><div class="menu-banner-search"><i class="fas fa-search"></i><input type="text" id="menuDigitalSearch" placeholder="Buscar en el menú..." /></div></div></div>
      <div class="menu-categorias" id="menuDigitalCategorias"></div>
      <div class="menu-grid" id="menuDigitalGrid"></div>
      <button class="btn-toggle-orden" id="btnToggleOrden" title="Ver mi orden">🛒 <span id="contadorOrden">0</span></button>
    `;

    _crearPanelOrden();

    // Listeners fijos con AbortController
    _abortController = new AbortController();
    const { signal } = _abortController;
    document.getElementById('menuDigitalSearch').addEventListener('input', () => {
      _terminoBusqueda = document.getElementById('menuDigitalSearch')?.value?.trim() || '';
      _renderProductos();
    }, { signal });
    document.getElementById('btnToggleOrden').addEventListener('click', _togglePanelOrden, { signal });
    document.getElementById('btnVolverMenu').addEventListener('click', () => EventBus.emit('app:cambiarVista', 'bienvenida'), { signal });
  }

  function activar() {
    if (_activada) return;
    _activada = true;
    _initRealtime();
  }

  function limpiar() {
    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (_abortControllerOrden) { _abortControllerOrden.abort(); _abortControllerOrden = null; }
    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }
    if (!_activada) return;
    _activada = false;
    if (EventBus.off) {
      if (_cbProductosActualizada) EventBus.off('productos:actualizada', _cbProductosActualizada);
      if (_cbMesasActualizada) EventBus.off('mesas:actualizada', _cbMesasActualizada);
    }
  }

  function _crearPanelOrden() {
    _panelOrden = document.createElement('aside');
    _panelOrden.id = 'panelOrden';
    _panelOrden.className = 'orden-panel oculto';
    _panelOrden.innerHTML = `
      <div class="orden-cabecera"><h3><i class="fas fa-clipboard-list"></i> Mi Orden</h3><button class="btn-cerrar-orden" id="btnCerrarOrden"><i class="fas fa-times"></i></button></div>
      <div class="orden-items" id="ordenItems"></div>
      <div class="orden-pie"><div class="orden-total"><span>Total</span><span id="ordenTotal">$0</span></div><button class="btn-primary" id="btnConfirmarOrden">Confirmar Orden</button></div>
    `;
    const vista = document.getElementById('view-menu-digital');
    if (vista) {
      vista.appendChild(_panelOrden);
    } else {
      document.body.appendChild(_panelOrden);
    }

    // Listeners fijos del panel con su propio AbortController
    _abortControllerOrden = new AbortController();
    const { signal: sigOrden } = _abortControllerOrden;
    document.getElementById('btnCerrarOrden').addEventListener('click', () => _panelOrden.classList.add('oculto'), { signal: sigOrden });
    document.getElementById('btnConfirmarOrden').addEventListener('click', _confirmarOrden, { signal: sigOrden });
  }

  function _togglePanelOrden() { _panelOrden.classList.toggle('oculto'); _renderizarItemsOrden(); }

  function _renderizarItemsOrden() {
    // Abortar listeners anteriores del panel de orden
    if (_abortControllerOrden) { _abortControllerOrden.abort(); _abortControllerOrden = null; }
    _abortControllerOrden = new AbortController();
    const { signal } = _abortControllerOrden;

    const container = document.getElementById('ordenItems');
    const totalEl = document.getElementById('ordenTotal');
    const items = Orden.obtenerItems(); const total = Orden.obtenerTotal();
    if (totalEl) totalEl.textContent = formatearDinero(total);
    if (!container) return;
    if (!items.length) { container.innerHTML = '<div class="orden-vacia"><i class="fas fa-inbox"></i><p>Tu orden está vacía</p></div>'; return; }
    container.innerHTML = items.map(item => `
      <div class="orden-item"><div class="orden-item-info"><div class="orden-item-nombre">${item.nombre}</div><div class="orden-item-precio">${formatearDinero(item.precio)} c/u</div><div class="orden-item-cantidad"><button data-id="${item.prodId}" data-accion="restar">−</button><span>${item.qty}</span><button data-id="${item.prodId}" data-accion="sumar">+</button></div><div class="orden-item-obs"><input type="text" placeholder="Observación (ej: sin cebolla)" value="${item.obs || ''}" data-id="${item.prodId}" /></div></div><button class="btn-quitar-item" data-id="${item.prodId}" title="Quitar"><i class="fas fa-trash-alt"></i></button></div>
    `).join('');

    container.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id; const item = items.find(i => i.prodId === id); if (!item) return;
        const nuevaCantidad = btn.dataset.accion === 'sumar' ? item.qty + 1 : item.qty - 1;
        Orden.modificarCantidad(id, nuevaCantidad); _renderizarItemsOrden(); _actualizarContador();
      }, { signal });
    });

    container.querySelectorAll('.orden-item-obs input').forEach(input => {
      input.addEventListener('input', () => Orden.modificarObservacion(input.dataset.id, input.value), { signal });
    });

    container.querySelectorAll('.btn-quitar-item').forEach(btn => {
      btn.addEventListener('click', () => { Orden.quitarItem(btn.dataset.id); _renderizarItemsOrden(); _actualizarContador(); }, { signal });
    });
  }

  function _actualizarContador() {
    const items = Orden.obtenerItems(); const totalCantidad = items.reduce((sum, i) => sum + i.qty, 0);
    const contador = document.getElementById('contadorOrden'); if (contador) contador.textContent = totalCantidad;
  }

  async function _confirmarOrden() {
    const state = Store.obtenerEstado(); const permite = state.cliente?.permitePrepedidos || false;
    if (!permite) { mostrarToast('error', 'Tu mesa ya no admite pedidos. Contactá al garzón.'); return; }
    const items = Orden.obtenerItems(); if (!items.length) { mostrarToast('error', 'Agregá productos a tu orden antes de confirmar.'); return; }

    let idUsuario;
    try {
      idUsuario = await Auth.getAppwriteUserId();
    } catch (e) {
      Logger.error('[MenuDigital] Error al obtener ID de Appwrite:', e);
      idUsuario = null;
    }
    if (!idUsuario) { mostrarToast('error', 'No se pudo obtener tu sesión. Intentá de nuevo.'); return; }

    const mesa = state.cliente?.mesa || 0; if (!mesa) { mostrarToast('error', 'No se pudo obtener el número de mesa.'); return; }
    const nombreComensal = Auth.obtenerNombre() || 'comensal';
    const payload = { mesa, items, clienteId: nombreComensal, id_usuario: idUsuario, nombre_comensal: nombreComensal, observaciones: '', timestamp: Date.now() };
    try {
      const resultado = await DBAppwrite.crear('precargas_cliente', 'unique()', { id_mesa: mesa, id_usuario: idUsuario, nombre_comensal: nombreComensal, productos: JSON.stringify(items), estado: 'por_confirmar', timestamp: payload.timestamp });
      if (!resultado) { mostrarToast('error', 'Error al enviar tu orden. Intentá de nuevo.'); return; }
      payload.id = resultado.id || 'pre_' + Date.now(); EventBus.emit('cliente:precarga_enviada', payload);
      Orden.vaciar(); _actualizarContador(); _panelOrden.classList.add('oculto'); mostrarToast('success', '✅ ¡Orden enviada! El garzón la revisará pronto.');
    } catch (e) {
      Logger.error('[MenuDigital] Error al confirmar orden:', e);
      mostrarToast('error', 'Error de conexión. Revisá tu internet.');
    }
  }

  function mostrar() {
    _asegurarVista(); activar();
    const viewMenu = document.getElementById('view-menu'); if (viewMenu) viewMenu.classList.remove('active');
    _vista.classList.add('active');
    _actualizarEstado(); _verificarPermiso(); _renderCategorias(); _renderProductos(); _actualizarContador();
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    if (_panelOrden) _panelOrden.classList.add('oculto');
    limpiar();  // Ahora también aborta los controllers
  }

  function _actualizarEstado() {
    const nombre = Auth.obtenerNombre() || 'comensal';
    const state = Store.obtenerEstado(); const mesa = state.cliente?.mesa || '?';
    document.getElementById('menuEstadoCliente').textContent = `👤 ${nombre}`; document.getElementById('menuEstadoMesa').textContent = `🪑 Mesa ${mesa}`;
  }
  function _verificarPermiso() {
    const state = Store.obtenerEstado(); const permite = state.cliente?.permitePrepedidos || false;
    const banner = document.getElementById('menuBannerEspera'); if (banner) banner.style.display = permite ? 'none' : 'flex';
    _renderProductos();
  }
  function _renderCategorias() {
    const container = document.getElementById('menuDigitalCategorias'); if (!container) return;
    const productos = Store.obtenerEstado().productos || [];
    const categorias = ['Todas', ...new Set(productos.filter(p => p.activo !== false).map(p => p.categoria))].filter(Boolean);
    container.innerHTML = categorias.map(cat => `<button class="menu-cat-btn ${cat === _categoriaActiva ? 'active' : ''}" data-categoria="${cat}">${cat}</button>`).join('');

    // Abortar listeners anteriores de categorías
    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }
    _abortControllerGrilla = new AbortController();
    const { signal: sigCat } = _abortControllerGrilla;
    container.querySelectorAll('.menu-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => { _categoriaActiva = btn.dataset.categoria; _renderCategorias(); _renderProductos(); }, { signal: sigCat });
    });
  }
  function _renderProductos() {
    const grid = document.getElementById('menuDigitalGrid'); if (!grid) return;
    const state = Store.obtenerEstado(); const permite = state.cliente?.permitePrepedidos || false;
    let productos = (Store.obtenerEstado().productos || []).filter(p => p.activo !== false);
    if (_categoriaActiva !== 'Todas') productos = productos.filter(p => p.categoria === _categoriaActiva);
    if (_terminoBusqueda) { const term = _terminoBusqueda.toLowerCase(); productos = productos.filter(p => p.nombre.toLowerCase().includes(term) || (p.descripcion || '').toLowerCase().includes(term)); }
    if (!productos.length) { grid.innerHTML = '<div class="menu-empty"><i class="fas fa-search"></i><p>No se encontraron productos</p></div>'; return; }
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    grid.innerHTML = productos.map(prod => {
      const disponible = prod.disponible !== false; const puedeAgregar = permite && disponible; const desc = prod.descripcion || 'Consulta a nuestro personal.';
      return `<div class="menu-card ${!disponible ? 'menu-card-atenuado' : ''}"><div class="menu-card-img" style="background-color: ${obtenerColorDesdeNombre(prod.nombre)};"><span class="menu-card-inicial">${prod.nombre.charAt(0).toUpperCase()}</span><span class="menu-card-precio">${formatearDinero(prod.precio)}</span></div><div class="menu-card-body"><h3>${prod.nombre}</h3><p>${desc.length > 60 ? desc.substring(0, 60) + '...' : desc}</p><button class="btn-agregar-orden ${!puedeAgregar ? 'btn-deshabilitado' : ''}" ${!puedeAgregar ? 'disabled' : ''} data-id="${prod.id}" data-nombre="${prod.nombre}" data-precio="${prod.precio}" data-categoria="${prod.categoria}" data-destino="${prod.destino || prod.categoria || 'general'}">🛒 Agregar a mi orden</button></div></div>`;
    }).join('');

    // Abortar listeners anteriores de la grilla
    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }
    _abortControllerGrilla = new AbortController();
    const { signal: sigGrilla } = _abortControllerGrilla;
    grid.querySelectorAll('.btn-agregar-orden:not(.btn-deshabilitado)').forEach(btn => {
      btn.addEventListener('click', () => {
        Orden.agregarItem({ id: btn.dataset.id, nombre: btn.dataset.nombre, precio: parseInt(btn.dataset.precio, 10), categoria: btn.dataset.categoria, destino: btn.dataset.destino });
        mostrarToast('success', `${btn.dataset.nombre} agregado a tu orden`);
        _actualizarContador();
        _renderizarItemsOrden();
      }, { signal: sigGrilla });
    });
  }

  function _initRealtime() {
    _cbProductosActualizada = () => { if (_vista?.classList.contains('active')) { _renderCategorias(); _renderProductos(); } };
    _cbMesasActualizada = () => { if (_vista?.classList.contains('active')) _verificarPermiso(); };
    EventBus.on('productos:actualizada', _cbProductosActualizada);
    EventBus.on('mesas:actualizada', _cbMesasActualizada);
  }

  return { mostrar, ocultar };
})();

export { MenuDigital };