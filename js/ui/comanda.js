/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/comanda.js
   Versión: 2.0.9
   Propósito: Gestión de la comanda actual.
              Migración a Store como fuente de verdad para UI.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { formatearDinero, mostrarToast, mostrarEntrada } from '../utils.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';

const Comanda = (() => {
  let _mesaActiva = null;

  function _mesasIguales(a, b) {
    if (!a || !b) return a === b;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (key === 'personaActiva') continue;
      const va = a[key];
      const vb = b[key];
      if (va !== vb) {
        if (typeof va === 'object' && typeof vb === 'object') {
          if (JSON.stringify(va) !== JSON.stringify(vb)) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  }

  function _syncMesaStoreADB(mesaActualizada) {
    if (!mesaActualizada) return;
    try {
      const idx = DB.mesas.findIndex(m => m.numero == mesaActualizada.numero);
      if (idx >= 0) {
        if (!_mesasIguales(DB.mesas[idx], mesaActualizada)) {
          DB.mesas[idx] = mesaActualizada;
          if (typeof DB.saveMesas === 'function') {
            DB.saveMesas();
          }
          Logger.debug('[Comanda] Mesa sincronizada a DB:', mesaActualizada.numero);
        }
      }
    } catch (e) {
      Logger.error('[Comanda] Error al sincronizar mesa con DB:', e);
    }
  }

  function _inicializarSincroniaStore() {
    try {
      Store.suscribir((state, action) => {
        if (!action || !action.type) return;
        if (!['COMANDA_ITEM_AGREGAR', 'COMANDA_ITEM_CAMBIAR', 'COMANDA_ITEM_QUITAR'].includes(action.type)) return;
        if (!_mesaActiva) return;

        const mesaStore = state.mesas.find(m => m.numero == _mesaActiva.numero);
        if (!mesaStore) return;

        _syncMesaStoreADB(mesaStore);
        _mesaActiva = mesaStore;
        EventBus.emit('mesa:actualizada', { mesa: _mesaActiva.numero, estado: _mesaActiva.estado });
        EventBus.emit('comanda:total_actualizado', {
          mesa: _mesaActiva.numero,
          total: mesaStore.total || _mesaActiva.total || 0
        });
        _render();
      });
    } catch (e) {
      Logger.error('[Comanda] Error al inicializar sincronía del Store:', e);
    }
  }

  _inicializarSincroniaStore();

  function establecerMesaActiva(mesa) {
    _mesaActiva = mesa;
    _render();
    _sincronizarCamposHeader();
  }

  function _sincronizarCamposHeader() {
    if (!_mesaActiva) return;
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
          return `<option value="${nombre}" ${nombre === _mesaActiva.mozo ? 'selected' : ''}>${nombre}</option>`;
        }).join('');
      }
      selMozo.innerHTML = opcionesHTML;
    }
    if (inpComensales) inpComensales.value = _mesaActiva.comensales || 1;
    if (inpObs) inpObs.value = _mesaActiva.observaciones || '';

    _renderSelectorPersona();
  }

  function _renderSelectorPersona() {
    const container = document.getElementById('personaActivaContainer');
    if (!container) return;
    const personas = _mesaActiva.personas || [];
    if (personas.length === 0) {
      _mesaActiva.personas = ['General'];
    }
    const personaActual = _mesaActiva.personaActiva || 'General';
    const opciones = _mesaActiva.personas.map(p => `<option value="${p}" ${p === personaActual ? 'selected' : ''}>${p}</option>`).join('');
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
    if (_mesaActiva) {
      _mesaActiva.personaActiva = nombre;
    }
  }

  async function agregarPersona() {
    try {
      const nombre = await mostrarEntrada(
        'Agregar persona',
        'Nombre de la persona:',
        { placeholder: 'Ej: Juan' }
      );
      if (!nombre) return;
      if (!_mesaActiva.personas) _mesaActiva.personas = [];
      if (!_mesaActiva.personas.includes(nombre)) {
        _mesaActiva.personas.push(nombre);
      }
      _mesaActiva.personaActiva = nombre;
      _renderSelectorPersona();
    } catch (e) {
      Logger.error('[Comanda] Error al agregar persona:', e);
    }
  }

  function agregarItem(producto) {
    if (!_mesaActiva) return;
    const persona = _mesaActiva.personaActiva || 'General';
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

    try {
      Store.despachar({
        type: 'COMANDA_ITEM_AGREGAR',
        payload: { numeroMesa: _mesaActiva.numero, item }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al agregar ítem a la comanda:', e);
    }
  }

  function cambiarCantidad(idx, delta) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (!item) return;
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      mostrarToast('error', 'No tienes permiso para modificar ítems ya enviados');
      return;
    }
    const nuevaCantidad = Math.max(1, item.qty + delta);
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_CAMBIAR',
        payload: { numeroMesa: _mesaActiva.numero, index: idx, cambios: { qty: nuevaCantidad } }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al cambiar cantidad del ítem:', e);
    }
  }

  function establecerObservacion(idx, valor) {
    if (_mesaActiva?.items[idx]) {
      try {
        Store.despachar({
          type: 'COMANDA_ITEM_CAMBIAR',
          payload: { numeroMesa: _mesaActiva.numero, index: idx, cambios: { obs: valor } }
        });
      } catch (e) {
        Logger.error('[Comanda] Error al establecer observación del ítem:', e);
      }
    }
  }

  function quitarItem(idx) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      mostrarToast('error', 'Solo administrador puede eliminar ítems enviados');
      return;
    }
    try {
      Store.despachar({
        type: 'COMANDA_ITEM_QUITAR',
        payload: { numeroMesa: _mesaActiva.numero, index: idx }
      });
    } catch (e) {
      Logger.error('[Comanda] Error al quitar ítem de la comanda:', e);
    }
  }

  function establecerMozo(mozo) {
    if (_mesaActiva) {
      _mesaActiva.mozo = mozo;
      try {
        DB.saveMesas();
      } catch (e) {
        Logger.error('[Comanda] Error al guardar mozo en DB:', e);
      }
    }
  }

  function establecerComensales(cant) {
    if (_mesaActiva) {
      _mesaActiva.comensales = parseInt(cant) || 1;
      try {
        DB.saveMesas();
      } catch (e) {
        Logger.error('[Comanda] Error al guardar comensales en DB:', e);
      }
    }
  }

  function establecerObservacionGeneral(obs) {
    if (_mesaActiva) {
      _mesaActiva.observaciones = obs;
    }
  }

  function render() {
    _render();
  }

  function _render() {
    const contenedor = document.getElementById('comandaItems');
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (!contenedor || !_mesaActiva) return;

    const state = Store.obtenerEstado();
    const mesaDelStore = state.mesas.find(m => m.numero == _mesaActiva.numero);
    const items = mesaDelStore ? mesaDelStore.items : _mesaActiva.items;

    if (!items.length) {
      contenedor.innerHTML = `
        <div class="comanda-vacia">
          <i class="fas fa-utensils"></i>
          <p>La comanda está vacía</p>
          <p style="font-size:11px">Tocá un producto para agregar</p>
        </div>`;
      if (subtotalEl) subtotalEl.textContent = '$0';
      return;
    }

    contenedor.innerHTML = items.map((item, idx) => _htmlItem(item, idx)).join('');
    if (subtotalEl) subtotalEl.textContent = formatearDinero(mesaDelStore?.total || _mesaActiva.total || 0);
    _renderSelectorPersona();

    contenedor.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = parseInt(this.dataset.idx);
        const delta = parseInt(this.dataset.delta);
        if (!isNaN(idx) && !isNaN(delta)) cambiarCantidad(idx, delta);
      });
    });

    contenedor.querySelectorAll('.item-obs-input').forEach(input => {
      input.addEventListener('input', function() {
        const idx = parseInt(this.dataset.idx);
        if (!isNaN(idx)) establecerObservacion(idx, this.value);
      });
    });

    contenedor.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = parseInt(this.dataset.idx);
        if (!isNaN(idx)) quitarItem(idx);
      });
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
          <span class="item-qty">${item.qty}</span>
          <button class="qty-btn" data-idx="${idx}" data-delta="1" ${disabledAttr}>+</button>
        </div>
        <div class="item-info">
          <div class="item-nombre">${item.nombre} ${personaBadge}</div>
          <input class="item-obs-input" data-idx="${idx}" placeholder="Aclaración..." value="${item.obs || ''}" ${disabledAttr}>
        </div>
        <span class="item-precio">${formatearDinero(item.precio * item.qty)}</span>
        <button class="item-remove" data-idx="${idx}">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  }

  function _inicializarEscuchadores() {
    EventBus.on('producto:seleccionado', agregarItem);
    EventBus.on('mesa:abierta', establecerMesaActiva);

    EventBus.on('precarga:items_listos', (payload) => {
      try {
        const mesaActiva = Comanda.getMesaActiva();
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

  _inicializarEscuchadores();

  return {
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
    getMesaActiva: () => _mesaActiva
  };
})();

export { Comanda };