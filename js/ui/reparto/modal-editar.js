/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/modal-editar.js
   Versión: 1.0.2
   Propósito: Modal para editar los ítems de un pedido de delivery existente.
              v1.0.2: elimina eventos inline (onmouseover/onmouseout).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { DB } from '../../db.js';
import { DeliveryService } from '../../servicios/delivery-service.js';
import { formatearDinero, mostrarToast } from '../../utils.js';
import { getItemsTemporales, setItemsTemporales } from './modal-nuevo.js';

let _productoSeleccionado = null;
let _onCerrar = null;

export function mostrar(deliveryId, onCerrar) {
  const ped = (Store.obtenerEstado().pedidosDelivery || []).find(p => p.id === deliveryId);
  if (!ped || ped.estado !== 'pendiente') {
    mostrarToast('error', 'Solo se pueden editar pedidos pendientes');
    return;
  }

  const items = (ped.items || []).map(it => ({
    prodId: it.prodId || '',
    nombre: it.nombre,
    precio: it.precio,
    qty: it.qty || 1
  }));
  setItemsTemporales(items);
  _productoSeleccionado = null;
  _onCerrar = onCerrar;

  let modal = document.getElementById('modalEditarItems');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalEditarItems';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-small" style="max-width:520px;">
        <div class="modal-header"><h3>Editar ítems del pedido</h3><button class="modal-close btn-cerrar-editar-items"><i class="fas fa-times"></i></button></div>
        <div class="modal-small-body">
          <label>Productos</label>
          <div style="position:relative;"><input type="text" id="editBusquedaProducto" placeholder="Buscar producto..." autocomplete="off"><div id="editResultadosBusqueda" style="position:absolute;top:100%;left:0;right:0;background:var(--color-panel);border:1px solid var(--color-border);border-radius:var(--radius-sm);z-index:10;max-height:200px;overflow-y:auto;display:none;"></div></div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="number" id="editCantidad" value="1" min="1"><button class="btn-secondary btn-agregar-item-edicion"><i class="fas fa-plus"></i> Agregar</button></div>
          <div id="editItemsLista" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
          <label>Total ($)</label><input type="number" id="editTotal" step="0.01" value="0" readonly style="font-weight:700;background:var(--color-panel);">
          <div class="modal-small-footer"><button class="btn-secondary btn-cerrar-editar-items">Cancelar</button><button class="btn-primary btn-guardar-edicion-items"><i class="fas fa-save"></i> Guardar cambios</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('.btn-cerrar-editar-items').forEach(b => b.addEventListener('click', () => cerrar()));
    modal.querySelector('.btn-guardar-edicion-items').addEventListener('click', () => guardar(deliveryId));
    modal.querySelector('.btn-agregar-item-edicion').addEventListener('click', _agregarItemEdicion);
    modal.querySelector('#editBusquedaProducto').addEventListener('input', _filtrarProductosEdicion);
    modal.querySelector('#editCantidad').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); _agregarItemEdicion(); }
    });
    modal.querySelector('#editItemsLista').addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-quitar-item-edicion');
      if (btn) {
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (!isNaN(idx)) _quitarItemEdicion(idx);
      }
    });

    // Delegación de eventos para hover en resultados de búsqueda (reemplaza eventos inline)
    const resultadosBusqueda = modal.querySelector('#editResultadosBusqueda');
    resultadosBusqueda.addEventListener('mouseover', function(e) {
      const item = e.target.closest('.resultado-item');
      if (item) item.style.background = 'var(--color-hover)';
    });
    resultadosBusqueda.addEventListener('mouseout', function(e) {
      const item = e.target.closest('.resultado-item');
      if (item) item.style.background = '';
    });
    resultadosBusqueda.addEventListener('click', function (e) {
      const item = e.target.closest('.resultado-item');
      if (item) _seleccionarProductoEdicion(item);
    });
  }

  document.getElementById('editBusquedaProducto').value = '';
  document.getElementById('editCantidad').value = 1;
  document.getElementById('editResultadosBusqueda').style.display = 'none';
  _productoSeleccionado = null;
  _renderItemsEdicion();
  modal.style.display = 'flex';
}

export function cerrar() {
  const modal = document.getElementById('modalEditarItems');
  if (modal) modal.style.display = 'none';
  if (_onCerrar) {
    _onCerrar();
    _onCerrar = null;
  }
}

function _filtrarProductosEdicion() {
  const input = document.getElementById('editBusquedaProducto');
  const res = document.getElementById('editResultadosBusqueda');
  if (!input || !res) return;
  const term = input.value.trim().toLowerCase();
  if (!term) { res.style.display = 'none'; _productoSeleccionado = null; return; }
  const prod = DB.productos.filter(p => p.activo !== false && p.nombre.toLowerCase().includes(term));
  if (prod.length === 0) {
    res.innerHTML = '<div style="padding:8px;color:var(--color-text-muted);">Sin resultados</div>';
    res.style.display = 'block';
    _productoSeleccionado = null;
  } else {
    // ✅ Sin eventos inline: las clases CSS y la delegación se encargan del hover
    res.innerHTML = prod.map(p => `<div class="resultado-item" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--color-border);"><strong>${p.nombre}</strong> <span style="float:right;color:var(--color-accent);">${formatearDinero(p.precio)}</span></div>`).join('');
    res.style.display = 'block';
  }
}

function _seleccionarProductoEdicion(el) {
  _productoSeleccionado = {
    id: el.dataset.id,
    nombre: el.dataset.nombre,
    precio: parseFloat(el.dataset.precio)
  };
  document.getElementById('editBusquedaProducto').value = el.dataset.nombre;
  document.getElementById('editResultadosBusqueda').style.display = 'none';
  document.getElementById('editCantidad').focus();
}

function _agregarItemEdicion() {
  if (!_productoSeleccionado) { mostrarToast('warning', 'Selecciona un producto'); return; }
  const cant = parseInt(document.getElementById('editCantidad')?.value) || 1;
  if (cant <= 0) { mostrarToast('warning', 'Cantidad inválida'); return; }
  const prod = DB.productos.find(p => p.id === _productoSeleccionado.id);
  if (!prod) return;
  const items = getItemsTemporales();
  const existente = items.find(it => it.prodId === prod.id);
  if (existente) existente.qty += cant;
  else items.push({ prodId: prod.id, nombre: prod.nombre, precio: prod.precio, qty: cant });
  setItemsTemporales(items);
  document.getElementById('editBusquedaProducto').value = '';
  document.getElementById('editCantidad').value = 1;
  _productoSeleccionado = null;
  _renderItemsEdicion();
}

function _quitarItemEdicion(idx) {
  const items = getItemsTemporales();
  items.splice(idx, 1);
  setItemsTemporales(items);
  _renderItemsEdicion();
}

function _renderItemsEdicion() {
  const container = document.getElementById('editItemsLista');
  if (!container) return;
  const items = getItemsTemporales();
  if (!items.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;">Sin productos.</p>';
    document.getElementById('editTotal').value = '0';
    return;
  }
  const total = items.reduce((sum, it) => sum + it.precio * (it.qty || 1), 0);
  document.getElementById('editTotal').value = total.toFixed(2);
  container.innerHTML = items.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-panel);border-radius:var(--radius-xs);font-size:12px;">
      <span style="flex:1;"><strong>${it.qty || 1}x</strong> ${it.nombre}</span>
      <span style="font-weight:600;">${formatearDinero(it.precio * (it.qty || 1))}</span>
      <button class="btn-icon-sm del btn-quitar-item-edicion" data-idx="${idx}"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

async function guardar(deliveryId) {
  const items = getItemsTemporales();
  if (!items.length) { mostrarToast('error', 'Agrega al menos un producto'); return; }
  const nuevosItems = items.map(it => ({
    nombre: it.nombre,
    precio: it.precio,
    qty: it.qty || 1
  }));
  const total = nuevosItems.reduce((sum, i) => sum + i.precio * i.qty, 0);

  try {
    if (typeof DeliveryService !== 'undefined' && DeliveryService.actualizarItems) {
      const res = await DeliveryService.actualizarItems(deliveryId, nuevosItems, total);
      if (res.exito) {
        cerrar();
        mostrarToast('success', 'Ítems actualizados');
        return;
      }
    }
    DB.actualizarPedidoDelivery(deliveryId, { items: nuevosItems, total });
    cerrar();
    mostrarToast('success', 'Ítems actualizados');
  } catch (e) {
    mostrarToast('error', 'Error al actualizar ítems');
  }
}