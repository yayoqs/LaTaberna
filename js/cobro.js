/* ================================================================
   PubPOS — MÓDULO: cobro.js (v4 – split bill con asignación visual,
              validación estricta y tickets mejorados)
   ================================================================ */
const Cobro = (() => {
  let _mesaACerrar = null;
  let _formaPago = 'Efectivo';
  let _pagosParciales = [];
  let _personas = [];            // nombres de personas en la mesa
  let _asignaciones = {};        // { prodId_idx: persona } mapeo temporal

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

    _inicializarPersonasYAsignaciones();
    _renderTodo();
    document.getElementById('modalCierre').style.display = 'flex';
  }

  function _inicializarPersonasYAsignaciones() {
    // Recoge personas de los ítems (si ya tienen) o crea 'General'
    const setPersonas = new Set(_mesaACerrar.items.map(it => it.persona || 'General'));
    _personas = Array.from(setPersonas);
    if (_personas.length === 0) _personas = ['General'];

    // Mapa de asignaciones: para cada item, persona actual
    _asignaciones = {};
    _mesaACerrar.items.forEach((it, idx) => {
      _asignaciones[idx] = it.persona || 'General';
    });
  }

  function _renderTodo() {
    _renderResumenAsignacion();
    _renderPagosParciales();
    _actualizarTotalFinal();
  }

  /* ── SECCIÓN: ASIGNACIÓN DE ÍTEMS A PERSONAS ────────────── */
  function _renderResumenAsignacion() {
    const resumenEl = document.getElementById('cierreResumen');
    if (!resumenEl || !_mesaACerrar) return;

    let html = `<div style="margin-bottom:12px"><strong>Mesa ${_mesaACerrar.numero}</strong> - ${_mesaACerrar.mozo}</div>`;

    // Lista de personas con botones para agregar/quitar
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
      <span style="font-weight:600;">Personas:</span>
      ${_personas.map(p => `<span class="persona-chip">${p} ${_personas.length > 1 ? `<button onclick="Cobro._eliminarPersona('${p}')" style="background:none;border:none;color:var(--color-danger);cursor:pointer;">×</button>` : ''}</span>`).join('')}
      <button class="btn-icon-sm" onclick="Cobro._agregarPersona()" title="Agregar persona"><i class="fas fa-plus"></i></button>
    </div>`;

    html += `<table style="width:100%; font-size:13px; margin-bottom:12px;">
      <thead><tr><th>Ítem</th><th>Persona</th><th style="text-align:right;">Precio</th></tr></thead>
      <tbody>`;

    _mesaACerrar.items.forEach((it, idx) => {
      const personaAsignada = _asignaciones[idx] || 'General';
      html += `<tr>
        <td>${it.qty}x ${it.nombre}</td>
        <td>
          <select onchange="Cobro._cambiarAsignacion(${idx}, this.value)" style="font-size:12px;">
            ${_personas.map(p => `<option value="${p}" ${p === personaAsignada ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:right;">${fmtMoney(it.precio * it.qty)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;

    // Totales por persona
    const totales = _calcularTotalesPorPersona();
    html += `<div style="background:var(--color-panel); padding:8px; border-radius:6px; margin-bottom:8px;">`;
    for (const [persona, monto] of Object.entries(totales)) {
      html += `<div style="display:flex; justify-content:space-between;"><span>${persona}:</span><strong>${fmtMoney(monto)}</strong></div>`;
    }
    html += `<div style="display:flex; justify-content:space-between; border-top:1px solid var(--color-border); margin-top:4px; padding-top:4px;">
      <span>Total Mesa:</span><strong>${fmtMoney(calcularTotal(_mesaACerrar.items))}</strong></div>`;
    html += `</div>`;

    resumenEl.innerHTML = html;
  }

  function _calcularTotalesPorPersona() {
    const totales = {};
    _mesaACerrar.items.forEach((it, idx) => {
      const p = _asignaciones[idx] || 'General';
      totales[p] = (totales[p] || 0) + it.precio * it.qty;
    });
    return totales;
  }

  // Métodos públicos para los select y botones
  window.Cobro._cambiarAsignacion = function(idx, persona) {
    if (!_mesaACerrar) return;
    _asignaciones[idx] = persona;
    _mesaACerrar.items[idx].persona = persona;   // reflejar en el objeto
    _renderTodo();
  };

  window.Cobro._agregarPersona = function() {
    const nombre = prompt('Nombre de la persona:');
    if (!nombre) return;
    if (_personas.includes(nombre)) {
      showToast('warning', 'Esa persona ya existe');
      return;
    }
    _personas.push(nombre);
    // Si hay ítems sin persona, se asignan a la nueva por defecto? Mejor no.
    _renderTodo();
  };

  window.Cobro._eliminarPersona = function(persona) {
    if (_personas.length <= 1) {
      showToast('warning', 'Debe haber al menos una persona');
      return;
    }
    if (!confirm(`¿Eliminar a "${persona}"? Los ítems que tenía pasarán a "General".`)) return;

    _personas = _personas.filter(p => p !== persona);
    // Reasignar ítems de esa persona a General
    Object.keys(_asignaciones).forEach(idx => {
      if (_asignaciones[idx] === persona) {
        _asignaciones[idx] = 'General';
        _mesaACerrar.items[idx].persona = 'General';
      }
    });
    _renderTodo();
  };

  /* ── PAGOS POR PERSONA (ahora basado en totales asignados) ── */
  function _renderPagosParciales() {
    const container = document.getElementById('pagosParcialesContainer');
    if (!container) return;
    const totales = _calcularTotalesPorPersona();
    let html = '<h4>Pago por persona</h4>';
    for (const persona of _personas) {
      const subtotal = totales[persona] || 0;
      const pagoExistente = _pagosParciales.find(p => p.persona === persona);
      const montoActual = pagoExistente ? pagoExistente.monto : subtotal;
      const forma = pagoExistente ? pagoExistente.formaPago : 'Efectivo';

      html += `<div class="pago-persona-row">
        <span>${persona}: ${fmtMoney(subtotal)}</span>
        <select id="formaPago_${persona}" onchange="Cobro.actualizarFormaPagoPersona('${persona}', this.value)">
          <option value="Efectivo" ${forma === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
          <option value="Débito" ${forma === 'Débito' ? 'selected' : ''}>Débito</option>
          <option value="Crédito" ${forma === 'Crédito' ? 'selected' : ''}>Crédito</option>
        </select>
        <input type="number" id="monto_${persona}" value="${montoActual.toFixed(2)}" step="0.01" min="0" onchange="Cobro.actualizarMontoPersona('${persona}', this.value)">
      </div>`;
    }
    html += `<button class="btn-secondary" onclick="Cobro.cobrarTodoJunto()">Cobrar todo junto</button>`;
    container.innerHTML = html;
    container.style.display = 'block';
  }

  function actualizarFormaPagoPersona(persona, forma) {
    const pago = _pagosParciales.find(p => p.persona === persona);
    if (pago) pago.formaPago = forma;
    else _pagosParciales.push({ persona, monto: 0, formaPago: forma });
  }

  function actualizarMontoPersona(persona, montoStr) {
    const monto = parseFloat(montoStr);
    if (isNaN(monto)) return;
    const pago = _pagosParciales.find(p => p.persona === persona);
    if (pago) pago.monto = monto;
    else _pagosParciales.push({ persona, monto, formaPago: 'Efectivo' });
    _actualizarTotalFinal();
  }

  function cobrarTodoJunto() {
    // Ocultar pagos parciales, usar pago único
    document.getElementById('pagosParcialesContainer').style.display = 'none';
    document.getElementById('cierreDescuento').value = 0;
    _pagosParciales = [];
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
    const total = calcularTotal(_mesaACerrar.items);
    const totalEl = document.getElementById('cierreTotalFinal');
    if (totalEl) totalEl.textContent = `TOTAL A COBRAR: ${fmtMoney(total)}`;
  }

  /* ── CONFIRMACIÓN CON VALIDACIÓN ESTRICTA ────────────────── */
  async function confirmarCierre() {
    if (!_mesaACerrar) return;
    const usarSplit = document.getElementById('pagosParcialesContainer')?.style.display !== 'none';
    const totalMesa = calcularTotal(_mesaACerrar.items);

    if (usarSplit) {
      // Asegurarse que _pagosParciales refleje todas las personas
      _personas.forEach(persona => {
        if (!_pagosParciales.find(p => p.persona === persona)) {
          const subtotal = _calcularTotalesPorPersona()[persona] || 0;
          _pagosParciales.push({ persona, monto: subtotal, formaPago: 'Efectivo' });
        }
      });

      // Validación 1: suma total de pagos = total mesa
      const sumaPagos = _pagosParciales.reduce((s, p) => s + p.monto, 0);
      if (Math.abs(sumaPagos - totalMesa) > 0.01) {
        showToast('error', `La suma de pagos (${fmtMoney(sumaPagos)}) no coincide con el total (${fmtMoney(totalMesa)}). Ajustá los montos.`);
        return;
      }

      // Validación 2: ningún pago excede el subtotal asignado a esa persona (con tolerancia)
      const totales = _calcularTotalesPorPersona();
      for (const pago of _pagosParciales) {
        const maxPersona = totales[pago.persona] || 0;
        if (pago.monto > maxPersona + 0.01) {
          showToast('error', `El pago de ${pago.persona} supera el total de sus ítems (${fmtMoney(maxPersona)}).`);
          return;
        }
      }

      // Aplicar asignaciones actuales a los items (ya se hizo en cada cambio, pero por si acaso)
      Object.keys(_asignaciones).forEach(idx => {
        _mesaACerrar.items[idx].persona = _asignaciones[idx];
      });

      // Cerrar pedido (solo una vez, con el primer pago? Vamos a cerrarlo con el total)
      try {
        if (_mesaACerrar.pedidoId) {
          await DB.cerrarPedido(_mesaACerrar.pedidoId, 'Mixto', totalMesa, 0);
        }
      } catch (e) {
        console.warn('[Cobro] Error al cerrar pedido:', e);
      }

      // Generar tickets individuales
      for (const pago of _pagosParciales) {
        if (pago.monto <= 0) continue;
        const ticketHTML = Tickets.generarCierreParcial(_mesaACerrar, pago, totalMesa);
        Tickets.mostrar(ticketHTML, `Comprobante ${pago.persona} — Mesa ${_mesaACerrar.numero}`);
      }

    } else {
      // Pago único
      const descuento = parseFloat(document.getElementById('cierreDescuento')?.value) || 0;
      const totalFinal = Math.round(totalMesa * (1 - descuento / 100));
      try {
        if (_mesaACerrar.pedidoId) {
          await DB.cerrarPedido(_mesaACerrar.pedidoId, _formaPago, totalFinal, descuento);
        }
      } catch (e) {
        console.warn('[Cobro] Error al cerrar pedido:', e);
      }
      const ticketHTML = Tickets.generarCierre(_mesaACerrar, totalFinal, descuento, _formaPago);
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
    document.getElementById('modalCierre').style.display = 'none';
  }

  EventBus.on('cobro:solicitado', abrirModalCierre);

  return {
    abrirModalCierre, cerrarModalCierre, selectPago,
    actualizarTotalCierre, confirmarCierre,
    actualizarFormaPagoPersona, actualizarMontoPersona, cobrarTodoJunto
  };
})();

window.Cobro = Cobro;