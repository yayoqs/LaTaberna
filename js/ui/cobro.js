/* ================================================================
   PubPOS — MÓDULO: cobro.js (v5.0 – usa comando liberarMesa)
   ================================================================ */
const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];

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
      if (pagos.length === 0) { showToast('error', 'No hay pagos registrados.'); return; }
      const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
      const total = calcularTotal(_mesaACerrar.items);
      if (Math.abs(sumaPagos - total) > 0.01) {
        showToast('warning', `La suma de pagos (${fmtMoney(sumaPagos)}) no coincide con el total (${fmtMoney(total)}).`);
        return;
      }
    } else {
      const subtotal = calcularTotal(_mesaACerrar.items);
      const descuentoInput = document.getElementById('cierreDescuento');
      const descuento = parseFloat(descuentoInput?.value) || 0;
      const totalFinal = Math.round(subtotal * (1 - descuento / 100));
      pagos = [{ persona: 'Total', monto: totalFinal, formaPago: _formaPago }];
    }

    // ── 1. Cerrar el pedido a través del Servicio de Dominio ──
    let pedidoService;
    try {
      pedidoService = Deps.obtener('pedidoService');
    } catch (e) {
      showToast('error', 'Servicio de pedidos no disponible.');
      return;
    }

    if (!_mesaACerrar.pedidoId) {
      showToast('error', 'La mesa no tiene un pedido asociado.');
      return;
    }

    try {
      await pedidoService.cerrarPedido(_mesaACerrar.pedidoId, {
        formaPago: pagos[0].formaPago,
        totalFinal: pagos[0].monto,
        descuento: parseFloat(document.getElementById('cierreDescuento')?.value) || 0
      });
    } catch (e) {
      Logger.error('[Cobro] Error al cerrar pedido:', e);
      showToast('error', 'Error al procesar el pago: ' + e.message);
      return;
    }

    // ── 2. Sincronización inmediata con Sheets (se delega en el servicio, pero forzamos igual) ──
    //    El servicio ya incluye sincronización. Se mantiene la lógica de respaldo.
    const pedidoCerrado = DB.pedidos.find(p => p.id === _mesaACerrar.pedidoId);
    if (pedidoCerrado && typeof DB.syncGuardarPedido === 'function') {
      const pedidoParaSync = {
        id:          pedidoCerrado.id,
        mesa:        pedidoCerrado.mesa,
        mozo:        pedidoCerrado.mozo || 'Sin mozo',
        comensales:  pedidoCerrado.comensales || 1,
        estado:      'cerrada',
        items:       Array.isArray(pedidoCerrado.items)
                       ? JSON.stringify(pedidoCerrado.items)
                       : (pedidoCerrado.items || '[]'),
        total:       pedidoCerrado.total || 0,
        created_at:  pedidoCerrado.created_at,
        updated_at:  pedidoCerrado.updated_at || new Date().toISOString()
      };

      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[Cobro] Pedido sincronizado con Sheets tras el cierre.');
      } catch (e) {
        Logger.warn('[Cobro] Error al sincronizar con Sheets, encolado.', e);
        showToast('warning', 'El ticket se guardó localmente y se enviará cuando haya conexión.');
      }
    }

    // ── 3. Cerrar el modal y mostrar ticket con acciones ──
    cerrarModalCierre();

    const ticketHTML = Tickets.generarCierre(_mesaACerrar, pagos[0].monto, 0, pagos[0].formaPago);
    Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`, {
      textoImprimir: 'Imprimir',
      claseImprimir: 'btn-print',
      onImprimir: () => true,
      textoExtra: 'Pagado',
      onExtra: async () => {
        // ── Liberar la mesa usando el comando ──
        try {
          if (typeof CommandBus !== 'undefined') {
            const res = await CommandBus.ejecutar({
              type: 'liberarMesa',
              datos: { numeroMesa: _mesaACerrar.numero }
            });
            if (res.exito) {
              EventBus.emit('pedido:cerrado', { mesa: _mesaACerrar.numero });
              if (typeof Pedido !== 'undefined' && Pedido.cerrar) Pedido.cerrar();
              showToast('success', `Mesa ${_mesaACerrar.numero} pagada y liberada.`);
            } else {
              showToast('error', 'Error al liberar la mesa: ' + res.error);
            }
          } else {
            // Fallback si CommandBus no está disponible (mantenemos acceso directo mínimo)
            if (_mesaACerrar.esVirtual) {
              DB.liberarMesasFusionadas(_mesaACerrar);
            } else {
              const idx = DB.mesas.findIndex(m => m.numero === _mesaACerrar.numero);
              if (idx >= 0) DB.mesas[idx] = mesaVacia(_mesaACerrar.numero);
            }
            DB.saveMesas();
            EventBus.emit('pedido:cerrado', { mesa: _mesaACerrar.numero });
            if (typeof Pedido !== 'undefined' && Pedido.cerrar) Pedido.cerrar();
            showToast('success', `Mesa ${_mesaACerrar.numero} pagada y liberada.`);
          }
        } catch (err) {
          Logger.error('[Cobro] Error al liberar mesa:', err);
          showToast('error', 'Error inesperado al liberar la mesa.');
        }
        _mesaACerrar = null;
      }
    });
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