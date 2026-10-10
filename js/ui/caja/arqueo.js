/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja/arqueo.js
   Versión: 1.5.1
   Propósito: Modal de arqueo de caja, denominaciones y cierre de turno.
              v1.5.1: guarda anti doble cierre de turno y clave de
                      idempotencia por operación.
   Dependencias:
     · js/lib/store.js
     · js/lib/command-bus.js
     · js/utils.js
   ================================================================ */

import { Store } from '../../lib/store.js';
import { CommandBus } from '../../lib/command-bus.js';
import { formatearDinero, mostrarToast } from '../../utils.js';

let _cerrando = false;
let _claveTurno = null;

function _generarClaveIdempotencia(operacion, referencia) {
  const rnd = Math.random().toString(36).slice(2, 11);
  return `${operacion}:${referencia}:${Date.now()}:${rnd}`;
}

export function abrirArqueo() {
  _asegurarModalArqueo();
  const modal = document.getElementById('modalArqueo');
  if (!modal) return;

  const pedidos = Store.obtenerEstado().pedidos || [];
  const cerrados = pedidos.filter(p => p.estado === 'cerrada');

  let efectivo = 0;
  let tarjetas = 0;

  cerrados.forEach(p => {
    const transacciones = Array.isArray(p.transacciones) ? p.transacciones : [];
    if (transacciones.length > 0) {
      transacciones.forEach(t => {
        const monto = t.monto || 0;
        if (t.formaPago === 'Efectivo') efectivo += monto;
        else if (['Débito', 'Crédito', 'Transferencia'].includes(t.formaPago)) tarjetas += monto;
      });
    } else {
      efectivo += (p.total || 0);
    }
  });

  document.getElementById('arqueoEfectivoEsperado').textContent = formatearDinero(efectivo);
  document.getElementById('arqueoTarjetasEsperado').textContent = formatearDinero(tarjetas);
  document.getElementById('arqueoTotalEsperado').textContent = formatearDinero(efectivo + tarjetas);

  const denominaciones = [
    { valor: 20000, etiqueta: '$20.000' },
    { valor: 10000, etiqueta: '$10.000' },
    { valor: 5000,  etiqueta: '$5.000' },
    { valor: 2000,  etiqueta: '$2.000' },
    { valor: 1000,  etiqueta: '$1.000' },
    { valor: 500,   etiqueta: '$500' },
    { valor: 100,   etiqueta: '$100' },
    { valor: 50,    etiqueta: '$50' },
    { valor: 10,    etiqueta: '$10' },
    { valor: 5,     etiqueta: '$5' },
    { valor: 1,     etiqueta: '$1' }
  ];

  const tbody = document.getElementById('arqueoDenominaciones');
  tbody.innerHTML = denominaciones.map(d => `
    <tr>
      <td><span class="denom-chip"><span class="bill-swatch"></span>${d.etiqueta}</span></td>
      <td><input class="denom-qty" data-valor="${d.valor}" type="number" min="0" value="0"></td>
      <td class="denom-sub" id="subtotal-${d.valor}">$0</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.denom-qty').forEach(input => {
    input.addEventListener('input', () => {
      const valor = parseInt(input.dataset.valor);
      const cantidad = parseInt(input.value) || 0;
      const subtotal = valor * cantidad;
      document.getElementById(`subtotal-${valor}`).textContent = formatearDinero(subtotal);
      _actualizarDiferenciaArqueo();
    });
  });

  document.getElementById('arqueoObservaciones').value = '';

  const turnoRaw = localStorage.getItem('pubpos_turno_actual');
  if (turnoRaw) {
    try {
      const turno = JSON.parse(turnoRaw);
      document.getElementById('arqueoTurnoInfo').textContent = `Turno ${turno.id || 'actual'} · Abierto desde ${new Date(turno.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
    } catch { /* ignorar */ }
  }

  _actualizarDiferenciaArqueo();
  modal.style.display = 'flex';
}

function _asegurarModalArqueo() {
  if (document.getElementById('modalArqueo')) return;

  const modal = document.createElement('div');
  modal.id = 'modalArqueo';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="arqueo-modal">
      <div class="modal-header">
        <div>
          <h3><i class="fas fa-vault icon-accent"></i> Arqueo de caja</h3>
          <div class="mh-sub" id="arqueoTurnoInfo">Turno actual</div>
        </div>
        <button class="modal-close" id="btnCerrarArqueo"><i class="fas fa-times"></i></button>
      </div>
      <div class="arqueo-body">
        <div class="arq-summary">
          <div class="arq-sum-card"><div class="lbl">Efectivo esperado</div><div class="val" id="arqueoEfectivoEsperado">$0</div></div>
          <div class="arq-sum-card"><div class="lbl">Tarjetas esperado</div><div class="val" id="arqueoTarjetasEsperado">$0</div></div>
          <div class="arq-sum-card"><div class="lbl">Total esperado</div><div class="val" id="arqueoTotalEsperado" style="color:var(--color-accent);">$0</div></div>
        </div>

        <table class="denom-table">
          <thead><tr><th>Denominación</th><th>Cantidad</th><th style="text-align:right;">Subtotal</th></tr></thead>
          <tbody id="arqueoDenominaciones"></tbody>
        </table>

        <div class="arqueo-diff">
          <div><div class="d-label">Total contado</div><div class="d-value" id="arqueoTotalContado">$0</div></div>
          <div><div class="d-label">Diferencia vs esperado</div><div class="d-value" id="arqueoDiferencia">$0</div></div>
        </div>

        <div class="form-group">
          <label for="arqueoObservaciones">Observaciones del cierre</label>
          <input type="text" id="arqueoObservaciones" placeholder="Ej: se retiraron $20.000 para depósito bancario">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="btnCancelarArqueo">Cancelar</button>
        <button class="btn-primary" id="btnConfirmarArqueo"><i class="fas fa-lock"></i> Confirmar cierre de turno</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCerrarArqueo').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('btnCancelarArqueo').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('btnConfirmarArqueo').addEventListener('click', async () => {
    await _confirmarCierreTurno();
  });
}

function _actualizarDiferenciaArqueo() {
  const efectivoEsperado = _parsearMonto(document.getElementById('arqueoEfectivoEsperado').textContent);
  let totalContado = 0;

  document.querySelectorAll('#arqueoDenominaciones .denom-qty').forEach(input => {
    const valor = parseInt(input.dataset.valor);
    const cantidad = parseInt(input.value) || 0;
    totalContado += valor * cantidad;
  });

  document.getElementById('arqueoTotalContado').textContent = formatearDinero(totalContado);
  const diferencia = totalContado - efectivoEsperado;
  document.getElementById('arqueoDiferencia').textContent = formatearDinero(diferencia);
  document.getElementById('arqueoDiferencia').style.color = diferencia === 0 ? 'var(--color-success)' : 'var(--color-danger)';
}

function _parsearMonto(texto) {
  const numero = texto.replace(/[^\d.-]/g, '');
  return parseInt(numero) || 0;
}

async function _confirmarCierreTurno() {
  if (_cerrando) {
    mostrarToast('info', 'El cierre de turno ya está en proceso.');
    return;
  }

  const btnConfirmar = document.getElementById('btnConfirmarArqueo');
  const observaciones = document.getElementById('arqueoObservaciones').value.trim();

  if (!_claveTurno) {
    const turnoRaw = localStorage.getItem('pubpos_turno_actual');
    let turnoId = 'actual';
    try { if (turnoRaw) turnoId = JSON.parse(turnoRaw).id; } catch { /* ignorar */ }
    _claveTurno = _generarClaveIdempotencia('cierre-turno', turnoId);
  }

  _cerrando = true;
  if (btnConfirmar) btnConfirmar.disabled = true;

  try {
    const resultado = await CommandBus.ejecutar({
      type: 'turno:cerrar',
      datos: {
        observaciones,
        claveIdempotencia: _claveTurno
      }
    });

    if (resultado && resultado.exito) {
      mostrarToast('success', 'Turno cerrado correctamente.');
      const modal = document.getElementById('modalArqueo');
      if (modal) modal.style.display = 'none';
      _claveTurno = null;
    } else {
      mostrarToast('error', (resultado && resultado.error) || 'Error al cerrar turno.');
    }
  } catch (e) {
    mostrarToast('error', 'Error inesperado al cerrar turno.');
  } finally {
    _cerrando = false;
    if (btnConfirmar) btnConfirmar.disabled = false;
  }
}