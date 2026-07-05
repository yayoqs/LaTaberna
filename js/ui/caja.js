/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/caja.js
   Versión: 1.1.2
   Propósito: Vista de caja: resumen de turno, estadísticas, tabla de pedidos
              y sección de cobros pendientes (split bill).
              Refactor: _asegurarVista usa contenedor estático (estándar B1/B2).
              Corrección: botón "Cierre de Caja" usa EventBus.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { fmtMoney, fmtHoraCorta, $id, showToast } from '../utils.js';
import { Cobro } from './cobro.js';

export const Caja = (() => {

  function _asegurarVista() {
    const main = document.getElementById('view-caja');

    if (!main) {
      const nuevoMain = document.createElement('main');
      nuevoMain.id = 'view-caja';
      nuevoMain.className = 'view';
      const referencia = $id('toastContainer') || document.body.lastChild;
      document.body.insertBefore(nuevoMain, referencia);
      _construirContenido(nuevoMain);
      return;
    }

    if (main.querySelector('.caja-stats')) return;

    _construirContenido(main);
  }

  function _construirContenido(contenedor) {
    contenedor.innerHTML = `
      <div class="view-toolbar">
        <h2><i class="fas fa-cash-register"></i> Caja — Resumen del Turno</h2>
        <div class="toolbar-actions">
          <button class="btn-secondary" id="btnVentaBarra">
            <i class="fas fa-beer"></i> Venta Barra
          </button>
          <button class="btn-primary" id="btnCerrarTurno">
            <i class="fas fa-file-alt"></i> Cierre de Caja
          </button>
        </div>
      </div>
      <div class="caja-stats" id="cajaStats"></div>
      <div class="caja-pendientes" id="cajaPendientes" style="padding: 0 24px; display: none;">
        <h3 style="color: var(--color-warning);"><i class="fas fa-clock"></i> Cobros pendientes</h3>
        <div id="pendientesLista"></div>
      </div>
      <div class="caja-table-wrap">
        <table class="caja-table">
          <thead>
            <tr><th>Mesa</th><th>Apertura</th><th>Cierre</th><th>Mozo</th><th>Pax</th><th>Ítems</th><th>Total</th><th>Estado</th></tr>
          </thead>
          <tbody id="cajaBody"></tbody>
        </table>
      </div>
    `;

    document.getElementById('btnCerrarTurno').addEventListener('click', () => {
      EventBus.emit('turno:solicitar_cierre');
    });

    document.getElementById('btnVentaBarra').addEventListener('click', () => {
      const mesas = Store.getState().mesas || [];
      let mesaBarra = mesas.find(m => m.numero === 'barra');
      if (!mesaBarra) {
        showToast('warning', 'No se encontró la mesa "barra". Debe configurarse desde administración.');
        return;
      }
      Cobro.abrirModalCierre(mesaBarra);
    });
  }

  function render() {
    _asegurarVista();
    const statsEl = $id('cajaStats');
    const bodyEl = $id('cajaBody');
    const pendientesContainer = $id('cajaPendientes');
    const pendientesLista = $id('pendientesLista');
    if (!statsEl || !bodyEl) return;

    const pedidos = Store.getState().pedidos || [];
    const cerrados = pedidos.filter(p => p.estado === 'cerrada');
    const abiertos = pedidos.filter(p => p.estado !== 'cerrada' && p.estado !== 'cancelada');

    const totalVentas = cerrados.reduce((s, p) => s + (p.total || 0), 0);
    const promedio = cerrados.length ? totalVentas / cerrados.length : 0;

    statsEl.innerHTML = _htmlStats(totalVentas, cerrados.length, promedio, abiertos.length);
    bodyEl.innerHTML = pedidos.length
      ? pedidos.map(_htmlFila).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted)">No hay registros en este turno</td></tr>`;

    const pedidosPendientes = pedidos.filter(p => {
      if (p.estado === 'cerrada') return false;
      const total = p.total || 0;
      const transacciones = Array.isArray(p.transacciones) ? p.transacciones : [];
      const cubierto = transacciones.reduce((s, t) => s + (t.monto || 0), 0);
      return cubierto > 0 && cubierto < total;
    });

    if (pendientesContainer && pendientesLista) {
      if (pedidosPendientes.length > 0) {
        pendientesContainer.style.display = 'block';
        pendientesLista.innerHTML = pedidosPendientes.map(p => {
          const total = p.total || 0;
          const cubierto = (p.transacciones || []).reduce((s, t) => s + (t.monto || 0), 0);
          return `<div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--color-border);">
            <strong>Mesa ${p.mesa}</strong>
            <span>Cubierto: ${fmtMoney(cubierto)} de ${fmtMoney(total)}</span>
            <button class="btn-secondary btn-cobrar-pendiente" data-mesa="${p.mesa}" style="margin-left:auto; font-size:12px;">Cobrar pendiente</button>
          </div>`;
        }).join('');

        pendientesLista.querySelectorAll('.btn-cobrar-pendiente').forEach(btn => {
          btn.addEventListener('click', () => {
            const numeroMesa = btn.dataset.mesa;
            const mesa = (Store.getState().mesas || []).find(m => m.numero == numeroMesa);
            if (mesa) {
              Cobro.abrirModalCierre(mesa);
            } else {
              Cobro.abrirModalCierre({ numero: numeroMesa });
            }
          });
        });
      } else {
        pendientesContainer.style.display = 'none';
      }
    }
  }

  function _htmlStats(totalVentas, cerradas, promedio, abiertas) {
    const tarjetas = [
      { icon: 'fa-dollar-sign', label: 'Total Ventas', value: fmtMoney(totalVentas), color: 'var(--color-success)' },
      { icon: 'fa-chair', label: 'Mesas Cerradas', value: cerradas, color: 'var(--color-accent)' },
      { icon: 'fa-chart-line', label: 'Ticket Promedio', value: fmtMoney(promedio), color: 'var(--color-primary)' },
      { icon: 'fa-door-open', label: 'Mesas Abiertas', value: abiertas, color: 'var(--color-danger)' }
    ];
    return tarjetas.map(t => `
      <div class="caja-stat-card">
        <div class="caja-stat-icon ${t.cls || ''}"><i class="fas ${t.icon}"></i></div>
        <div><div class="caja-stat-label">${t.label}</div><div class="caja-stat-value" style="color:${t.color}">${t.value}</div></div>
      </div>`).join('');
  }

  function _htmlFila(p) {
    let items = [];
    try { items = JSON.parse(p.items || '[]'); } catch {}
    const cant = items.reduce((s, it) => s + it.qty, 0);
    const apertura = fmtHoraCorta(p.creadoEn || p.created_at);
    const cierre = p.estado === 'cerrada' ? fmtHoraCorta(p.actualizadoEn || p.updated_at) : '—';
    return `
      <tr>
        <td><strong>Mesa ${p.mesa}</strong></td>
        <td>${apertura}</td>
        <td>${cierre}</td>
        <td>${p.mozo || '—'}</td>
        <td>${p.comensales || 1}</td>
        <td>${cant}</td>
        <td><strong style="color:var(--color-success)">${fmtMoney(p.total)}</strong></td>
        <td><span class="status-pill ${p.estado}">${p.estado}</span></td>
      </tr>`;
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('PEDIDOS') || action.type.startsWith('PEDIDO')) {
        render();
      }
    });

    EventBus.on('db:inicializada', render);
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'caja') render();
    });
  }
  _initListeners();

  return { render };
})();