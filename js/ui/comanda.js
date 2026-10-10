/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/comanda.js
   Versión: 2.4.0
   Propósito: Gestión de la comanda actual.

   v2.4.0: Guard defensivo en el path de item completo.
             · Si un item llega sin `destino` válido, se le asigna
               `'ambos'` (fallback seguro) y se loguea WARN. Sin
               esto, el handler `enviarComanda` de Célula A aborta
               el envío entero con "Los ítems no tienen un destino
               válido".
             · Idem para `categoria` (default 'Sin categoría').
             · El fix de raíz vive en `modal-opciones.js` v1.2.0
               (el modal copia `categoria` y `destino` del producto).
               Este guard es la red de seguridad para futuros
               consumidores (precargas, delivery, importaciones).

   v2.3.0: Paquete 4 (B1.3) — Soporte de items con opciones.
             · agregarItem(item): si el objeto trae `opciones`
               y/o `precio_unitario`, se trata como item completo
               (viene del modal de opciones) y se preserva la
               estructura. Si no, flujo clásico intacto.
             · _htmlItem: subtexto con opciones agrupadas por
               variante, badge de alergias manuales, badge de
               impacto KDS (insumos_delta/pasos_delta).
             · Handler de precarga preserva items con opciones.
             · Se guarda `precio = precio_unitario` para
               compatibilidad con el reducer de Store v2.0.13 que
               suma `it.precio * it.qty`.

   v2.2.0: Rename COMANDA_ITEM_* → PEDIDO_ITEM_*. Sincronía de
           Store reescrita para escribir en state.pedidos[X].items.
           Ciclo de vida completo (activar / limpiar).
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { formatearDinero, mostrarToast, mostrarEntrada } from '../utils.js';
import { Auth } from '../auth.js';
import { DB } from '../db.js';
import { DBAppwrite } from '../db-appwrite.js';

const DESTINOS_VALIDOS = ['cocina', 'barra', 'ambos'];

const Comanda = (() => {
  let _mesaActiva = null;
  let _pedidoActivo = null;
  let _activada = false;

  let _unsubscribeStore = null;
  const _cleanupsEventBus = [];

  function _normalizarItems(items) {
    if (typeof items === 'string') {
      try { return JSON.parse(items); } catch { return []; }
    }
    return Array.isArray(items) ? items : [];
  }

  function _obtenerPedidoActivo(mesa) {
    if (!mesa || !mesa.pedidoId) return null;
    const pedidos = Store.obtenerEstado().pedidos || [];
    return pedidos.find(p => p.id === mesa.pedidoId) || null;
  }

  async function _syncPedidoADB(pedido) {
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

      if (typeof DBAppwrite !== 'undefined' && DBAppwrite.habilitado) {
        const datosParaRemoto = {
          estado: pedido.estado,
          items: typeof pedido.items === 'string'
            ? pedido.items
            : JSON.stringify(pedido.items || []),
          total: pedido.total || 0,
          mozo: pedido.mozo,
          comensales: pedido.comensales,
          observaciones: pedido.observaciones || ''
        };
        await DBAppwrite.actualizar('pedidos', pedido.id, datosParaRemoto);
      }
    } catch (e) {
      Logger.error('[Comanda] Error al sincronizar pedido con DB:', e);
    }
  }

  function _inicializarSincroniaStore() {
    try {
      _unsubscribeStore = Store.suscribir((state, action) => {
        if (!action || !action.type) return;
        if (!['PEDIDO_ITEM_AGREGAR', 'PEDIDO_ITEM_CAMBIAR', 'PEDIDO_ITEM_QUITAR'].includes(action.type)) return;
        if (!_mesaActiva || !_pedidoActivo) return;

        const pedidoStore = (state.pedidos || []).find(p => p.id === _pedidoActivo.id);
        if (!pedidoStore) return;

        _pedidoActivo = pedidoStore;
        _syncPedidoADB(pedidoStore);

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
    if (_activada) return;
    _activada = true;
    _inicializarSincroniaStore();
    _inicializarEscuchadores();
    Logger.info('[Comanda] Módulo activado (v2.4.0).');
  }

  function limpiar() {
    if (!_activada) return;
    _activada = false;

    if (_unsubscribeStore) {
      try { _unsubscribeStore(); } catch (e) { Logger.warn('[Comanda] Error al desuscribir Store:', e); }
      _unsubscribeStore = null;
    }

    _cleanupsEventBus.forEach(fn => {
      try { fn(); } catch (e) { Logger.warn('[Comanda] Error al desuscribir EventBus:', e); }
    });
    _cleanupsEventBus.length = 0;

    _mesaActiva = null;
    _pedidoActivo = null;

    Logger.info('[Comanda] Módulo limpiado.');
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
    const personas = _pedidoActivo?.personas || _mesaActiva?.personas || [];
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

    document.getElementById('personaActivaSelect')?.addEventListener('change', function() {
      establecerPersonaActiva(this.value);
    });
    document.getElementById('btnAgregarPersona')?.addEventListener('click', agregarPersona);
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

  /**
   * Agrega un item a la comanda.
   * Acepta dos formas:
   *   a) Item simple (flujo clásico desde carta o precarga sin opciones):
   *      { id|prodId, nombre, precio, categoria?, destino? }
   *   b) Item completo (desde modal-opciones):
   *      { tipo:'producto', prodId, nombre, precio_base, precio_unitario,
   *        precio_total, opciones:[], alergias_manuales:[], qty, obs, persona }
   *
   * v2.4.0: guard defensivo. Si un item completo llega sin `destino`
   * válido, se le asigna 'ambos' (fallback). Sin esto, el handler
   * `enviarComanda` aborta el envío entero.
   */
  function agregarItem(producto) {
    if (!_pedidoActivo || !producto) return;

    const esItemCompleto =
      Array.isArray(producto.opciones) ||
      typeof producto.precio_unitario === 'number';

    const persona = _pedidoActivo.personaActiva || 'General';
    let item;

    if (esItemCompleto) {
      const precioUnit = producto.precio_unitario ?? producto.precio ?? 0;
      const qty = Math.max(1, parseInt(producto.qty) || 1);

      // Guard defensivo: destino y categoria deben venir del producto.
      // Si el consumidor los olvidó, aplicamos fallback y avisamos.
      let destino = producto.destino;
      if (!DESTINOS_VALIDOS.includes(destino)) {
        Logger.warn(
          '[Comanda] Item completo sin destino válido para "' +
          (producto.nombre || '?') + '". Aplicando fallback "ambos". ' +
          'Revisar el módulo que construyó el item.'
        );
        destino = 'ambos';
      }

      const categoria = producto.categoria || 'Sin categoría';

      item = {
        tipo: producto.tipo || 'producto',
        prodId: producto.prodId || producto.id,
        nombre: producto.nombre,
        // Compatibilidad con reducer de Store v2.0.13 (suma it.precio * it.qty).
        precio: precioUnit,
        // Campos informativos del snapshot de variantes.
        precio_base: producto.precio_base ?? producto.precio ?? 0,
        precio_unitario: precioUnit,
        precio_total: producto.precio_total ?? precioUnit * qty,
        opciones: Array.isArray(producto.opciones) ? producto.opciones : [],
        alergias_manuales: Array.isArray(producto.alergias_manuales)
          ? producto.alergias_manuales
          : [],
        categoria,
        destino,
        persona: producto.persona || persona,
        qty,
        obs: producto.obs || '',
        enviado: false,
        enviadoA: null,
        enviadoTs: null
      };
    } else {
      item = {
        prodId: producto.id || producto.prodId,
        nombre: producto.nombre,
        precio: producto.precio,
        categoria: producto.categoria,
        destino: producto.destino,
        persona,
        qty: Math.max(1, parseInt(producto.qty) || 1),
        obs: producto.obs || '',
        enviado: false,
        enviadoA: null,
        enviadoTs: null
      };
    }

    try {
      Store.despachar({
        type: 'PEDIDO_ITEM_AGREGAR',
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
        type: 'PEDIDO_ITEM_CAMBIAR',
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
        type: 'PEDIDO_ITEM_CAMBIAR',
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
        type: 'PEDIDO_ITEM_QUITAR',
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
    const items = _normalizarItems(pedidoStore?.items || _pedidoActivo.items || []);

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

    // Subtexto de opciones agrupadas por variante: "Sabor: Cubana · Tamaño: Grande"
    let opcionesHtml = '';
    if (Array.isArray(item.opciones) && item.opciones.length > 0) {
      const porVariante = new Map();
      for (const op of item.opciones) {
        const key = op.varianteId || op.varianteNombre || '?';
        if (!porVariante.has(key)) {
          porVariante.set(key, { nombre: op.varianteNombre || key, opciones: [] });
        }
        porVariante.get(key).opciones.push(op.opcionNombre || op.opcionId || '?');
      }
      const partes = [...porVariante.values()].map(v => `${v.nombre}: ${v.opciones.join(', ')}`);
      opcionesHtml = `<div class="item-opciones">${partes.join(' · ')}</div>`;
    }

    // Badge de alergias manuales
    const alergias = Array.isArray(item.alergias_manuales) ? item.alergias_manuales : [];
    const alergiasHtml = alergias.length > 0
      ? `<span class="item-badge-alergia" title="Alergias informadas por el cliente"><i class="fas fa-exclamation-triangle"></i> ${alergias.join(', ')}</span>`
      : '';

    // Badge de impacto KDS (insumos_delta o pasos_delta presentes)
    const tieneImpacto = Array.isArray(item.opciones) && item.opciones.some(o =>
      (Array.isArray(o.insumos_delta) && o.insumos_delta.length > 0) ||
      (Array.isArray(o.pasos_delta) && o.pasos_delta.length > 0)
    );
    const impactoHtml = tieneImpacto
      ? `<span class="item-badge-impacto" title="Esta opción modifica insumos o pasos en cocina/barra"><i class="fas fa-gear"></i></span>`
      : '';

    const badgesRow = (alergiasHtml || impactoHtml)
      ? `<div class="item-badges">${alergiasHtml}${impactoHtml}</div>`
      : '';

    return `
      <div class="comanda-item${enviado ? ' enviado' : ''}${(Array.isArray(item.opciones) && item.opciones.length) ? ' tiene-variantes' : ''}">
        <div class="item-qty-controls">
          <button class="qty-btn" data-idx="${idx}" data-delta="-1" ${disabledAttr}>−</button>
          <span class="item-qty">${item.qty || 1}</span>
          <button class="qty-btn" data-idx="${idx}" data-delta="1" ${disabledAttr}>+</button>
        </div>
        <div class="item-info">
          <div class="item-nombre">${item.nombre} ${personaBadge}</div>
          ${opcionesHtml}
          ${badgesRow}
          <input class="item-obs-input" data-idx="${idx}" placeholder="Aclaración..." value="${item.obs || ''}" ${disabledAttr}>
        </div>
        <span class="item-precio">${formatearDinero((item.precio || 0) * (item.qty || 1))}</span>
        <button class="item-remove" data-idx="${idx}"><i class="fas fa-times"></i></button>
      </div>`;
  }

  function _inicializarEscuchadores() {
    _cleanupsEventBus.push(EventBus.on('producto:seleccionado', agregarItem));
    _cleanupsEventBus.push(EventBus.on('mesa:abierta', establecerMesaActiva));

    _cleanupsEventBus.push(EventBus.on('precarga:items_listos', (payload) => {
      try {
        const mesaActiva = Comanda.obtenerMesaActiva();
        if (!mesaActiva || mesaActiva.numero !== payload.mesa) {
          mostrarToast('warning', 'Abrí la mesa antes de cargar la precarga.');
          return;
        }
        payload.items.forEach(item => {
          if (Array.isArray(item.opciones)) {
            // La precarga ya trae un item con opciones: pasarlo tal cual.
            Comanda.agregarItem(item);
          } else {
            // Flujo clásico: N items simples.
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
          }
        });
        EventBus.emit('mesas:limpiar_badge', { mesa: payload.mesa });
      } catch (e) {
        Logger.error('[Comanda] Error al procesar precarga:', e);
        mostrarToast('error', 'Error al cargar la precarga.');
      }
    }));
  }

  return {
    activar,
    limpiar,
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