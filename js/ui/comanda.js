/* ================================================================
   LaTaberna - PubPOS — UI
   Archivo: js/ui/comanda.js
   Versión: 1.0.2
   Propósito: Gestión de la comanda actual (ítems, cantidades,
              observaciones, split bill). Fase 2: eliminada la
              escritura directa a DB.saveMesas(). La sincronización
              del estado local con DB se hace mediante un suscriptor
              del Store, manteniendo la compatibilidad con el flujo
              de envío a cocina.
   Dependencias: Store, EventBus, DB, Auth, Logger
   ================================================================ */
const Comanda = (() => {
  let _mesaActiva = null;

  /**
   * Sincroniza los cambios del Store con DB.mesas.
   * Reemplaza la antigua llamada a DB.saveMesas().
   */
  function _syncMesaStoreADB(mesaActualizada) {
    if (!mesaActualizada) return;
    const idx = DB.mesas.findIndex(m => m.numero == mesaActualizada.numero);
    if (idx >= 0) {
      DB.mesas[idx] = mesaActualizada;
      if (typeof DB.saveMesas === 'function') {
        DB.saveMesas();
      }
    }
  }

  function _initStoreSync() {
    Store.subscribe((state, action) => {
      // Solo reaccionar a acciones de comanda
      if (!action || !action.type) return;
      if (!['COMANDA_ITEM_AGREGAR', 'COMANDA_ITEM_CAMBIAR', 'COMANDA_ITEM_QUITAR'].includes(action.type)) return;
      if (!_mesaActiva) return;

      // Obtener la mesa actualizada desde el Store
      const mesaStore = state.mesas.find(m => m.numero == _mesaActiva.numero);
      if (!mesaStore) return;

      // Sincronizar con DB y emitir evento
      _syncMesaStoreADB(mesaStore);
      _mesaActiva = mesaStore;
      EventBus.emit('mesa:actualizada', { mesa: _mesaActiva.numero, estado: _mesaActiva.estado });
      _render();
      if (typeof actualizarTotalCierre === 'function') {
        actualizarTotalCierre();
      }
    });
  }

  // Activar la sincronización al cargar el módulo
  _initStoreSync();

  /**
   * Establece la mesa activa y sincroniza la UI.
   * @param {object} mesa
   */
  function setMesaActiva(mesa) {
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
      const mozos = DB.mozos || [];
      if (mozos.length) {
        const esObjeto = typeof mozos[0] === 'object' && mozos[0] !== null;
        opcionesHTML = mozos.map(m => {
          const nombre = esObjeto ? m.nombre : m;
          const activo = esObjeto ? (m.activo !== false) : true;
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
      <select id="personaActivaSelect" onchange="Comanda.setPersonaActiva(this.value)">
        ${opciones}
      </select>
      <button class="btn-icon-sm" onclick="Comanda.agregarPersona()" title="Agregar persona"><i class="fas fa-plus"></i></button>
    `;
  }

  /**
   * Cambia la persona activa para asignar ítems en split bill.
   * @param {string} nombre
   */
  function setPersonaActiva(nombre) {
    if (_mesaActiva) {
      _mesaActiva.personaActiva = nombre;
    }
  }

  /** Agrega una nueva persona a la mesa */
  function agregarPersona() {
    const nombre = prompt('Nombre de la persona:');
    if (!nombre) return;
    if (!_mesaActiva.personas) _mesaActiva.personas = [];
    if (!_mesaActiva.personas.includes(nombre)) {
      _mesaActiva.personas.push(nombre);
    }
    _mesaActiva.personaActiva = nombre;
    _renderSelectorPersona();
  }

  /**
   * Agrega un producto a la comanda.
   * @param {object} producto
   */
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

    Store.dispatch({
      type: 'COMANDA_ITEM_AGREGAR',
      payload: { numeroMesa: _mesaActiva.numero, item }
    });
  }

  /**
   * Cambia la cantidad de un ítem.
   * @param {number} idx - Índice del ítem
   * @param {number} delta - Incremento (+1 o -1)
   */
  function cambiarCantidad(idx, delta) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (!item) return;
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      showToast('error', 'No tienes permiso para modificar ítems ya enviados');
      return;
    }
    const nuevaCantidad = Math.max(1, item.qty + delta);
    Store.dispatch({
      type: 'COMANDA_ITEM_CAMBIAR',
      payload: { numeroMesa: _mesaActiva.numero, index: idx, cambios: { qty: nuevaCantidad } }
    });
  }

  /**
   * Establece la observación de un ítem.
   * @param {number} idx
   * @param {string} valor
   */
  function setObservacion(idx, valor) {
    if (_mesaActiva?.items[idx]) {
      Store.dispatch({
        type: 'COMANDA_ITEM_CAMBIAR',
        payload: { numeroMesa: _mesaActiva.numero, index: idx, cambios: { obs: valor } }
      });
    }
  }

  /** Elimina un ítem de la comanda */
  function quitarItem(idx) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      showToast('error', 'Solo administrador puede eliminar ítems enviados');
      return;
    }
    Store.dispatch({
      type: 'COMANDA_ITEM_QUITAR',
      payload: { numeroMesa: _mesaActiva.numero, index: idx }
    });
  }

  /** @param {string} mozo */
  function setMozo(mozo) {
    if (_mesaActiva) {
      _mesaActiva.mozo = mozo;
      DB.saveMesas();
    }
  }

  /** @param {number} cant */
  function setComensales(cant) {
    if (_mesaActiva) {
      _mesaActiva.comensales = parseInt(cant) || 1;
      DB.saveMesas();
    }
  }

  /** @param {string} obs */
  function setObservacionGeneral(obs) {
    if (_mesaActiva) {
      _mesaActiva.observaciones = obs;
    }
  }

  /** Renderiza la lista de ítems de la comanda */
  function render() {
    _render();
  }

  function _render() {
    const contenedor = document.getElementById('comandaItems');
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (!contenedor || !_mesaActiva) return;

    // Leer los ítems desde el Store para asegurar consistencia
    const state = Store.getState();
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
    if (subtotalEl) subtotalEl.textContent = fmtMoney(mesaDelStore?.total || _mesaActiva.total || 0);
    _renderSelectorPersona();
  }

  function _htmlItem(item, idx) {
    const enviado = item.enviado;
    const disabledAttr = enviado ? 'disabled' : '';
    const personaBadge = item.persona ? `<span class="item-persona-badge"><i class="fas fa-user"></i> ${item.persona}</span>` : '';
    return `
      <div class="comanda-item${enviado ? ' enviado' : ''}">
        <div class="item-qty-controls">
          <button class="qty-btn" onclick="Comanda.cambiarCantidad(${idx}, -1)" ${disabledAttr}>−</button>
          <span class="item-qty">${item.qty}</span>
          <button class="qty-btn" onclick="Comanda.cambiarCantidad(${idx}, 1)" ${disabledAttr}>+</button>
        </div>
        <div class="item-info">
          <div class="item-nombre">${item.nombre} ${personaBadge}</div>
          <input class="item-obs-input" placeholder="Aclaración..." value="${item.obs || ''}"
                 oninput="Comanda.setObservacion(${idx}, this.value)" ${disabledAttr}>
        </div>
        <span class="item-precio">${fmtMoney(item.precio * item.qty)}</span>
        <button class="item-remove" onclick="Comanda.quitarItem(${idx})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  }

  function _initEventListeners() {
    EventBus.on('producto:seleccionado', agregarItem);
    EventBus.on('mesa:abierta', setMesaActiva);
  }

  _initEventListeners();

  return {
    setMesaActiva,
    setMozo,
    setComensales,
    setObservacionGeneral,
    setPersonaActiva,
    agregarPersona,
    agregarItem,
    cambiarCantidad,
    setObservacion,
    quitarItem,
    render,
    getMesaActiva: () => _mesaActiva
  };
})();

window.Comanda = Comanda;