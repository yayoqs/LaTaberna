/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja/movimientos.js
   Versión: 1.6.0
   Propósito: Modal de movimientos de caja (ingresos/egresos) y
              listado de los últimos 6 movimientos del turno.
   Dependencias:
     · js/utils.js
   ================================================================ */

import { formatearDinero, mostrarToast } from '../../utils.js';

export function abrirMovimiento() {
  _asegurarModalMovimiento();
  document.getElementById('modalMovimiento').style.display = 'flex';
}

export function abrirListaMovimientos() {
  _asegurarModalListaMovimientos();
  const modal = document.getElementById('modalListaMovimientos');
  if (!modal) return;

  const turno = localStorage.getItem('pubpos_turno_actual');
  const turnoId = turno ? JSON.parse(turno).id : 'turno_actual';
  const clave = 'pubpos_movimientos_' + turnoId;
  const movimientos = JSON.parse(localStorage.getItem(clave) || '[]');

  const ultimos = movimientos.slice(-6).reverse();
  const listaEl = document.getElementById('listaMovimientos');

  if (ultimos.length === 0) {
    listaEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--color-text-muted);">No hay movimientos registrados en este turno.</div>';
  } else {
    listaEl.innerHTML = ultimos.map(m => {
      const icono = m.tipo === 'ingreso' ? 'fa-arrow-down' : 'fa-arrow-up';
      const color = m.tipo === 'ingreso' ? 'var(--color-success)' : 'var(--color-danger)';
      const signo = m.tipo === 'ingreso' ? '+' : '-';
      const hora = new Date(m.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border);">
          <div style="width:32px;height:32px;border-radius:50%;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;">
            <i class="fas ${icono}"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;">${m.motivo}</div>
            <div style="font-size:11px;color:var(--color-text-muted);">${hora}</div>
          </div>
          <div style="font-weight:700;color:${color};">${signo}${formatearDinero(m.monto)}</div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
}

function _asegurarModalMovimiento() {
  if (document.getElementById('modalMovimiento')) return;

  const modal = document.createElement('div');
  modal.id = 'modalMovimiento';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-small" style="max-width:420px;">
      <div class="modal-header">
        <h3><i class="fas fa-hand-holding-dollar icon-accent"></i> Movimiento de Caja</h3>
        <button class="modal-close" id="btnCerrarMovimiento"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="movimientoTipo">Tipo</label>
          <select id="movimientoTipo">
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso / Retiro</option>
          </select>
        </div>
        <div class="form-group">
          <label for="movimientoMonto">Monto</label>
          <input type="number" id="movimientoMonto" inputmode="decimal" min="1" placeholder="0">
        </div>
        <div class="form-group">
          <label for="movimientoMotivo">Motivo</label>
          <input type="text" id="movimientoMotivo" placeholder="Ej: compra de hielo, retiro de efectivo">
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="btnCancelarMovimiento">Cancelar</button>
          <button class="btn-primary" id="btnGuardarMovimiento"><i class="fas fa-check"></i> Registrar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCerrarMovimiento').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('btnCancelarMovimiento').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('btnGuardarMovimiento').addEventListener('click', () => {
    const tipo = document.getElementById('movimientoTipo').value;
    const monto = parseFloat(document.getElementById('movimientoMonto').value) || 0;
    const motivo = document.getElementById('movimientoMotivo').value.trim();

    if (monto <= 0) {
      mostrarToast('error', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!motivo) {
      mostrarToast('error', 'Ingresa un motivo.');
      return;
    }

    const turno = localStorage.getItem('pubpos_turno_actual');
    const turnoId = turno ? JSON.parse(turno).id : 'turno_actual';
    const clave = 'pubpos_movimientos_' + turnoId;
    const movimientos = JSON.parse(localStorage.getItem(clave) || '[]');
    movimientos.push({ tipo, monto, motivo, timestamp: Date.now() });
    localStorage.setItem(clave, JSON.stringify(movimientos));

    mostrarToast('success', `Movimiento de ${tipo} registrado: ${formatearDinero(monto)}`);
    modal.style.display = 'none';
    document.getElementById('movimientoMonto').value = '';
    document.getElementById('movimientoMotivo').value = '';
  });
}

function _asegurarModalListaMovimientos() {
  if (document.getElementById('modalListaMovimientos')) return;

  const modal = document.createElement('div');
  modal.id = 'modalListaMovimientos';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-small" style="max-width:480px;">
      <div class="modal-header">
        <h3><i class="fas fa-file-invoice icon-accent"></i> Últimos movimientos</h3>
        <button class="modal-close" id="btnCerrarListaMovimientos"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div id="listaMovimientos"></div>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:14px;text-align:center;">
          Para ver el historial completo, consulta el historial de caja.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" id="btnNuevoMovimientoDesdeLista"><i class="fas fa-plus"></i> Nuevo movimiento</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCerrarListaMovimientos').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('btnNuevoMovimientoDesdeLista').addEventListener('click', () => {
    modal.style.display = 'none';
    abrirMovimiento();
  });
}