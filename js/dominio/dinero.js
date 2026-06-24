/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/dinero.js
   Versión: 1.1.0
   Propósito: Objeto de Valor Dinero: monto inmutable, operaciones matemáticas.
              Migrado a módulo ES6 con export.
   Dependencias: js/utils.js (fmtMoney)
   ================================================================ */
export class Dinero {
  constructor(monto) {
    if (typeof monto !== 'number' || isNaN(monto) || monto < 0) {
      throw new Error(`Dinero inválido: ${monto}`);
    }
    this._monto = monto;
    Object.freeze(this);
  }

  get monto() { return this._monto; }

  sumar(otro) { return new Dinero(this._monto + otro._monto); }
  restar(otro) { return new Dinero(Math.max(0, this._monto - otro._monto)); }
  multiplicar(factor) {
    if (factor < 0) throw new Error('No se puede multiplicar dinero por negativo');
    return new Dinero(Math.round(this._monto * factor));
  }

  esMayorQue(otro) { return this._monto > otro._monto; }
  esMenorQue(otro) { return this._monto < otro._monto; }
  esIgual(otro)    { return this._monto === otro._monto; }
  esCero()         { return this._monto === 0; }

  toString() { return fmtMoney(this._monto); }
  toJSON()   { return this._monto; }
}

export function crearDinero(monto) {
  try { return new Dinero(monto); } catch { return null; }
}

// Retrocompatibilidad con scripts legacy
window.Dinero = Dinero;
window.crearDinero = crearDinero;