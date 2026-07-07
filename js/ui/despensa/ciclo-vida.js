/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/ciclo-vida.js
   Versión: 1.0.0
   Propósito: Ciclo de vida de la vista de despensa.
              Vincula eventos del DOM con AbortController y
              suscribe al Store y EventBus.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { asegurarVista, renderCompleto, renderTabla, renderMovimientos, renderAlertas } from './renderer.js';
import { setCategoriaFiltro, resetearOrden, resetearPaginaMovimientos, toggleOrdenColumna, incrementarPaginaMovimientos } from './estado.js';
import { mostrar as mostrarModalIngrediente, editarIngrediente } from './modal-ingrediente.js';
import { exportarCSV, exportarPDF } from './exportacion.js';
import { ajusteRapido } from './acciones.js';

let _abortController = null;
let _desuscripciones = [];

function _refresh() {
  renderCompleto();
}

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();

  // ── Vinculación de eventos del DOM ──
  document.getElementById('despensaCatFilter')?.addEventListener('change', function () {
    setCategoriaFiltro(this.value);
    renderTabla();
  }, { signal });

  document.getElementById('ingredienteSearch')?.addEventListener('input', function () {
    resetearOrden();
    renderTabla();
  }, { signal });

  document.getElementById('filtroBajoMinimo')?.addEventListener('change', renderTabla, { signal });
  document.getElementById('filtroConValor')?.addEventListener('change', renderTabla, { signal });
  document.getElementById('filtroUbicacion')?.addEventListener('input', renderTabla, { signal });

  document.getElementById('btnNuevoIngrediente')?.addEventListener('click', () => {
    mostrarModalIngrediente(null, _refresh);
  }, { signal });

  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV, { signal });
  document.getElementById('btnExportarPDF')?.addEventListener('click', exportarPDF, { signal });

  document.getElementById('ingredientesTableHead')?.addEventListener('click', function (e) {
    const th = e.target.closest('th[data-columna]');
    if (th) {
      toggleOrdenColumna(th.dataset.columna, e.shiftKey);
      renderTabla();
    }
  }, { signal });

  document.getElementById('ingredientesBody')?.addEventListener('click', function (e) {
    const editBtn = e.target.closest('[data-accion="editar"]');
    const ajusteBtn = e.target.closest('[data-accion="ajuste"]');
    if (editBtn) {
      editarIngrediente(editBtn.dataset.id);
    }
    if (ajusteBtn) {
      ajusteRapido(ajusteBtn.dataset.id, _refresh);
    }
  }, { signal });

  document.getElementById('movimientosPaginador')?.addEventListener('click', function (e) {
    const btn = e.target.closest('#btnVerMasMovimientos');
    if (btn) {
      incrementarPaginaMovimientos();
      renderMovimientos();
    }
  }, { signal });

  document.getElementById('btnAjusteRapidoSidebar')?.addEventListener('click', () => {
    ajusteRapido(null, _refresh);
  }, { signal });

  // ── Suscripciones al Store y EventBus ──
  const unsubscribeStore = Store.subscribe((state, action) => {
    if (action.type.startsWith('INGREDIENTE') || action.type.startsWith('MOVIMIENTO')) {
      _refresh();
    }
  });
  _desuscripciones.push(unsubscribeStore);

  _desuscripciones.push(EventBus.on('db:inicializada', () => {
    setTimeout(_refresh, 100);
  }));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'despensa') {
      resetearPaginaMovimientos();
      _refresh();
    }
  }));
}

export function limpiar() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];
}