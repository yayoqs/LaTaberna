/* ================================================================
   LaTaberna - PubPOS — MÓDULO INTERNO (ES6)
   Archivo: js/modulos/interno/guia-mesero.js
   Versión: 2.0.2
   Propósito: Guía interactiva para el mesero nuevo.
              Log de inicialización movido a función activar().
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';

const GuiaMesero = (() => {
  const PASOS = [
    {
      titulo: 'Bienvenido al mapa de mesas',
      texto: 'Cada tarjeta representa una mesa del salón. El color del borde izquierdo indica su estado: verde para libre, azul para ocupada, amarillo para lista y rojo para cuenta.',
      boton: 'Entendido'
    },
    {
      titulo: 'Insignias de notificación',
      texto: 'Un reloj azul significa que un cliente está esperando que actives la mesa. Una campana naranja con un número significa que el cliente ya armó un pedido. Toca la insignia para cargar los ítems en la comanda.',
      boton: 'Siguiente'
    },
    {
      titulo: 'Cómo abrir una mesa',
      texto: 'Haz clic sobre una mesa libre. Te pedirá la cantidad de comensales. Luego podrás agregar productos desde la carta y enviar comandas a cocina o barra.',
      boton: 'Comenzar'
    }
  ];

  let _pasoActual = 0;
  let _contenedor = null;
  let _activa = false;
  let _activado = false;

  function _iniciar() {
    if (_activa) return;
    _activa = true;
    _pasoActual = 0;
    _crearContenedor();
    _mostrarPaso();
  }

  function _crearContenedor() {
    _contenedor = document.createElement('div');
    _contenedor.id = 'guia-mesero-overlay';
    _contenedor.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(_contenedor);
  }

  function _mostrarPaso() {
    if (!_contenedor) return;
    const paso = PASOS[_pasoActual];
    if (!paso) return _finalizar();

    _contenedor.innerHTML = `
      <div style="
        background: #1a1a2e;
        border: 1px solid #2e2e42;
        border-radius: 12px;
        padding: 24px;
        max-width: 420px;
        width: 90%;
        color: #f1f5f9;
        font-family: system-ui, sans-serif;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      ">
        <div style="font-size: 14px; color: #f59e0b; margin-bottom: 8px;">
          Paso ${_pasoActual + 1} de ${PASOS.length}
        </div>
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #fff;">
          ${paso.titulo}
        </h2>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px 0;">
          ${paso.texto}
        </p>
        <button id="guia-mesero-btn" style="
          background: #f59e0b;
          color: #1a1a24;
          border: none;
          border-radius: 8px;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
        ">${paso.boton}</button>
        <button id="guia-mesero-saltar" style="
          background: transparent;
          color: #64748b;
          border: none;
          margin-top: 12px;
          font-size: 11px;
          cursor: pointer;
          display: block;
          width: 100%;
          text-align: center;
        ">Saltar guía</button>
      </div>
    `;

    document.getElementById('guia-mesero-btn').addEventListener('click', _siguientePaso);
    document.getElementById('guia-mesero-saltar').addEventListener('click', _finalizar);
  }

  function _siguientePaso() {
    _pasoActual++;
    if (_pasoActual >= PASOS.length) {
      _finalizar();
    } else {
      _mostrarPaso();
    }
  }

  function _finalizar() {
    if (_contenedor) {
      _contenedor.remove();
      _contenedor = null;
    }
    _activa = false;
    Logger.info('[GuiaMesero] Guía completada.');
  }

  function activar() {
    if (_activado) return;
    _activado = true;

    EventBus.on('vista:cambiada', (vista) => {
      if (vista === 'mesas') {
        setTimeout(_iniciar, 300);
      }
    });

    Logger.info('[GuiaMesero] Módulo inicializado (ES6 v2.0.2).');
  }

  activar();

  return { activar };
})();

export { GuiaMesero };