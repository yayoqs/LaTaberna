/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/cobro.js
   Versión: 2.0.4
   Propósito: Modal de cierre de mesa, split bill con pagos por persona,
              pago total y liberación controlada por caja.
              Migración a nombres en español (utils/store).
   ================================================================ */

import { Auth } from '../auth.js';
import { formatearDinero, mostrarToast, calcularTotal, $id } from '../utils.js';
import { Logger } from '../lib/logger.js';
import { Deps } from '../lib/deps.js';
import { CommandBus } from '../lib/command-bus.js';
import { EventBus } from '../lib/eventBus.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';
import { Tickets } from './tickets.js';

const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];
  let _pedidoService = null;

  function _getPedidoService() {
    if (_pedidoService) return _pedidoService;
    try {
      _pedidoService = Deps.obtener('pedidoService');
    } catch (e) {
      Logger.error('[Cobro] No se pudo obtener pedidoService:', e);
    }
    return _pedidoService;
  }

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
          <button class="modal-close" id="btnCerrarModalCierre"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-small-body">
          <div class="cierre-resumen" id="cierreResumen"></div>
          <div id="pagosParcialesContainer" style="display:none;"></div>
          <div id="cierreSingleContainer">
            <label>Forma de Pago</label>
            <div class="formas-pago" id="formasPagoContainer">
              <button class="pago-btn active" data-pago="Efectivo"><i class="fas fa-money-bill"></i> Efectivo</button>
              <button class="pago-btn" data-pago="Débito"><i class="fas fa-credit-card"></i> Débito</button>
              <button class="pago-btn" data-pago="Crédito"><i class="fas fa-credit-card"></i> Crédito</button>
              <button class="pago-btn" data-pago="Transferencia"><i class="fas fa-mobile-alt"></i> Transf.</button>
              <button class="pago-btn" data-pago="Mixto"><i class="fas fa-layer-group"></i> Mixto</button>
            </div>
            <label for="cierreDescuento">Descuento (%)</label>
            <input type="number" id="cierreDescuento" value="0" min="0" max="100">
            <div class="cierre-total-final" id="cierreTotalFinal"></div>
          </div>
          <div class="modal-small-footer" style="flex-wrap:wrap; gap:8px;">
            <button class="btn-secondary" id="btnCancelarCierre">Cancelar</button>
            <button class="btn-primary" id="btnConfirmarCierre"><i class="fas fa-check-circle"></i> Confirmar y Cobrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalCierre').addEventListener('click', cerrarModalCierre);
    document.getElementById('btnCancelarCierre').addEventListener('click', cerrarModalCierre);
    document.getElementById('btnConfirmarCierre').addEventListener('click', confirmarCierre);
    document.getElementById('cierreDescuento').addEventListener('input', actualizarTotalCierre);

    document.getElementById('formasPagoContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('.pago-btn');
      if (btn) selectPago(btn);
    });
  }

  function abrirModalCierre(mesaOpcional) {
    if (!Auth.puedeCerrarMesa()) {
      mostrarToast('error', 'No tienes permiso para cerrar mesas');
      return;
    }

    if (!mesaOpcional) {
      const mesas = Store.obtenerEstado().mesas || [];
      _mesaACerrar = mesas.find(m => m.estado === 'cuenta' || m.estado === 'ocupada');
    } else {
      _mesaACerrar = mesaOpcional;
    }

    if (!_mesaACerrar) {
      mostrarToast('warning', 'No hay ninguna mesa para cerrar.');
      return;
    }
    if (!_mesaACerrar.items || _mesaACerrar.items.length === 0) {
      mostrarToast('warning', 'La mesa no tiene consumos.');
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
      const singleContainer = document.getElementById('cierreSingleContainer');
      if (ppContainer) ppContainer.style.display = 'none';
      if (singleContainer) singleContainer.style.display = 'block';
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
      html += `<div class="cierre-persona-group"><div class="cierre-persona-header">${persona} <span>${formatearDinero(data.subtotal)}</span></div>`;
      data.items.forEach(it => {
        html += `<div class="cierre-resumen-row"><span>${it.qty}x ${it.nombre}</span><span>${formatearDinero(it.precio * it.qty)}</span></div>`;
      });
      html += `</div>`;
    }
    html += `<div class="cierre-resumen-row total-row"><span>Total</span><span>${formatearDinero(_mesaACerrar.total)}</span></div>`;
    resumenEl.innerHTML = html;

    if (Object.keys(porPersona).length > 1) {
      _renderPagosParciales(porPersona);
    } else {
      const ppContainer = document.getElementById('pagosParcialesContainer');
      const singleContainer = document.getElementById('cierreSingleContainer');
      if (ppContainer) ppContainer.style.display = 'none';
      if (singleContainer) singleContainer.style.display = 'block';
    }

    _actualizarTotalFinal();
  }

  function _renderPagosParciales(porPersona) {
    const container = document.getElementById('pagosParcialesContainer');
    const singleContainer = document.getElementById('cierreSingleContainer');
    if (!container) return;

    if (singleContainer) singleContainer.style.display = 'none';

    let html = '<h4>Pago por persona</h4>';
    for (const persona of Object.keys(porPersona)) {
      const pagoExistente = _pagosParciales.find(p => p.persona === persona);
      const montoSugerido = porPersona[persona].subtotal;
      const monto = pagoExistente ? pagoExistente.monto : montoSugerido;
      const forma = pagoExistente ? pagoExistente.formaPago : 'Efectivo';

      html += `<div class="pago-persona-row" id="fila-${persona.replace(/\s/g, '_')}">
        <span>${persona}: ${formatearDinero(montoSugerido)}</span>
        <select class="select-forma-pago" data-persona="${persona}">
          <option value="Efectivo" ${forma === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
          <option value="Débito" ${forma === 'Débito' ? 'selected' : ''}>Débito</option>
          <option value="Crédito" ${forma === 'Crédito' ? 'selected' : ''}>Crédito</option>
          <option value="Transferencia" ${forma === 'Transferencia' ? 'selected' : ''}>Transf.</option>
        </select>
        <input type="number" class="input-monto-persona" data-persona="${persona}" value="${monto}" step="0.01" min="0">
        <button class="btn-primary btn-cobrar-persona" data-persona="${persona}" style="font-size:12px; padding:4px 8px;">Cobrar</button>
      </div>`;
    }
    html += `<button class="btn-secondary" id="btnCobrarTodoJuntoSplit" style="margin-top:8px;">Cobrar todo junto</button>`;
    html += `<div id="saldoPendienteInfo" style="margin-top:8px; font-weight:bold;"></div>`;
    container.innerHTML = html;
    container.style.display = 'block';

    container.querySelectorAll('.select-forma-pago').forEach(select => {
      select.addEventListener('change', function() {
        actualizarFormaPagoPersona(this.dataset.persona, this.value);
      });
    });

    container.querySelectorAll('.input-monto-persona').forEach(input => {
      input.addEventListener('change', function() {
        actualizarMontoPersona(this.dataset.persona, this.value);
      });
    });

    container.querySelectorAll('.btn-cobrar-persona').forEach(btn => {
      btn.addEventListener('click', function() {
        cobrarPersona(this.dataset.persona);
      });
    });

    document.getElementById('btnCobrarTodoJuntoSplit')?.addEventListener('click', () => {
      document.getElementById('pagosParcialesContainer').style.display = 'none';
      document.getElementById('cierreSingleContainer').style.display = 'block';
    });

    _actualizarSaldoPendiente();
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

  function _actualizarSaldoPendiente() {
    const infoEl = document.getElementById('saldoPendienteInfo');
    if (!infoEl || !_mesaACerrar) return;
    const total = calcularTotal(_mesaACerrar.items);
    const pagado = _pagosParciales
      .filter(p => p.pagado)
      .reduce((s, p) => s + p.monto, 0);
    const pendiente = total - pagado;
    infoEl.textContent = `Pagado: ${formatearDinero(pagado)} | Pendiente: ${formatearDinero(pendiente)}`;
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

  async function cobrarPersona(persona) {
    const pago = _pagosParciales.find(p => p.persona === persona);
    if (!pago) return mostrarToast('error', 'Persona no encontrada en pagos');

    if (!_mesaACerrar || !_mesaACerrar.pedidoId) {
      return mostrarToast('error', 'La mesa no tiene un pedido asociado.');
    }

    const pedidoService = _getPedidoService();
    if (!pedidoService) {
      return mostrarToast('error', 'Servicio de pedidos no disponible.');
    }

    let resultado;
    try {
      resultado = await pedidoService.agregarTransaccion(_mesaACerrar.pedidoId, {
        persona,
        monto: pago.monto,
        formaPago: pago.formaPago
      });
    } catch (e) {
      Logger.error('[Cobro] Error al agregar transacción:', e);
      return mostrarToast('error', 'Error al procesar el pago.');
    }

    if (!resultado.exito) {
      return mostrarToast('error', resultado.error || 'Error al cobrar');
    }

    pago.pagado = true;

    const fila = document.getElementById(`fila-${persona.replace(/\s/g, '_')}`);
    if (fila) fila.style.opacity = '0.5';

    _actualizarSaldoPendiente();

    if (resultado.datos && resultado.datos.pedidoCerrado) {
      cerrarModalCierre();
      const ticketHTML = Tickets.generarCierre(_mesaACerrar, calcularTotal(_mesaACerrar.items), 0, 'Mixto');
      Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`, {
        textoImprimir: 'Imprimir',
        claseImprimir: 'btn-print',
        onImprimir: () => true,
        textoExtra: 'Liberar Mesa',
        onExtra: async () => {
          EventBus.emit('pago:confirmado', {
            mesa: _mesaACerrar.numero,
            pedidoId: _mesaACerrar.pedidoId,
            total: calcularTotal(_mesaACerrar.items)
          });

          try {
            const res = await CommandBus.ejecutar({
              type: 'liberarMesa',
              datos: { numeroMesa: _mesaACerrar.numero }
            });
            if (res.exito) {
              EventBus.emit('pedido:cerrado', { mesa: _mesaACerrar.numero });
              mostrarToast('success', `Mesa ${_mesaACerrar.numero} liberada.`);
            } else {
              mostrarToast('error', 'Error al liberar la mesa: ' + res.error);
            }
          } catch (err) {
            Logger.error('[Cobro] Error al liberar mesa:', err);
            mostrarToast('error', 'Error inesperado al liberar la mesa.');
          }
          _mesaACerrar = null;
        }
      });
    } else {
      mostrarToast('success', `${persona} pagó ${formatearDinero(pago.monto)}. Saldo pendiente: ${formatearDinero(resultado.datos.saldoRestante)}`);
    }
  }

  function cobrarTodoJunto() {
    const container = document.getElementById('pagosParcialesContainer');
    if (container) container.style.display = 'none';
    document.getElementById('cierreSingleContainer').style.display = 'block';
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
    if (totalEl) totalEl.textContent = `TOTAL A COBRAR: ${formatearDinero(total)}`;
  }

  async function confirmarCierre() {
    if (!_mesaACerrar) return;

    const ppContainer = document.getElementById('pagosParcialesContainer');
    const usarSplit = ppContainer && ppContainer.style.display !== 'none';

    if (usarSplit) {
      const pendientes = _pagosParciales.filter(p => !p.pagado);
      if (pendientes.length === 0) {
        mostrarToast('warning', 'No hay pagos pendientes.');
        return;
      }
      for (const pago of pendientes) {
        await cobrarPersona(pago.persona);
      }
      return;
    }

    const subtotal = calcularTotal(_mesaACerrar.items);
    const descuentoInput = document.getElementById('cierreDescuento');
    const descuento = parseFloat(descuentoInput?.value) || 0;
    const totalFinal = Math.round(subtotal * (1 - descuento / 100));

    const pedidoService = _getPedidoService();
    if (!pedidoService) {
      mostrarToast('error', 'Servicio de pedidos no disponible.');
      return;
    }

    if (!_mesaACerrar.pedidoId) {
      mostrarToast('error', 'La mesa no tiene un pedido asociado.');
      return;
    }

    const descuentoAplicado = parseFloat(document.getElementById('cierreDescuento')?.value) || 0;

    let resultado;
    try {
      resultado = await pedidoService.cerrarPedidoSinLiberar(_mesaACerrar.pedidoId, {
        formaPago: _formaPago,
        totalFinal,
        descuento: descuentoAplicado
      });
    } catch (e) {
      Logger.error('[Cobro] Error al cerrar pedido:', e);
      mostrarToast('error', 'Error al procesar el pago: ' + e.message);
      return;
    }

    if (!resultado.exito) {
      mostrarToast('error', resultado.error || 'Error al procesar el pago');
      return;
    }

    const pedidoCerrado = DB.pedidos.find(p => p.id === _mesaACerrar.pedidoId);
    if (pedidoCerrado && typeof DB.syncGuardarPedido === 'function') {
      const pedidoParaSync = {
        id:          pedidoCerrado.id,
        mesa:        pedidoCerrado.mesa,
        mozo:        pedidoCerrado.mozo || 'Sin mozo',
        comensales:  pedidoCerrado.comensales || 1,
        estado:      'cerrada',
        items:       Array.isArray(pedidoCerrado.items) ? JSON.stringify(pedidoCerrado.items) : (pedidoCerrado.items || '[]'),
        total:       pedidoCerrado.total || 0,
        created_at:  pedidoCerrado.created_at,
        updated_at:  pedidoCerrado.updated_at || new Date().toISOString()
      };
      try {
        await DB.syncGuardarPedido(pedidoParaSync);
        Logger.info('[Cobro] Pedido sincronizado con Sheets tras el cierre.');
      } catch (e) {
        Logger.warn('[Cobro] Error al sincronizar con Sheets, encolado.', e);
        mostrarToast('warning', 'El ticket se guardó localmente y se enviará cuando haya conexión.');
      }
    }

    cerrarModalCierre();

    const ticketHTML = Tickets.generarCierre(_mesaACerrar, totalFinal, descuentoAplicado, _formaPago);
    Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`, {
      textoImprimir: 'Imprimir',
      claseImprimir: 'btn-print',
      onImprimir: () => true,
      textoExtra: 'Liberar Mesa',
      onExtra: async () => {
        EventBus.emit('pago:confirmado', {
          mesa: _mesaACerrar.numero,
          pedidoId: _mesaACerrar.pedidoId,
          total: totalFinal
        });

        try {
          const res = await CommandBus.ejecutar({
            type: 'liberarMesa',
            datos: { numeroMesa: _mesaACerrar.numero }
          });
          if (res.exito) {
            EventBus.emit('pedido:cerrado', { mesa: _mesaACerrar.numero });
            mostrarToast('success', `Mesa ${_mesaACerrar.numero} liberada.`);
          } else {
            mostrarToast('error', 'Error al liberar la mesa: ' + res.error);
          }
        } catch (err) {
          Logger.error('[Cobro] Error al liberar mesa:', err);
          mostrarToast('error', 'Error inesperado al liberar la mesa.');
        }
        _mesaACerrar = null;
      }
    });
  }

  function cerrarModalCierre() {
    const modal = document.getElementById('modalCierre');
    if (modal) modal.style.display = 'none';
  }

  EventBus.on('cobro:solicitado', () => abrirModalCierre());

  return {
    abrirModalCierre,
    cerrarModalCierre,
    selectPago,
    actualizarTotalCierre,
    confirmarCierre,
    actualizarFormaPagoPersona,
    actualizarMontoPersona,
    cobrarTodoJunto,
    cobrarPersona
  };
})();

export { Cobro };