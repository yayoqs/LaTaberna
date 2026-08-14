/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/mesa-detalles.js
   Versión: 3.2.1
   Propósito: Centro de operaciones de mesa.
              v3.2.1: Deshacer Fusión es acción adicional en mesas
                      virtuales, manteniendo acciones operativas.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Mesas } from './mesas.js';
import { Cuenta } from './cuenta.js';
import { Cobro } from './cobro.js';
import { CommandBus } from '../lib/command-bus.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';
import { mostrarToast, mostrarConfirmacion } from '../utils.js';

const MesaDetalles = (() => {
  let _panelVisible = false;
  let _mesaActual = null;
  let _pedidoActual = null;
  let _columnaColapsada = false;
  let _comensalesApertura = 2;
  let _modoApertura = false;
  let _touchStartX = 0, _touchStartY = 0;

  function _obtenerPedidoDeMesa(mesa) {
    if (!mesa?.pedidoId) return null;
    const pedidos = Store.obtenerEstado().pedidos || [];
    return pedidos.find(p => p.id === mesa.pedidoId) || null;
  }

  function _onTouchStart(e) { _touchStartX = e.touches[0].clientX; _touchStartY = e.touches[0].clientY; }
  function _onTouchEnd(e) {
    const columna = document.getElementById('columnaIzquierda');
    if (!columna) return;
    const dx = e.changedTouches[0].clientX - _touchStartX;
    const dy = e.changedTouches[0].clientY - _touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      _columnaColapsada = dx < 0;
      columna.classList.toggle('colapsada', _columnaColapsada);
    }
  }

  function _asegurarModal() {
    if (document.getElementById('modalMesaDetalles')) return;
    const overlay = document.createElement('div');
    overlay.id = 'modalMesaDetalles';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="centro-card">
        <div class="centro-fondo"></div>
        <div class="centro-top">
          <div class="centro-mesa-info"><h2 id="mdTitulo">Mesa</h2><span class="badge-estado libre" id="mdEstado">LIBRE</span></div>
          <button class="btn-cerrar-modal" id="btnCerrarMesaDetalles"><i class="fas fa-times"></i></button>
        </div>
        <div class="centro-body" id="centroBody">
          <div class="columna-izquierda" id="columnaIzquierda">
            <div class="dato-item-sm"><div class="dato-icon"><i class="fas fa-user-tag"></i></div><div class="dato-cuerpo"><div class="dato-label">Mozo</div><div class="dato-valor" id="mdMozo">—</div></div></div>
            <div class="dato-item-sm"><div class="dato-icon"><i class="fas fa-clock"></i></div><div class="dato-cuerpo"><div class="dato-label">Tiempo</div><div class="dato-valor" id="mdTiempo">—</div></div></div>
            <div class="comensales-seccion"><div class="comensales-titulo">Comensales (<span id="mdComensales">0</span>)</div><div class="comensales-lista" id="comensalesGrid"></div></div>
          </div>
          <div class="columna-derecha" id="columnaDerecha">
            <div class="centro-datos" id="centroDatos"></div>
            <div class="pagada-mensaje" id="pagadaMensaje" style="display:none;"></div>
            <div class="seccion-atencion" id="seccionEspera" style="display:none;"></div>
            <div class="comanda-resumen" id="comandaResumen" style="display:none;"></div>
            <div id="precargasContainer"></div>
            <div class="apertura-form" id="aperturaForm" style="display:none;"></div>
            <div class="acciones-lista" id="accionesContainer"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('btnCerrarMesaDetalles').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    document.getElementById('columnaIzquierda').addEventListener('touchstart', _onTouchStart, { passive: true });
    document.getElementById('columnaIzquierda').addEventListener('touchend', _onTouchEnd, { passive: true });

    document.getElementById('columnaDerecha').addEventListener('click', (e) => {
      const actionCard = e.target.closest('.action-card');
      if (actionCard) {
        if (actionCard.classList.contains('virtual')) {
          deshacerFusion();
          return;
        }
        if (actionCard.classList.contains('primaria')) {
          if (_mesaActual?.estado === 'libre') activarModoApertura();
          else { cerrar(); EventBus.emit('mesa:tomar_pedido', { mesa: _mesaActual.numero }); }
        } else if (actionCard.classList.contains('verde')) pedirCuenta();
        else if (actionCard.classList.contains('roja')) cerrarMesa();
        return;
      }
      const btnAtender = e.target.closest('.btn-atender');
      if (btnAtender) {
        if (btnAtender.classList.contains('precarga')) cargarPrecarga(btnAtender.dataset.precargaId);
        else aceptarVinculacion(btnAtender.dataset.numMesa);
        return;
      }
      if (e.target.closest('#btnConfirmarApertura')) { confirmarApertura(); return; }
      if (e.target.closest('#btnCancelarApertura')) { cancelarApertura(); return; }
      if (e.target.closest('#btnMenosComensales')) { cambiarComensales(-1); return; }
      if (e.target.closest('#btnMasComensales')) { cambiarComensales(1); }
    });
  }

  function _mostrarSeccionEspera(infoAtencion, mesa) {
    const seccion = document.getElementById('seccionEspera');
    if (!seccion) return;

    if (infoAtencion?.tipo === 'esperando' && mesa.estado === 'libre') {
      seccion.style.display = 'flex';
      seccion.className = 'seccion-atencion';
      seccion.innerHTML = `
        <div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div>
        <div class="atencion-texto">
          <strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere unirse a la Mesa ${mesa.numero}
        </div>
        <button class="btn-atender" data-num-mesa="${mesa.numero}">Aceptar</button>
      `;
    } else if (infoAtencion?.tipo === 'precarga') {
      seccion.style.display = 'flex';
      seccion.className = 'seccion-atencion precarga';
      seccion.innerHTML = `
        <div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div>
        <div class="atencion-texto">
          <strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere añadir un pedido
        </div>
        <button class="btn-atender precarga" data-precarga-id="${infoAtencion.precargaId}">Cargar</button>
      `;
    } else {
      seccion.style.display = 'none';
    }
  }

  function _renderizarEstado(mesa) {
    _mesaActual = mesa;
    _pedidoActual = _obtenerPedidoDeMesa(mesa);
    const estado = mesa.estado;

    document.getElementById('mdTitulo').textContent = mesa.esVirtual ? `Mesas ${mesa.numero}` : `Mesa ${mesa.numero}`;
    const badge = document.getElementById('mdEstado');
    badge.textContent = Mesas.labelEstado(estado);
    badge.className = `badge-estado ${estado}`;

    const centroBody = document.getElementById('centroBody');
    centroBody.classList.remove('layout-simple');
    const columnaIzq = document.getElementById('columnaIzquierda');
    const datosContainer = document.getElementById('centroDatos');
    const comandaResumen = document.getElementById('comandaResumen');
    const pagadaMensaje = document.getElementById('pagadaMensaje');
    const aperturaForm = document.getElementById('aperturaForm');

    if (estado === 'ocupada' || estado === 'esperando' || estado === 'cuenta') {
      columnaIzq.style.display = 'flex';
      datosContainer.style.display = 'none';
      comandaResumen.style.display = 'block';
      pagadaMensaje.style.display = 'none';
      aperturaForm.style.display = 'none';

      document.getElementById('mdMozo').textContent = _pedidoActual?.mozo || '—';
      document.getElementById('mdTiempo').textContent = _pedidoActual?.creadoEn ? _tiempoDesde(_pedidoActual.creadoEn) : '—';
      document.getElementById('mdComensales').textContent = _pedidoActual?.comensales || 0;
      _renderizarComensales(_pedidoActual?.personas || []);
      _renderizarComanda();
    } else {
      centroBody.classList.add('layout-simple');
      columnaIzq.style.display = 'none';
      datosContainer.style.display = 'grid';
      comandaResumen.style.display = 'none';
      aperturaForm.style.display = 'none';
      datosContainer.innerHTML = _htmlDatosBasicos(mesa);

      if (estado === 'pagada') {
        pagadaMensaje.style.display = 'block';
        pagadaMensaje.innerHTML = `<i class="fas fa-check-circle"></i><p class="pagada-titulo">Mesa pagada</p><p class="pagada-sub">Esperando liberación por el cajero</p>`;
      } else {
        pagadaMensaje.style.display = 'none';
      }
    }

    const infoAtencion = Mesas.getBadgeAtencion(mesa.numero);
    _mostrarSeccionEspera(infoAtencion, mesa);

    _renderizarAcciones(estado);
    _modoApertura = false;
    _comensalesApertura = 2;
  }

  function _htmlDatosBasicos(mesa) {
    const mozo = _pedidoActual?.mozo || 'Sin asignar';
    const comensales = _pedidoActual?.comensales || '—';
    const zona = mesa.zona || 'Salón';
    let tiempo = '—';
    if (_pedidoActual?.creadoEn) tiempo = _tiempoDesde(_pedidoActual.creadoEn);
    return `
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-user-tag"></i></div><div class="dato-cuerpo"><div class="dato-label">Mozo</div><div class="dato-valor">${mozo}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-users"></i></div><div class="dato-cuerpo"><div class="dato-label">Comensales</div><div class="dato-valor">${comensales}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-map-marker-alt"></i></div><div class="dato-cuerpo"><div class="dato-label">Zona</div><div class="dato-valor">${zona}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-clock"></i></div><div class="dato-cuerpo"><div class="dato-label">Abierta hace</div><div class="dato-valor">${tiempo}</div></div></div>`;
  }

  function _renderizarComensales(personas) {
    const grid = document.getElementById('comensalesGrid');
    if (!grid) return;
    const lista = personas?.length ? personas : ['General'];
    grid.innerHTML = lista.map(nombre => {
      const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
      return `<div class="comensal-fila"><div class="comensal-avatar">${iniciales}</div><div class="comensal-nombre">${nombre}</div></div>`;
    }).join('');
  }

  function _renderizarComanda() {
    const container = document.getElementById('comandaResumen');
    if (!container || !_pedidoActual) return;
    const items = _pedidoActual.items || [];
    const total = items.reduce((sum, i) => sum + (i.precio || 0) * (i.qty || 1), 0);
    container.innerHTML = `
      <div class="resumen-titulo">Comanda activa</div>
      <div class="resumen-items">${items.map(i => `<div class="resumen-item"><span>${i.nombre} x${i.qty || 1}</span><span>$${((i.precio || 0) * (i.qty || 1)).toLocaleString()}</span></div>`).join('')}</div>
      <div class="resumen-total"><span>Total</span><span>$${total.toLocaleString()}</span></div>`;
    setTimeout(() => { container.scrollTop = container.scrollHeight - container.clientHeight; }, 0);
  }

  function _renderizarAcciones(estado) {
    const container = document.getElementById('accionesContainer');
    if (!container) return;

    let html = '';

    if (estado === 'pagada') {
      html = `<div class="action-card roja"><div class="action-icon"><i class="fas fa-door-open"></i></div><div class="action-details"><h4>Forzar Apertura</h4><p>La mesa está pagada pero no liberada.</p></div><div class="action-arrow"><i class="fas fa-angle-right"></i></div></div>`;
    } else if (estado === 'libre') {
      html = _modoApertura ? '' : `<div class="action-card primaria"><div class="action-icon"><i class="fas fa-door-open"></i></div><div class="action-details"><h4>Abrir Mesa</h4><p>Asignar mozo y comensales</p></div><div class="action-arrow"><i class="fas fa-angle-right"></i></div></div>`;
    } else {
      html = `<div class="action-card primaria"><div class="action-icon"><i class="fas fa-utensils"></i></div><div class="action-details"><h4>Tomar Pedido</h4><p>Agregar ítems a la comanda</p></div><div class="action-arrow"><i class="fas fa-angle-right"></i></div></div>
        <div class="action-card verde"><div class="action-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="action-details"><h4>Pedir Cuenta</h4><p>Generar pre-cuenta</p></div><div class="action-arrow"><i class="fas fa-angle-right"></i></div></div>
        <div class="action-card roja"><div class="action-icon"><i class="fas fa-check-circle"></i></div><div class="action-details"><h4>Cerrar Mesa</h4><p>Procesar pago y liberar</p></div><div class="action-arrow"><i class="fas fa-angle-right"></i></div></div>`;
    }

    // Si es mesa virtual, agregar acción Deshacer Fusión al final
    if (_mesaActual && _mesaActual.esVirtual) {
      html += `
        <div class="action-card virtual" style="margin-top:10px; border-color: rgba(139,92,246,.4); background: rgba(139,92,246,.06);">
          <div class="action-icon" style="color: #8b5cf6;"><i class="fas fa-link-slash"></i></div>
          <div class="action-details">
            <h4>Deshacer Fusión</h4>
            <p>Restaurar mesas originales y eliminar la mesa virtual</p>
          </div>
          <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
        </div>`;
    }

    container.innerHTML = html;
  }

  function activarModoApertura() {
    _modoApertura = true; _comensalesApertura = 2;
    document.getElementById('aperturaForm').style.display = 'flex';
    document.getElementById('aperturaForm').innerHTML = `
      <label>Cantidad de Comensales</label>
      <div class="selector-comensales"><button id="btnMenosComensales"><i class="fas fa-minus"></i></button><span class="cantidad" id="cantidadComensales">2</span><button id="btnMasComensales"><i class="fas fa-plus"></i></button></div>
      <div class="apertura-botones"><button class="btn-cancelar" id="btnCancelarApertura">Cancelar</button><button class="btn-confirmar" id="btnConfirmarApertura"><i class="fas fa-check-circle"></i> Confirmar y Abrir</button></div>`;
    _renderizarAcciones('libre');
  }
  function cambiarComensales(delta) { _comensalesApertura = Math.max(1, Math.min(20, _comensalesApertura + delta)); document.getElementById('cantidadComensales').textContent = _comensalesApertura; }
  function cancelarApertura() { _modoApertura = false; document.getElementById('aperturaForm').style.display = 'none'; _renderizarAcciones('libre'); }
  async function confirmarApertura() {
    if (!_mesaActual) return;
    const num = _mesaActual.numero;
    const mozo = document.getElementById('mozoActivo')?.value || 'Mozo';
    cancelarApertura();
    try {
      const resultado = await CommandBus.ejecutar({ type: 'crearPedidoMesa', datos: { numeroMesa: num, mozo, comensales: _comensalesApertura } });
      if (resultado.exito) {
        mostrarToast('success', `Mesa ${num} abierta`);
        const mesaActualizada = Store.obtenerEstado().mesas.find(m => m.numero == num);
        if (mesaActualizada) { _renderizarEstado(mesaActualizada); }
        EventBus.emit('mesa:tomar_pedido', { mesa: num });
      } else {
        mostrarToast('error', resultado.error || 'Error al abrir mesa');
      }
    } catch (e) {
      Logger.error('[MesaDetalles] Error al abrir mesa:', e);
      mostrarToast('error', 'Error inesperado al abrir mesa');
    }
  }

  function _tiempoDesde(ts) { const min = Math.floor((Date.now() - ts) / 60000); return min === 0 ? 'Ahora' : `Hace ${min} min`; }

  function abrir(numMesa) {
    _asegurarModal();
    const mesas = Store.obtenerEstado().mesas || [];
    const mesa = mesas.find(m => m.numero == numMesa);
    if (!mesa) { Logger.warn('[MesaDetalles] Mesa no encontrada:', numMesa); return; }
    _columnaColapsada = false; _modoApertura = false;
    _renderizarEstado(mesa);
    document.getElementById('modalMesaDetalles').style.display = 'flex';
    _panelVisible = true;
    EventBus.emit('mesa-detalle:abierto');
  }

  function cerrar() {
    document.getElementById('modalMesaDetalles').style.display = 'none';
    _panelVisible = false;
    EventBus.emit('mesa-detalle:cerrado');
  }

  function pedirCuenta() { cerrar(); Cuenta?.pedirCuenta(); }
  function cerrarMesa() { cerrar(); Cobro?.abrirModalCierre(); }

  async function aceptarVinculacion(numMesa) {
    const mesa = Store.obtenerEstado().mesas.find(m => m.numero == numMesa);
    if (!mesa) return;

    let pedidoId = null;
    try {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: { numeroMesa: numMesa, mozo: 'Mozo', comensales: 2 }
      });
      if (resultado.exito) {
        pedidoId = resultado.data.id;
      } else {
        mostrarToast('error', 'No se pudo abrir la mesa: ' + resultado.error);
        return;
      }
    } catch (e) {
      Logger.error('[MesaDetalles] Error al ejecutar crearPedidoMesa:', e);
      mostrarToast('error', 'Error inesperado al abrir la mesa.');
      return;
    }

    try {
      await DBAppwrite.actualizar('mesas', String(numMesa), { estado: 'ocupada', pedidoId });
    } catch (e) {
      Logger.error('[MesaDetalles] Error al actualizar Appwrite en vinculación:', e);
    }

    Store.despachar({ type: 'MESA_ACTUALIZAR', payload: { numero: numMesa, cambios: { estado: 'ocupada', pedidoId } } });
    Store.despachar({ type: 'CLIENTE_PERMISO_PREPEDIDOS', payload: true });
    EventBus.emit('mesas:actualizada', { numero: numMesa, estado: 'ocupada', permite_prepedidos: true });
    Mesas.clearBadgeAtencion(numMesa);
    EventBus.emit('mesa:tomar_pedido', { mesa: numMesa });

    _mesaActual = Store.obtenerEstado().mesas.find(m => m.numero == numMesa);
    if (_mesaActual) _renderizarEstado(_mesaActual);
  }

  function cargarPrecarga(precargaId) {
    EventBus.emit('precarga:cargar_en_comanda', { precargaId, mesa: _mesaActual?.numero });
    cerrar();
  }

  async function deshacerFusion() {
    if (!_mesaActual || !_mesaActual.esVirtual) return;

    const confirmado = await mostrarConfirmacion(
      'Deshacer Fusión',
      `¿Deseas deshacer la fusión de la mesa "${_mesaActual.numero}"?`,
      { textoConfirmar: 'Deshacer', textoCancelar: 'Cancelar' }
    );
    if (!confirmado) return;

    const originales = Array.isArray(_mesaActual.mesasFusionadas) ? _mesaActual.mesasFusionadas : [];
    let virtualRowId = _mesaActual._rowId;

    if (!virtualRowId && DBAppwrite && DBAppwrite.habilitado) {
      try {
        const mesasAppwrite = await DBAppwrite.listar('mesas');
        const virtualAppwrite = mesasAppwrite.find(m => m.numero === _mesaActual.numero);
        if (virtualAppwrite) virtualRowId = virtualAppwrite.id;
      } catch (e) {
        Logger.warn('[MesaDetalles] No se pudo obtener rowId de la virtual:', e);
      }
    }
    if (!virtualRowId) virtualRowId = _mesaActual.numero;

    try {
      DB.liberarMesasFusionadas(_mesaActual);

      if (DBAppwrite && DBAppwrite.habilitado) {
        for (const num of originales) {
          await DBAppwrite.actualizar('mesas', String(num), { estado: 'libre', pedidoId: '' })
            .catch(e => Logger.warn(`[MesaDetalles] Error al restaurar mesa ${num}:`, e));
        }
        await DBAppwrite.eliminar('mesas', String(virtualRowId))
          .catch(e => Logger.warn('[MesaDetalles] Error al eliminar mesa virtual:', e));
      }

      Store.despachar({ type: 'MESAS_INICIALIZAR', payload: DB.mesas });
      Mesas.render();
      cerrar();
      mostrarToast('success', 'Fusión deshecha correctamente');
    } catch (e) {
      Logger.error('[MesaDetalles] Error al deshacer fusión:', e);
      mostrarToast('error', 'No se pudo deshacer la fusión');
    }
  }

  EventBus.on('mesa:seleccionada', (numMesa) => { if (!_panelVisible) abrir(numMesa); });

  Logger.info('[MesaDetalles] Módulo inicializado v3.2.1.');

  return { abrir, cerrar, pedirCuenta, cerrarMesa, aceptarVinculacion, cargarPrecarga, deshacerFusion, _mesaActual: null };
})();

export { MesaDetalles };