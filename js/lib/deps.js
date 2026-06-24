/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/lib/deps.js
   Versión: 1.0.0
   Propósito: Contenedor de inyección de dependencias. Registro y resolución de servicios y repositorios.
   Dependencias: js/lib/logger.js
   ================================================================ */
const Deps = (() => {
  const _registro = {};

  /**
   * Registra una dependencia con un nombre único.
   * @param {string} nombre - ej. 'pedidoRepo', 'inventarioService'
   * @param {*} instancia
   */
  function registrar(nombre, instancia) {
    if (_registro[nombre]) {
      Logger.warn(`[Deps] Ya existe una dependencia llamada "${nombre}". Será reemplazada.`);
    }
    _registro[nombre] = instancia;
  }

  /**
   * Obtiene una dependencia registrada.
   * @param {string} nombre
   * @returns {*} La instancia registrada
   * @throws {Error} Si no está registrada
   */
  function obtener(nombre) {
    if (!_registro[nombre]) {
      throw new Error(`Dependencia "${nombre}" no registrada`);
    }
    return _registro[nombre];
  }

  /**
   * Verifica si una dependencia está registrada.
   */
  function existe(nombre) {
    return !!_registro[nombre];
  }

  return { registrar, obtener, existe };
})();

window.Deps = Deps;