/* ================================================================
   PubPOS — DOMINIO: Resultado (Value Object)
   Propósito: Representa el resultado de una operación (éxito o fallo).
              Evita propagar excepciones y obliga al llamador a manejar
              ambos casos explícitamente.
   ================================================================ */
class Resultado {
  /**
   * @param {boolean} exito - true si la operación fue exitosa
   * @param {*} [datos] - Datos devueltos en caso de éxito
   * @param {string} [error] - Mensaje de error en caso de fallo
   */
  constructor(exito, datos = null, error = null) {
    this._exito = exito;
    this._datos = datos;
    this._error = error;
    Object.freeze(this);
  }

  /** @returns {boolean} */
  get exito() { return this._exito; }
  /** @returns {*} */
  get datos() { return this._datos; }
  /** @returns {string|null} */
  get error() { return this._error; }

  /**
   * Crea un Resultado exitoso.
   * @param {*} datos
   * @returns {Resultado}
   */
  static ok(datos) {
    return new Resultado(true, datos, null);
  }

  /**
   * Crea un Resultado fallido.
   * @param {string} error
   * @returns {Resultado}
   */
  static fallo(error) {
    return new Resultado(false, null, error);
  }

  /**
   * Encadena operaciones: si el resultado es exitoso, ejecuta la función;
   * si es fallido, retorna el mismo resultado sin ejecutar nada.
   * @param {function} fn - Recibe los datos y debe devolver un nuevo Resultado
   * @returns {Resultado}
   */
  encadenar(fn) {
    if (!this._exito) return this;
    try {
      return fn(this._datos);
    } catch (e) {
      return Resultado.fallo(e.message);
    }
  }

  /** @returns {string} */
  toString() {
    return this._exito ? `Éxito: ${JSON.stringify(this._datos)}` : `Error: ${this._error}`;
  }
}

window.Resultado = Resultado;