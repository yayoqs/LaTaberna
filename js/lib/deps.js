/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/lib/deps.js
   Versión: 1.1.2
   Propósito: Contenedor de inyección de dependencias.
              Con import explícito.
   ================================================================ */

import { Logger } from './logger.js';

export const Deps = (() => {
  const _registro = {};

  function registrar(nombre, instancia) {
    if (_registro[nombre]) {
      Logger.warn(`[Deps] Ya existe una dependencia llamada "${nombre}". Será reemplazada.`);
    }
    _registro[nombre] = instancia;
  }

  function obtener(nombre) {
    if (!_registro[nombre]) throw new Error(`Dependencia "${nombre}" no registrada`);
    return _registro[nombre];
  }

  function existe(nombre) { return !!_registro[nombre]; }

  return { registrar, obtener, existe };
})();