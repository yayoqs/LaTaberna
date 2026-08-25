/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/acciones-mesa.js
   Versión: 1.1.5
   Propósito: Funciones de acción sobre mesas.
              v1.1.5: Eliminado workaround temporal OT-5.
                      La creación de mesas depende exclusivamente
                      del comando agregarMesa vía CommandBus.
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

async function agregarMesa() {
  try {
    const zonas = (Store.obtenerEstado().config && Store.obtenerEstado().config.zonas) || DB.config.zonas || [];
    const zona = zonas.length > 0 ? zonas[0].nombre : 'salon';

    const mesas = DB.mesas || [];
    let maxNum = 0;
    for (const m of mesas) {
      const num = parseInt(m.numero);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    const nuevoNum = maxNum + 1;

    const resultado = await CommandBus.ejecutar({
      type: 'agregarMesa',
      datos: { numero: nuevoNum, zona }
    });

    if (resultado.exito) {
      renderGrid();
      mostrarToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
      return { exito: true, numero: nuevoNum };
    }

    mostrarToast('error', resultado.error || 'Error al agregar mesa');
    return { exito: false, numero: nuevoNum, error: resultado.error };
  } catch (err) {
    Logger.error('[Mesas] Error al ejecutar comando agregarMesa:', err);
    mostrarToast('error', 'Error inesperado al agregar mesa');
    return { exito: false, error: err.message };
  }
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