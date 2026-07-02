/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/reparto.js
   Versión: 2.0.1
   Propósito: Orquestador de la vista de reparto.
              v2.0.1: listeners se vinculan una sola vez desde tabla.js.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { asegurarVista, renderTabla, setEstadoFiltro } from './reparto/tabla.js';
import { mostrar as mostrarModalNuevo, cerrar as cerrarModalNuevo, getItemsTemporales, setItemsTemporales } from './reparto/modal-nuevo.js';
import { mostrar as mostrarModalEditar, cerrar as cerrarModalEditar } from './reparto/modal-editar.js';
import { enviarACocina, despachar, confirmarEntrega, eliminarPedido } from './reparto/acciones.js';

const Reparto = (() => {

  function render() {
    // asegurarVista solo crea el DOM y vincula eventos la primera vez
    asegurarVista(
      () => mostrarModalNuevo(render),           // onNuevoPedido
      (id) => mostrarModalEditar(id, render),    // onEditarItems
      (id) => enviarACocina(id).then(() => render()), // onEnviarCocina
      (id) => despachar(id).then(() => render()),     // onDespachar
      (id) => confirmarEntrega(id).then(() => render()), // onConfirmarEntrega
      (id) => { eliminarPedido(id); setTimeout(render, 200); } // onEliminarPedido
    );

    const pedidos = Store.getState().pedidosDelivery || [];
    const pedidosValidos = pedidos.filter(p => p && p.id);
    renderTabla(pedidosValidos);
  }

  function filtrarPorEstado(estado) {
    setEstadoFiltro(estado);
    render();
  }

  function _initListeners() {
    Store.subscribe((state, action) => {
      if (action.type.startsWith('DELIVERY') || action.type.startsWith('PEDIDOSDELIVERY')) {
        render();
      }
    });
    EventBus.on('db:inicializada', () => {
      setTimeout(render, 100);
    });
    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'reparto') render();
    });
  }

  _initListeners();

  return {
    render,
    filtrarPorEstado,
    mostrarModalNuevo: () => mostrarModalNuevo(render),
    cerrarModalNuevo,
    enviarACocina: (id) => enviarACocina(id).then(() => render()),
    despachar: (id) => despachar(id).then(() => render()),
    confirmarEntrega: (id) => confirmarEntrega(id).then(() => render()),
    eliminarPedido: (id) => { eliminarPedido(id); setTimeout(render, 200); },
    editarItems: (id) => mostrarModalEditar(id, render),
    cerrarEditarItems: cerrarModalEditar,
    _getItemsTemporales: getItemsTemporales,
    _setItemsTemporales: setItemsTemporales
  };
})();

export { Reparto };