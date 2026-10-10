/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/cobro.js
   Versión: 2.3.0
   Propósito: Modal de cierre de mesa con división de cuenta (split bill),
              pago total y liberación controlada por caja.
              v2.3.0: usa precio_unitario cuando está disponible, con
                      fallback a precio * qty. Soporte de variantes.
   Dependencias:
     · js/auth.js
     · js/utils.js
     · js/lib/logger.js
     · js/lib/deps.js
     · js/lib/command-bus.js
     · js/lib/eventBus.js
     · js/lib/store.js
     · js/ui/tickets.js
   ================================================================ */

import { Auth } from '../auth.js';
import { formatearDinero, mostrarToast, $id } from '../utils.js';
import { Logger } from '../lib/logger.js';
import { Deps } from '../lib/deps.js';
import { CommandBus } from '../lib/command-bus.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';
import { Tickets } from './tickets.js';

const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];
  let _pedidoService = null;
  let _modoSplit = 'total';
  let _efectivoRecibido = 0;

  let _cerrando = false;
  const _cobrandoPersonas = new Set();

  let _claveCierre = null;
  const _clavesPersonas = new Map();

  function _getPedidoService() {
    if (_pedidoService) return _pedidoService;
    try {
      _pedidoService = Deps.obtener('pedidoService');
    } catch (e) {
      Logger.error('[Cobro] No se pudo obtener pedidoService:', e);
    }
    return _pedidoService;
  }

  function _generarClaveIdempotencia(operacion, referencia) {
    const rnd = Math.random().toString(36).slice(2, 11);
    return `${operacion}:${referencia}:${Date.now()}:${rnd}`;
  }

  function _reiniciarClaves() {
    _claveCierre = null;
    _clavesPersonas.clear();
    _cerrando = false;
    _cobrandoPersonas.clear();
  }

  function _precioItem(item) {
    if (typeof item.precio_unitario === 'number' && item.precio_unitario > 0) {
      return item.precio_unitario;
    }
    return item.precio || 0;
  }

  function _calcularTotalMesa() {
    if (!_mesaACerrar || !Array.isArray(_mesaACerrar.items)) return 0;
    return _mesaACerrar.items.reduce((s, it) => s + _precioItem(it) * (it.qty || 1), 0);
  }

  function _asegurarModalCierre() {
    if ($id('modalCierre')) return;

    const modal = document.createElement('div');
    modal.id = 'modalCierre';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="cobro-modal">
        <div class="modal-header">
          <div>
            <h3><i class="fas fa-file-invoice-dollar icon-accent"></i> Cierre de Mesa <span id="cobroMesaNumero"></span></h3>
            <div class="mh-sub" id="cobroMesaDetalle"></div>
          </div>
          <button class="modal-close" id="btnCerrarModalCierre"><i class="fas fa-times"></i></button>
        </div>

        <div class="cobro-body">
          <div class="cobro-left">
            <div class="split-tabs">
              <button class="active" data-split="total" id="tabSplitTotal"><i class="fas fa-receipt"></i> Total</button>
              <button data-split="persona" id="tabSplitPersona"><i class="fas fa-users"></i> Por persona</button>
              <button data-split="items" id="tabSplitItems"><i class="fas fa-list-check"></i> Por ítems</button>
            </div>

            <div class="split-panel active" id="panel-total">
              <div id="listaItemsTotal"></div>
              <p style="font-size:12px;color:var(--color-text-muted);margin-top:14px;">
                <i class="fas fa-circle-info"></i> Se cobrará el total en un solo pago.
              </p>
            </div>

            <div class="split-panel" id="panel-persona">
              <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px;">
                División equitativa entre comensales. Ajusta montos manualmente si es necesario.
              </p>
              <div id="listaPersonas"></div>
              <div class="person-add-row">
                <button class="person-add-btn" id="btnAgregarComensal"><i class="fas fa-user-plus"></i> Agregar comensal</button>
                <button class="person-add-btn" id="btnDividirPartesIguales"><i class="fas fa-arrows-split-up-and-left"></i> Dividir en partes iguales</button>
              </div>
            </div>

            <div class="split-panel" id="panel-items">
              <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:10px;">
                Toca un avatar para asignar el ítem a esa persona.
              </p>
              <div id="listaItemsAsignacion"></div>
            </div>

            <div class="discount-row">
              <div class="form-group">
                <label for="cierreDescuento">Descuento (%)</label>
                <input type="number" id="cierreDescuento" inputmode="decimal" value="0" min="0" max="100">
              </div>
              <div class="form-group">
                <label for="cierrePropina">Propina</label>
                <select id="cierrePropina">
                  <option value="0">Sin propina</option>
                  <option value="5">5%</option>
                  <option value="10" selected>10%</option>
                  <option value="15">15%</option>
                  <option value="custom">Monto personalizado</option>
                </select>
              </div>
            </div>
          </div>

          <div class="cobro-right">
            <div class="totals-box">
              <div class="tot-line"><span>Subtotal</span><span id="totalSubtotal">$0</span></div>
              <div class="tot-line"><span>Descuento</span><span id="totalDescuento">$0</span></div>
              <div class="tot-line"><span>Propina</span><span id="totalPropina">$0</span></div>
              <div class="tot-line grand"><span>Total</span><span id="totalFinal">$0</span></div>
            </div>

            <div class="restante-box" id="restanteCobrar">Restante por cobrar: <span>$0</span></div>

            <div class="pay-people" id="payPeopleContainer"></div>

            <div class="keypad-box" id="keypadBox" style="display:none;">
              <div style="font-size:10.5px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:2px;">
                Efectivo recibido (<span id="keypadPersonaNombre"></span>)
              </div>
              <div class="keypad-amount" id="keypadAmount">$0</div>
              <div class="quick-cash">
                <button data-monto="5000">$5.000</button>
                <button data-monto="10000">$10.000</button>
                <button data-monto="20000">$20.000</button>
                <button data-monto="exacto">Exacto</button>
              </div>
              <div class="vuelto-line"><span>Vuelto a entregar</span><b id="vueltoCalculado">$0</b></div>
            </div>

            <button class="btn-primary" id="btnCobrarPersonaActual" style="width:100%;justify-content:center;margin-top:auto;display:none;">
              <i class="fas fa-check-circle"></i> Cobrar
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" id="btnImprimirDivision"><i class="fas fa-print"></i> Imprimir división</button>
          <button class="btn-secondary" id="btnCancelarCierre">Cancelar</button>
          <button class="btn-primary" id="btnConfirmarCierre"><i class="fas fa-check-double"></i> Confirmar y cerrar mesa</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnCerrarModalCierre').addEventListener('click', cerrarModalCierre);
    document.getElementById('btnCancelarCierre').addEventListener('click', cerrarModalCierre);

    document.querySelectorAll('.split-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.split-tabs button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.split-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        _modoSplit = btn.dataset.split;
        document.getElementById('panel-' + _modoSplit).classList.add('active');
        _renderSegunModo();
      });
    });

    document.getElementById('cierreDescuento').addEventListener('input', _actualizarTotales);
    document.getElementById('cierrePropina').addEventListener('change', _actualizarTotales);

    document.querySelectorAll('.quick-cash button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.monto === 'exacto') {
          const personaActual = _obtenerPersonaActual();
          if (personaActual) {
            _efectivoRecibido = personaActual.monto;
            _actualizarVuelto();
          }
        } else {
          _efectivoRecibido = parseInt(btn.dataset.monto);
          _actualizarVuelto();
        }
      });
    });

    document.getElementById('btnCobrarPersonaActual').addEventListener('click', () => {
      const persona = _obtenerPersonaActual();
      if (persona) cobrarPersona(persona.persona);
    });

    document.getElementById('btnImprimirDivision').addEventListener('click', () => {
      mostrarToast('info', 'Función de imprimir división próximamente');
    });

    document.getElementById('btnAgregarComensal').addEventListener('click', () => {
      mostrarToast('info', 'Agregar comensal próximamente');
    });

    document.getElementById('btnDividirPartesIguales').addEventListener('click', () => {
      const personas = _pagosParciales.filter(p => !p.pagado);
      if (personas.length === 0) return;
      const totalPendiente = _obtenerTotalPendiente();
      const montoPorPersona = Math.floor(totalPendiente / personas.length);
      personas.forEach(p => { p.monto = montoPorPersona; });
      _renderListaPersonas();
      _actualizarTotales();
    });

    document.getElementById('btnConfirmarCierre').addEventListener('click', confirmarCierre);
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
    _inicializarPagosParciales();
    _reiniciarClaves();

    document.getElementById('cobroMesaNumero').textContent = _mesaACerrar.numero;
    document.getElementById('cobroMesaDetalle').textContent = `${_mesaACerrar.mozo || 'Mozo'} · ${_mesaACerrar.comensales || 1} comensales`;

    _modoSplit = 'total';
    document.querySelectorAll('.split-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tabSplitTotal').classList.add('active');
    document.querySelectorAll('.split-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-total').classList.add('active');

    _renderListaItemsTotal();
    _renderListaPersonas();
    _renderListaItemsAsignacion();
    _actualizarTotales();

    const modal = document.getElementById('modalCierre');
    if (modal) modal.style.display = 'flex';
  }

  function _inicializarPagosParciales() {
    _pagosParciales = [];
    const porPersona = {};
    _mesaACerrar.items.forEach(it => {
      const p = it.persona || 'General';
      if (!porPersona[p]) porPersona[p] = 0;
      porPersona[p] += _precioItem(it) * (it.qty || 1);
    });
    for (const [persona, monto] of Object.entries(porPersona)) {
      _pagosParciales.push({ persona, monto, formaPago: 'Efectivo', pagado: false });
    }
  }

  function _renderListaItemsTotal() {
    const cont = document.getElementById('listaItemsTotal');
    if (!cont || !_mesaACerrar) return;
    cont.innerHTML = _mesaACerrar.items.map(it => `
      <div class="item-row">
        <div class="item-qty">${it.qty}x</div>
        <div class="item-name">${it.nombre}</div>
        <div class="item-price">${formatearDinero(_precioItem(it) * it.qty)}</div>
      </div>
    `).join('');
  }

  function _renderListaPersonas() {
    const cont = document.getElementById('listaPersonas');
    if (!cont) return;
    cont.innerHTML = _pagosParciales.map(p => `
      <div class="split-person-card">
        <div class="avatar-lg" style="background:${_colorAvatar(p.persona)};">${_iniciales(p.persona)}</div>
        <div class="spc-info">
          <div class="spc-name">${p.persona}</div>
          <div class="spc-detail">${p.pagado ? 'Pagado' : 'Pendiente de pago'}</div>
        </div>
        <input class="spc-amount-input" data-persona="${p.persona}" value="${p.monto}" ${p.pagado ? 'disabled' : ''}>
      </div>
    `).join('');

    cont.querySelectorAll('.spc-amount-input').forEach(input => {
      input.addEventListener('change', () => {
        const persona = input.dataset.persona;
        const monto = parseFloat(input.value);
        if (!isNaN(monto)) {
          const pago = _pagosParciales.find(p => p.persona === persona);
          if (pago) pago.monto = monto;
          _actualizarTotales();
        }
      });
    });
  }

  function _renderListaItemsAsignacion() {
    const cont = document.getElementById('listaItemsAsignacion');
    if (!cont || !_mesaACerrar) return;
    cont.innerHTML = _mesaACerrar.items.map(it => `
      <div class="item-row">
        <div class="item-qty">${it.qty}x</div>
        <div class="item-name">${it.nombre}</div>
        <div class="item-price">${formatearDinero(_precioItem(it) * it.qty)}</div>
        <div class="item-chips">
          ${_pagosParciales.slice(0,3).map(p => `<div class="chip-avatar" style="background:${_colorAvatar(p.persona)};">${_iniciales(p.persona)}</div>`).join('')}
          <div class="chip-avatar off"><i class="fas fa-plus" style="font-size:8px;"></i></div>
        </div>
      </div>
    `).join('');
  }

  function _renderSegunModo() {
    if (_modoSplit === 'total') {
      document.getElementById('panel-total').classList.add('active');
    } else if (_modoSplit === 'persona') {
      _renderListaPersonas();
    } else if (_modoSplit === 'items') {
      _renderListaItemsAsignacion();
    }
    _actualizarTotales();
  }

  function _actualizarTotales() {
    if (!_mesaACerrar) return;
    const totalEl = document.getElementById('totalFinal');
    if (!totalEl) return;

    const subtotal = _calcularTotalMesa();
    const descuentoInput = document.getElementById('cierreDescuento');
    const descuento = parseFloat(descuentoInput?.value) || 0;
    const propinaSelect = document.getElementById('cierrePropina');
    let propina = 0;
    if (propinaSelect) {
      if (propinaSelect.value === 'custom') {
        propina = parseFloat(prompt('Monto de propina:')) || 0;
        propinaSelect.value = propina;
      } else {
        propina = Math.round(subtotal * (parseFloat(propinaSelect.value) || 0) / 100);
      }
    }

    const total = Math.round(subtotal * (1 - descuento / 100)) + propina;

    document.getElementById('totalSubtotal').textContent = formatearDinero(subtotal);
    document.getElementById('totalDescuento').textContent = formatearDinero(Math.round(subtotal * descuento / 100));
    document.getElementById('totalPropina').textContent = formatearDinero(propina);
    totalEl.textContent = formatearDinero(total);

    const restante = _obtenerTotalPendiente();
    document.getElementById('restanteCobrar').innerHTML = `Restante por cobrar: <span>${formatearDinero(restante)}</span>`;

    const modoActual = document.querySelector('.split-tabs button.active')?.dataset.split || _modoSplit || 'total';
    const enSplit = modoActual !== 'total';

    const btnConfirmar = document.getElementById('btnConfirmarCierre');
    if (btnConfirmar) {
      btnConfirmar.disabled = _cerrando || (enSplit && restante <= 0);
    }

    _renderPayPeople();
  }

  function _obtenerTotalPendiente() {
    const total = _calcularTotalMesa();
    const pagado = _pagosParciales.filter(p => p.pagado).reduce((s, p) => s + p.monto, 0);
    return total - pagado;
  }

  function _obtenerPersonaActual() {
    return _pagosParciales.find(p => !p.pagado) || null;
  }

  function _renderPayPeople() {
    const cont = document.getElementById('payPeopleContainer');
    if (!cont) return;
    cont.innerHTML = _pagosParciales.map(p => `
      <div class="pay-person ${p.pagado ? 'paid' : ''}">
        <div class="pp-top">
          <div class="avatar-lg" style="background:${_colorAvatar(p.persona)};">${_iniciales(p.persona)}</div>
          <div class="pp-name">${p.persona}</div>
          <span class="pp-amt">${formatearDinero(p.monto)}</span>
          ${p.pagado ? '<i class="fas fa-circle-check pp-check"></i>' : ''}
        </div>
        ${!p.pagado ? `
          <div class="pay-methods">
            <button class="pm-chip active" data-persona="${p.persona}" data-metodo="Efectivo"><i class="fas fa-money-bill"></i> Efvo.</button>
            <button class="pm-chip" data-persona="${p.persona}" data-metodo="Débito"><i class="fas fa-credit-card"></i> Débito</button>
            <button class="pm-chip" data-persona="${p.persona}" data-metodo="Crédito"><i class="fas fa-credit-card"></i> Crédito</button>
            <button class="pm-chip" data-persona="${p.persona}" data-metodo="Transferencia"><i class="fas fa-mobile-alt"></i> Transf.</button>
            <button class="pm-chip" data-persona="${p.persona}" data-metodo="Mixto"><i class="fas fa-layer-group"></i> Mixto</button>
          </div>
        ` : ''}
      </div>
    `).join('');

    cont.querySelectorAll('.pm-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const persona = chip.dataset.persona;
        const metodo = chip.dataset.metodo;
        const pago = _pagosParciales.find(p => p.persona === persona);
        if (pago) pago.formaPago = metodo;
        cont.querySelectorAll(`.pm-chip[data-persona="${persona}"]`).forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const keypadBox = document.getElementById('keypadBox');
        const btnCobrar = document.getElementById('btnCobrarPersonaActual');
        if (metodo === 'Efectivo' || metodo === 'Mixto') {
          keypadBox.style.display = 'block';
          btnCobrar.style.display = 'flex';
          btnCobrar.innerHTML = `<i class="fas fa-check-circle"></i> Cobrar a ${persona} — ${formatearDinero(pago.monto)}`;
          document.getElementById('keypadPersonaNombre').textContent = persona;
          _efectivoRecibido = 0;
          _actualizarVuelto();
        } else {
          keypadBox.style.display = 'none';
          btnCobrar.style.display = 'none';
        }
      });
    });
  }

  function _actualizarVuelto() {
    const personaActual = _obtenerPersonaActual();
    if (!personaActual) return;
    document.getElementById('keypadAmount').textContent = formatearDinero(_efectivoRecibido);
    const vuelto = _efectivoRecibido - personaActual.monto;
    document.getElementById('vueltoCalculado').textContent = formatearDinero(Math.max(0, vuelto));
  }

  async function cobrarPersona(persona) {
    if (!persona) return;

    if (_cobrandoPersonas.has(persona)) {
      Logger.warn('[Cobro] cobrarPersona ignorado: operación ya en curso para ' + persona);
      return;
    }

    const pago = _pagosParciales.find(p => p.persona === persona);
    if (!pago) return mostrarToast('error', 'Persona no encontrada en pagos');
    if (pago.pagado) return mostrarToast('info', 'Esta persona ya pagó.');

    if (!_mesaACerrar || !_mesaACerrar.pedidoId) {
      return mostrarToast('error', 'La mesa no tiene un pedido asociado.');
    }

    const pedidoService = _getPedidoService();
    if (!pedidoService) {
      return mostrarToast('error', 'Servicio de pedidos no disponible.');
    }

    let clave = _clavesPersonas.get(persona);
    if (!clave) {
      clave = _generarClaveIdempotencia('cobro-persona', `${_mesaACerrar.pedidoId}::${persona}`);
      _clavesPersonas.set(persona, clave);
    }

    _cobrandoPersonas.add(persona);
    let resultado;
    try {
      resultado = await pedidoService.agregarTransaccion(_mesaACerrar.pedidoId, {
        persona,
        monto: pago.monto,
        formaPago: pago.formaPago,
        claveIdempotencia: clave
      });
    } catch (e) {
      Logger.error('[Cobro] Error al agregar transacción:', e);
      _cobrandoPersonas.delete(persona);
      return mostrarToast('error', 'Error al procesar el pago.');
    }
    _cobrandoPersonas.delete(persona);

    if (!resultado.exito) {
      return mostrarToast('error', resultado.error || 'Error al cobrar');
    }

    pago.pagado = true;

    if (resultado.datos && resultado.datos.pedidoCerrado) {
      cerrarModalCierre();
      const ticketHTML = Tickets.generarCierre(_mesaACerrar, _calcularTotalMesa(), 0, 'Mixto');
      Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`, {
        idOperacion: clave,
        textoImprimir: 'Imprimir',
        claseImprimir: 'btn-print',
        onImprimir: () => true,
        textoExtra: 'Liberar Mesa',
        onExtra: async () => {
          EventBus.emit('pago:confirmado', {
            mesa: _mesaACerrar.numero,
            pedidoId: _mesaACerrar.pedidoId,
            total: _calcularTotalMesa()
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
      _renderListaPersonas();
      _actualizarTotales();
    }
  }

  async function confirmarCierre() {
    if (_cerrando) {
      Logger.warn('[Cobro] confirmarCierre ignorado: ya hay un cierre en curso.');
      return;
    }
    if (!_mesaACerrar) return;

    const modoActual = document.querySelector('.split-tabs button.active')?.dataset.split || _modoSplit || 'total';
    const usarSplit = modoActual !== 'total';

    if (usarSplit) {
      const pendientes = _pagosParciales.filter(p => !p.pagado);
      if (pendientes.length === 0) {
        mostrarToast('info', 'Todos los pagos ya están registrados.');
        return;
      }
      for (const pago of pendientes) {
        await cobrarPersona(pago.persona);
      }
      return;
    }

    const pedidoService = _getPedidoService();
    if (!pedidoService) {
      mostrarToast('error', 'Servicio de pedidos no disponible.');
      return;
    }

    if (!_mesaACerrar.pedidoId) {
      mostrarToast('error', 'La mesa no tiene un pedido asociado.');
      return;
    }

    if (!_claveCierre) {
      _claveCierre = _generarClaveIdempotencia('cierre-total', _mesaACerrar.pedidoId);
    }

    _cerrando = true;
    const btnConfirmar = document.getElementById('btnConfirmarCierre');
    if (btnConfirmar) btnConfirmar.disabled = true;

    const subtotal = _calcularTotalMesa();
    const descuentoInput = document.getElementById('cierreDescuento');
    const descuento = parseFloat(descuentoInput?.value) || 0;
    const totalFinal = Math.round(subtotal * (1 - descuento / 100));

    let resultado;
    try {
      resultado = await pedidoService.cerrarPedidoSinLiberar(_mesaACerrar.pedidoId, {
        formaPago: _formaPago,
        totalFinal,
        descuento,
        claveIdempotencia: _claveCierre
      });
    } catch (e) {
      Logger.error('[Cobro] Error al cerrar pedido:', e);
      mostrarToast('error', 'Error al procesar el pago: ' + e.message);
      _cerrando = false;
      if (btnConfirmar) btnConfirmar.disabled = false;
      return;
    }

    if (!resultado || !resultado.exito) {
      mostrarToast('error', (resultado && resultado.error) || 'Error al procesar el pago');
      _cerrando = false;
      if (btnConfirmar) btnConfirmar.disabled = false;
      return;
    }

    cerrarModalCierre();

    const ticketHTML = Tickets.generarCierre(_mesaACerrar, totalFinal, descuento, _formaPago);
    Tickets.mostrar(ticketHTML, `Comprobante — Mesa ${_mesaACerrar.numero}`, {
      idOperacion: _claveCierre,
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

    _cerrando = false;
  }

  function cerrarModalCierre() {
    const modal = document.getElementById('modalCierre');
    if (modal) modal.style.display = 'none';
  }

  function _iniciales(nombre) {
    return nombre.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
  }

  function _colorAvatar(nombre) {
    const colores = ['#17b8a6', '#f5a623', '#7076f2', '#ef4444', '#22c55e'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    return colores[Math.abs(hash) % colores.length];
  }

  EventBus.on('cobro:solicitado', () => abrirModalCierre());

  return {
    abrirModalCierre,
    cerrarModalCierre,
    confirmarCierre,
    cobrarPersona
  };
})();

export { Cobro };