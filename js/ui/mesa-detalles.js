/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/mesa-detalles.js
   Versión: 3.0.6
   Propósito: Centro de operaciones de mesa. Migración a Store como
              única fuente de verdad para lecturas de UI.
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
import { mostrarToast } from '../utils.js';

const MesaDetalles = (() => {

  let _panelVisible = false;
  let _mesaActual = null;
  let _columnaColapsada = false;
  let _comensalesApertura = 2;
  let _modoApertura = false;

  let _touchStartX = 0;
  let _touchStartY = 0;

  function _onTouchStart(e) {
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
  }

  function _onTouchEnd(e) {
    const columna = document.getElementById('columnaIzquierda');
    if (!columna) return;
    const deltaX = e.changedTouches[0].clientX - _touchStartX;
    const deltaY = e.changedTouches[0].clientY - _touchStartY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        _columnaColapsada = false;
      } else {
        _columnaColapsada = true;
      }
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
          <div class="centro-mesa-info">
            <h2 id="mdTitulo">Mesa</h2>
            <span class="badge-estado libre" id="mdEstado">LIBRE</span>
          </div>
          <button class="btn-cerrar-modal" id="btnCerrarMesaDetalles">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="centro-body" id="centroBody">
          <div class="columna-izquierda" id="columnaIzquierda">
            <div class="dato-item-sm"><div class="dato-icon"><i class="fas fa-user-tag"></i></div><div class="dato-cuerpo"><div class="dato-label">Mozo</div><div class="dato-valor" id="mdMozo">—</div></div></div>
            <div class="dato-item-sm"><div class="dato-icon"><i class="fas fa-clock"></i></div><div class="dato-cuerpo"><div class="dato-label">Tiempo</div><div class="dato-valor" id="mdTiempo">—</div></div></div>
            <div class="comensales-seccion">
              <div class="comensales-titulo">Comensales (<span id="mdComensales">0</span>)</div>
              <div class="comensales-lista" id="comensalesGrid"></div>
            </div>
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
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnCerrarMesaDetalles').addEventListener('click', cerrar);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) cerrar();
    });

    const columna = document.getElementById('columnaIzquierda');
    columna.addEventListener('touchstart', _onTouchStart, { passive: true });
    columna.addEventListener('touchend', _onTouchEnd, { passive: true });

    document.getElementById('columnaDerecha').addEventListener('click', function(e) {
      const actionCard = e.target.closest('.action-card');
      if (actionCard) {
        if (actionCard.classList.contains('primaria')) {
          if (_mesaActual && _mesaActual.estado === 'libre') {
            activarModoApertura();
          } else {
            cerrar();
            EventBus.emit('mesa:tomar_pedido', { mesa: _mesaActual.numero });
          }
        } else if (actionCard.classList.contains('verde')) {
          pedirCuenta();
        } else if (actionCard.classList.contains('roja')) {
          cerrarMesa();
        }
        return;
      }

      const btnAtender = e.target.closest('.btn-atender');
      if (btnAtender) {
        if (btnAtender.classList.contains('precarga')) {
          const precargaId = btnAtender.dataset.precargaId;
          if (precargaId) cargarPrecarga(precargaId);
        } else {
          const numMesa = btnAtender.dataset.numMesa;
          if (numMesa) aceptarVinculacion(numMesa);
        }
        return;
      }

      const btnApertura = e.target.closest('#btnConfirmarApertura');
      if (btnApertura) {
        confirmarApertura();
        return;
      }

      const btnCancelarApertura = e.target.closest('#btnCancelarApertura');
      if (btnCancelarApertura) {
        cancelarApertura();
        return;
      }

      const btnMenos = e.target.closest('#btnMenosComensales');
      if (btnMenos) {
        cambiarComensales(-1);
        return;
      }

      const btnMas = e.target.closest('#btnMasComensales');
      if (btnMas) {
        cambiarComensales(1);
        return;
      }
    });
  }

  function _renderizarEstado(mesa) {
    _mesaActual = mesa;
    const estado = mesa.estado;

    document.getElementById('mdTitulo').textContent = mesa.esVirtual ? `Mesas ${mesa.mesasFusionadas.join(' + ')}` : `Mesa ${mesa.numero}`;
    const badge = document.getElementById('mdEstado');
    badge.textContent = Mesas.labelEstado(estado);
    badge.className = `badge-estado ${estado}`;

    const centroBody = document.getElementById('centroBody');
    const columnaIzquierda = document.getElementById('columnaIzquierda');
    const datosContainer = document.getElementById('centroDatos');
    const comandaResumen = document.getElementById('comandaResumen');
    const pagadaMensaje = document.getElementById('pagadaMensaje');
    const seccionEspera = document.getElementById('seccionEspera');
    const aperturaForm = document.getElementById('aperturaForm');

    centroBody.classList.remove('layout-simple');

    if (estado === 'ocupada' || estado === 'esperando' || estado === 'cuenta') {
      centroBody.classList.remove('layout-simple');
      columnaIzquierda.style.display = 'flex';
      datosContainer.style.display = 'none';
      comandaResumen.style.display = 'block';
      pagadaMensaje.style.display = 'none';
      aperturaForm.style.display = 'none';

      document.getElementById('mdMozo').textContent = mesa.mozo || '—';
      document.getElementById('mdTiempo').textContent = mesa.abiertaEn ? _tiempoDesde(mesa.abiertaEn) : '—';
      document.getElementById('mdComensales').textContent = mesa.comensales || 0;
      _renderizarComensales(mesa.personas || []);
      _renderizarComanda(mesa);
    } else {
      centroBody.classList.add('layout-simple');
      columnaIzquierda.style.display = 'none';
      datosContainer.style.display = 'grid';
      comandaResumen.style.display = 'none';
      aperturaForm.style.display = 'none';

      datosContainer.innerHTML = _htmlDatosBasicos(mesa);

      if (estado === 'pagada') {
        pagadaMensaje.style.display = 'block';
        pagadaMensaje.innerHTML = `
          <i class="fas fa-check-circle"></i>
          <p class="pagada-titulo">Mesa pagada</p>
          <p class="pagada-sub">Esperando liberación por el cajero</p>
        `;
      } else {
        pagadaMensaje.style.display = 'none';
      }
    }

    const infoAtencion = Mesas.getBadgeAtencion(mesa.numero);
    if (infoAtencion && infoAtencion.tipo === 'esperando' && estado === 'libre') {
      seccionEspera.style.display = 'flex';
      seccionEspera.className = 'seccion-atencion';
      seccionEspera.innerHTML = `
        <div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div>
        <div class="atencion-texto">
          <strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere unirse a la Mesa ${mesa.numero}
        </div>
        <button class="btn-atender" data-num-mesa="${mesa.numero}">Aceptar</button>
      `;
    } else if (infoAtencion && infoAtencion.tipo === 'precarga') {
      seccionEspera.style.display = 'flex';
      seccionEspera.className = 'seccion-atencion precarga';
      seccionEspera.innerHTML = `
        <div class="atencion-avatar">${infoAtencion.iniciales || '?'}</div>
        <div class="atencion-texto">
          <strong>${infoAtencion.nombre || 'Cliente'}</strong><br>quiere añadir un pedido
        </div>
        <button class="btn-atender precarga" data-precarga-id="${infoAtencion.precargaId}">Cargar</button>
      `;
    } else {
      seccionEspera.style.display = 'none';
    }

    _renderizarAcciones(estado);

    _modoApertura = false;
    _comensalesApertura = 2;
  }

  function _htmlDatosBasicos(mesa) {
    const mozo = mesa.mozo || 'Sin asignar';
    const comensales = mesa.comensales || '—';
    const zona = mesa.zona || 'Salón';
    let tiempo = '—';
    if (mesa.abiertaEn) tiempo = _tiempoDesde(mesa.abiertaEn);
    return `
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-user-tag"></i></div><div class="dato-cuerpo"><div class="dato-label">Mozo</div><div class="dato-valor">${mozo}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-users"></i></div><div class="dato-cuerpo"><div class="dato-label">Comensales</div><div class="dato-valor">${comensales}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-map-marker-alt"></i></div><div class="dato-cuerpo"><div class="dato-label">Zona</div><div class="dato-valor">${zona}</div></div></div>
      <div class="dato-item"><div class="dato-icon"><i class="fas fa-clock"></i></div><div class="dato-cuerpo"><div class="dato-label">Abierta hace</div><div class="dato-valor">${tiempo}</div></div></div>
    `;
  }

  function _renderizarComensales(personas) {
    const grid = document.getElementById('comensalesGrid');
    if (!grid) return;
    const lista = personas && personas.length > 0 ? personas : ['General'];
    grid.innerHTML = lista.map(nombre => {
      const iniciales = nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
      return `<div class="comensal-fila"><div class="comensal-avatar">${iniciales}</div><div class="comensal-nombre">${nombre}</div></div>`;
    }).join('');
  }

  function _renderizarComanda(mesa) {
    const container = document.getElementById('comandaResumen');
    if (!container) return;
    const items = mesa.items || [];
    const total = items.reduce((sum, i) => sum + (i.precio || 0) * (i.qty || 1), 0);
    container.innerHTML = `
      <div class="resumen-titulo">Comanda activa</div>
      <div class="resumen-items">
        ${items.map(i => `<div class="resumen-item"><span>${i.nombre} x${i.qty}</span><span>$${(i.precio * i.qty).toLocaleString()}</span></div>`).join('')}
      </div>
      <div class="resumen-total"><span>Total</span><span>$${total.toLocaleString()}</span></div>
    `;
    setTimeout(() => {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }, 0);
  }

  function _renderizarAcciones(estado) {
    const container = document.getElementById('accionesContainer');
    if (!container) return;

    if (estado === 'pagada') {
      container.innerHTML = `
        <div class="action-card roja">
          <div class="action-icon"><i class="fas fa-door-open"></i></div>
          <div class="action-details"><h4>Forzar Apertura</h4><p>La mesa está pagada pero no liberada. Abrir de todos modos.</p></div>
          <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
        </div>`;
    } else if (estado === 'libre') {
      if (_modoApertura) {
        container.innerHTML = '';
      } else {
        container.innerHTML = `
          <div class="action-card primaria">
            <div class="action-icon"><i class="fas fa-door-open"></i></div>
            <div class="action-details"><h4>Abrir Mesa</h4><p>Asignar mozo y comensales</p></div>
            <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
          </div>`;
      }
    } else {
      container.innerHTML = `
        <div class="action-card primaria">
          <div class="action-icon"><i class="fas fa-utensils"></i></div>
          <div class="action-details"><h4>Tomar Pedido</h4><p>Agregar ítems a la comanda</p></div>
          <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
        </div>
        <div class="action-card verde">
          <div class="action-icon"><i class="fas fa-file-invoice-dollar"></i></div>
          <div class="action-details"><h4>Pedir Cuenta</h4><p>Generar pre-cuenta</p></div>
          <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
        </div>
        <div class="action-card roja">
          <div class="action-icon"><i class="fas fa-check-circle"></i></div>
          <div class="action-details"><h4>Cerrar Mesa</h4><p>Procesar pago y liberar</p></div>
          <div class="action-arrow"><i class="fas fa-angle-right"></i></div>
        </div>`;
    }
  }

  function activarModoApertura() {
    _modoApertura = true;
    _comensalesApertura = 2;
    const form = document.getElementById('aperturaForm');
    form.style.display = 'flex';
    form.innerHTML = `
      <label>Cantidad de Comensales</label>
      <div class="selector-comensales">
        <button id="btnMenosComensales"><i class="fas fa-minus"></i></button>
        <span class="cantidad" id="cantidadComensales">2</span>
        <button id="btnMasComensales"><i class="fas fa-plus"></i></button>
      </div>
      <div class="apertura-botones">
        <button class="btn-cancelar" id="btnCancelarApertura">Cancelar</button>
        <button class="btn-confirmar" id="btnConfirmarApertura"><i class="fas fa-check-circle"></i> Confirmar y Abrir</button>
      </div>
    `;
    _renderizarAcciones('libre');
  }

  function cambiarComensales(delta) {
    _comensalesApertura = Math.max(1, Math.min(20, _comensalesApertura + delta));
    document.getElementById('cantidadComensales').textContent = _comensalesApertura;
  }

  function cancelarApertura() {
    _modoApertura = false;
    document.getElementById('aperturaForm').style.display = 'none';
    _renderizarAcciones('libre');
  }

  async function confirmarApertura() {
    if (!_mesaActual) return;
    const num = _mesaActual.numero;
    const comensales = _comensalesApertura;
    const mozo = document.getElementById('mozoActivo')?.value || 'Mozo';
    cancelarApertura();

    try {
      const resultado = await CommandBus.ejecutar({
        type: 'crearPedidoMesa',
        datos: {
          numeroMesa: num,
          mozo: mozo,
          comensales: comensales
        }
      });
      if (resultado.exito) {
        mostrarToast('success', `Mesa ${num} abierta`);
        const mesas = Store.obtenerEstado().mesas;
        const mesaActualizada = mesas.find(m => m.numero == num);
        if (mesaActualizada) {
          _renderizarEstado(mesaActualizada);
        }
        EventBus.emit('mesa:tomar_pedido', { mesa: num });
      } else {
        mostrarToast('error', resultado.error || 'Error al abrir mesa');
      }
    } catch (e) {
      Logger.error('[MesaDetalles] Error al abrir mesa:', e);
      mostrarToast('error', 'Error inesperado al abrir mesa');
    }
  }

  function _tiempoDesde(ts) {
    const min = Math.floor((Date.now() - ts) / 60000);
    return min === 0 ? 'Ahora' : `Hace ${min} min`;
  }

  function abrir(numMesa) {
    _asegurarModal();
    const mesas = Store.obtenerEstado().mesas || [];
    const mesa = mesas.find(m => m.numero == numMesa);
    if (!mesa) { Logger.warn('[MesaDetalles] Mesa no encontrada:', numMesa); return; }

    _columnaColapsada = false;
    _modoApertura = false;
    _renderizarEstado(mesa);

    document.getElementById('modalMesaDetalles').style.display = 'flex';
    _panelVisible = true;
    EventBus.emit('mesa-detalle:abierto');
  }

  function cerrar() {
    const overlay = document.getElementById('modalMesaDetalles');
    if (overlay) overlay.style.display = 'none';
    _panelVisible = false;
    EventBus.emit('mesa-detalle:cerrado');
  }

  function pedirCuenta() { cerrar(); if (Cuenta && Cuenta.pedirCuenta) Cuenta.pedirCuenta(); }
  function cerrarMesa() { cerrar(); if (Cobro && Cobro.abrirModalCierre) Cobro.abrirModalCierre(); }

  function aceptarVinculacion(numMesa) {
    // 1. Leer mesa actual desde el Store (fuente de verdad para UI)
    const mesas = Store.obtenerEstado().mesas || [];
    const mesa = mesas.find(m => m.numero == numMesa);
    if (!mesa) return;

    // 2. Persistir en DB (repositorio)
    const mesaDB = DB.mesas.find(m => m.numero == numMesa);
    if (mesaDB) {
      mesaDB.estado = 'ocupada';
      mesaDB.permite_prepedidos = true;
      try {
        DB.saveMesas();
      } catch (e) {
        Logger.error('[MesaDetalles] Error al persistir vinculación:', e);
      }
    }

    // 3. Despachar al Store para mantener coherencia
    Store.despachar({
      type: 'MESA_ACTUALIZAR',
      payload: {
        numero: numMesa,
        cambios: { estado: 'ocupada', permite_prepedidos: true }
      }
    });

    // 4. Emitir evento para el cliente (Célula C)
    EventBus.emit('mesas:actualizada', {
      numero: numMesa,
      estado: 'ocupada',
      permite_prepedidos: true
    });

    // 5. Limpiar badge
    Mesas.clearBadgeAtencion(numMesa);

    // 6. Refrescar panel con la mesa actualizada desde el Store
    _mesaActual = Store.obtenerEstado().mesas.find(m => m.numero == numMesa) || _mesaActual;
    if (_mesaActual) {
      _renderizarEstado(_mesaActual);
    }
  }

  function cargarPrecarga(precargaId) {
    EventBus.emit('precarga:cargar_en_comanda', {
      precargaId,
      mesa: _mesaActual ? _mesaActual.numero : null
    });
    cerrar();
  }

  EventBus.on('mesa:seleccionada', (numMesa) => {
    if (_panelVisible) return;
    abrir(numMesa);
  });

  Logger.info('[MesaDetalles] Módulo inicializado (ES6 v3.0.6).');

  return {
    abrir,
    cerrar,
    pedirCuenta,
    cerrarMesa,
    aceptarVinculacion,
    cargarPrecarga,
    _mesaActual: null
  };
})();

export { MesaDetalles };