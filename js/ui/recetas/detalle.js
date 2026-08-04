/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/detalle.js
   Versión: 1.0.3
   Propósito: Modal de detalle rápido, árbol de ingredientes y exportación PDF.
              v1.0.3: exportarPDF usa iframe oculto en lugar de window.open
              (Misión 5.2). Store.getState → Store.obtenerEstado.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { mostrarToast } from '../../utils.js';

export function mostrarDetalle(idReceta) {
  const state = Store.obtenerEstado();
  const receta = (state.recetas || []).find(r => r.id === idReceta || r.productoId == idReceta);
  if (!receta) { mostrarToast('error', 'Receta no encontrada'); return; }
  const prod = (state.productos || []).find(p => p.id == receta.productoId);
  const nombre = prod ? prod.nombre : 'Receta';

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
    document.getElementById('btnExportarPDF').addEventListener('click', () => exportarPDF(receta.id));
  }

  const tipoReceta = receta.es_intermedio ? 'Preparación intermedia' : 'Producto final';
  document.getElementById('detalleTitulo').innerHTML = `<i class="fas fa-utensils"></i> ${nombre} <span class="recetas-chip-nivel">${receta.nivel || 'sin_nivel'}</span> <span class="recetas-tipo-badge">${tipoReceta}</span>`;
  if (receta.es_intermedio) {
    document.getElementById('detalleTitulo').innerHTML += ` <span class="recetas-stock-info">Stock: ${receta.stockActual || 0} ${receta.unidadStock || ''}</span>`;
  }

  const htmlIngredientes = construirArbolIngredientes(receta.ingredientes || [], state, 0);
  document.getElementById('detalleIngredientes').innerHTML = `<h4><i class="fas fa-list-ul"></i> Ingredientes</h4>${htmlIngredientes}`;
  document.getElementById('detalleCosto').innerHTML = '';
  document.getElementById('detalleInstrucciones').innerHTML = `<h4><i class="fas fa-tasks"></i> Preparación</h4><div class="recetas-pasos">${(receta.instrucciones || 'Sin instrucciones').split('\n').filter(l => l.trim()).map((l, i) => `<div class="recetas-paso"><span class="recetas-paso-num">${i+1}</span><span class="recetas-paso-texto">${l}</span></div>`).join('') || '<p>Sin instrucciones.</p>'}</div>`;

  modal.dataset.recetaId = idReceta;
  modal.style.display = 'flex';
}

export function cerrarDetalle() {
  const m = document.getElementById('modalRecetaDetalle');
  if (m) m.style.display = 'none';
}

export function construirArbolIngredientes(ingredientes, state, profundidad) {
  if (!ingredientes.length) return '<p class="recetas-sin-ingredientes">Sin ingredientes</p>';

  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  const productosState = state.productos || [];

  let html = '<ul class="recetas-arbol-ingredientes">';
  ingredientes.forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    if (tipo === 'insumo') {
      const ingData = ingredientesState.find(i => i.id == ing.id);
      const nombre = ingData ? ingData.nombre : ing.id;
      html += `
        <li class="recetas-nodo-insumo">
          <span class="recetas-ing-nombre">🧄 ${nombre}</span>
          <span class="recetas-ing-cantidad">${ing.cantidad} ${ingData?.unidad || ing.unidad || ''}</span>
        </li>`;
    } else if (tipo === 'subreceta') {
      const subReceta = recetasState.find(r => r.id == ing.id);
      const prod = subReceta ? productosState.find(p => p.id == subReceta.productoId) : null;
      const nombreSub = prod ? prod.nombre : (subReceta ? subReceta.productoId : ing.id);
      html += `
        <li class="recetas-nodo-subreceta">
          <details ${profundidad === 0 ? 'open' : ''}>
            <summary>
              <span class="recetas-ing-nombre">📦 ${nombreSub}</span>
              <span class="recetas-ing-cantidad">${ing.cantidad} ${subReceta?.unidadStock || ''}</span>
              ${subReceta?.es_intermedio ? `<span class="recetas-stock-info">Stock: ${subReceta.stockActual || 0} ${subReceta.unidadStock || ''}</span>` : ''}
            </summary>
            ${subReceta ? construirArbolIngredientes(subReceta.ingredientes || [], state, profundidad + 1) : '<p class="recetas-sin-ingredientes">Receta no encontrada</p>'}
          </details>
        </li>`;
    }
  });
  html += '</ul>';
  return html;
}

export function exportarPDF(idReceta) {
  const state = Store.obtenerEstado();
  const receta = (state.recetas || []).find(r => r.id === idReceta || r.productoId == idReceta);
  if (!receta) return;
  const prod = (state.productos || []).find(p => p.id == receta.productoId);
  const nombre = prod ? prod.nombre : 'Receta';
  const ingredientesState = state.ingredientes || [];
  const recetasState = state.recetas || [];
  let filas = '';
  (receta.ingredientes || []).forEach(ing => {
    const tipo = ing.tipo || 'insumo';
    let nombreIng = ing.id;
    if (tipo === 'insumo') {
      const ingData = ingredientesState.find(i => i.id == ing.id);
      nombreIng = ingData ? ingData.nombre : ing.id;
    } else {
      const sub = recetasState.find(r => r.id == ing.id);
      const p = sub ? (state.productos || []).find(p => p.id == sub.productoId) : null;
      nombreIng = p ? p.nombre : (sub ? sub.productoId : ing.id);
    }
    filas += `<tr><td>${nombreIng} (${tipo})</td><td>${ing.cantidad} ${ing.unidad || ''}</td></tr>`;
  });

  const html = `<html><head><title>Receta: ${nombre}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#f5f5f5}</style></head><body><h1>${nombre}</h1><h2>Ingredientes</h2><table><thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead><tbody>${filas}</tbody></table><h2>Preparación</h2><p>${(receta.instrucciones||'').replace(/\n/g,'<br>')}</p></body></html>`;

  // Usar iframe oculto en lugar de window.open (Misión 5.2)
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(html);
  iframe.contentWindow.document.close();

  // Esperar a que el contenido cargue antes de imprimir
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      mostrarToast('error', 'No se pudo imprimir. Revisa los permisos del navegador.');
    }
    // Limpiar el iframe después de imprimir (o cancelar)
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  // Fallback por si onload no se dispara
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      // Ya manejado arriba
    }
  }, 500);
}