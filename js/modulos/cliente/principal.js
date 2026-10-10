/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/modulos/cliente/principal.js
   Versión: 2.0.4
   Propósito: Punto de entrada del frontend del cliente.
   v2.0.4: Paquete 6 — extrae la lectura del parámetro ?espacio= a
     contexto-qr.js para romper el ciclo de importación entre
     principal.js y menu-digital.js. Se elimina el import sin uso
     de Logger.
   v2.0.3: Paquete 6 — integración con QR del restaurante (lógica
     movida a contexto-qr.js).
   v2.0.2: migrado a Auth.esJugador() y jugador:cuenta_creada.
   ================================================================ */

import { PantallaInicio } from './pantalla-inicio.js';
import { PantallaBienvenida } from './pantalla-bienvenida.js';
import { MenuDigital } from './menu-digital.js';
import { Orden } from './orden.js';
import { PantallaEventos } from './pantalla-eventos.js';
import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';
import { leerEspacioDelQR } from './contexto-qr.js';

export const ClienteModulo = {
  PantallaInicio,
  PantallaBienvenida,
  MenuDigital,
  Orden,
  PantallaEventos
};

(function iniciar() {
  // Leer ?espacio= antes de cualquier otra inicialización.
  leerEspacioDelQR();

  EventBus.on('vista:cambiada', (vista) => {
    const esJugador = Auth.esJugador?.() || false;

    if (vista === 'inicio') {
      if (!esJugador) PantallaInicio.mostrar();
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }

    if (esJugador && vista === 'bienvenida') {
      PantallaInicio.ocultar();
      PantallaBienvenida.mostrar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }

    if (esJugador && vista === 'menu') {
      PantallaInicio.ocultar();
      PantallaBienvenida.ocultar();
      MenuDigital.mostrar();
      PantallaEventos.ocultar();
    }

    if (esJugador && vista === 'eventos') {
      PantallaInicio.ocultar();
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.mostrar();
    }

    if (!esJugador || (vista !== 'menu' && vista !== 'inicio' && vista !== 'eventos' && vista !== 'bienvenida')) {
      PantallaBienvenida.ocultar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }
  });

  EventBus.on('jugador:cuenta_creada', () => {
    if (Auth.esJugador?.()) {
      PantallaInicio.ocultar();
      PantallaBienvenida.mostrar();
      MenuDigital.ocultar();
      PantallaEventos.ocultar();
    }
  });

  const usuario = Auth.obtenerUsuarioActual?.() || null;
  if (!usuario) PantallaInicio.mostrar();
})();