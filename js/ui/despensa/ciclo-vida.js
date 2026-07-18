/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/ciclo-vida.js
   Versión: 2.0.0
   Propósito: Ciclo de vida de la nueva vista de despensa con tres paneles.
              Vincula eventos del DOM y suscribe al Store y EventBus.
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

  // Aplicar búsqueda
  const termino = getTerminoBusqueda();
  if (termino) {
    ingredientes = ingredientes.filter(i =>
      i.nombre.toLowerCase().includes(termino.toLowerCase())
    );
  }

  renderResumen(ingredientes);
  renderEspacios(ingredientes);
  renderListaCompras(getListaCompras());

  // Proveedores y productos del panel izquierdo (mock por ahora)
  const proveedoresUnicos = [...new Set(ingredientes.map(i => i.proveedor).filter(Boolean))];
  renderProveedores(proveedoresUnicos.map(nombre => ({ nombre, productos: 0 })));

  const productosUnicos = [];
  const visto = new Set();
  ingredientes.forEach(i => {
    if (!visto.has(i.nombre)) {
      visto.add(i.nombre);
      productosUnicos.push({
        nombre: i.nombre,
        proveedores: 1,
        precio: i.valor_unitario || 0
      });
    }
  });
  renderProductosDisponibles(productosUnicos);
}

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();

  // ── Eventos del DOM ──

  // Tabs del panel izquierdo
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('activo'));
      tab.classList.add('activo');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.add('activo');
    }, { signal });
  });

  // Búsqueda en panel central
  document.getElementById('inventarioSearch')?.addEventListener('input', function() {
    setTerminoBusqueda(this.value);
    _refresh();
  }, { signal });

  // Paneles laterales (móvil)
  document.getElementById('fabIzquierdo')?.addEventListener('click', abrirPanelIzquierdo, { signal });
  document.getElementById('fabDerecho')?.addEventListener('click', abrirPanelDerecho, { signal });
  document.getElementById('despensaOverlay')?.addEventListener('click', cerrarPaneles, { signal });
  document.getElementById('btnCerrarDer')?.addEventListener('click', cerrarPaneles, { signal });

  // Desktop toggles
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
      const item = btn.dataset.item;
      quitarDeListaCompras(item);
      renderListaCompras(getListaCompras());
    }
  }, { signal });

  // ── Suscripciones al Store y EventBus ──

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (action.type.startsWith('INGREDIENTE') || action.type.startsWith('MOVIMIENTO')) {
      _refresh();
    }
  });
  _desuscripciones.push(unsubscribeStore);

  _desuscripciones.push(EventBus.on('db:inicializada', () => {
    setTimeout(_refresh, 100);
  }));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'despensa') _refresh();
  }));

  // Render inicial
  _refresh();
}

export function limpiar() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];
}