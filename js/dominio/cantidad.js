/* ================================================================
   PubPOS — DOMINIO: Cantidad (Value Object)
   Propósito: Representa una cantidad entera positiva. Inmutable.
              Usado para ítems de pedido, comensales, etc.
   ================================================================ */
class Cantidad {
  /**
   * @param {number} valor - Entero positivo
   */
  constructor(valor) {
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new Error(`Cantidad inválida: ${valor}`);
    }
    this._valor = valor;
    Object.freeze(this);
  }

  get valor() { return this._valor; }

  // ── Operaciones ──────────────────────────────────────────
  sumar(otra) {
    return new Cantidad(this._valor + otra._valor);
  }

  // ── Comparaciones ────────────────────────────────────────
  esMayorQue(otra) { return this._valor > otra._valor; }
  esMenorQue(otra) { return this._valor < otra._valor; }
  esIgual(otra)    { return this._valor === otra._valor; }

  toString() { return String(this._valor); }
  toJSON()   { return this._valor; }
}

function crearCantidad(valor) {
  try {
    return new Cantidad(valor);
  } catch {
    return null;
  }
}

window.Cantidad   = Cantidad;
window.crearCantidad = crearCantidad;