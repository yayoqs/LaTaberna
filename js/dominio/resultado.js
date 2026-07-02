/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/resultado.js
   Versión: 1.1.2
   Propósito: Objeto de Valor Resultado: patrón Either para éxito/fallo.
              Sin asignaciones window.
   ================================================================ */

export class Resultado {
  constructor(exito, datos = null, error = null) {
    this._exito = exito;
    this._datos = datos;
    this._error = error;
    Object.freeze(this);
  }

  get exito() { return this._exito; }
  get datos() { return this._datos; }
  get error() { return this._error; }

  static ok(datos) { return new Resultado(true, datos, null); }
  static fallo(error) { return new Resultado(false, null, error); }

  encadenar(fn) {
    if (!this._exito) return this;
    try { return fn(this._datos); } catch (e) { return Resultado.fallo(e.message); }
  }

  toString() {
    return this._exito ? `Éxito: ${JSON.stringify(this._datos)}` : `Error: ${this._error}`;
  }
}