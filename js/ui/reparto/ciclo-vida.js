/* ================================================================
   LaTaberna - PubPOS — REPARTO SUBMÓDULO (ES6)
   Archivo: js/ui/reparto/ciclo-vida.js
   Versión: 1.0.2
   Propósito: Suscripciones al Store y EventBus para reparto.
              v1.0.2: migra a nombres en español (store).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { asegurarVista, renderTabla, establecerEstadoFiltro } from './tabla.js';
import { mostrar as mostrarModalNuevo } from './modal-nuevo.js';
import { mostrar as mostrarModalEditar } from './modal-editar.js';
import { enviarACocina, despachar, confirmarEntrega, eliminarPedido } from './acciones.js';

let _abortController = null;
let _desuscripciones = [];

function _renderCompleto() {
  const pedidos = Store.obtenerEstado().pedidosDelivery || [];
  const pedidosValidos = pedidos.filter(p => p && p.id);
  renderTabla(pedidosValidos);
}

export function activar() {
  limpiar();
  _abortController = new AbortController();

  asegurarVista(
    () => mostrarModalNuevo(_renderCompleto),
    (id) => mostrarModalEditar(id, _renderCompleto),
    (id) => enviarACocina(id).then(() => _renderCompleto()),
    (id) => despachar(id).then(() => _renderCompleto()),
    (id) => confirmarEntrega(id).then(() => _renderCompleto()),
    (id) => { eliminarPedido(id); setTimeout(_renderCompleto, 200); }
  );

  const { signal } = _abortController;
  const selectEstado = document.getElementById('repartoEstadoFilter');
  if (selectEstado) {
    selectEstado.addEventListener('change', function () {
      establecerEstadoFiltro(this.value);
      _renderCompleto();
    }, { signal });
  }

  const btnNuevo = document.getElementById('btnNuevoPedidoReparto');
  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => mostrarModalNuevo(_renderCompleto), { signal });
  }

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (action.type.startsWith('DELIVERY') || action.type.startsWith('PEDIDOSDELIVERY')) {
      _renderCompleto();
    }
  });
  _desuscripciones.push(unsubscribeStore);

  _desuscripciones.push(EventBus.on('db:inicializada', () => {
    setTimeout(_renderCompleto, 100);
  }));
  _desuscripciones.push(EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'reparto') _renderCompleto();
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