/* ================================================================
   LaTaberna - PubPOS — UI (ES6)
   Archivo: js/ui/mesas.js
   Versión: 2.2.2
   Propósito: Fachada del mapa de mesas. Reexporta desde submódulos
              para mantener API pública sin cambios.
              Sin window, sin onclick.
              Agrega import de AvisosMesero para el indicador visual.
   ================================================================ */

import { EventBus } from '../lib/eventBus.js';
import { getNotificaciones } from './mesas/notificaciones.js';
import {
  agregarMesa,
  labelEstado,
  setBadge,
  clearBadge,
  setClienteEsperando,
  clearClienteEsperando,
  getBadgeAtencion,
  clearBadgeAtencion,
  setZona
} from './mesas/acciones-mesa.js';

import { renderGrid, renderZoneButtons, asegurarVista } from './mesas/renderer.js';
import { toggleModoFusion, toggleSeleccionMesa, fusionarMesasSeleccionadas } from './mesas/fusion.js';
import { activar, limpiar } from './mesas/ciclo-vida.js';
import { AvisosMesero } from '../modulos/interno/avisos-mesero.js';

const Mesas = (() => {

  function render() {
    asegurarVista();
    renderZoneButtons();
    renderGrid();
  }

  function onPrecargaClick(numMesa) {
    const notificaciones = getNotificaciones(numMesa);
    const precarga = notificaciones.find(n => n.tipo === 'precarga');
    if (precarga) {
      EventBus.emit('mesa:badge_click', { mesa: numMesa, precargaId: precarga.precargaId });
    }
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