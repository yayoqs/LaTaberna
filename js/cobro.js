/* ================================================================
   PubPOS — MÓDULO: cobro.js (v4.2 – corrección visibilidad pago único)
   ================================================================ */
const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];

  /* ── CREACIÓN DINÁMICA DEL MODAL DE CIERRE ───────────────── */
  function _asegurarModalCierre() {
    if ($id('modalCierre')) return;

    const modal = document.createElement('div');
    modal.id = 'modalCierre';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small" style="max-width:500px;">
        <div class="modal-header">
          <h3><i class="fas fa-file-invoice-dollar"></i> Cierre de Mesa</h3>
          <button class="modal-close" onclick="Cobro.cerrarModalCierre()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body">
          <div class="cierre-resumen" id="cierreResumen"></div>
          <div id="pagosParcialesContainer" style="display:none;"></div>
          <label>Forma de Pago (si no se divide)</label>
          <div class="formas-pago">
            <button class="pago-btn active" data-pago="Efectivo" onclick="Cobro.selectPago(this)"><i class="fas fa-money-bill"></i> Efectivo</button>
            <button class="pago-btn" data-pago="Débito" onclick="Cobro.selectPago(this)"><i class="fas fa-credit-card"></i> Débito</button>
            <button class="pago-btn" data-pago="Crédito" onclick="Cobro.selectPago(this)"><i class="fas fa-credit-card"></i> Crédito</button>
            <button class="pago-btn" data-pago="Transferencia" onclick="Cobro.selectPago(this)"><i class="fas fa-mobile-alt"></i> Transf.</button>
            <button class="pago-btn" data-pago="Mixto" onclick="Cobro.selectPago(this)"><i class="fas fa-layer-group"></i> Mixto</button>
          </div>
          <label for="cierreDescuento">Descuento (%)</label>
          <input type="number" id="cierreDescuento" value="0" min="0" max="100" oninput="Cobro.actualizarTotalCierre()">
          <div class="cierre-total-final" id="cierreTotalFinal"></div>
          <div class="modal-small-footer" style="flex-wrap:wrap; gap:8px;">
            <button class="btn-secondary" onclick="Cobro.cerrarModalCierre()">Cancelar</button>
            <button class="btn-secondary" onclick="Cobro.cobrarTodoJunto()" style="margin-right:auto;">
              <i class="fas fa-layer-group"></i> Cobrar todo junto
            </button>
            <button class="btn-primary" onclick="Cobro.confirmarCierre()"><i class="fas fa-check-circle"></i> Confirmar y Cobrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function abrirModalCierre() {
    if (!Auth.puedeCerrarMesa()) {
      showToast('error', 'No tienes permiso para cerrar mesas');
      return;
    }

    _mesaACerrar = Comanda.getMesaActiva();
    if (!_mesaACerrar) {
      showToast('warning', 'No hay ninguna mesa abierta.');
      return;
    }
    if (!_mesaACerrar.items || _mesaACerrar.items.length === 0) {
      showToast('warning', 'La mesa no tiene consumos.');
      return;
    }

    const obsInput = document.getElementById('comandaObs');
    if (obsInput) _mesaACerrar.observaciones = obsInput.value;

    _asegurarModalCierre();
    _renderResumen();
    _inicializarPagosParciales();

    const modal = document.getElementById('modalCierre');
    if (modal) {
      const ppContainer = document.getElementById('pagosParcialesContainer');
      if (ppContainer) ppContainer.style.display = 'none';
      modal.style.display = 'flex';
    }
  }

  function _renderResumen() {
    const resumenEl = document.getElementById('cierreResumen');
    if (!resumenEl || !_mesaACerrar) return;
    const porPersona = {};
    _mesaACerrar.items.forEach(it => {
      const p = it.persona || 'General';
      if (!porPersona[p]) porPersona[p] = { items: [], subtotal: 0 };
      porPersona[p].items.push(it);
      porPersona[p].subtotal += it.precio * it.qty;
    });
    let html = `<div><strong>Mesa ${_mesaACerrar.numero}</strong> - ${_mesaACerrar.mozo}</div>`;
    for (const [persona, data] of Object.entries(porPersona)) {
      html += `<div class="cierre-persona-group"><div class="cierre-persona-header">${persona} <span>${fmtMoney(data.subtotal)}</span></div>`;
      data.items.forEach(it => {
        html += `<div class="cierre-resumen-row"><span>${it.qty}x ${it.nombre}</span><span>${fmtMoney(it.precio * it.qty)}</span></div>`;
      });
      html += `</div>`;
    }
    html += `<div class="cierre-resumen-row total-row"><span>Total</span><span>${fmtMoney(_mesaACerrar.total)}</span></div>`;
    resumenEl.innerHTML = html;

    // Renderizar pagos parciales si hay múltiples personas
    if (Object.keys(porPersona).length > 1) {
      _renderPagosParciales(porPersona);
    } else {
      const ppContainer = document.getElementById('pagosParcialesContainer');
      if (ppContainer) ppContainer.style.display = 'none';
    }

    _actualizarTotalFinal();
  }

  function _renderPagosParciales(porPersona) {
    const container = document.getElementById('pagosParcialesContainer');
    if (!container) return;
    let html = '<h4>Pago por persona</h4>';
    for (const persona of Object.keys(porPersona)) {
      const pagoExistente = _pagosParciales.find(p => p.persona === persona);
      const montoSugerido = porPersona[persona].subtotal;
      const monto = pagoExistente ? pagoExistente.monto : montoSugerido;
      const forma = pagoExistente ? pagoExistente.formaPago : 'Efectivo';

      html += `<div class="pago-persona-row">
        <span>${persona}: ${fmtMoney(montoSugerido)}</span>
        <select id="formaPago_${persona}" onchange="Cobro.actualizarFormaPagoPersona('${persona}', this.value)">
          <option value="Efectivo" ${forma === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
          <option value="Débito" ${forma === 'Débito' ? 'selected' : ''}>Débito</option>
          <option value="Crédito" ${forma === 'Crédito' ? 'selected' : ''}>Crédito</option>
        </select>
        <input type="number" id="monto_${persona}" value="${monto}" step="0.01" min="0" onchange="Cobro.actualizarMontoPersona('${persona}', this.value)">
      </div>`;
    }
    html += `<button class="btn-secondary" onclick="Cobro.cobrarTodoJunto()" style="margin-top:8px;">Cobrar todo junto</button>`;
    container.innerHTML = html;
    container.style.display = 'block';
  }

  function _inicializarPagosParciales() {
    _pagosParciales = [];
    const porPersona = {};
    _mesaACerrar.items.forEach(it => {
      const p = it.persona || 'General';
      if (!porPersona[p]) porPersona[p] = 0;
      porPersona[p] += it.precio * it.qty;
    });
    for (const [persona, monto] of Object.entries(porPersona)) {
      _pagosParciales.push({ persona, monto, formaPago: 'Efectivo' });
    }
  }

  function actualizarFormaPagoPersona(persona, forma) {
    const pago = _pagosParciales.find(p => p.persona === persona);
    if (pago) pago.formaPago = forma;
  }

  function actualizarMontoPersona(persona, montoStr) {
    const monto = parseFloat(montoStr);
    if (isNaN(monto)) return;
    const pago = _pagosParciales.find(p => p.persona === persona);
    if (pago) pago.monto = monto;
  }

  function cobrarTodoJunto() {
    const container = document.getElementById('pagosParcialesContainer');
    if (container) container.style.display = 'none';
    document.getElementById('cierreDescuento').value = 0;
    _actualizarTotalFinal();
  }

  function selectPago(btn) {
    _formaPago = btn.dataset.pago;
    document.querySelectorAll('.pago-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.pago === _formaPago);
    });
  }

  function actualizarTotalCierre() {
    _actualizarTotalFinal();
  }

  function _actualizarTotalFinal() {
    if (!_mesaACerrar) return;
    const subtotal = calcularTotal(_mesaACerrar.items);
    const descuentoInput = document.getElementById('cierreDescuento');
    const descuento = parseFloat(descuentoInput?.value) || 0;
    const total = subtotal * (1 - descuento / 100);
    const totalEl = document.getElementById('cierreTotalFinal');
    if (totalEl) totalEl.textContent = `TOTAL A COBRAR: ${fmtMoney(total)}`;
  }

  async function confirmarCierre() {
    if (!_mesaACerrar) return;
    const ppContainer = document.getElementById('pagosParcialesContainer');
    const usarSplit = ppContainer && ppContainer.style.display !== 'none';
    let pagos = [];

    if (usarSplit) {
      pagos = _pagosParciales.filter(p => p.monto > 0);
      if (pagos.length === 0) {
        showToast('error', 'No hay pagos registrados.');
        return;
      }
      const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
      const total = calcularTotal(_mesaACerrar.items);
      if (Math.abs(sumaPagos - total) > 0.01) {
        showToast('warning', `La suma de pagos (${fmtMoney(sumaPagos)}) no coincide con el total (${fmtMoney(total)}). Ajusta los montos.`);
        return;
      }
    } else {
      const subtotal = calcularTotal(_mesaACerrar.items);
      const descuentoInput = document.getElementById('cierreDescuento');
      const descuento = parseFloat(descuentoInput?.value) || 0;
      const totalFinal = Math.round(subtotal * (1 - descuento / 100));
      pagos = [{ persona: 'Total', monto: totalFinal, formaPago: _formaPago }];
    }

    if (_mesaACerrar.pedidoId) {
      try {
        if (typeof PedidoManager !== 'undefined' && PedidoManager.cerrarPedidoMesa) {
          PedidoManager.cerrarPedidoMesa(
            _mesaACerrar.pedidoId,
            pagos[0].formaPago,
            pagos[0].monto,
            0
          );
        } else {
          await DB.cerrarPedido(_mesaACerrar.pedidoId, pagos[0].formaPago, pagos[0].monto, 0);
        }
      } catch (e) {
        console.warn('[Cobro] Error al cerrar pedido:', e);
      }
    }

    if (usarSplit) {
      pagos.forEach(pago => {
        const ticketHTML = Tickets.generarCierreParcial(_mesaACerrar, pago);
        Tickets.mostrar(ticketHTML, `Comprobante ${pago.persona} — Mesa ${_mesaACerrar.numero}`);
      });
    } else {
      const ticketHTML = Tickets.generarCierre(_mesaACerrar, pagos[0].monto, 0, pagos[0].formaPago);
      Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`);
    }

    if (_mesaACerrar.esVirtual) {
      DB.liberarMesasFusionadas(_mesaACerrar);
    } else {
      const idx = DB.mesas.findIndex(m => m.numero === _mesaACerrar.numero);
      if (idx >= 0) DB.mesas[idx] = mesaVacia(_mesaACerrar.numero);
    }
    DB.saveMesas();
    EventBus.emit('pedido:cerrado', { mesa: _mesaACerrar.numero });
    cerrarModalCierre();
    if (typeof Pedido !== 'undefined' && Pedido.cerrar) Pedido.cerrar();
    _mesaACerrar = null;
  }

  function cerrarModalCierre() {
    const modal = document.getElementById('modalCierre');
    if (modal) modal.style.display = 'none';
  }

  EventBus.on('cobro:solicitado', abrirModalCierre);

  return {
    abrirModalCierre,
    cerrarModalCierre,
    selectPago,
    actualizarTotalCierre,
    confirmarCierre,
    actualizarFormaPagoPersona,
    actualizarMontoPersona,
    cobrarTodoJunto
  };
})();

window.Cobro = Cobro;