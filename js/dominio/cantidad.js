/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/cantidad.js
   Versión: 1.1.3
   Propósito: Objeto de Valor Cantidad: número positivo inmutable.
              Acepta tanto enteros como decimales.
   ================================================================ */

export class Cantidad {
  constructor(valor) {
    if (typeof valor !== 'number' || isNaN(valor) || valor <= 0) {
      throw new Error(`Cantidad inválida: ${valor}`);
    }
    this._valor = valor;
    Object.freeze(this);
  }

  get valor() { return this._valor; }

  sumar(otra) { return new Cantidad(this._valor + otra._valor); }

  esMayorQue(otra) { return this._valor > otra._valor; }
  esMenorQue(otra) { return this._valor < otra._valor; }
  esIgual(otra)    { return this._valor === otra._valor; }

  toString() { return String(this._valor); }
  toJSON()   { return this._valor; }
}

export function crearCantidad(valor) {
  try { return new Cantidad(valor); } catch { return null; }
}