/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/modulos/cliente/principal.js
   Versión: 1.0.0
   Propósito: Punto de entrada del frontend del cliente. Orquesta todas las pantallas y expone window.ClienteModulo.
   Dependencias: js/modulos/cliente/pantalla-inicio.js, js/modulos/cliente/pantalla-bienvenida.js, js/modulos/cliente/menu-digital.js, js/modulos/cliente/orden.js, js/modulos/cliente/pantalla-eventos.js, js/lib/eventBus.js, js/auth.js
   ================================================================ */

import { PantallaInicio } from './pantalla-inicio.js';
import { PantallaBienvenida } from './pantalla-bienvenida.js';
import { MenuDigital } from './menu-digital.js';
import { Orden } from './orden.js';
import { PantallaEventos } from './pantalla-eventos.js';

const ClienteModulo = {
  PantallaInicio,
  PantallaBienvenida,
  MenuDigital,
  Orden,
  PantallaEventos
};

window.ClienteModulo = ClienteModulo;

(function iniciar() {
  PantallaInicio.render();
  PantallaBienvenida.render();
  MenuDigital.render();
  PantallaEventos.render();

  if (typeof window.EventBus !== 'undefined') {
    window.EventBus.on('vista:cambiada', (vista) => {
      const esCliente = window.Auth?.esCliente?.() || false;

      if (vista === 'inicio') {
        if (!esCliente) {
          PantallaInicio.mostrar();
        }
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

    window.EventBus.on('cliente:cuenta_creada', () => {
      if (window.Auth?.esCliente?.()) {
        PantallaInicio.ocultar();
        PantallaBienvenida.mostrar();
        MenuDigital.ocultar();
        PantallaEventos.ocultar();
      }
    });
  }

  const usuario = window.Auth?.getUsuarioActual?.() || null;
  if (!usuario) {
    PantallaInicio.mostrar();
  }
})();