/* ================================================================
   PubPOS — DOMINIO: Dinero (Value Object)
   Propósito: Representar una cantidad de dinero. Es inmutable:
              cualquier operación devuelve una nueva instancia.
              Garantiza que el valor nunca sea negativo.
   ================================================================ */
class Dinero {
  /**
   * @param {number} monto - Valor en pesos (ej. 1500)
   * @throws {Error} Si el monto no es un número válido o es negativo
   */
  constructor(monto) {
    if (typeof monto !== 'number' || isNaN(monto) || monto < 0) {
      throw new Error(`Dinero inválido: ${monto}`);
    }
    this._monto = monto;
    Object.freeze(this);
  }

  /** @returns {number} El monto */
  get monto() { return this._monto; }

  /**
   * Suma dos montos y devuelve un nuevo Dinero.
   * @param {Dinero} otro
   * @returns {Dinero}
   */
  sumar(otro) {
    return new Dinero(this._monto + otro._monto);
  }

  /**
   * Resta dos montos (el resultado nunca es negativo).
   * @param {Dinero} otro
   * @returns {Dinero}
   */
  restar(otro) {
    return new Dinero(Math.max(0, this._monto - otro._monto));
  }

  /**
   * Multiplica el monto por un factor entero positivo.
   * @param {number} factor
   * @returns {Dinero}
   */
  multiplicar(factor) {
    if (factor < 0) throw new Error('No se puede multiplicar dinero por negativo');
    return new Dinero(Math.round(this._monto * factor));
  }

  /** @returns {boolean} */
  esMayorQue(otro)  { return this._monto > otro._monto; }
  /** @returns {boolean} */
  esMenorQue(otro)  { return this._monto < otro._monto; }
  /** @returns {boolean} */
  esIgual(otro)     { return this._monto === otro._monto; }
  /** @returns {boolean} */
  esCero()          { return this._monto === 0; }

  /** @returns {string} Formateado como moneda */
  toString() {
    return fmtMoney(this._monto);
  }

  /** @returns {number} */
  toJSON() {
    return this._monto;
  }
}

/**
 * Factory segura: devuelve null si el monto no es válido.
 * @param {number} monto
 * @returns {Dinero|null}
 */
function crearDinero(monto) {
  try {
    return new Dinero(monto);
  } catch {
    return null;
  }
}

window.Dinero = Dinero;
window.crearDinero = crearDinero;