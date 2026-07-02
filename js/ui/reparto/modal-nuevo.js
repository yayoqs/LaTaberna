/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/modal-nuevo.js
   Versión: 1.0.0
   Propósito: Modal para crear un nuevo pedido de delivery.
              Maneja búsqueda de productos, ítems temporales y guardado.
   ================================================================ */

import { DB } from '../../db.js';
import { DeliveryService } from '../../servicios/delivery-service.js';
import { PedidoManager } from '../../managers/pedido-manager.js';
import { Logger } from '../../lib/logger.js';
import { fmtMoney, showToast } from '../../utils.js';

let _itemsTemporales = [];
let _productoSeleccionado = null;

// ── Helpers para tests ──
export function getItemsTemporales() { return _itemsTemporales; }
export function setItemsTemporales(items) { _itemsTemporales = items; }

export function mostrar(onCerrar) {
  _itemsTemporales = [];
  _productoSeleccionado = null;

  let modal = document.getElementById('modalReparto');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalReparto';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small" style="max-width:520px;">
        <div class="modal-header"><h3><i class="fas fa-plus"></i> Nuevo Pedido de Delivery</h3><button class="modal-close btn-cerrar-modal-reparto"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <label>Dirección *</label><input type="text" id="repDireccion" placeholder="Calle, número, depto.">
          <label>Teléfono</label><input type="text" id="repTelefono" placeholder="+56 9 ...">
          <label>Productos</label>
          <div style="position:relative;"><input type="text" id="repBusquedaProducto" placeholder="Buscar producto..." autocomplete="off"><div id="repResultadosBusqueda" style="position:absolute;top:100%;left:0;right:0;background:var(--color-panel);border:1px solid var(--color-border);border-radius:var(--radius-sm);z-index:10;max-height:200px;overflow-y:auto;display:none;"></div></div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="number" id="repCantidad" value="1" min="1"><button class="btn-secondary btn-agregar-item-reparto"><i class="fas fa-plus"></i> Agregar</button></div>
          <div id="repItemsLista" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
          <label>Total ($)</label><input type="number" id="repTotal" step="0.01" value="0" readonly style="font-weight:700;background:var(--color-panel);">
          <label>Repartidor</label><input type="text" id="repRepartidor" placeholder="Nombre del repartidor">
          <label>Observaciones</label><input type="text" id="repObservaciones" placeholder="Pago con tarjeta, timbre roto...">
          <div class="modal-small-footer"><button class="btn-secondary btn-cerrar-modal-reparto">Cancelar</button><button class="btn-primary btn-guardar-pedido-reparto"><i class="fas fa-save"></i> Guardar</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Eventos del modal
    modal.querySelectorAll('.btn-cerrar-modal-reparto').forEach(b => b.addEventListener('click', () => cerrar(onCerrar)));
    modal.querySelector('.btn-guardar-pedido-reparto').addEventListener('click', () => guardar(onCerrar));
    modal.querySelector('.btn-agregar-item-reparto').addEventListener('click', _agregarItemAlPedido);
    modal.querySelector('#repBusquedaProducto').addEventListener('input', _filtrarProductos);
    modal.querySelector('#repCantidad').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); _agregarItemAlPedido(); }
    });
    modal.querySelector('#repItemsLista').addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-quitar-item-reparto');
      if (btn) {
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (!isNaN(idx)) _quitarItemTemporal(idx);
      }
    });
    modal.querySelector('#repResultadosBusqueda').addEventListener('click', function (e) {
      const item = e.target.closest('.resultado-item');
      if (item) _seleccionarProducto(item);
    });
  }

  document.getElementById('repDireccion').value = '';
  document.getElementById('repTelefono').value = '';
  document.getElementById('repTotal').value = '0';
  document.getElementById('repRepartidor').value = '';
  document.getElementById('repObservaciones').value = '';
  document.getElementById('repBusquedaProducto').value = '';
  document.getElementById('repCantidad').value = 1;
  document.getElementById('repResultadosBusqueda').style.display = 'none';
  _renderItemsTemporales();
  modal.style.display = 'flex';
}

export function cerrar(onCerrar) {
  const modal = document.getElementById('modalReparto');
  if (modal) modal.style.display = 'none';
  if (onCerrar) onCerrar();
}

// ── Funciones internas ──

function _filtrarProductos() {
  const input = document.getElementById('repBusquedaProducto');
  const res = document.getElementById('repResultadosBusqueda');
  if (!input || !res) return;
  const term = input.value.trim().toLowerCase();
  if (!term) { res.style.display = 'none'; _productoSeleccionado = null; return; }
  const prod = DB.productos.filter(p => p.activo !== false && p.nombre.toLowerCase().includes(term));
  if (prod.length === 0) {
    res.innerHTML = '<div style="padding:8px;color:var(--color-text-muted);">Sin resultados</div>';
    res.style.display = 'block';
    _productoSeleccionado = null;
  } else {
    res.innerHTML = prod.map(p => `<div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border);" onmouseover="this.style.background='var(--color-hover)'" onmouseout="this.style.background=''"><strong>${p.nombre}</strong> <span style="float:right;color:var(--color-accent);">${fmtMoney(p.precio)}</span></div>`).join('');
    res.style.display = 'block';
  }
}

function _seleccionarProducto(el) {
  _productoSeleccionado = { id: el.dataset.id, nombre: el.dataset.nombre, precio: parseFloat(el.dataset.precio) };
  document.getElementById('repBusquedaProducto').value = el.dataset.nombre;
  document.getElementById('repResultadosBusqueda').style.display = 'none';
  document.getElementById('repCantidad').focus();
}

function _agregarItemAlPedido() {
  if (!_productoSeleccionado) { showToast('warning', 'Selecciona un producto'); return; }
  const cant = parseInt(document.getElementById('repCantidad')?.value) || 1;
  if (cant <= 0) { showToast('warning', 'Cantidad inválida'); return; }
  const prod = DB.productos.find(p => p.id === _productoSeleccionado.id);
  if (!prod) return;
  const existente = _itemsTemporales.find(it => it.prodId === prod.id);
  if (existente) existente.qty += cant;
  else _itemsTemporales.push({ prodId: prod.id, nombre: prod.nombre, precio: prod.precio, qty: cant });
  document.getElementById('repBusquedaProducto').value = '';
  _productoSeleccionado = null;
  document.getElementById('repCantidad').value = 1;
  document.getElementById('repBusquedaProducto').focus();
  _renderItemsTemporales();
}

function _quitarItemTemporal(idx) {
  _itemsTemporales.splice(idx, 1);
  _renderItemsTemporales();
}

function _renderItemsTemporales() {
  const container = document.getElementById('repItemsLista');
  if (!container) return;
  if (!_itemsTemporales.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;">Sin productos agregados.</p>';
    document.getElementById('repTotal').value = '0';
    return;
  }
  const total = _itemsTemporales.reduce((sum, it) => sum + it.precio * (it.qty || 1), 0);
  document.getElementById('repTotal').value = total.toFixed(2);
  container.innerHTML = _itemsTemporales.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-panel);border-radius:var(--radius-xs);font-size:12px;">
      <span style="flex:1;"><strong>${it.qty || 1}x</strong> ${it.nombre}</span>
      <span style="font-weight:600;">${fmtMoney(it.precio * (it.qty || 1))}</span>
      <button class="btn-icon-sm del btn-quitar-item-reparto" data-idx="${idx}"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

async function guardar(onCerrar) {
  const dir = document.getElementById('repDireccion').value.trim();
  const tel = document.getElementById('repTelefono').value.trim();
  const rep = document.getElementById('repRepartidor').value.trim();
  const obs = document.getElementById('repObservaciones').value.trim();
  if (!dir) { showToast('error', 'Dirección obligatoria'); return; }
  if (!_itemsTemporales.length) { showToast('error', 'Agrega al menos un producto'); return; }
  const itemsListos = _itemsTemporales.map(it => ({ nombre: it.nombre, precio: it.precio, qty: it.qty || 1 }));
  const total = itemsListos.reduce((s, i) => s + i.precio * i.qty, 0);
  if (total <= 0) { showToast('error', 'Total inválido'); return; }

  let nuevo = null;
  if (typeof DeliveryService !== 'undefined' && DeliveryService.crearDelivery) {
    try {
      const res = await DeliveryService.crearDelivery({ direccion: { calle: dir, telefono: tel }, items: itemsListos, repartidor: rep, observaciones: obs });
      if (res.exito) nuevo = res.datos;
      else Logger.warn('[Reparto] DeliveryService falló:', res.error);
    } catch (e) { Logger.warn('[Reparto] Excepción DeliveryService:', e); }
  }
  if (!nuevo && typeof PedidoManager !== 'undefined' && PedidoManager.crearPedidoDelivery) {
    try { nuevo = PedidoManager.crearPedidoDelivery({ direccion: dir, telefono: tel, items: itemsListos, total, repartidor: rep, observaciones: obs, estado: 'pendiente' }); } catch (e) { }
  }
  if (!nuevo) {
    try { nuevo = DB.crearPedidoDelivery({ direccion: dir, telefono: tel, items: itemsListos, total, repartidor: rep, observaciones: obs, estado: 'pendiente' }); } catch (e) { }
  }

  if (nuevo && nuevo.id) {
    cerrar(onCerrar);
    showToast('success', `Pedido ${nuevo.id.slice(-6)} creado`);
  } else {
    showToast('error', 'No se pudo crear el pedido. Intenta de nuevo.');
  }
}