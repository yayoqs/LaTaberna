/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/ciclo-vida.js
   Versión: 1.0.5
   Propósito: Ciclo de vida (activar/limpiar) con AbortController
              y desuscripción funcional del EventBus.
              Incluye listener para mesas:limpiar_badge.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { renderGrid, renderZoneButtons, asegurarVista } from './renderer.js';
import { addNotificacion } from './notificaciones.js';
import { toggleModoFusion, fusionarMesasSeleccionadas } from './fusion.js';

let _abortController = null;
let _desuscripciones = [];

export function activar() {
  limpiar();

  _abortController = new AbortController();
  const { signal } = _abortController;

  document.getElementById('btnAgregarMesa')?.addEventListener('click', () => {
    import('../mesas.js').then(m => m.Mesas.agregarMesa());
  }, { signal });
  document.getElementById('btnFusionar')?.addEventListener('click', toggleModoFusion, { signal });
  document.getElementById('btnConfirmarFusion')?.addEventListener('click', fusionarMesasSeleccionadas, { signal });

  const unsubscribeStore = Store.subscribe((state, action) => {
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
      onAgregarMesa: () => import('../mesas.js').then(m => m.Mesas.agregarMesa()),
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
// Verificar el estado de la mesa justo antes de renderizar
const mesas = Store.getState().mesas;
const mesaObjetivo = mesas.find(m => m.numero == data.mesa);
console.log('[DEBUG] Mesa ' + data.mesa + ' - estado:', mesaObjetivo?.estado, 'permite_prepedidos:', mesaObjetivo?.permite_prepedidos);
renderGrid();
      Logger.info(`[Mesas] Cliente esperando en mesa ${data.mesa}`);
    }
    console.log('[DEBUG] cliente:mesa_ingresada recibido:', data);
  }));
  _desuscripciones.push(EventBus.on('precarga:nueva', (data) => {
    import('../mesas.js').then(m => m.Mesas.setBadge(data.mesa, data.cantidad, data.precargaId));
  }));
  _desuscripciones.push(EventBus.on('config:actualizada', () => {
    renderZoneButtons();
    renderGrid();
  }));
  _desuscripciones.push(EventBus.on('mesas:limpiar_badge', (data) => {
    import('../mesas.js').then(m => m.Mesas.clearBadge(data.mesa));
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