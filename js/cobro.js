/* ================================================================
   PubPOS — MÓDULO: cobro.js (v3 – split bill con validación)
   ================================================================ */
const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];

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

    _renderResumen();
    _inicializarPagosParciales();

    const modal = document.getElementById('modalCierre');
    if (modal) modal.style.display = 'flex';
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

    _renderPagosParciales(porPersona);
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
    html += `<button class="btn-secondary" onclick="Cobro.cobrarTodoJunto()">Cobrar todo junto</button>`;
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
    const usarSplit = document.getElementById('pagosParcialesContainer')?.style.display !== 'none';
    let pagos = [];

    if (usarSplit) {
      pagos = _pagosParciales.filter(p => p.monto > 0);
      if (pagos.length === 0) {
        showToast('error', 'No hay pagos registrados.');
        return;
      }
      // Validar que la suma de pagos sea igual al total (con margen de redondeo)
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

    // Cerrar el pedido una sola vez con el primer pago (o el único)
    try {
      if (_mesaACerrar.pedidoId) {
        await DB.cerrarPedido(_mesaACerrar.pedidoId, pagos[0].formaPago, pagos[0].monto, 0);
      }
    } catch (e) {
      console.warn('[Cobro] Error al cerrar pedido:', e);
    }

    // Generar tickets individuales si es split
    if (usarSplit) {
      pagos.forEach(pago => {
        const ticketHTML = Tickets.generarCierreParcial(_mesaACerrar, pago);
        Tickets.mostrar(ticketHTML, `Comprobante ${pago.persona} — Mesa ${_mesaACerrar.numero}`);
      });
    } else {
      const ticketHTML = Tickets.generarCierre(_mesaACerrar, pagos[0].monto, 0, pagos[0].formaPago);
      Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`);
    }

    // Liberar mesa
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
    abrirModalCierre, cerrarModalCierre, selectPago,
    actualizarTotalCierre, confirmarCierre,
    actualizarFormaPagoPersona, actualizarMontoPersona, cobrarTodoJunto
  };
})();

window.Cobro = Cobro;