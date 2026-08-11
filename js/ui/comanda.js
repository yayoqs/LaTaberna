/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/comanda.js
   Versión: 2.1.5
   Propósito: Gestión de la comanda actual.
              Corregido: normalización de items en agregarItem
              para evitar error con .find() cuando items es string.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { formatearDinero, mostrarToast, mostrarEntrada } from '../utils.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';

const Comanda = (() => {
  let _mesaActiva = null;
  let _pedidoActivo = null;
  let _inicializado = false;

  function _obtenerPedidoActivo(mesa) {
    if (!mesa || !mesa.pedidoId) return null;
    const pedidos = Store.obtenerEstado().pedidos || [];
    return pedidos.find(p => p.id === mesa.pedidoId) || null;
  }

  function _syncPedidoADB(pedido) {
    if (!pedido) return;
    try {
      const idx = DB.pedidos.findIndex(p => p.id === pedido.id);
      if (idx >= 0) {
        DB.pedidos[idx] = pedido;
        if (typeof DB.savePedidos === 'function') {
          DB.savePedidos();
        }
        Logger.debug('[Comanda] Pedido sincronizado a DB:', pedido.id);
      }
    } catch (e) {
      Logger.error('[Comanda] Error al sincronizar pedido con DB:', e);
    }
  }

  function _inicializarSincroniaStore() {
    try {
      Store.suscribir((state, action) => {
        if (!action || !action.type) return;
        if (!['COMANDA_ITEM_AGREGAR', 'COMANDA_ITEM_CAMBIAR', 'COMANDA_ITEM_QUITAR'].includes(action.type)) return;
        if (!_mesaActiva || !_pedidoActivo) return;

        const pedidoStore = (state.pedidos || []).find(p => p.id === _pedidoActivo.id);
        if (!pedidoStore) return;

        _syncPedidoADB(pedidoStore);
        _pedidoActivo = pedidoStore;
        EventBus.emit('mesa:actualizada', { mesa: _mesaActiva.numero, estado: _mesaActiva.estado });
        EventBus.emit('comanda:total_actualizado', {
          mesa: _mesaActiva.numero,
          total: pedidoStore.total || 0
        });
        _render();
      });
    } catch (e) {
      Logger.error('[Comanda] Error al inicializar sincronía del Store:', e);
    }
  }

  function activar() {
    if (_inicializado) return;
    _inicializado = true;
    _inicializarSincroniaStore();
    _inicializarEscuchadores();
    Logger.info('[Comanda] Módulo activado (v2.1.5).');
  }

  function establecerMesaActiva(mesa) {
    _mesaActiva = mesa;
    _pedidoActivo = _obtenerPedidoActivo(mesa);
    _render();
    _sincronizarCamposHeader();
  }

  function _sincronizarCamposHeader() {
    if (!_mesaActiva || !_pedidoActivo) return;
    const selMozo = document.getElementById('comandaMozo');
    const inpComensales = document.getElementById('comandaComensales');
    const inpObs = document.getElementById('comandaObs');

    if (selMozo) {
      let opcionesHTML = '';
      const mozos = Store.obtenerEstado().mozos || [];
      if (mozos.length) {
        opcionesHTML = mozos.map(m => {
          const nombre = m.nombre || m;
          const activo = m.activo !== false;
          if (!activo) return '';
          return `<option value="${nombre}" ${nombre === _pedidoActivo.mozo ? 'selected' : ''}>${nombre}</option>`;
        }).join('');
      }
      selMozo.innerHTML = opcionesHTML;
    }
    if (inpComensales) inpComensales.value = _pedidoActivo.comensales || 1;
    if (inpObs) inpObs.value = _pedidoActivo.observaciones || '';

    _renderSelectorPersona();
  }

  function _renderSelectorPersona() {
    const container = document.getElementById('personaActivaContainer');
    if (!container) return;
    const personas = _pedidoActivo?.personas || _mesaActiva.personas || [];
    if (personas.length === 0) {
      if (_pedidoActivo) _pedidoActivo.personas = ['General'];
    }
    const personaActual = _pedidoActivo?.personaActiva || 'General';
    const opciones = personas.map(p => `<option value="${p}" ${p === personaActual ? 'selected' : ''}>${p}</option>`).join('');
    container.innerHTML = `
      <i class="fas fa-user"></i>
      <select id="personaActivaSelect">
        ${opciones}
      </select>
      <button class="btn-icon-sm" id="btnAgregarPersona" title="Agregar persona"><i class="fas fa-plus"></i></button>
    `;

    document.getElementById('personaActivaSelect').addEventListener('change', function() {
      establecerPersonaActiva(this.value);
    });
    document.getElementById('btnAgregarPersona').addEventListener('click', agregarPersona);
  }

  function establecerPersonaActiva(nombre) {
    if (_pedidoActivo) {
      _pedidoActivo.personaActiva = nombre;
    }
  }

  async function agregarPersona() {
    try {
      const nombre = await mostrarEntrada('Agregar persona', 'Nombre de la persona:', { placeholder: 'Ej: Juan' });
      if (!nombre) return;
      if (!_pedidoActivo) return;
      if (!_pedidoActivo.personas) _pedidoActivo.personas = [];
      if (!_pedidoActivo.personas.includes(nombre)) {
        _pedidoActivo.personas.push(nombre);
      }
      _pedidoActivo.personaActiva = nombre;
      _renderSelectorPersona();
    } catch (e) {
      Logger.error('[Comanda] Error al agregar persona:', e);
    }
  }

  function agregarItem(producto) {
    if (!_pedidoActivo) return;
    const persona = _pedidoActivo.personaActiva || 'General';
    const item = {
      prodId: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      categoria: producto.categoria,
      destino: producto.destino,
      persona: persona,
      obs: '',
      enviado: false,
      enviadoA: null,
      enviadoTs: null
    };

    // 1) Persistir en DB.pedidos local
    const pedidoLocal = DB.pedidos.find(p => p.id === _pedidoActivo.id);
    if (pedidoLocal) {
      // Normalizar items: si es string, parsearlo; si no es array, inicializarlo
      if (typeof pedidoLocal.items === 'string') {
        try {
          pedidoLocal.items = JSON.parse(pedidoLocal.items);
        } catch (e) {
          pedidoLocal.items = [];
        }
      }
      if (!Array.isArray(pedidoLocal.items)) {
        pedidoLocal.items = [];
      }
      
      const existente = pedidoLocal.items.find(it => it.prodId === item.prodId && !it.enviado);
      if (existente) existente.qty = (existente.qty || 1) + 1;
      else pedidoLocal.items.push({ ...item, qty: 1 });
    }

    // 2) Despachar al Store (para listeners)
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_AGREGAR',
        payload: { pedidoId: _pedidoActivo.id, item }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al agregar ítem:', e);
    }
  }

  function cambiarCantidad(idx, delta) {
    if (!_pedidoActivo) return;
    const item = _pedidoActivo.items?.[idx];
    if (!item) return;
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      mostrarToast('error', 'No tienes permiso para modificar ítems ya enviados');
      return;
    }
    const nuevaCantidad = Math.max(1, (item.qty || 1) + delta);
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_CAMBIAR',
        payload: { pedidoId: _pedidoActivo.id, index: idx, cambios: { qty: nuevaCantidad } }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al cambiar cantidad:', e);
    }
  }

  function establecerObservacion(idx, valor) {
    if (!_pedidoActivo?.items?.[idx]) return;
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_CAMBIAR',
        payload: { pedidoId: _pedidoActivo.id, index: idx, cambios: { obs: valor } }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al establecer observación:', e);
    }
  }

  function quitarItem(idx) {
    if (!_pedidoActivo) return;
    const item = _pedidoActivo.items?.[idx];
    if (item?.enviado && !Auth.puede('eliminarItemEnviado')) {
      mostrarToast('error', 'Solo administrador puede eliminar ítems enviados');
      return;
    }
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_QUITAR',
        payload: { pedidoId: _pedidoActivo.id, index: idx }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al quitar ítem:', e);
    }
  }

  function establecerMozo(mozo) {
    if (_pedidoActivo) {
      _pedidoActivo.mozo = mozo;
      _syncPedidoADB(_pedidoActivo);
    }
  }

  function establecerComensales(cant) {
    if (_pedidoActivo) {
      _pedidoActivo.comensales = parseInt(cant) || 1;
      _syncPedidoADB(_pedidoActivo);
    }
  }

  function establecerObservacionGeneral(obs) {
    if (_pedidoActivo) {
      _pedidoActivo.observaciones = obs;
    }
  }

  function render() { _render(); }

  function _render() {
    const contenedor = document.getElementById('comandaItems');
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (!contenedor || !_pedidoActivo) return;

    const state = Store.obtenerEstado();
    const pedidoStore = (state.pedidos || []).find(p => p.id === _pedidoActivo.id);
    const items = pedidoStore?.items || _pedidoActivo.items || [];

    if (!items.length) {
      contenedor.innerHTML = `<div class="comanda-vacia"><i class="fas fa-utensils"></i><p>La comanda está vacía</p></div>`;
      if (subtotalEl) subtotalEl.textContent = '$0';
      return;
    }

    contenedor.innerHTML = items.map((item, idx) => _htmlItem(item, idx)).join('');
    if (subtotalEl) subtotalEl.textContent = formatearDinero(pedidoStore?.total || _pedidoActivo.total || 0);
    _renderSelectorPersona();

    contenedor.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => cambiarCantidad(parseInt(btn.dataset.idx), parseInt(btn.dataset.delta)));
    });
    contenedor.querySelectorAll('.item-obs-input').forEach(input => {
      input.addEventListener('input', () => establecerObservacion(parseInt(input.dataset.idx), input.value));
    });
    contenedor.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', () => quitarItem(parseInt(btn.dataset.idx)));
    });
  }

  function _htmlItem(item, idx) {
    const enviado = item.enviado;
    const disabledAttr = enviado ? 'disabled' : '';
    const personaBadge = item.persona ? `<span class="item-persona-badge"><i class="fas fa-user"></i> ${item.persona}</span>` : '';
    return `
      <div class="comanda-item${enviado ? ' enviado' : ''}">
        <div class="item-qty-controls">
          <button class="qty-btn" data-idx="${idx}" data-delta="-1" ${disabledAttr}>−</button>
          <span class="item-qty">${item.qty || 1}</span>
          <button class="qty-btn" data-idx="${idx}" data-delta="1" ${disabledAttr}>+</button>
        </div>
        <div class="item-info">
          <div class="item-nombre">${item.nombre} ${personaBadge}</div>
          <input class="item-obs-input" data-idx="${idx}" placeholder="Aclaración..." value="${item.obs || ''}" ${disabledAttr}>
        </div>
        <span class="item-precio">${formatearDinero((item.precio || 0) * (item.qty || 1))}</span>
        <button class="item-remove" data-idx="${idx}"><i class="fas fa-times"></i></button>
      </div>`;
  }

  function _inicializarEscuchadores() {
    EventBus.on('producto:seleccionado', agregarItem);
    EventBus.on('mesa:abierta', establecerMesaActiva);

    EventBus.on('precarga:items_listos', (payload) => {
      try {
        const mesaActiva = Comanda.obtenerMesaActiva();
        if (!mesaActiva || mesaActiva.numero !== payload.mesa) {
          mostrarToast('warning', 'Abrí la mesa antes de cargar la precarga.');
          return;
        }
        payload.items.forEach(item => {
          const producto = {
            id: item.prodId,
            nombre: item.nombre,
            precio: item.precio,
            categoria: item.categoria,
            destino: item.destino
          };
          for (let i = 0; i < (item.qty || 1); i++) {
            Comanda.agregarItem(producto);
          }
        });
        EventBus.emit('mesas:limpiar_badge', { mesa: payload.mesa });
      } catch (e) {
        Logger.error('[Comanda] Error al procesar precarga:', e);
        mostrarToast('error', 'Error al cargar la precarga.');
      }
    });
  }

  return {
    activar,
    establecerMesaActiva,
    establecerMozo,
    establecerComensales,
    establecerObservacionGeneral,
    establecerPersonaActiva,
    agregarPersona,
    agregarItem,
    cambiarCantidad,
    establecerObservacion,
    quitarItem,
    render,
    obtenerMesaActiva: () => _mesaActiva,
    obtenerPedidoActivo: () => _pedidoActivo
  };
})();

export { Comanda };