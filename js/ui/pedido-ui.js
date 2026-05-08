/* ================================================================
   PubPOS — MÓDULO: pedido-ui.js (v5.2 – modal no se cierra solo)
   ================================================================ */
const Pedido = (() => {

  let _mesaAbriendo = null;
  const _comandasEnviadas = {};

  function _asegurarModalPedido() {
    if ($id('modalPedido')) return;

    const modal = document.createElement('div');
    modal.id = 'modalPedido';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-pedido">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-chair"></i>
            <span id="modalMesaTitulo">Mesa 1</span>
            <span class="estado-badge" id="modalEstadoBadge">Libre</span>
          </div>
          <button class="btn-icon" onclick="Pedido.mostrarSelectorTransferencia()" title="Cambiar Mesa" style="background:transparent; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:6px 12px; color:var(--color-text-sec); margin-right:8px;" data-rol="admin,master">
            <i class="fas fa-exchange-alt"></i> Cambiar Mesa
          </button>
          <button class="modal-close" onclick="Pedido.cerrar()" aria-label="Cerrar" style="margin-left: auto;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <section class="carta-panel">
            <div class="carta-search"><i class="fas fa-search"></i><input type="text" id="searchProducto" placeholder="Buscar producto..." oninput="Carta.filtrar()" autocomplete="off"></div>
            <div class="categorias-tabs" id="categoriasTabs"></div>
            <div id="cartaProductos" class="carta-productos"></div>
          </section>
          <section class="comanda-panel">
            <div class="comanda-header">
              <div class="comanda-meta">
                <span><i class="fas fa-user-tie"></i><select id="comandaMozo" onchange="Comanda.setMozo(this.value)"></select></span>
                <span><i class="fas fa-users"></i><input type="number" id="comandaComensales" value="2" min="1" max="20" onchange="Comanda.setComensales(this.value)"> pax</span>
              </div>
              <div id="personaActivaContainer" style="display: flex; align-items: center; gap: 8px; margin-top: 8px;"></div>
            </div>
            <div id="comandaItems" class="comanda-items"></div>
            <div class="comanda-obs"><input type="text" id="comandaObs" placeholder="Observaciones generales..." oninput="Comanda.setObservacionGeneral(this.value)"></div>
            <div class="comanda-footer">
              <div class="comanda-total"><span>Subtotal</span><span class="total-monto" id="subtotalDisplay">$0</span></div>
              <div class="comanda-actions">
                <button class="btn-comanda btn-todo" onclick="Pedido.revisarComanda()" style="grid-column:span 3;">
                  <i class="fas fa-check-double"></i> Revisar Comandas
                </button>
              </div>
              <div class="comanda-actions-2">
                <button class="btn-cuenta" onclick="Cuenta.pedirCuenta()" data-rol="mesero,admin,master,caja"><i class="fas fa-file-invoice-dollar"></i> Pedir Cuenta</button>
                <button class="btn-cerrar-mesa" onclick="Cobro.abrirModalCierre()" data-rol="caja,admin,master"><i class="fas fa-check-circle"></i> Cerrar Mesa</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /* ── MODAL DE APERTURA (sin cambios) ───────────────────── */
  function _mostrarModalApertura(mesa) {
    let modal = $id('modalAperturaMesa');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modalAperturaMesa';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const numMesa = mesa.numero;
    modal.innerHTML = `
      <div class="modal-small" style="max-width:400px;">
        <div class="modal-header">
          <h3><i class="fas fa-chair"></i> Abrir Mesa ${numMesa}</h3>
          <button class="modal-close" onclick="Pedido._cancelarApertura()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body">
          <label for="aperturaComensales">Comensales</label>
          <input type="number" id="aperturaComensales" value="2" min="1" max="20" step="1">
          <label for="aperturaPersonas">
            Nombres o apodos (opcional)
            <span style="font-weight:normal;font-size:11px;color:var(--color-text-muted);">Separados por coma o uno por línea</span>
          </label>
          <textarea id="aperturaPersonas" rows="3" placeholder="Ej: Juan, María, Pedro"></textarea>
          <div class="modal-small-footer">
            <button class="btn-secondary" onclick="Pedido._cancelarApertura()">Cancelar</button>
            <button class="btn-primary" onclick="Pedido._confirmarApertura(${numMesa})">
              <i class="fas fa-check-circle"></i> Abrir Mesa
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => $id('aperturaComensales')?.focus(), 100);
  }

  function _cancelarApertura() {
    const modal = $id('modalAperturaMesa');
    if (modal) modal.remove();
    _mesaAbriendo = null;
  }

  async function _confirmarApertura(num) {
    const comensales = parseInt($id('aperturaComensales')?.value) || 2;
    const personasRaw = $id('aperturaPersonas')?.value || '';
    const personas = personasRaw.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
    _cancelarApertura();

    const mesa = DB.mesas.find(m => m.numero == num);
    if (!mesa) { showToast('error', 'Mesa no encontrada'); return; }

    mesa.comensales = comensales;
    mesa.personas = personas;
    mesa.personaActiva = personas.length > 0 ? personas[0] : 'General';

    const comando = {
      type: 'crearPedidoMesa',
      datos: {
        numeroMesa: num,
        mozo: mesa.mozo || (DB.mozos[0]?.nombre || 'Mozo'),
        comensales: comensales
      }
    };

    Logger.debug('[Pedido] Ejecutando comando crearPedidoMesa...');
    const resultado = await CommandBus.ejecutar(comando);

    if (!resultado.exito || !resultado.data) {
      Logger.error('[Pedido] El comando crearPedidoMesa falló:', resultado.error);
      showToast('error', 'No se pudo abrir la mesa. Intente de nuevo.');
      return;
    }

    mesa.pedidoId = resultado.data.id;
    mesa.estado = 'ocupada';
    mesa.abiertaEn = Date.now();
    mesa.items = [];
    mesa.observaciones = '';
    DB.saveMesas();

    _abrirModalPedido(mesa);
  }

  function _abrirModalPedido(mesa) {
    _asegurarModalPedido();

    const tituloEl = document.getElementById('modalMesaTitulo');
    const badgeEl = document.getElementById('modalEstadoBadge');
    if (tituloEl) tituloEl.textContent = mesa.esVirtual ? `Mesas ${mesa.mesasFusionadas.join(', ')}` : `Mesa ${mesa.numero}`;
    if (badgeEl) {
      badgeEl.textContent = Mesas.labelEstado(mesa.estado);
      badgeEl.className = `estado-badge ${mesa.estado}`;
    }

    EventBus.emit('mesa:abierta', mesa);
    if (window.Carta && typeof Carta.render === 'function') Carta.render();
    const modal = document.getElementById('modalPedido');
    if (modal) modal.style.display = 'flex';
  }

  async function abrirMesa(num) {
    if (_mesaAbriendo === num) return;
    _mesaAbriendo = num;

    try {
      const mesa = DB.mesas.find(m => m.numero == num);
      if (!mesa) { Logger.error(`[Pedido] Mesa ${num} no encontrada.`); return; }

      if (mesa.estado === 'libre') {
        mesa.mozo = document.getElementById('mozoActivo')?.value || (DB.mozos[0]?.nombre || 'Mozo');
        _mostrarModalApertura(mesa);
      } else {
        _abrirModalPedido(mesa);
      }
    } finally {
      _mesaAbriendo = null;
    }
  }

  function cerrar() {
    const modal = document.getElementById('modalPedido');
    if (modal) {
      modal.style.display = 'none';
    } else {
      const overlays = document.querySelectorAll('.modal-overlay');
      overlays.forEach(o => { if (o.querySelector('.modal-pedido')) o.style.display = 'none'; });
    }

    const mesa = Comanda.getMesaActiva();
    if (mesa && mesa.estado === 'libre' && (!mesa.items || mesa.items.length === 0)) {
      if (mesa.esVirtual) { DB.liberarMesasFusionadas(mesa); }
      else {
        const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
        if (idx >= 0) { DB.mesas[idx] = mesaVacia(mesa.numero); DB.saveMesas(); EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' }); Mesas.render(); }
      }
    }
    EventBus.emit('mesa:cerrada');
  }

  /* ── REVISAR COMANDA (con botón que cambia y modal persistente) ── */
  async function revisarComanda() {
    const mesa = Comanda.getMesaActiva();
    if (!mesa) { showToast('warning', 'No hay mesa activa.'); return; }

    const pendientes = mesa.items.filter(it => !it.enviado);
    if (!pendientes.length) { showToast('warning', 'No hay ítems nuevos para revisar.'); return; }

    const mozoSelect = document.getElementById('comandaMozo');
    const comensalesInput = document.getElementById('comandaComensales');
    const obsInput = document.getElementById('comandaObs');
    if (mozoSelect) mesa.mozo = mozoSelect.value;
    if (comensalesInput) mesa.comensales = parseInt(comensalesInput.value) || 1;
    if (obsInput) mesa.observaciones = obsInput.value;

    const cocinaItems = pendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = pendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');

    const _crearOpciones = (comandaTemp, modalId) => {
      const tempId = comandaTemp.id;
      const yaEnviada = !!_comandasEnviadas[tempId];
      return {
        textoEditar: 'Editar',
        editarCallback: (html) => _editarComandaCallback(comandaTemp, html),
        textoImprimir: yaEnviada ? 'Reimprimir' : 'Enviar e Imprimir',
        claseImprimir: yaEnviada ? 'btn-secondary' : 'btn-print',
        esReimpresion: yaEnviada,
        onImprimir: async () => {
          if (!yaEnviada) {
            try {
              const resultado = await CommandBus.ejecutar({
                type: 'enviarComanda',
                datos: {
                  mesa,
                  mozo: mesa.mozo,
                  comensales: mesa.comensales,
                  observaciones: mesa.observaciones || '',
                  itemsPendientes: pendientes
                }
              });
              if (!resultado.exito) {
                showToast('error', 'Error al enviar comanda: ' + resultado.error);
                return false;
              }
              _comandasEnviadas[tempId] = true;
              showToast('success', 'Comanda(s) enviada(s)');
              if (window.Comanda && typeof Comanda.render === 'function') Comanda.render();
              if (window.Mesas && typeof Mesas.render === 'function') Mesas.render();
              EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });

              // Cambiar el botón dinámicamente sin cerrar el modal
              const btnImprimir = document.getElementById(`${modalId}-imprimir`);
              if (btnImprimir) {
                btnImprimir.textContent = 'Reimprimir';
                btnImprimir.className = 'btn-secondary';
              }
              return false; // no queremos que se cierre el modal ni se imprima automáticamente
            } catch (e) {
              Logger.error('[Pedido] Error al enviar comanda:', e);
              showToast('error', 'Error al enviar comanda.');
              return false;
            }
          }
          // Reimpresión: permite imprimir, no cierra el modal
          return true;
        }
      };
    };

    const comandaTemp = (items, destino) => ({
      id: 'temp_' + Date.now(),
      mesa: mesa.numero,
      mozo: mesa.mozo,
      destino: destino,
      items: items,
      observaciones: mesa.observaciones || '',
      estado: 'nueva',
      ts: Date.now()
    });

    if (cocinaItems.length && barraItems.length) {
      const comCocina = comandaTemp(cocinaItems, 'cocina');
      const comBarra  = comandaTemp(barraItems,  'barra');
      Tickets.mostrarDoble(
        Tickets.generarComanda(comCocina, 'cocina'), 'Cocina',
        _crearOpciones(comCocina, 'ticket-dual-izq'),
        Tickets.generarComanda(comBarra, 'barra'), 'Barra',
        _crearOpciones(comBarra, 'ticket-dual-der')
      );
    } else if (cocinaItems.length) {
      const comCocina = comandaTemp(cocinaItems, 'cocina');
      Tickets.mostrar(Tickets.generarComanda(comCocina, 'cocina'), `Cocina — Mesa ${mesa.numero}`, _crearOpciones(comCocina, 'ticket-modal'));
    } else if (barraItems.length) {
      const comBarra = comandaTemp(barraItems, 'barra');
      Tickets.mostrar(Tickets.generarComanda(comBarra, 'barra'), `Barra — Mesa ${mesa.numero}`, _crearOpciones(comBarra, 'ticket-modal'));
    }
  }

  function _editarComandaCallback(comanda, htmlActual) {
    if (!comanda) return htmlActual;
    const nota = prompt('Agregar comentario a la comanda:', comanda.observaciones || '');
    if (nota !== null) {
      comanda.observaciones = nota;
      return Tickets.generarComanda(comanda, comanda.destino);
    }
    return htmlActual;
  }

  function transferirMesa(mesaOrigenNum, mesaDestinoNum) {
    if (!Auth.esAdmin()) { showToast('error', 'Solo administradores pueden transferir pedidos entre mesas'); return false; }
    const mesaOrigen = DB.getMesa(mesaOrigenNum), mesaDestino = DB.getMesa(mesaDestinoNum);
    if (!mesaOrigen || !mesaDestino) { showToast('error', 'Una de las mesas no existe.'); return false; }
    if (mesaDestino.estado !== 'libre') { showToast('error', `La mesa ${mesaDestinoNum} no está libre.`); return false; }
    if (mesaOrigen.esVirtual || mesaDestino.esVirtual) { showToast('error', 'No se puede transferir desde/hacia una mesa fusionada.'); return false; }

    mesaDestino.estado = mesaOrigen.estado; mesaDestino.pedidoId = mesaOrigen.pedidoId;
    mesaDestino.items = mesaOrigen.items; mesaDestino.mozo = mesaOrigen.mozo;
    mesaDestino.comensales = mesaOrigen.comensales; mesaDestino.abiertaEn = mesaOrigen.abiertaEn;
    mesaDestino.observaciones = mesaOrigen.observaciones; mesaDestino.total = mesaOrigen.total;

    if (mesaDestino.pedidoId) {
      const pedido = DB.pedidos.find(p => p.id === mesaDestino.pedidoId);
      if (pedido) { pedido.mesa = mesaDestinoNum; DB.savePedidos(); }
    }
    const idxOrigen = DB.mesas.findIndex(m => m.numero === mesaOrigenNum);
    if (idxOrigen >= 0) DB.mesas[idxOrigen] = mesaVacia(mesaOrigenNum);
    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: mesaOrigenNum, estado: 'libre' });
    EventBus.emit('mesa:actualizada', { mesa: mesaDestinoNum, estado: mesaDestino.estado });
    if (window.Mesas) Mesas.render();
    const mesaActiva = Comanda.getMesaActiva();
    if (mesaActiva && mesaActiva.numero === mesaOrigenNum) abrirMesa(mesaDestinoNum);
    showToast('success', `Pedido transferido de Mesa ${mesaOrigenNum} a Mesa ${mesaDestinoNum}`);
    return true;
  }

  function mostrarSelectorTransferencia() {
    const mesaActual = Comanda.getMesaActiva();
    if (!mesaActual) { showToast('warning', 'No hay mesa activa.'); return; }
    if (!Auth.esAdmin()) { showToast('error', 'Solo administradores pueden transferir mesas.'); return; }
    if (mesaActual.esVirtual) { showToast('info', 'No se puede transferir una mesa fusionada.'); return; }
    const mesasLibres = DB.mesas.filter(m => m.estado === 'libre' && !m.esVirtual && m.numero !== mesaActual.numero);
    if (!mesasLibres.length) { showToast('info', 'No hay mesas libres para transferir.'); return; }
    const opciones = mesasLibres.map(m => m.numero).join(', ');
    const destino = prompt(`Mesas libres: ${opciones}\nIngresá el número de mesa destino:`);
    if (destino) {
      const numDestino = parseInt(destino);
      if (!isNaN(numDestino)) transferirMesa(mesaActual.numero, numDestino);
      else showToast('error', 'Número de mesa inválido.');
    }
  }

  function pedirCuenta() { if (window.Cuenta && typeof Cuenta.pedirCuenta === 'function') Cuenta.pedirCuenta(); }
  function cerrarMesa() { if (window.Cobro && typeof Cobro.abrirModalCierre === 'function') Cobro.abrirModalCierre(); }
  function _setCat(cat) { if (window.Carta && typeof Carta.setCategoria === 'function') Carta.setCategoria(cat); }
  function filtrarProductos() { if (window.Carta && typeof Carta.filtrar === 'function') Carta.filtrar(); }
  function actualizarObsGeneral(valor) { if (window.Comanda && typeof Comanda.setObservacionGeneral === 'function') Comanda.setObservacionGeneral(valor); }
  function _agregarItem(prodId) { const producto = DB.productos.find(p => p.id === prodId); if (producto && window.Comanda) Comanda.agregarItem(producto); }

  EventBus.on('mesa:seleccionada', abrirMesa);

  return {
    abrirMesa, cerrar, revisarComanda, transferirMesa,
    mostrarSelectorTransferencia, pedirCuenta, cerrarMesa,
    _setCat, filtrarProductos, actualizarObsGeneral, _agregarItem,
    _confirmarApertura, _cancelarApertura
  };
})();

window.Pedido = Pedido;