/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/detalle.js
   Versión: 1.1.2
   Propósito: Modal de detalle rápido, árbol de ingredientes y exportación PDF.
              Hallazgo H15: reemplazado setTimeout por verificación de
              readyState en la exportación de PDF.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { DBInventario } from '../../db-inventario.js';
import { mostrarToast } from '../../utils.js';

export function mostrarDetalle(idReceta) {
  const state = Store.obtenerEstado();
  const recetaConProducto = DBInventario.obtenerRecetaConProducto(idReceta);
  if (!recetaConProducto) { mostrarToast('error', 'Receta no encontrada'); return; }
  const nombre = recetaConProducto.nombre || 'Receta';

  let modal = document.getElementById('modalRecetaDetalle');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRecetaDetalle';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="recetas-modal-detalle">
        <div class="modal-header"><h3 id="detalleTitulo"></h3><button class="modal-close" id="btnCerrarDetalle"><i class="fas fa-times"></i></button></div>
        <div class="recetas-modal-cuerpo">
          <div id="detalleIngredientes"></div>
          <div id="detalleCosto"></div>
          <div id="detalleInstrucciones"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="btnCerrarDetalle2">Cerrar</button>
          <button class="btn-secondary" id="btnExportarPDF"><i class="fas fa-print"></i> Exportar PDF</button>
        </div>
      </div>`;
    const vista = document.getElementById('view-recetas');
    if (vista) {
      vista.appendChild(modal);
    } else {
      document.body.appendChild(modal);
    }
    document.getElementById('btnCerrarDetalle').addEventListener('click', cerrarDetalle);
    document.getElementById('btnCerrarDetalle2').addEventListener('click', cerrarDetalle);
    document.getElementById('btnExportarPDF').addEventListener('click', () => exportarPDF(idReceta));
  }

  const tipoReceta = recetaConProducto.es_intermedio ? 'Preparación intermedia' : 'Producto final';
  document.getElementById('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${nombre} <span class="recetas-chip-nivel">${recetaConProducto.nivel || 'sin_nivel'}</span> <span class="recetas-tipo-badge">${tipoReceta}</span>`;
  if (recetaConProducto.es_intermedio) {
    const tipoInsumo = (recetaConProducto.destino === 'barra') ? 'barra' : 'cocina';
    const insumos = state.insumos || [];
    const insumo = insumos.find(i => i.nombre === nombre && i.tipo === tipoInsumo);
    const stock = insumo ? insumo.stock : 0;
    const unidad = insumo ? insumo.unidad : (recetaConProducto.unidadStock || '');
    document.getElementById('detalleTitulo').innerHTML += ` <span class="recetas-stock-info">Stock: ${stock} ${unidad}</span>`;
  }

  const htmlIngredientes = construirArbolIngredientes(recetaConProducto.ingredientes || [], state, 0);
  document.getElementById('detalleIngredientes').innerHTML = `<h4><i class="fas fa-list-ul"></i> Ingredientes</h4>${htmlIngredientes}`;
  document.getElementById('detalleCosto').innerHTML = '';
  document.getElementById('detalleInstrucciones').innerHTML = `<h4><i class="fas fa-tasks"></i> Preparación</h4><div class="recetas-pasos">${(recetaConProducto.instrucciones || 'Sin instrucciones').split('\n').filter(l => l.trim()).map((l, i) => `<div class="recetas-paso"><span class="recetas-paso-num">${i+1}</span><span class="recetas-paso-texto">${l}</span></div>`).join('') || '<p>Sin instrucciones.</p>'}</div>`;

  modal.dataset.recetaId = idReceta;
  modal.style.display = 'flex';
}

export function cerrarDetalle() {
  const m = document.getElementById('modalRecetaDetalle');
  if (m) m.style.display = 'none';
}

export function construirArbolIngredientes(ingredientes, state, profundidad) {
  if (!ingredientes.length) return '<p class="recetas-sin-ingredientes">Sin ingredientes</p>';

  const insumosState = state.insumos || [];
  const recetasState = state.recetas || [];

  let html = '<ul class="recetas-arbol-ingredientes">';
  ingredientes.forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const insumoData = insumosState.find(i => i.id == ing.id);
      const nombre = insumoData ? insumoData.nombre : ing.id;
      html += `
        <li class="recetas-nodo-insumo">
          <span class="recetas-ing-nombre">🧄 ${nombre}</span>
          <span class="recetas-ing-cantidad">${ing.cantidad} ${insumoData?.unidad || ing.unidad || ''}</span>
        </li>`;
    } else if (tipo === 'subreceta') {
      const subReceta = recetasState.find(r => r.id == ing.id);
      const subConProducto = subReceta ? DBInventario.obtenerRecetaConProducto(subReceta.id) : null;
      const nombreSub = subConProducto ? subConProducto.nombre : (subReceta ? subReceta.productoId : ing.id);
      html += `
        <li class="recetas-nodo-subreceta">
          <details ${profundidad === 0 ? 'open' : ''}>
            <summary>
              <span class="recetas-ing-nombre">📦 ${nombreSub}</span>
              <span class="recetas-ing-cantidad">${ing.cantidad} ${subReceta?.unidadStock || ''}</span>
              ${subReceta?.es_intermedio ? `<span class="recetas-stock-info">Stock: ${_obtenerStockSubreceta(subReceta, state)}</span>` : ''}
            </summary>
            ${subReceta ? construirArbolIngredientes(subReceta.ingredientes || [], state, profundidad + 1) : '<p class="recetas-sin-ingredientes">Receta no encontrada</p>'}
          </details>
        </li>`;
    }
  });
  html += '</ul>';
  return html;
}

function _obtenerStockSubreceta(subReceta, state) {
  const subConProducto = DBInventario.obtenerRecetaConProducto(subReceta.id);
  const nombre = subConProducto ? subConProducto.nombre : '';
  const tipoInsumo = (subReceta.destino === 'barra') ? 'barra' : 'cocina';
  const insumos = state.insumos || [];
  const insumo = insumos.find(i => i.nombre === nombre && i.tipo === tipoInsumo);
  const stock = insumo ? insumo.stock : 0;
  const unidad = insumo ? insumo.unidad : (subReceta.unidadStock || '');
  return `${stock} ${unidad}`;
}

export function exportarPDF(idReceta) {
  const state = Store.obtenerEstado();
  const recetaConProducto = DBInventario.obtenerRecetaConProducto(idReceta);
  if (!recetaConProducto) return;
  const nombre = recetaConProducto.nombre || 'Receta';
  const insumosState = state.insumos || [];
  const recetasState = state.recetas || [];
  let filas = '';
  (recetaConProducto.ingredientes || []).forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    let nombreIng = ing.id;
    if (tipo === 'insumo') {
      const insumoData = insumosState.find(i => i.id == ing.id);
      nombreIng = insumoData ? insumoData.nombre : ing.id;
    } else {
      const sub = recetasState.find(r => r.id == ing.id);
      const subConProducto = sub ? DBInventario.obtenerRecetaConProducto(sub.id) : null;
      nombreIng = subConProducto ? subConProducto.nombre : (sub ? sub.productoId : ing.id);
    }
    filas += `<tr><td>${nombreIng} (${tipo})</td><td>${ing.cantidad} ${ing.unidad || ''}</td></tr>`;
  });

  const html = `<html><head><title>Receta: ${nombre}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#f5f5f5}</style></head><body><h1>${nombre}</h1><h2>Ingredientes</h2><table><thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead><tbody>${filas}</tbody></table><h2>Preparación</h2><p>${(recetaConProducto.instrucciones||'').replace(/\n/g,'<br>')}</p></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(html);
  iframe.contentWindow.document.close();

  const intentarImprimir = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      mostrarToast('error', 'No se pudo imprimir. Revisa los permisos del navegador.');
    }
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  if (iframe.contentWindow.document.readyState === 'complete') {
    intentarImprimir();
  } else {
    iframe.onload = intentarImprimir;
  }
}