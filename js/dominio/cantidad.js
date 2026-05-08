/* ================================================================
   PubPOS — DOMINIO: Cantidad (Value Object)
   Propósito: Representa una cantidad entera positiva. Inmutable.
              Usado para ítems de pedido, comensales, etc.
   ================================================================ */
class Cantidad {
  /**
   * @param {number} valor - Entero positivo
   * @throws {Error} Si el valor no es un entero positivo
   */
  constructor(valor) {
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new Error(`Cantidad inválida: ${valor}`);
    }
    this._valor = valor;
    Object.freeze(this);
  }

  /** @returns {number} El valor numérico */
  get valor() { return this._valor; }

  /**
   * Suma dos cantidades y devuelve una nueva.
   * @param {Cantidad} otra
   * @returns {Cantidad}
   */
  sumar(otra) {
    return new Cantidad(this._valor + otra._valor);
  }

  /** @returns {boolean} */
  esMayorQue(otra) { return this._valor > otra._valor; }
  /** @returns {boolean} */
  esMenorQue(otra) { return this._valor < otra._valor; }
  /** @returns {boolean} */
  esIgual(otra)    { return this._valor === otra._valor; }

  /** @returns {string} */
  toString() { return String(this._valor); }
  /** @returns {number} */
  toJSON()   { return this._valor; }
}

/**
 * Factory segura: devuelve null si el valor no es válido.
 * @param {number} valor
 * @returns {Cantidad|null}
 */
function crearCantidad(valor) {
  try {
    return new Cantidad(valor);
  } catch {
    return null;
  }
}

window.Cantidad = Cantidad;
window.crearCantidad = crearCantidad;