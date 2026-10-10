/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/menu-digital.js
   Versión: 2.2.3
   Propósito: Menú digital interactivo del cliente.
   v2.2.3: Paquete 6 — fix de ciclo de vida. Los listeners de la
     vista y del panel de orden ahora se registran en activar() y
     se limpian en limpiar(). Antes vivían en _asegurarVista() y se
     perdían tras el primer ocultar(). Se separan los
     AbortControllers por responsabilidad.
   v2.2.2: payload de crearPrecargaCliente sin id_usuario.
   v2.2.1: import de contexto-qr.js.
   v2.2.0: crearPrecargaCliente, bloqueo sin QR.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast, formatearDinero, obtenerColorDesdeNombre } from '../../utils.js';
import { Orden } from './orden.js';
import { ModalOpciones } from './modal-opciones.js';
import { AlergiasCliente } from './alergias-cliente.js';
import { obtenerEspacioRestaurante } from './contexto-qr.js';

const DESTINOS_VALIDOS = ['cocina', 'barra', 'ambos'];

const MenuDigital = (() => {
  let _vista = null;
  let _panelOrden = null;
  let _categoriaActiva = 'Todas';
  let _terminoBusqueda = '';
  let _activada = false;

  let _abortControllerVista = null;
  let _abortControllerItems = null;
  let _abortControllerGrilla = null;

  let _cbProductosActualizada = null;
  let _cbMesasActualizada = null;
  let _limpiarProductoAgregado = null;
  let _limpiarAlergiasActualizadas = null;

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
      <div class="menu-estado" id="menuEstado">
        <span id="menuEstadoCliente"></span>
        <span id="menuEstadoMesa"></span>
        <button class="chip-alergias" id="chipAlergiasMenu" type="button"></button>
      </div>
      <div class="menu-banner-sin-espacio" id="menuBannerSinEspacio" style="display:none;">
        <i class="fas fa-qrcode"></i>
        <span>Escanea el código QR del restaurante para poder enviar tu pedido.</span>
      </div>
      <div class="menu-banner-espera" id="menuBannerEspera"><i class="fas fa-clock"></i><p>Ponte cómodo. El garzón activará tu pantalla en unos instantes.</p></div>
      <div class="menu-banner"><div class="menu-banner-content"><p>🗺️ "Donde cada trago es una aventura"</p><div class="menu-banner-search"><i class="fas fa-search"></i><input type="text" id="menuDigitalSearch" placeholder="Buscar en el menú..." /></div></div></div>
      <div class="menu-categorias" id="menuDigitalCategorias"></div>
      <div class="menu-grid" id="menuDigitalGrid"></div>
      <button class="btn-toggle-orden" id="btnToggleOrden" title="Ver mi orden">🛒 <span id="contadorOrden">0</span></button>
    `;

    _crearPanelOrden();
  }

  function _crearPanelOrden() {
    _panelOrden = document.createElement('aside');
    _panelOrden.id = 'panelOrden';
    _panelOrden.className = 'orden-panel oculto';
    _panelOrden.innerHTML = `
      <div class="orden-cabecera"><h3><i class="fas fa-clipboard-list"></i> Mi Orden</h3><button class="btn-cerrar-orden" id="btnCerrarOrden"><i class="fas fa-times"></i></button></div>
      <div class="orden-items" id="ordenItems"></div>
      <div id="avisoAlergiasOrden"></div>
      <div class="orden-pie"><div class="orden-total"><span>Total</span><span id="ordenTotal">$0</span></div><button class="btn-primary" id="btnConfirmarOrden">Confirmar Orden</button></div>
    `;
    const vista = document.getElementById('view-menu-digital');
    if (vista) vista.appendChild(_panelOrden);
    else document.body.appendChild(_panelOrden);
  }

  // ── Handlers nombrados para claridad ────────────────────

  function _onInputBusqueda() {
    _terminoBusqueda = document.getElementById('menuDigitalSearch')?.value?.trim() || '';
    _renderProductos();
  }

  function _onClickToggleOrden() {
    _panelOrden.classList.toggle('oculto');
    _renderizarItemsOrden();
  }

  function _onClickVolver() {
    EventBus.emit('app:cambiarVista', 'bienvenida');
  }

  function _onClickChipAlergias() {
    AlergiasCliente.mostrar();
  }

  function _onClickCerrarOrden() {
    _panelOrden.classList.add('oculto');
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _asegurarVista();

    // Listeners de la vista — se registran cada vez que se activa.
    _abortControllerVista = new AbortController();
    const { signal } = _abortControllerVista;

    document.getElementById('menuDigitalSearch')?.addEventListener('input', _onInputBusqueda, { signal });
    document.getElementById('btnToggleOrden')?.addEventListener('click', _onClickToggleOrden, { signal });
    document.getElementById('btnVolverMenu')?.addEventListener('click', _onClickVolver, { signal });
    document.getElementById('chipAlergiasMenu')?.addEventListener('click', _onClickChipAlergias, { signal });
    document.getElementById('btnConfirmarOrden')?.addEventListener('click', _confirmarOrden, { signal });
    document.getElementById('btnCerrarOrden')?.addEventListener('click', _onClickCerrarOrden, { signal });

    ModalOpciones.activar();
    AlergiasCliente.activar();

    _cbProductosActualizada = () => {
      if (_vista?.classList.contains('active')) {
        _renderCategorias();
        _renderProductos();
      }
    };
    _cbMesasActualizada = () => {
      if (_vista?.classList.contains('active')) _verificarPermiso();
    };
    EventBus.on('productos:actualizada', _cbProductosActualizada);
    EventBus.on('mesas:actualizada', _cbMesasActualizada);

    _limpiarProductoAgregado = EventBus.on('cliente:producto_agregado_a_orden', () => {
      _actualizarContador();
      _renderizarItemsOrden();
    });

    _limpiarAlergiasActualizadas = EventBus.on('cliente:alergias_actualizadas', () => {
      _renderChipAlergias();
      _renderizarItemsOrden();
    });

    _renderChipAlergias();
  }

  function limpiar() {
    if (_abortControllerVista) { _abortControllerVista.abort(); _abortControllerVista = null; }
    if (_abortControllerItems) { _abortControllerItems.abort(); _abortControllerItems = null; }
    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }

    if (!_activada) return;
    _activada = false;

    if (typeof EventBus.off === 'function') {
      if (_cbProductosActualizada) EventBus.off('productos:actualizada', _cbProductosActualizada);
      if (_cbMesasActualizada) EventBus.off('mesas:actualizada', _cbMesasActualizada);
    }
    if (typeof _limpiarProductoAgregado === 'function') _limpiarProductoAgregado();
    if (typeof _limpiarAlergiasActualizadas === 'function') _limpiarAlergiasActualizadas();
    _limpiarProductoAgregado = null;
    _limpiarAlergiasActualizadas = null;
    _cbProductosActualizada = null;
    _cbMesasActualizada = null;

    ModalOpciones.limpiar();
    AlergiasCliente.limpiar();
  }

  function _renderizarItemsOrden() {
    if (_abortControllerItems) { _abortControllerItems.abort(); _abortControllerItems = null; }
    _abortControllerItems = new AbortController();
    const { signal } = _abortControllerItems;

    const container = document.getElementById('ordenItems');
    const totalEl = document.getElementById('ordenTotal');
    const items = Orden.obtenerItems();
    const total = Orden.obtenerTotal();

    if (totalEl) totalEl.textContent = formatearDinero(total);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = '<div class="orden-vacia"><i class="fas fa-inbox"></i><p>Tu orden está vacía</p></div>';
      _renderAvisoAlergiasOrden();
      return;
    }

    container.innerHTML = items.map(item => {
      const subopciones = (item.opciones || []).map(o => o.opcionNombre).join(' · ');
      const obs = item.obs || '';
      const lineas = [subopciones, obs].filter(Boolean);

      return `
        <div class="orden-item">
          <div class="orden-item-info">
            <div class="orden-item-nombre">${_esc(item.nombre)}</div>
            ${lineas.length ? `<div class="orden-item-subopciones">${_esc(lineas.join(' · '))}</div>` : ''}
            <div class="orden-item-precio">${formatearDinero(item.precio)} c/u</div>
            <div class="orden-item-cantidad">
              <button data-id="${item.prodId}" data-key="${item._key}" data-accion="restar">−</button>
              <span>${item.qty}</span>
              <button data-id="${item.prodId}" data-key="${item._key}" data-accion="sumar">+</button>
            </div>
            <div class="orden-item-obs"><input type="text" placeholder="Observación (ej: sin cebolla)" value="${_esc(obs)}" data-key="${item._key}" /></div>
          </div>
          <button class="btn-quitar-item" data-key="${item._key}" title="Quitar"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const item = items.find(i => i._key === key);
        if (!item) return;
        const nuevaCantidad = btn.dataset.accion === 'sumar' ? item.qty + 1 : item.qty - 1;
        Orden.modificarCantidad(key, nuevaCantidad);
        _renderizarItemsOrden();
        _actualizarContador();
      }, { signal });
    });

    container.querySelectorAll('.orden-item-obs input').forEach(input => {
      input.addEventListener('input', () => Orden.modificarObservacion(input.dataset.key, input.value), { signal });
    });

    container.querySelectorAll('.btn-quitar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        Orden.quitarItem(btn.dataset.key);
        _renderizarItemsOrden();
        _actualizarContador();
      }, { signal });
    });

    _renderAvisoAlergiasOrden();
  }

  function _renderAvisoAlergiasOrden() {
    const cont = document.getElementById('avisoAlergiasOrden');
    if (!cont) return;
    if (AlergiasCliente.cantidad() > 0) {
      cont.innerHTML = `
        <div class="aviso-alergias-orden">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Alergias declaradas: ${AlergiasCliente.obtener().map(a => AlergiasCliente.etiqueta(a)).join(', ')}</span>
        </div>
      `;
    } else {
      cont.innerHTML = '';
    }
  }

  function _actualizarContador() {
    const items = Orden.obtenerItems();
    const totalCantidad = items.reduce((sum, i) => sum + i.qty, 0);
    const contador = document.getElementById('contadorOrden');
    if (contador) contador.textContent = totalCantidad;
  }

  function _renderChipAlergias() {
    const chip = document.getElementById('chipAlergiasMenu');
    if (!chip) return;
    const n = AlergiasCliente.cantidad();
    if (n === 0) {
      chip.classList.remove('activo');
      chip.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Declarar alergias';
    } else {
      chip.classList.add('activo');
      chip.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${AlergiasCliente.obtener().map(a => AlergiasCliente.etiqueta(a)).join(', ')} · Editar`;
    }
  }

  function _mostrarBannerSinEspacio(mostrar) {
    const banner = document.getElementById('menuBannerSinEspacio');
    if (!banner) return;
    banner.style.display = mostrar ? 'flex' : 'none';
  }

  async function _confirmarOrden() {
    const state = Store.obtenerEstado();
    const permite = state.cliente?.permitePrepedidos || false;
    if (!permite) {
      mostrarToast('error', 'Tu mesa ya no admite pedidos. Contacta al garzón.');
      return;
    }

    const items = Orden.obtenerItems();
    if (!items.length) {
      mostrarToast('error', 'Agrega productos a tu orden antes de confirmar.');
      return;
    }

    const espacioIdRestaurante = obtenerEspacioRestaurante();
    if (!espacioIdRestaurante) {
      mostrarToast('error', 'Escanea el código QR del restaurante para hacer tu pedido.');
      _mostrarBannerSinEspacio(true);
      return;
    }

    let idUsuario;
    try {
      idUsuario = await Auth.obtenerIdUsuarioAppwrite();
    } catch (e) {
      Logger.error('[MenuDigital] Error al obtener ID de Appwrite:', e);
      idUsuario = null;
    }
    if (!idUsuario) {
      mostrarToast('error', 'No se pudo obtener tu sesión. Intenta de nuevo.');
      return;
    }

    const mesa = state.cliente?.mesa || 0;
    if (!mesa) {
      mostrarToast('error', 'No se pudo obtener el número de mesa.');
      return;
    }

    const nombreComensal = Auth.obtenerNombre() || 'comensal';

    const datosPrecarga = {
      mesa: String(mesa),
      tipo: 'local',
      origen: 'cliente',
      estado: 'precarga',
      comensales: 1,
      items: JSON.stringify(items),
      total: Orden.obtenerTotal(),
      observaciones: '',
      nombre_comensal: nombreComensal
    };

    if (typeof DBAppwrite.crearPrecargaCliente !== 'function') {
      Logger.error('[MenuDigital] DBAppwrite.crearPrecargaCliente no disponible.');
      mostrarToast('error', 'Servicio de precargas no disponible. Avisa al garzón.');
      return;
    }

    let resultado = null;
    try {
      resultado = await DBAppwrite.crearPrecargaCliente(datosPrecarga, espacioIdRestaurante);
    } catch (e) {
      Logger.error('[MenuDigital] Error al crear precarga:', e);
      const mensaje = _mensajeAmigableError(e);
      mostrarToast('error', mensaje);
      return;
    }

    if (!resultado) {
      Logger.error('[MenuDigital] crearPrecargaCliente devolvió null.');
      mostrarToast('error', 'No pudimos enviar tu pedido. Verifica que estés escaneando el código QR del restaurante.');
      _mostrarBannerSinEspacio(true);
      return;
    }

    const timestamp = Date.now();
    const payload = {
      id: resultado.id || ('ped_' + timestamp),
      mesa,
      items,
      clienteId: nombreComensal,
      id_usuario: idUsuario,
      nombre_comensal: nombreComensal,
      observaciones: '',
      timestamp
    };
    EventBus.emit('cliente:precarga_enviada', payload);

    Orden.vaciar();
    _actualizarContador();
    _panelOrden.classList.add('oculto');
    mostrarToast('success', '✅ ¡Orden enviada! El garzón la revisará pronto.');
  }

  function _mensajeAmigableError(e) {
    const tipo = e?.type || '';
    const codigo = e?.code || 0;
    if (tipo === 'general_unauthorized_scope' || codigo === 401 || codigo === 403) {
      return 'No pudimos enviar tu pedido. Verifica que estés escaneando el código QR del restaurante.';
    }
    if (tipo === 'general_rate_limit_exceeded' || codigo === 429) {
      return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
    }
    return 'Error de conexión. Revisa tu internet e intenta de nuevo.';
  }

  function mostrar() {
    activar();

    const viewMenu = document.getElementById('view-menu');
    if (viewMenu) viewMenu.classList.remove('active');

    _vista.classList.add('active');
    _actualizarEstado();
    _renderChipAlergias();
    _mostrarBannerSinEspacio(!obtenerEspacioRestaurante());
    _verificarPermiso();
    _renderCategorias();
    _renderProductos();
    _actualizarContador();
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    if (_panelOrden) _panelOrden.classList.add('oculto');
    limpiar();
  }

  function _actualizarEstado() {
    const nombre = Auth.obtenerNombre() || 'comensal';
    const state = Store.obtenerEstado();
    const mesa = state.cliente?.mesa || '?';
    const elCliente = document.getElementById('menuEstadoCliente');
    const elMesa = document.getElementById('menuEstadoMesa');
    if (elCliente) elCliente.textContent = `👤 ${nombre}`;
    if (elMesa) elMesa.textContent = `🪑 Mesa ${mesa}`;
  }

  function _verificarPermiso() {
    const state = Store.obtenerEstado();
    const permite = state.cliente?.permitePrepedidos || false;
    const banner = document.getElementById('menuBannerEspera');
    if (banner) banner.style.display = permite ? 'none' : 'flex';
    _renderProductos();
  }

  function _renderCategorias() {
    const container = document.getElementById('menuDigitalCategorias');
    if (!container) return;
    const productos = Store.obtenerEstado().productos || [];
    const categorias = ['Todas', ...new Set(productos.filter(p => p.activo !== false).map(p => p.categoria))].filter(Boolean);
    container.innerHTML = categorias.map(cat =>
      `<button class="menu-cat-btn ${cat === _categoriaActiva ? 'active' : ''}" data-categoria="${_esc(cat)}">${_esc(cat)}</button>`
    ).join('');

    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }
    _abortControllerGrilla = new AbortController();
    const { signal } = _abortControllerGrilla;

    container.querySelectorAll('.menu-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _categoriaActiva = btn.dataset.categoria;
        _renderCategorias();
        _renderProductos();
      }, { signal });
    });
  }

  function _resolverVariantesActivas(producto) {
    const variantesIds = _normalizarVariantesIds(producto.variantes_ids);
    if (variantesIds.length === 0) return [];
    const todasVariantes = Store.obtenerEstado().variantes || [];
    return variantesIds
      .map(id => todasVariantes.find(v => v.id === id))
      .filter(v => v && v.activo !== false)
      .map(v => ({
        ...v,
        opciones: (v.opciones || []).filter(o => o.activo !== false)
      }))
      .filter(v => v.opciones.length > 0);
  }

  function _renderProductos() {
    const grid = document.getElementById('menuDigitalGrid');
    if (!grid) return;

    const state = Store.obtenerEstado();
    const permite = state.cliente?.permitePrepedidos || false;

    let productos = (Store.obtenerEstado().productos || []).filter(p => p.activo !== false);
    if (_categoriaActiva !== 'Todas') productos = productos.filter(p => p.categoria === _categoriaActiva);
    if (_terminoBusqueda) {
      const term = _terminoBusqueda.toLowerCase();
      productos = productos.filter(p =>
        p.nombre.toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term)
      );
    }

    if (!productos.length) {
      grid.innerHTML = '<div class="menu-empty"><i class="fas fa-search"></i><p>No se encontraron productos</p></div>';
      return;
    }

    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    grid.innerHTML = productos.map(prod => {
      const disponible = prod.disponible !== false;
      const puedeAgregar = permite && disponible;
      const destinoValido = DESTINOS_VALIDOS.includes(prod.destino);
      const variantesActivas = _resolverVariantesActivas(prod);
      const tieneVariantes = variantesActivas.length > 0;
      const desc = prod.descripcion || 'Consulta a nuestro personal.';
      const alergenos = Array.isArray(prod.alergenos) ? prod.alergenos : [];
      const alergenosHTML = alergenos.length
        ? `<div class="menu-card-alergenos">⚠ Contiene: ${alergenos.map(a => _etiquetaAlergeno(a)).join(', ')}</div>`
        : '';

      const claseAtenuada = !destinoValido ? 'menu-card-atenuado' : '';

      return `
        <div class="menu-card ${!disponible ? 'menu-card-atenuado' : ''} ${claseAtenuada}">
          <div class="menu-card-img" style="background-color: ${obtenerColorDesdeNombre(prod.nombre)};">
            <span class="menu-card-inicial">${prod.nombre.charAt(0).toUpperCase()}</span>
            <span class="menu-card-precio">${formatearDinero(prod.precio)}</span>
            ${tieneVariantes ? '<span class="menu-card-badge">✦ Personalizable</span>' : ''}
          </div>
          <div class="menu-card-body">
            <h3>${_esc(prod.nombre)}</h3>
            <p>${_esc(desc.length > 60 ? desc.substring(0, 60) + '...' : desc)}</p>
            ${alergenosHTML}
            <button class="btn-agregar-orden ${!puedeAgregar ? 'btn-deshabilitado' : ''}" ${!puedeAgregar ? 'disabled' : ''}>🛒 Agregar a mi orden</button>
          </div>
        </div>
      `;
    }).join('');

    if (_abortControllerGrilla) { _abortControllerGrilla.abort(); _abortControllerGrilla = null; }
    _abortControllerGrilla = new AbortController();
    const { signal } = _abortControllerGrilla;

    grid.querySelectorAll('.menu-card').forEach((card, idx) => {
      const prod = productos[idx];
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-agregar-orden[disabled]')) return;
        _tocarProducto(prod);
      }, { signal });
    });
  }

  function _tocarProducto(prod) {
    const state = Store.obtenerEstado();
    const permite = state.cliente?.permitePrepedidos || false;
    if (!permite) {
      mostrarToast('error', 'Espera la activación del garzón.');
      return;
    }

    if (!DESTINOS_VALIDOS.includes(prod.destino)) {
      mostrarToast('error', 'Este producto no está disponible.');
      return;
    }

    const variantesActivas = _resolverVariantesActivas(prod);
    EventBus.emit('cliente:producto_con_variantes', {
      producto: prod,
      variantes: variantesActivas
    });
  }

  function _normalizarVariantesIds(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string') {
      try { const p = JSON.parse(valor); return Array.isArray(p) ? p : []; }
      catch { return []; }
    }
    return [];
  }

  function _etiquetaAlergeno(a) {
    const etiquetas = {
      mani:'Maní', gluten:'Gluten', lactosa:'Lactosa', mariscos:'Mariscos',
      huevo:'Huevo', soya:'Soya', frutos_secos:'Frutos secos',
      pescado:'Pescado', otro:'Otro'
    };
    return etiquetas[a] || a;
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { mostrar, ocultar };
})();

export { MenuDigital };