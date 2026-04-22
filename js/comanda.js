/* ================================================================
   PubPOS — MÓDULO: comanda.js
   Propósito: Gestión de la comanda actual, incluyendo asignación
              de ítems a personas (split bill).
   ================================================================ */

const Comanda = (() => {
  let _mesaActiva = null;

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

    // Renderizar selector de persona activa
    _renderSelectorPersona();
  }

  function _renderSelectorPersona() {
    const container = document.getElementById('personaActivaContainer');
    if (!container) return;
    const personas = _mesaActiva.personas || [];
    if (personas.length === 0) {
      // Inicializar con "General"
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

  function setPersonaActiva(nombre) {
    if (_mesaActiva) {
      _mesaActiva.personaActiva = nombre;
    }
  }

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

  function agregarItem(producto) {
    if (!_mesaActiva) return;
    const persona = _mesaActiva.personaActiva || 'General';
    const existente = _mesaActiva.items.find(it => it.prodId === producto.id && !it.enviado && it.persona === persona);
    if (existente) {
      existente.qty++;
    } else {
      _mesaActiva.items.push({
        prodId:    producto.id,
        nombre:    producto.nombre,
        precio:    producto.precio,
        categoria: producto.categoria,
        destino:   producto.destino,
        qty:       1,
        obs:       '',
        enviado:   false,
        enviadoA:  null,
        enviadoTs: null,
        persona:   persona           // clave para split bill
      });
    }
    _guardarYRenderizar();
  }

  function cambiarCantidad(idx, delta) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (!item) return;
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      showToast('error', 'No tienes permiso para modificar ítems ya enviados');
      return;
    }
    item.qty = Math.max(1, item.qty + delta);
    _guardarYRenderizar();
  }

  function setObservacion(idx, valor) {
    if (_mesaActiva?.items[idx]) {
      _mesaActiva.items[idx].obs = valor;
    }
  }

  function quitarItem(idx) {
    if (!_mesaActiva) return;
    const item = _mesaActiva.items[idx];
    if (item.enviado && !Auth.puede('eliminarItemEnviado')) {
      showToast('error', 'Solo administrador puede eliminar ítems enviados');
      return;
    }
    _mesaActiva.items.splice(idx, 1);
    _guardarYRenderizar();
  }

  function setMozo(mozo) {
    if (_mesaActiva) {
      _mesaActiva.mozo = mozo;
      DB.saveMesas();
    }
  }

  function setComensales(cant) {
    if (_mesaActiva) {
      _mesaActiva.comensales = parseInt(cant) || 1;
      DB.saveMesas();
    }
  }

  function setObservacionGeneral(obs) {
    if (_mesaActiva) {
      _mesaActiva.observaciones = obs;
    }
  }

  function _guardarYRenderizar() {
    if (!_mesaActiva) return;
    _mesaActiva.total = calcularTotal(_mesaActiva.items);
    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: _mesaActiva.numero, estado: _mesaActiva.estado });
    _render();
    if (typeof actualizarTotalCierre === 'function') {
      actualizarTotalCierre();
    }
  }

  function _render() {
    const contenedor = document.getElementById('comandaItems');
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (!contenedor || !_mesaActiva) return;

    if (!_mesaActiva.items.length) {
      contenedor.innerHTML = `
        <div class="comanda-vacia">
          <i class="fas fa-utensils"></i>
          <p>La comanda está vacía</p>
          <p style="font-size:11px">Tocá un producto para agregar</p>
        </div>`;
      if (subtotalEl) subtotalEl.textContent = '$0';
      return;
    }

    contenedor.innerHTML = _mesaActiva.items.map((item, idx) => _htmlItem(item, idx)).join('');
    if (subtotalEl) subtotalEl.textContent = fmtMoney(_mesaActiva.total || 0);
    _renderSelectorPersona(); // mantener actualizado
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
    render: _render,
    getMesaActiva: () => _mesaActiva
  };
})();

window.Comanda = Comanda;