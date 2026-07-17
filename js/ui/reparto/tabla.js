/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/tabla.js
   Versión: 1.0.4
   Propósito: Render de la tabla de pedidos delivery y filtro por estado.
              v1.0.4: renombra setEstadoFiltro a establecerEstadoFiltro.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { fmtMoney } from '../../utils.js';
import { ESTADO_BADGE, ESTADO_DEFAULT } from './constantes.js';

let _estadoFiltro = 'todos';

export function getEstadoFiltro() {
  return _estadoFiltro;
}

export function establecerEstadoFiltro(estado) {
  _estadoFiltro = estado;
}

export function asegurarVista(onNuevoPedido, onEditarItems, onEnviarCocina, onDespachar, onConfirmarEntrega, onEliminarPedido) {
  let main = document.getElementById('view-reparto');
  if (main && main.querySelector('.view-toolbar')) return;
  
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-reparto';
    main.className = 'view';
    const referencia = document.getElementById('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  main.innerHTML = `
    <div class="view-toolbar">
      <h2><i class="fas fa-motorcycle"></i> Reparto — Pedidos de Delivery</h2>
      <div class="toolbar-actions">
        <select id="repartoEstadoFilter">
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_preparacion">En preparación</option>
          <option value="en_camino">En camino</option>
          <option value="entregado">Entregado</option>
        </select>
        <button class="btn-primary" id="btnNuevoPedidoReparto">
          <i class="fas fa-plus"></i> Nuevo Pedido
        </button>
      </div>
    </div>
    <div class="reparto-table-wrap">
      <table class="reparto-table">
        <thead><tr><th>Pedido</th><th>Dirección</th><th>Teléfono</th><th>Ítems</th><th>Total</th><th>Estado</th><th>Repartidor</th><th>Acciones</th></tr></thead>
        <tbody id="repartoBody"></tbody>
      </table>
    </div>
  `;

  // Vincular eventos UNA SOLA VEZ
  const selectEstado = document.getElementById('repartoEstadoFilter');
  if (selectEstado) {
    selectEstado.addEventListener('change', function () {
      establecerEstadoFiltro(this.value);
      if (typeof onNuevoPedido === 'function') onNuevoPedido();
    });
  }

  const btnNuevo = document.getElementById('btnNuevoPedidoReparto');
  if (btnNuevo) {
    btnNuevo.addEventListener('click', onNuevoPedido);
  }

  const tbody = document.getElementById('repartoBody');
  if (tbody) {
    tbody.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const deliveryId = btn.getAttribute('data-id');
      if (!deliveryId) return;

      if (btn.classList.contains('btn-editar-items') && typeof onEditarItems === 'function') {
        onEditarItems(deliveryId);
      } else if (btn.classList.contains('btn-enviar-cocina') && typeof onEnviarCocina === 'function') {
        onEnviarCocina(deliveryId);
      } else if (btn.classList.contains('btn-despachar') && typeof onDespachar === 'function') {
        onDespachar(deliveryId);
      } else if (btn.classList.contains('btn-confirmar-entrega') && typeof onConfirmarEntrega === 'function') {
        onConfirmarEntrega(deliveryId);
      } else if (btn.classList.contains('btn-eliminar-delivery') && typeof onEliminarPedido === 'function') {
        onEliminarPedido(deliveryId);
      }
    });
  }
}

export function renderTabla(pedidos) {
  const tbody = document.getElementById('repartoBody');
  if (!tbody) return;

  if (_estadoFiltro !== 'todos') {
    pedidos = pedidos.filter(p => p.estado === _estadoFiltro);
  }

  if (!pedidos.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">No hay pedidos de delivery.</td></tr>`;
    return;
  }

  const ordenados = [...pedidos].sort((a, b) => {
    const fechaA = a.creadoEn || a.created_at || '';
    const fechaB = b.creadoEn || b.created_at || '';
    return new Date(fechaB) - new Date(fechaA);
  });

  tbody.innerHTML = ordenados.map(p => {
    const idSeguro = (p.id || '').toString();
    const idCorto = idSeguro.replace('deliv_', '').slice(-6) || '—';

    let items = p.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    const resumen = items.map(i => `${i.qty}x ${i.nombre}`).join(', ') || '—';

    const badgeClase = ESTADO_BADGE[p.estado] || ESTADO_DEFAULT;

    let btnEditar = '';
    if (p.estado === 'pendiente') {
      btnEditar = `<button class="btn-ajuste btn-editar-items" data-id="${idSeguro}"><i class="fas fa-edit"></i> Editar</button>`;
    }

    let botones = '';
    if (p.estado === 'pendiente') {
      botones += `<button class="btn-ajuste btn-enviar-cocina" data-id="${idSeguro}"><i class="fas fa-fire-burner"></i> Enviar a Cocina</button>`;
    } else if (p.estado === 'en_preparacion') {
      botones += `<button class="btn-ajuste btn-despachar" data-id="${idSeguro}"><i class="fas fa-motorcycle"></i> En camino</button>`;
    } else if (p.estado === 'en_camino') {
      botones += `<button class="btn-ajuste btn-confirmar-entrega" data-id="${idSeguro}"><i class="fas fa-check"></i> Entregado</button>`;
    }
    botones += `<button class="btn-ajuste del btn-eliminar-delivery" data-id="${idSeguro}"><i class="fas fa-trash"></i></button>`;

    return `<tr>
      <td><strong>${idCorto}</strong></td>
      <td>${p.direccion || '—'}</td>
      <td>${p.telefono || '—'}</td>
      <td style="font-size:12px;">${resumen}</td>
      <td>${fmtMoney(p.total)}</td>
      <td><span class="badge ${badgeClase}">${(p.estado || '').replace('_', ' ')}</span></td>
      <td>${p.repartidor || '—'}</td>
      <td>${btnEditar} ${botones}</td>
    </tr>`;
  }).join('');
}