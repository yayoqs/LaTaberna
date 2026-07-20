/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/ciclo-vida.js
   Versión: 2.0.4
   Propósito: Ciclo de vida de la nueva vista de despensa con tres paneles.
              v2.0.4: sin workaround, con exportación, revisión completa.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import {
  asegurarVista,
  renderResumen,
  renderEspacios,
  renderListaCompras,
  renderProveedores,
  renderProductosDisponibles,
  abrirPanelIzquierdo,
  abrirPanelDerecho,
  cerrarPaneles
} from './renderer.js';
import { exportarCSV, exportarPDF } from './exportacion.js';
import {
  getListaCompras,
  agregarAListaCompras,
  quitarDeListaCompras,
  getTerminoBusqueda,
  setTerminoBusqueda
} from './estado.js';

let _abortController = null;
let _desuscripciones = [];

function _refresh() {
  const state = Store.obtenerEstado();
  let ingredientes = state.ingredientes || [];

  const termino = getTerminoBusqueda();
  if (termino) {
    ingredientes = ingredientes.filter(i =>
      i.nombre.toLowerCase().includes(termino.toLowerCase())
    );
  }

  renderResumen(ingredientes);
  renderEspacios(ingredientes);
  renderListaCompras(getListaCompras());

  const proveedoresUnicos = [...new Set(ingredientes.map(i => i.proveedor).filter(Boolean))];
  renderProveedores(proveedoresUnicos.map(nombre => ({ nombre, productos: 0 })));

  const productosUnicos = [];
  const visto = new Set();
  ingredientes.forEach(i => {
    if (!visto.has(i.nombre)) {
      visto.add(i.nombre);
      productosUnicos.push({ nombre: i.nombre, proveedores: 1, precio: i.valor_unitario || 0 });
    }
  });
  renderProductosDisponibles(productosUnicos);
}

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();

  // Tabs
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('activo'));
      tab.classList.add('activo');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.add('activo');
    }, { signal });
  });

  // Búsqueda
  document.getElementById('inventarioSearch')?.addEventListener('input', function() {
    setTerminoBusqueda(this.value);
    _refresh();
  }, { signal });

  // Nuevo Insumo
  document.getElementById('btnNuevoInsumo')?.addEventListener('click', () => {
    import('./modal-ingrediente.js').then(mod => mod.mostrar(null, _refresh));
  }, { signal });

  // Exportación
  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV, { signal });
  document.getElementById('btnExportarPDF')?.addEventListener('click', exportarPDF, { signal });

  // Paneles laterales
  document.getElementById('fabIzquierdo')?.addEventListener('click', abrirPanelIzquierdo, { signal });
  document.getElementById('fabDerecho')?.addEventListener('click', abrirPanelDerecho, { signal });
  document.getElementById('despensaOverlay')?.addEventListener('click', cerrarPaneles, { signal });
  document.getElementById('btnCerrarDer')?.addEventListener('click', cerrarPaneles, { signal });

  document.getElementById('btnToggleIzq')?.addEventListener('click', () => {
    const panel = document.getElementById('panelIzquierdo');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }, { signal });
  document.getElementById('btnToggleDer')?.addEventListener('click', () => {
    const panel = document.getElementById('panelDerecho');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }, { signal });

  // Lista de compras
  document.getElementById('btnAddCompra')?.addEventListener('click', () => {
    const input = document.getElementById('inputCompra');
    const nombre = input?.value.trim();
    if (nombre) {
      agregarAListaCompras(nombre);
      renderListaCompras(getListaCompras());
      input.value = '';
    }
  }, { signal });

  document.getElementById('listaCompras')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-quitar');
    if (btn) {
      quitarDeListaCompras(btn.dataset.item);
      renderListaCompras(getListaCompras());
    }
  }, { signal });

  // Suscripciones
  _desuscripciones.push(Store.suscribir((state, action) => {
    if (action.type.startsWith('INGREDIENTE') || action.type.startsWith('MOVIMIENTO')) _refresh();
  }));
  _desuscripciones.push(EventBus.on('db:inicializada', () => setTimeout(_refresh, 100)));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'despensa') setTimeout(_refresh, 150);
  }));

  setTimeout(_refresh, 150);
}

export function limpiar() {
  if (_abortController) { _abortController.abort(); _abortController = null; }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];
}