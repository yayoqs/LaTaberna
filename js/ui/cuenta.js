/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/cuenta.js
   Versión: 1.0.2
   Propósito: Solicitud de cuenta (pre-cierre).
              Migración a mostrarToast.
   ================================================================ */

import { Auth } from '../auth.js';
import { mostrarToast } from '../utils.js';
import { EventBus } from '../lib/eventBus.js';
import { DB } from '../db.js';
import { Comanda } from './comanda.js';
import { Tickets } from './tickets.js';

const Cuenta = (() => {

  function pedirCuenta() {
    const rol = Auth.getRol();
    const rolesPermitidos = ['mesero', 'admin', 'master', 'caja'];
    if (!rolesPermitidos.includes(rol)) {
      mostrarToast('error', 'No tienes permiso para pedir la cuenta');
      return;
    }

    const mesa = Comanda.getMesaActiva();
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

    DB.saveMesas();
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