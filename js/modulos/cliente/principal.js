/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/modulos/cliente/principal.js
   Versión: 2.0.0
   Propósito: Punto de entrada del frontend del cliente.
              Ya no llama a render(), confía en _asegurarVista.
   ================================================================ */

import { PantallaInicio } from './pantalla-inicio.js';
import { PantallaBienvenida } from './pantalla-bienvenida.js';
import { MenuDigital } from './menu-digital.js';
import { Orden } from './orden.js';
import { PantallaEventos } from './pantalla-eventos.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';

export const ClienteModulo = {
  PantallaInicio,
  PantallaBienvenida,
  MenuDigital,
  Orden,
  PantallaEventos
};

(function iniciar() {
  EventBus.on('vista:cambiada', (vista) => {
    const esCliente = Auth.esCliente?.() || false;

    if (vista === 'inicio') {
      if (!esCliente) PantallaInicio.mostrar();
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }

    if (esCliente && vista === 'bienvenida') {
      PantallaInicio.ocultar();
      PantallaBienvenida.mostrar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }

    if (esCliente && vista === 'menu') {
      PantallaInicio.ocultar();
      PantallaBienvenida.ocultar();
      MenuDigital.mostrar();
      PantallaEventos.ocultar();
    }

    if (esCliente && vista === 'eventos') {
      PantallaInicio.ocultar();
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.mostrar();
    }

    if (!esCliente || (vista !== 'menu' && vista !== 'inicio' && vista !== 'eventos' && vista !== 'bienvenida')) {
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }
  });

  EventBus.on('cliente:cuenta_creada', () => {
    if (Auth.esCliente?.()) {
      PantallaInicio.ocultar();
      PantallaBienvenida.mostrar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }
  });

  const usuario = Auth.getUsuarioActual?.() || null;
  if (!usuario) PantallaInicio.mostrar();
})();