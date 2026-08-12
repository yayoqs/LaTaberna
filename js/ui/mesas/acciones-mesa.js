/* ================================================================
   LaTaberna - PubPOS — MESAS SUBMÓDULO (ES6)
   Archivo: js/ui/mesas/acciones-mesa.js
   Versión: 1.0.7
   Propósito: Funciones de acción sobre mesas.
              Workaround temporal: crea la mesa directamente en
              Appwrite hasta que el comando funcione correctamente.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { DB } from '../../db.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { Auth } from '../../auth.js';
import { CommandBus } from '../../lib/command-bus.js';
import { mostrarToast } from '../../utils.js';
import { LABELS } from './constantes.js';
import { getNotificaciones, addNotificacion, removeNotificacion, clearNotificaciones } from './notificaciones.js';
import { renderGrid, renderZoneButtons, setZonaActiva } from './renderer.js';

let _agregandoMesa = false;

async function agregarMesa() {
  if (_agregandoMesa) {
    Logger.warn('[Mesas] Ya hay una operación de agregar mesa en curso.');
    return;
  }
  _agregandoMesa = true;

  try {
    const zonas = (Store.obtenerEstado().config && Store.obtenerEstado().config.zonas) || DB.config.zonas || [];
    const zona = zonas.length > 0 ? zonas[0].nombre : 'salon';
    const local = Auth.obtenerLocalActivo?.() || {};
    const espacioId = local.id || 'lataberna';
    
    let mesas = Store.obtenerEstado().mesas;
    if (!mesas || mesas.length === 0) {
      try {
        mesas = await DBAppwrite.listar('mesas');
      } catch (e) {
        mesas = DB.mesas || [];
      }
    }
    
    let maxNum = 0;
    for (const m of mesas) {
      const num = parseInt(m.numero);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    const nuevoNum = maxNum + 1;

    // Ejecutar comando (actualiza Store y grilla)
    const resultado = await CommandBus.ejecutar({
      type: 'agregarMesa',
      datos: { numero: nuevoNum, zona }
    });

    // WORKAROUND: crear directamente en Appwrite
    try {
      await DBAppwrite.crear('mesas', String(nuevoNum), {
        numero: String(nuevoNum),
        estado: 'libre',
        comensales: 1,
        zona,
        esVirtual: false,
        espacioId
      });
      Logger.info(`[Mesas] Mesa ${nuevoNum} creada en Appwrite (workaround).`);
    } catch (e) {
      Logger.error('[Mesas] Error al crear mesa en Appwrite:', e);
    }

    if (resultado.exito) {
      mostrarToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
    } else {
      mostrarToast('error', resultado.error || 'Error al agregar mesa');
    }
  } catch (err) {
    Logger.error('[Mesas] Error al ejecutar comando agregarMesa:', err);
    mostrarToast('error', 'Error inesperado al agregar mesa');
  } finally {
    _agregandoMesa = false;
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