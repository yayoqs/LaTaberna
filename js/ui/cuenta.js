/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/cuenta.js
   Versión: 1.0.5
   Propósito: Solicitud de cuenta (pre-cierre).
              Corrección: Auth.getRol() → Auth.obtenerRol().
   ================================================================ */

import { Auth } from '../auth.js';
import { mostrarToast } from '../utils.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { Store } from '../lib/store.js';
import { DB } from '../db.js';
import { Comanda } from './comanda.js';
import { Tickets } from './tickets.js';

const Cuenta = (() => {

  function pedirCuenta() {
    const rol = Auth.obtenerRol();
    const rolesPermitidos = ['mesero', 'admin', 'master', 'caja'];
    if (!rolesPermitidos.includes(rol)) {
      mostrarToast('error', 'No tienes permiso para pedir la cuenta');
      return;
    }

    const mesa = Comanda.obtenerMesaActiva();
    if (!mesa) {
      mostrarToast('warning', 'No hay ninguna mesa abierta.');
      return;
    }
    if (!mesa.items || mesa.items.length === 0) {
      mostrarToast('warning', 'La mesa no tiene consumos para cobrar.');
      return;
    }

    mesa.estado = 'cuenta';
    const obsInput = document.getElementById('comandaObs');
    if (obsInput) mesa.observaciones = obsInput.value;

    // Persistir en DB
    try {
      DB.saveMesas();
    } catch (e) {
      Logger.error('[Cuenta] Error al persistir estado cuenta:', e);
    }

    // Despachar al Store
    Store.despachar({
      type: 'MESA_ACTUALIZAR',
      payload: { numero: mesa.numero, cambios: { estado: 'cuenta' } }
    });

    EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: 'cuenta' });

    const badge = document.getElementById('modalEstadoBadge');
    if (badge) {
      badge.textContent = 'Cuenta';
      badge.className = 'estado-badge cuenta';
    }

    const ticketHTML = Tickets.generarCuenta(mesa);
    Tickets.mostrar(ticketHTML, `Cuenta — Mesa ${mesa.numero}`);
    mostrarToast('info', `Cuenta generada para Mesa ${mesa.numero}`);
  }

  EventBus.on('cuenta:solicitada', pedirCuenta);

  return { pedirCuenta };
})();

export { Cuenta };