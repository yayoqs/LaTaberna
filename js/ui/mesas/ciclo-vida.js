/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/ciclo-vida.js
   Versión: 1.1.2
   Propósito: Ciclo de vida (activar/limpiar) con AbortController.
              Corregido: eliminado listener duplicado de btnAgregarMesa
              para evitar doble ejecución del comando agregarMesa.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { renderGrid, renderZoneButtons, asegurarVista, setVistaActiva } from './renderer.js';
import { addNotificacion } from './notificaciones.js';
import { toggleModoFusion, fusionarMesasSeleccionadas } from './fusion.js';
import { agregarMesa, setBadge, clearBadge } from './acciones-mesa.js';

let _abortController = null;
let _desuscripciones = [];

export function activar() {
  limpiar();

  _abortController = new AbortController();
  const { signal } = _abortController;

  // NOTA: El listener de btnAgregarMesa se asigna en renderer.js mediante callbacks.
  // No lo duplicamos aquí para evitar doble ejecución del comando agregarMesa.
  document.getElementById('btnFusionar')?.addEventListener('click', toggleModoFusion, { signal });
  document.getElementById('btnConfirmarFusion')?.addEventListener('click', fusionarMesasSeleccionadas, { signal });

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (action.type.startsWith('MESA') || action.type.startsWith('MESAS') || action.type.startsWith('COMANDA')) {
      renderGrid();
    }
    if (action.type === 'CONFIG_INICIALIZAR') {
      renderZoneButtons();
    }
  });
  _desuscripciones.push(unsubscribeStore);

  _desuscripciones.push(EventBus.on('db:inicializada', () => {
    asegurarVista({
      onAgregarMesa: agregarMesa,
      onToggleFusion: () => toggleModoFusion(),
      onConfirmarFusion: () => fusionarMesasSeleccionadas()
    });
    renderZoneButtons();
    renderGrid();
  }));
  _desuscripciones.push(EventBus.on('comanda:enviada', () => renderGrid()));
  _desuscripciones.push(EventBus.on('comanda:lista', () => renderGrid()));
  _desuscripciones.push(EventBus.on('mesa:actualizada', () => renderGrid()));
  _desuscripciones.push(EventBus.on('cliente:mesa_ingresada', (data) => {
    if (data && data.mesa) {
      addNotificacion(data.mesa, 'esperando', {});
      Store.despachar({
        type: 'MESA_AGREGAR_NOTIFICACION',
        payload: { numero: data.mesa, tipo: 'esperando', datos: {} }
      });
      Logger.debug('[Mesas] Cliente esperando en mesa ' + data.mesa);
      renderGrid();
    }
  }));
  _desuscripciones.push(EventBus.on('precarga:nueva', (data) => {
    setBadge(data.mesa, data.cantidad, data.precargaId);
  }));
  _desuscripciones.push(EventBus.on('config:actualizada', () => {
    renderZoneButtons();
    renderGrid();
  }));
  _desuscripciones.push(EventBus.on('mesas:limpiar_badge', (data) => {
    clearBadge(data.mesa);
  }));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    setVistaActiva(vista === 'mesas');
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