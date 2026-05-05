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

  get exito() { return this._exito; }
  get datos() { return this._datos; }
  get error() { return this._error; }

  // ── Factory methods ──────────────────────────────────────
  static ok(datos) {
    return new Resultado(true, datos, null);
  }

  static fallo(error) {
    return new Resultado(false, null, error);
  }

  // ── Utilidades ───────────────────────────────────────────
  /**
   * Ejecuta una función solo si el resultado es exitoso.
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

  toString() {
    return this._exito ? `Éxito: ${JSON.stringify(this._datos)}` : `Error: ${this._error}`;
  }
}

window.Resultado = Resultado;