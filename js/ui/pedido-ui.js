/* ================================================================
   PubPOS — MÓDULO: pedido-ui.js (v2.8 – botón cerrar robusto)
   ================================================================ */
const Pedido = (() => {

  let _mesaAbriendo = null;

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
                <button class="btn-comanda btn-todo" onclick="Pedido.enviarComanda()" style="grid-column:span 3;">
                  <i class="fas fa-paper-plane"></i> Enviar Comanda
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

  /* ── APERTURA DE MESA ──────────────────────────────────── */
  async function abrirMesa(num) {
    if (_mesaAbriendo === num) return;
    _mesaAbriendo = num;
    try {
      _asegurarModalPedido();
      let mesa = DB.mesas.find(m => m.numero == num);
      if (!mesa) { console.error(`[Pedido] Mesa ${num} no encontrada.`); return; }

      if (mesa.estado === 'libre') {
        mesa.abiertaEn = Date.now();
        mesa.mozo = document.getElementById('mozoActivo')?.value || (DB.mozos[0]?.nombre || 'Mozo');
        mesa.comensales = 2;
        mesa.items = [];
        mesa.observaciones = '';

        let pedidoId = null;
        if (typeof PedidoService !== 'undefined' && PedidoService.crearPedidoMesa) {
          try {
            const pedido = await PedidoService.crearPedidoMesa({ numeroMesa: num, mozo: mesa.mozo, comensales: mesa.comensales });
            if (pedido) { pedidoId = pedido.id; mesa.pedidoId = pedidoId; }
          } catch (e) { console.warn('[Pedido] PedidoService:', e); }
        }
        if (!pedidoId && typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoMesa) {
          try {
            const pedido = PedidoManager.crearPedidoMesa(num, mesa.mozo, mesa.comensales);
            if (pedido) { pedidoId = pedido.id; mesa.pedidoId = pedidoId; }
          } catch (e) { console.warn('[Pedido] PedidoManager:', e); }
        }
        if (!pedidoId) {
          try {
            const nuevoPedido = await DB.crearPedido(num, mesa.mozo, mesa.comensales);
            mesa.pedidoId = nuevoPedido.id;
          } catch (e) { console.warn('[Pedido] DB:', e); mesa.pedidoId = 'local_' + Date.now(); }
        }
        DB.saveMesas();
      }

      const tituloEl = document.getElementById('modalMesaTitulo');
      const badgeEl = document.getElementById('modalEstadoBadge');
      if (tituloEl) tituloEl.textContent = mesa.esVirtual ? `Mesas ${mesa.mesasFusionadas.join(', ')}` : `Mesa ${num}`;
      if (badgeEl) { badgeEl.textContent = Mesas.labelEstado(mesa.estado); badgeEl.className = `estado-badge ${mesa.estado}`; }

      EventBus.emit('mesa:abierta', mesa);
      if (window.Carta && typeof Carta.render === 'function') Carta.render();
      const modal = document.getElementById('modalPedido');
      if (modal) modal.style.display = 'flex';
    } finally { _mesaAbriendo = null; }
  }

  function cerrar() {
    const modal = document.getElementById('modalPedido');
    if (modal) {
      modal.style.display = 'none';
    } else {
      // Si no existe, intentamos cerrar el overlay que tenga la clase modal-overlay y contenga el modal
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

  /* ── ENVÍO DE COMANDA ─────────────────────────────────── */
  async function enviarComanda() {
    const mesa = Comanda.getMesaActiva();
    if (!mesa) { showToast('warning', 'No hay mesa activa.'); return; }

    const pendientes = mesa.items.filter(it => !it.enviado);
    if (!pendientes.length) { showToast('warning', 'No hay ítems nuevos para enviar.'); return; }

    const cocinaItems = pendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    const barraItems  = pendientes.filter(it => it.destino === 'barra'  || it.destino === 'ambos');
    if (!cocinaItems.length && !barraItems.length) { showToast('info', 'No hay ítems para enviar.'); return; }

    const mozoSelect = document.getElementById('comandaMozo');
    const comensalesInput = document.getElementById('comandaComensales');
    const obsInput = document.getElementById('comandaObs');
    if (mozoSelect) mesa.mozo = mozoSelect.value;
    if (comensalesInput) mesa.comensales = parseInt(comensalesInput.value) || 1;
    if (obsInput) mesa.observaciones = obsInput.value;

    const _crearComanda = (items, destinoKds) => {
      items.forEach(it => { it.enviado = true; it.enviadoA = destinoKds; it.enviadoTs = Date.now(); });
      const comanda = {
        id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
        mesa: mesa.numero, mozo: mesa.mozo, destino: destinoKds,
        items: items.map(it => ({ ...it })),
        observaciones: mesa.observaciones || '', estado: 'nueva', ts: Date.now()
      };
      DB.comandas.push(comanda);
      DB.saveComandas();
      EventBus.emit('comanda:enviada', comanda);
      return comanda;
    };

    if (cocinaItems.length && barraItems.length) {
      const comandaCocina = _crearComanda(cocinaItems, 'cocina');
      const comandaBarra  = _crearComanda(barraItems,  'barra');
      Tickets.mostrarDoble(
        Tickets.generarComanda(comandaCocina, 'cocina'), 'Cocina',
        { textoEditar: 'Editar', editarCallback: (htmlActual) => {
            const nota = prompt('Agregar comentario a la comanda de Cocina:', comandaCocina.observaciones || '');
            if (nota !== null) {
              comandaCocina.observaciones = nota;
              const idx = DB.comandas.findIndex(c => c.id === comandaCocina.id);
              if (idx >= 0) { DB.comandas[idx].observaciones = nota; DB.saveComandas(); }
              return Tickets.generarComanda(comandaCocina, 'cocina');
            }
            return htmlActual;
          }
        },
        Tickets.generarComanda(comandaBarra, 'barra'), 'Barra',
        { textoEditar: 'Editar', editarCallback: (htmlActual) => {
            const nota = prompt('Agregar comentario a la comanda de Barra:', comandaBarra.observaciones || '');
            if (nota !== null) {
              comandaBarra.observaciones = nota;
              const idx = DB.comandas.findIndex(c => c.id === comandaBarra.id);
              if (idx >= 0) { DB.comandas[idx].observaciones = nota; DB.saveComandas(); }
              return Tickets.generarComanda(comandaBarra, 'barra');
            }
            return htmlActual;
          }
        }
      );
    } else {
      if (cocinaItems.length) {
        const comandaCocina = _crearComanda(cocinaItems, 'cocina');
        Tickets.mostrar(Tickets.generarComanda(comandaCocina, 'cocina'), `Cocina — Mesa ${mesa.numero}`, { textoEditar: 'Editar', editarCallback: (htmlActual) => {
          const nota = prompt('Agregar comentario a la comanda de Cocina:', comandaCocina.observaciones || '');
          if (nota !== null) {
            comandaCocina.observaciones = nota;
            const idx = DB.comandas.findIndex(c => c.id === comandaCocina.id);
            if (idx >= 0) { DB.comandas[idx].observaciones = nota; DB.saveComandas(); }
            return Tickets.generarComanda(comandaCocina, 'cocina');
          }
          return htmlActual;
        }});
      }
      if (barraItems.length) {
        const comandaBarra = _crearComanda(barraItems, 'barra');
        Tickets.mostrar(Tickets.generarComanda(comandaBarra, 'barra'), `Barra — Mesa ${mesa.numero}`, { textoEditar: 'Editar', editarCallback: (htmlActual) => {
          const nota = prompt('Agregar comentario a la comanda de Barra:', comandaBarra.observaciones || '');
          if (nota !== null) {
            comandaBarra.observaciones = nota;
            const idx = DB.comandas.findIndex(c => c.id === comandaBarra.id);
            if (idx >= 0) { DB.comandas[idx].observaciones = nota; DB.saveComandas(); }
            return Tickets.generarComanda(comandaBarra, 'barra');
          }
          return htmlActual;
        }});
      }
    }

    if (mesa.estado === 'libre') mesa.estado = 'ocupada';

    try {
      if (mesa.pedidoId) {
        await DB.actualizarPedido(mesa.pedidoId, {
          estado: 'en_proceso', items: JSON.stringify(mesa.items),
          total: calcularTotal(mesa.items), mozo: mesa.mozo,
          comensales: mesa.comensales, observaciones: mesa.observaciones
        });
      }
    } catch (e) { console.warn('[Pedido] Error actualizando pedido:', e); }

    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
    if (window.Comanda && typeof Comanda.render === 'function') Comanda.render();
    showToast('success', 'Comanda(s) enviada(s)');
  }

  /* ── Transferir mesa ───────────────────────────────────── */
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
    abrirMesa, cerrar, enviarComanda, transferirMesa,
    mostrarSelectorTransferencia, pedirCuenta, cerrarMesa,
    _setCat, filtrarProductos, actualizarObsGeneral, _agregarItem
  };
})();

window.Pedido = Pedido;