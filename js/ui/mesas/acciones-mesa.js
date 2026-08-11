/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/acciones-mesa.js
   Versión: 1.0.2
   Propósito: Funciones de acción sobre mesas. Corrección:
             getBadgeAtencion ya no verifica permite_prepedidos
             (campo eliminado en el nuevo modelo).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { DB } from '../../db.js';
import { CommandBus } from '../../lib/command-bus.js';
import { mostrarToast } from '../../utils.js';
import { LABELS } from './constantes.js';
import { getNotificaciones, addNotificacion, removeNotificacion, clearNotificaciones } from './notificaciones.js';
import { renderGrid, renderZoneButtons, setZonaActiva } from './renderer.js';

function agregarMesa() {
  const zonas = (Store.obtenerEstado().config && Store.obtenerEstado().config.zonas) || DB.config.zonas || [];
  const zona = zonas.length > 0 ? zonas[0].nombre : 'salon';
  const mesas = Store.obtenerEstado().mesas;
  const maxNum = mesas.reduce((max, m) => Math.max(max, typeof m.numero === 'number' ? m.numero : 0), 0);
  const nuevoNum = maxNum + 1;

  CommandBus.ejecutar({
    type: 'agregarMesa',
    datos: { numero: nuevoNum, zona }
  }).then(resultado => {
    if (resultado.exito) {
      mostrarToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
    } else {
      mostrarToast('error', resultado.error || 'Error al agregar mesa');
    }
  }).catch(err => {
    Logger.error('[Mesas] Error al ejecutar comando agregarMesa:', err);
    mostrarToast('error', 'Error inesperado al agregar mesa');
  });
}

function labelEstado(estado) { return LABELS[estado] || estado; }

function setBadge(numMesa, cantidad, precargaId) {
  addNotificacion(numMesa, 'precarga', { cantidad, precargaId });
  renderGrid();
}

function clearBadge(numMesa) {
  removeNotificacion(numMesa, 'precarga');
  renderGrid();
}

function setClienteEsperando(numMesa) {
  addNotificacion(numMesa, 'esperando', {});
  renderGrid();
}

function clearClienteEsperando(numMesa) {
  removeNotificacion(numMesa, 'esperando');
  renderGrid();
}

function getBadgeAtencion(numMesa) {
  const notificaciones = getNotificaciones(numMesa);
  
  const espera = notificaciones.find(n => n.tipo === 'esperando');
  if (espera) {
    const mesa = (Store.obtenerEstado().mesas || []).find(m => m.numero == numMesa);
    // En el nuevo modelo, solo verificamos que la mesa esté libre.
    // El campo permite_prepedidos ya no existe en laTaberna_Mesas.
    if (mesa && mesa.estado === 'libre') {
      return { tipo: 'esperando', nombre: 'Cliente', iniciales: 'C' };
    }
  }
  
  const precarga = notificaciones.find(n => n.tipo === 'precarga');
  if (precarga) {
    return { tipo: 'precarga', nombre: 'Cliente', iniciales: 'P', precargaId: precarga.precargaId };
  }
  
  return null;
}

function clearBadgeAtencion(numMesa) {
  clearNotificaciones(numMesa);
  renderGrid();
}

function setZona(zona) {
  setZonaActiva(zona);
  renderZoneButtons();
  renderGrid();
}

export {
  agregarMesa,
  labelEstado,
  setBadge,
  clearBadge,
  setClienteEsperando,
  clearClienteEsperando,
  getBadgeAtencion,
  clearBadgeAtencion,
  setZona
};