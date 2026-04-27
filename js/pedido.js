/* ================================================================
   PubPOS — MÓDULO: pedido.js (v2 – modal de pedido dinámico)
   Propósito: Coordinar apertura de mesa, envío de comandas, transferencia.
   Ahora el modal #modalPedido se crea bajo demanda, eliminando la
   dependencia de HTML estático.
   ================================================================ */

const Pedido = (() => {

  /* ── CREACIÓN DINÁMICA DEL MODAL DE PEDIDO ────────────────── */
  function _asegurarModalPedido() {
    if ($id('modalPedido')) return; // ya existe

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
                <button class="btn-comanda btn-barra" onclick="Pedido.enviarComanda('barra')"><i class="fas fa-wine-glass"></i> Barra</button>
                <button class="btn-comanda btn-cocina" onclick="Pedido.enviarComanda('cocina')"><i class="fas fa-fire-burner"></i> Cocina</button>
                <button class="btn-comanda btn-todo" onclick="Pedido.enviarComanda('todos')"><i class="fas fa-paper-plane"></i> Enviar Todo</button>
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


  /* ── APERTURA DE MESA ─────────────────────────────────────── */
  async function abrirMesa(num) {
    _asegurarModalPedido();  // ← asegura que el modal existe

    let mesa = DB.mesas.find(m => m.numero == num);
    if (!mesa) {
      console.error(`[Pedido] Mesa ${num} no encontrada.`);
      return;
    }
    if (mesa.estado === 'libre') {
      mesa.abiertaEn = Date.now();
      mesa.mozo = document.getElementById('mozoActivo')?.value || (DB.mozos[0]?.nombre || 'Mozo');
      mesa.comensales = 2;
      mesa.items = [];
      mesa.observaciones = '';
      try {
        const nuevoPedido = await DB.crearPedido(num, mesa.mozo, mesa.comensales);
        mesa.pedidoId = nuevoPedido.id;
      } catch (e) {
        console.warn('[Pedido] Error creando pedido en backend, usando ID local.');
        mesa.pedidoId = 'local_' + Date.now();
      }
      DB.saveMesas();
    }

    const tituloEl = document.getElementById('modalMesaTitulo');
    const badgeEl = document.getElementById('modalEstadoBadge');
    if (tituloEl) {
      if (mesa.esVirtual) {
        tituloEl.textContent = `Mesas ${mesa.mesasFusionadas.join(', ')}`;
      } else {
        tituloEl.textContent = `Mesa ${num}`;
      }
    }
    if (badgeEl) {
      badgeEl.textContent = Mesas.labelEstado(mesa.estado);
      badgeEl.className = `estado-badge ${mesa.estado}`;
    }

    EventBus.emit('mesa:abierta', mesa);
    if (window.Carta && typeof Carta.render === 'function') Carta.render();
    const modal = document.getElementById('modalPedido');
    if (modal) modal.style.display = 'flex';
  }

  function cerrar() {
    const mesa = Comanda.getMesaActiva();
    if (mesa && mesa.estado === 'libre' && (!mesa.items || mesa.items.length === 0)) {
      if (mesa.esVirtual) {
        DB.liberarMesasFusionadas(mesa);
      } else {
        const idx = DB.mesas.findIndex(m => m.numero === mesa.numero);
        if (idx >= 0) {
          DB.mesas[idx] = mesaVacia(mesa.numero);
          DB.saveMesas();
          EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'libre' });
          Mesas.render();
        }
      }
    }
    const modal = document.getElementById('modalPedido');
    if (modal) modal.style.display = 'none';
    EventBus.emit('mesa:cerrada');
  }

  /* ── ENVÍO DE COMANDA ─────────────────────────────────────── */
  async function enviarComanda(destino) {
    const mesa = Comanda.getMesaActiva();
    if (!mesa) {
      showToast('warning', 'No hay mesa activa.');
      return;
    }
    const pendientes = mesa.items.filter(it => !it.enviado);
    if (!pendientes.length) {
      showToast('warning', 'No hay ítems nuevos para enviar.');
      return;
    }
    let paraEnviar = pendientes;
    if (destino === 'barra') {
      paraEnviar = pendientes.filter(it => it.destino === 'barra' || it.destino === 'ambos');
    } else if (destino === 'cocina') {
      paraEnviar = pendientes.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
    }
    if (!paraEnviar.length) {
      showToast('info', 'No hay ítems para ese destino.');
      return;
    }

    const mozoSelect = document.getElementById('comandaMozo');
    const comensalesInput = document.getElementById('comandaComensales');
    const obsInput = document.getElementById('comandaObs');
    if (mozoSelect) mesa.mozo = mozoSelect.value;
    if (comensalesInput) mesa.comensales = parseInt(comensalesInput.value) || 1;
    if (obsInput) mesa.observaciones = obsInput.value;

    paraEnviar.forEach(it => {
      it.enviado = true;
      it.enviadoA = destino;
      it.enviadoTs = Date.now();
    });
    if (mesa.estado === 'libre') mesa.estado = 'ocupada';

    const comanda = {
      id: 'kds_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      mesa: mesa.numero,
      mozo: mesa.mozo,
      destino: destino === 'todos' ? 'ambos' : destino,
      items: paraEnviar.map(it => ({ ...it })),
      observaciones: mesa.observaciones,
      estado: 'nueva',
      ts: Date.now()
    };
    DB.comandas.push(comanda);
    DB.saveComandas();

    try {
      if (mesa.pedidoId) {
        await DB.actualizarPedido(mesa.pedidoId, {
          estado: 'en_proceso',
          items: JSON.stringify(mesa.items),
          total: calcularTotal(mesa.items),
          mozo: mesa.mozo,
          comensales: mesa.comensales,
          observaciones: mesa.observaciones
        });
      }
    } catch (e) {
      console.warn('[Pedido] Error actualizando pedido:', e);
    }

    DB.saveMesas();
    EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
    EventBus.emit('comanda:enviada', comanda);
    if (window.Comanda && typeof Comanda.render === 'function') Comanda.render();

    const destinoLabel = destino === 'todos' ? 'Cocina y Barra' : destino.charAt(0).toUpperCase() + destino.slice(1);
    Tickets.mostrar(
      Tickets.generarComanda(comanda, destino === 'todos' ? 'cocina' : destino),
      `${destinoLabel} — Mesa ${mesa.numero}`
    );
    showToast('success', `Comanda enviada → ${destinoLabel}`);
  }

  /* ── TRANSFERIR MESA ──────────────────────────────────────── */
  function transferirMesa(mesaOrigenNum, mesaDestinoNum) {
    if (!Auth.esAdmin()) {
      showToast('error', 'Solo administradores pueden transferir pedidos entre mesas');
      return false;
    }

    const mesaOrigen = DB.getMesa(mesaOrigenNum);
    const mesaDestino = DB.getMesa(mesaDestinoNum);

    if (!mesaOrigen || !mesaDestino) {
      showToast('error', 'Una de las mesas no existe.');
      return false;
    }
    if (mesaDestino.estado !== 'libre') {
      showToast('error', `La mesa ${mesaDestinoNum} no está libre.`);
      return false;
    }
    if (mesaOrigen.esVirtual || mesaDestino.esVirtual) {
      showToast('error', 'No se puede transferir desde/hacia una mesa fusionada.');
      return false;
    }

    mesaDestino.estado = mesaOrigen.estado;
    mesaDestino.pedidoId = mesaOrigen.pedidoId;
    mesaDestino.items = mesaOrigen.items;
    mesaDestino.mozo = mesaOrigen.mozo;
    mesaDestino.comensales = mesaOrigen.comensales;
    mesaDestino.abiertaEn = mesaOrigen.abiertaEn;
    mesaDestino.observaciones = mesaOrigen.observaciones;
    mesaDestino.total = mesaOrigen.total;

    if (mesaDestino.pedidoId) {
      const pedido = DB.pedidos.find(p => p.id === mesaDestino.pedidoId);
      if (pedido) {
        pedido.mesa = mesaDestinoNum;
        DB.savePedidos();
      }
    }

    const idxOrigen = DB.mesas.findIndex(m => m.numero === mesaOrigenNum);
    if (idxOrigen >= 0) DB.mesas[idxOrigen] = mesaVacia(mesaOrigenNum);
    DB.saveMesas();

    EventBus.emit('mesa:actualizada', { mesa: mesaOrigenNum, estado: 'libre' });
    EventBus.emit('mesa:actualizada', { mesa: mesaDestinoNum, estado: mesaDestino.estado });
    if (window.Mesas) Mesas.render();

    const mesaActiva = Comanda.getMesaActiva();
    if (mesaActiva && mesaActiva.numero === mesaOrigenNum) {
      abrirMesa(mesaDestinoNum);
    }

    showToast('success', `Pedido transferido de Mesa ${mesaOrigenNum} a Mesa ${mesaDestinoNum}`);
    return true;
  }

  function mostrarSelectorTransferencia() {
    const mesaActual = Comanda.getMesaActiva();
    if (!mesaActual) {
      showToast('warning', 'No hay mesa activa.');
      return;
    }
    if (!Auth.esAdmin()) {
      showToast('error', 'Solo administradores pueden transferir mesas.');
      return;
    }
    if (mesaActual.esVirtual) {
      showToast('info', 'No se puede transferir una mesa fusionada.');
      return;
    }
    const mesasLibres = DB.mesas.filter(m => m.estado === 'libre' && !m.esVirtual && m.numero !== mesaActual.numero);
    if (!mesasLibres.length) {
      showToast('info', 'No hay mesas libres para transferir.');
      return;
    }
    const opciones = mesasLibres.map(m => m.numero).join(', ');
    const destino = prompt(`Mesas libres: ${opciones}\nIngresá el número de mesa destino:`);
    if (destino) {
      const numDestino = parseInt(destino);
      if (!isNaN(numDestino)) transferirMesa(mesaActual.numero, numDestino);
      else showToast('error', 'Número de mesa inválido.');
    }
  }

  function pedirCuenta() {
    if (window.Cuenta && typeof Cuenta.pedirCuenta === 'function') Cuenta.pedirCuenta();
  }
  function cerrarMesa() {
    if (window.Cobro && typeof Cobro.abrirModalCierre === 'function') Cobro.abrirModalCierre();
  }
  function _setCat(cat) { if (window.Carta && typeof Carta.setCategoria === 'function') Carta.setCategoria(cat); }
  function filtrarProductos() { if (window.Carta && typeof Carta.filtrar === 'function') Carta.filtrar(); }
  function actualizarObsGeneral(valor) { if (window.Comanda && typeof Comanda.setObservacionGeneral === 'function') Comanda.setObservacionGeneral(valor); }
  function _agregarItem(prodId) {
    const producto = DB.productos.find(p => p.id === prodId);
    if (producto && window.Comanda) Comanda.agregarItem(producto);
  }

  EventBus.on('mesa:seleccionada', abrirMesa);

  return {
    abrirMesa,
    cerrar,
    enviarComanda,
    transferirMesa,
    mostrarSelectorTransferencia,
    pedirCuenta,
    cerrarMesa,
    _setCat,
    filtrarProductos,
    actualizarObsGeneral,
    _agregarItem
  };
})();

window.Pedido = Pedido;