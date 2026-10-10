/* ================================================================
   LaTaberna - Ecosistema Elisekai — DOMINIO JS (ES6)
   Archivo: js/dominio/dinero.js
   Versión: 2.0.0
   Propósito: Objeto de Valor Dinero: monto entero, precisión por
              moneda. Inmutable, sin floats.
              v2.0.0: rediseño con precisión configurable (CLP y KYU).
                      Monto entero, operaciones sin redondeo binario.
   ================================================================ */

import { formatearDinero, MONEDAS } from '../utils.js';

// Reexportamos MONEDAS para que otros módulos puedan importarla desde dominio
export { MONEDAS } from '../utils.js';

export class Dinero {
  constructor(monto, moneda = 'CLP') {
    if (!Number.isInteger(monto) || monto < 0) {
      throw new Error(`Dinero inválido: ${monto}`);
    }
    if (!MONEDAS[moneda]) {
      throw new Error(`Moneda no soportada: ${moneda}`);
    }
    this._monto = monto;
    this._moneda = moneda;
    Object.freeze(this);
  }

  get monto() { return this._monto; }
  get moneda() { return this._moneda; }

  // Operaciones: asumen misma moneda
  sumar(otro) {
    this._validarMismaMoneda(otro);
    return new Dinero(this._monto + otro._monto, this._moneda);
  }

  restar(otro) {
    this._validarMismaMoneda(otro);
    return new Dinero(Math.max(0, this._monto - otro._monto), this._moneda);
  }

  multiplicar(factor) {
    if (typeof factor !== 'number' || factor < 0) {
      throw new Error('No se puede multiplicar dinero por un factor negativo o no numérico');
    }
    // Redondeo explícito al entero más cercano
    const resultado = Math.round(this._monto * factor);
    return new Dinero(resultado, this._moneda);
  }

  esMayorQue(otro) { this._validarMismaMoneda(otro); return this._monto > otro._monto; }
  esMenorQue(otro) { this._validarMismaMoneda(otro); return this._monto < otro._monto; }
  esIgual(otro)    { this._validarMismaMoneda(otro); return this._monto === otro._monto; }
  esCero()         { return this._monto === 0; }

  _validarMismaMoneda(otro) {
    if (this._moneda !== otro._moneda) {
      throw new Error('No se pueden operar montos de distintas monedas');
    }
  }

  toString() {
    return formatearDinero(this._monto, this._moneda);
  }

  toJSON() {
    return { monto: this._monto, moneda: this._moneda };
  }
}

export function crearDinero(monto, moneda = 'CLP') {
  try {
    // Validamos que el monto sea entero y que la moneda sea soportada
    if (!Number.isInteger(monto) || monto < 0) return null;
    if (!MONEDAS[moneda]) return null;
    return new Dinero(monto, moneda);
  } catch {
    return null;
  }
}