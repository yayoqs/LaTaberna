/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/modal-propiedades.js
   Versión: 1.0.1
   Propósito: Panel de propiedades para editar fichas del lienzo.
              v1.0.1: reemplaza formatearDineroLocal por formatearDinero de utils (locale unificado).
   ================================================================ */

import { formatearDinero } from '../../utils.js';

let _fichaActual = null;
let _onCambio = null;

export function abrir(ficha, onCambio) {
  _fichaActual = ficha;
  _onCambio = onCambio;

  const panel = document.getElementById('menuPropsPanel');
  const overlay = document.getElementById('menuPropsOverlay');
  if (!panel || !overlay) return;

  const tipo = ficha.dataset.tipo || 'producto';

  // Mostrar/ocultar campos según tipo
  document.getElementById('menuPropContent').parentElement.style.display = (tipo === 'titulo' || tipo === 'descripcion') ? '' : 'none';
  document.getElementById('menuPropShape').parentElement.style.display = (tipo === 'producto') ? '' : 'none';
  document.getElementById('menuPropDisplay').parentElement.style.display = (tipo === 'producto') ? '' : 'none';
  document.getElementById('menuPropPrice').parentElement.style.display = (tipo === 'producto') ? '' : 'none';
  document.getElementById('menuPropCost').parentElement.style.display = (tipo === 'producto') ? '' : 'none';

  // Cargar valores actuales
  if (tipo === 'producto') {
    document.getElementById('menuPropShape').value = ficha.dataset.shape || 'rect';
    document.getElementById('menuPropDisplay').value = ficha.dataset.display || 'both';
    document.getElementById('menuPropPrice').value = ficha.dataset.price || 0;
    document.getElementById('menuPropCost').textContent = formatearDinero(ficha.dataset.cost || 0);
    actualizarMargenLocal();
  }
  if (tipo === 'titulo' || tipo === 'descripcion') {
    document.getElementById('menuPropContent').value = ficha.dataset.content || '';
  }

  panel.classList.add('active');
  overlay.classList.add('active');
}

export function cerrar() {
  document.getElementById('menuPropsPanel')?.classList.remove('active');
  document.getElementById('menuPropsOverlay')?.classList.remove('active');
  _fichaActual = null;
}

export function guardarCambios() {
  if (!_fichaActual) return;
  const tipo = _fichaActual.dataset.tipo || 'producto';

  if (tipo === 'producto') {
    _fichaActual.dataset.shape = document.getElementById('menuPropShape').value;
    _fichaActual.dataset.display = document.getElementById('menuPropDisplay').value;
    _fichaActual.dataset.price = document.getElementById('menuPropPrice').value;
    _fichaActual.classList.toggle('circulo', _fichaActual.dataset.shape === 'circle');
    // Actualizar visual
    const nombreEl = _fichaActual.querySelector('.nombre');
    const imgEl = _fichaActual.querySelector('img');
    const precioEl = _fichaActual.querySelector('.precio');
    if (nombreEl) nombreEl.style.display = (_fichaActual.dataset.display === 'both' || _fichaActual.dataset.display === 'name') ? '' : 'none';
    if (imgEl) imgEl.style.display = (_fichaActual.dataset.display === 'both' || _fichaActual.dataset.display === 'img') ? '' : 'none';
    if (precioEl) precioEl.textContent = formatearDinero(parseFloat(_fichaActual.dataset.price) || 0);
  }
  if (tipo === 'titulo' || tipo === 'descripcion') {
    _fichaActual.dataset.content = document.getElementById('menuPropContent').value;
    _fichaActual.textContent = _fichaActual.dataset.content;
  }

  if (typeof _onCambio === 'function') _onCambio(_fichaActual);
}

export function eliminarFicha() {
  if (_fichaActual) {
    _fichaActual.remove();
  }
  cerrar();
}

function actualizarMargenLocal() {
  const costoText = document.getElementById('menuPropCost').textContent || '';
  const costo = parseFloat(costoText.replace(/[^0-9.-]+/g, '')) || 0;
  const precio = parseFloat(document.getElementById('menuPropPrice').value) || 0;
  const margen = costo > 0 ? Math.round((precio - costo) / costo * 100) : 0;
  const spanMargen = document.getElementById('menuPropMargin');
  if (spanMargen) spanMargen.textContent = margen + '%';
}