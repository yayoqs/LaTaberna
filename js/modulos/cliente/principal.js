/**
 * Módulo principal del Cliente (Frontend Cliente)
 * v1.7.0 — 2026-06-20
 *
 * Punto de entrada cargado como <script type="module">.
 * Expone únicamente window.ClienteModulo.
 *
 * Responsabilidades:
 * - Renderiza y orquesta PantallaInicio, PantallaBienvenida,
 *   MenuDigital y PantallaEventos.
 * - Importa Orden como módulo interno.
 * - Escucha eventos del sistema (vista:cambiada, cliente:cuenta_creada)
 *   para activar o desactivar los módulos del cliente.
 * - Maneja la nueva vista 'bienvenida' como paso post-login.
 *
 * @module principal
 * @exports ClienteModulo
 */

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