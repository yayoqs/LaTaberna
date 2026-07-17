/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/reparto.js
   Versión: 2.1.2
   Propósito: Fachada de la vista de reparto.
              v2.1.2: migra a nombres en español (store).
   ================================================================ */

import { activar, limpiar } from './reparto/ciclo-vida.js';
import { renderTabla, getEstadoFiltro, establecerEstadoFiltro } from './reparto/tabla.js';
import { enviarACocina, despachar, confirmarEntrega, eliminarPedido } from './reparto/acciones.js';
import { mostrar as mostrarModalNuevo, cerrar as cerrarModalNuevo, getItemsTemporales, setItemsTemporales } from './reparto/modal-nuevo.js';
import { mostrar as mostrarModalEditar, cerrar as cerrarModalEditar } from './reparto/modal-editar.js';
import { Store } from '../lib/store.js';

const Reparto = {
  activar,
  limpiar,

  render() {
    activar();
    const pedidos = Store.obtenerEstado().pedidosDelivery || [];
    const pedidosValidos = pedidos.filter(p => p && p.id);
    renderTabla(pedidosValidos);
  },

  filtrarPorEstado(estado) {
    establecerEstadoFiltro(estado);
    this.render();
  },

  mostrarModalNuevo() {
    mostrarModalNuevo(() => this.render());
  },
  cerrarModalNuevo,

  enviarACocina(id) {
    return enviarACocina(id).then(() => this.render());
  },
  despachar(id) {
    return despachar(id).then(() => this.render());
  },
  confirmarEntrega(id) {
    return confirmarEntrega(id).then(() => this.render());
  },
  eliminarPedido(id) {
    eliminarPedido(id);
    setTimeout(() => this.render(), 200);
  },
  editarItems(id) {
    mostrarModalEditar(id, () => this.render());
  },
  cerrarEditarItems: cerrarModalEditar,

  _getItemsTemporales: getItemsTemporales,
  _setItemsTemporales: setItemsTemporales
};

export { Reparto };