/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja/historial.js
   Versión: 1.1.0
   Propósito: Modal overlay con el historial completo del turno.
              No toca vista:cambiada ni app.js.
   Dependencias:
     · js/lib/store.js
     · js/utils.js
   ================================================================ */

import { Store } from '../../lib/store.js';
import { formatearDinero, formatearHoraCorta } from '../../utils.js';

let _filtroEstado = 'todos';

export function abrirHistorial() {
  _asegurarModalHistorial();
  _render();
  const modal = document.getElementById('modalHistorial');
  if (modal) modal.style.display = 'flex';
}

function _asegurarModalHistorial() {
  if (document.getElementById('modalHistorial')) return;

  const modal = document.createElement('div');
  modal.id = 'modalHistorial';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.style.alignItems = 'stretch';
  modal.style.justifyContent = 'stretch';
  modal.style.padding = '0';
  modal.innerHTML = `
    <div style="background:var(--color-bg);display:flex;flex-direction:column;width:100%;height:100vh;overflow:hidden;">
      <header class="topbar" style="flex-shrink:0;">
        <button class="btn-icon" id="btnCerrarHistorial"><i class="fas fa-arrow-left"></i></button>
        <div class="page-title-block">
          <h1>Historial de caja</h1>
          <div class="crumb">Registro completo del turno actual</div>
        </div>
        <div class="topbar-right">
          <div class="date-chip"><i class="fas fa-calendar-day"></i> <span id="fechaHistorial"></span></div>
        </div>
      </header>

      <div class="content-scroll" style="flex:1;padding:22px;overflow-y:auto;">
        <div class="section-head">
          <h2><i class="fas fa-filter"></i> Filtros</h2>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
          <button class="nav-btn filtro-estado active" data-estado="todos">Todos</button>
          <button class="nav-btn filtro-estado" data-estado="cerrada">Cerradas</button>
          <button class="nav-btn filtro-estado" data-estado="abierta">Abiertas</button>
          <button class="nav-btn filtro-estado" data-estado="en_proceso">En proceso</button>
        </div>

        <div class="table-wrap">
          <div class="table-scroll">
            <table class="caja-table">
              <thead>
                <tr>
                  <th>Mesa</th><th>Apertura</th><th>Cierre</th><th>Mozo</th>
                  <th>Pax</th><th>Ítems</th><th>Total</th><th>Estado</th>
                </tr>
              </thead>
              <tbody id="historialBody"></tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:20px;padding:14px 18px;background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius);">
          <div style="display:flex;justify-content:space-between;font-size:14px;">
            <span style="color:var(--color-text-sec);">Total de ventas cerradas</span>
            <span id="historialTotalVentas" style="font-weight:700;color:var(--color-success);">$0</span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCerrarHistorial').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.querySelectorAll('.filtro-estado').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-estado').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filtroEstado = btn.dataset.estado;
      _render();
    });
  });

  const ahora = new Date();
  const fechaFormateada = ahora.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('fechaHistorial').textContent = fechaFormateada;
}

function _render() {
  const estado = Store.obtenerEstado();
  const pedidos = estado.pedidos || [];

  const filtrados = _filtroEstado === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === _filtroEstado);

  const bodyEl = document.getElementById('historialBody');
  if (bodyEl) {
    bodyEl.innerHTML = filtrados.length
      ? filtrados.map(p => _htmlFila(p)).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted)">No hay registros con ese filtro.</td></tr>`;
  }

  const cerrados = pedidos.filter(p => p.estado === 'cerrada');
  const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
  const totalEl = document.getElementById('historialTotalVentas');
  if (totalEl) totalEl.textContent = formatearDinero(totalVentas);
}

function _htmlFila(p) {
  const items = Array.isArray(p.items) ? p.items : [];
  const cant = items.reduce((s, it) => s + (it.qty || 1), 0);
  const apertura = formatearHoraCorta(p.creadoEn || p.created_at);
  const cierre = p.estado === 'cerrada' ? formatearHoraCorta(p.actualizadoEn || p.updated_at) : '—';
  const estadoCls = p.estado === 'cerrada' ? 'cerrada' : p.estado === 'abierta' ? 'abierta' : p.estado;
  return `
    <tr>
      <td><strong>Mesa ${p.mesa}</strong></td>
      <td>${apertura}</td>
      <td>${cierre}</td>
      <td>${p.mozo || '—'}</td>
      <td>${p.comensales || 1}</td>
      <td>${cant}</td>
      <td><strong style="color:var(--color-success)">${formatearDinero(p.total)}</strong></td>
      <td><span class="status-pill ${estadoCls}">${p.estado}</span></td>
    </tr>
  `;
}