/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/mesas.js
   Versión: 2.1.0
   Propósito: Fachada del mapa de mesas. Orquesta los submódulos
              de la carpeta mesas/. Sin window, sin onclick.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DB } from '../db.js';
import { CommandBus } from '../lib/command-bus.js';
import { showToast } from '../utils.js';
import { mesaVacia } from '../db-core.js';
import { LABELS } from './mesas/constantes.js';
import { getNotificaciones, addNotificacion, removeNotificacion, clearNotificaciones } from './mesas/notificaciones.js';
import { renderGrid, renderZoneButtons, asegurarVista, setZonaActiva } from './mesas/renderer.js';
import { toggleModoFusion, toggleSeleccionMesa, fusionarMesasSeleccionadas } from './mesas/fusion.js';
import { activar, limpiar } from './mesas/ciclo-vida.js';

const Mesas = (() => {

  function render() {
    asegurarVista();
    renderZoneButtons();
    renderGrid();
  }

  function agregarMesa() {
    const zonas = (Store.getState().config && Store.getState().config.zonas) || DB.config.zonas || [];
    const zona = zonas.length > 0 ? zonas[0].nombre : 'salon';
    const mesas = Store.getState().mesas;
    const maxNum = mesas.reduce((max, m) => Math.max(max, typeof m.numero === 'number' ? m.numero : 0), 0);
    const nuevoNum = maxNum + 1;

    CommandBus.ejecutar({
      type: 'agregarMesa',
      datos: { numero: nuevoNum, zona }
    }).then(resultado => {
      if (resultado.exito) {
        showToast('success', `Mesa ${nuevoNum} agregada (${zona})`);
      } else {
        showToast('error', resultado.error || 'Error al agregar mesa');
      }
    }).catch(err => {
      Logger.error('[Mesas] Error al ejecutar comando agregarMesa:', err);
      showToast('error', 'Error inesperado al agregar mesa');
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

  function onPrecargaClick(numMesa) {
    const notificaciones = getNotificaciones(numMesa);
    const precarga = notificaciones.find(n => n.tipo === 'precarga');
    if (precarga) {
      EventBus.emit('mesa:badge_click', { mesa: numMesa, precargaId: precarga.precargaId });
    }
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
      const mesa = (Store.getState().mesas || []).find(m => m.numero == numMesa);
      if (mesa && mesa.estado === 'libre' && mesa.permite_prepedidos === false) {
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

  // Inicializar el ciclo de vida al importar
  activar();

  return {
    activar,
    limpiar,
    render,
    agregarMesa,
    labelEstado,
    toggleModoFusion,
    toggleSeleccionMesa,
    fusionarMesasSeleccionadas,
    setZona,
    setBadge,
    clearBadge,
    onPrecargaClick,
    setClienteEsperando,
    clearClienteEsperando,
    getBadgeAtencion,
    clearBadgeAtencion
  };
})();

export { Mesas };