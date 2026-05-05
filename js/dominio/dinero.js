/* ================================================================
   PubPOS — DOMINIO: Dinero (Value Object)
   Propósito: Representar una cantidad de dinero. Es inmutable:
              cualquier operación devuelve una nueva instancia.
              Garantiza que el valor nunca sea negativo.
   ================================================================ */
class Dinero {
  /**
   * @param {number} monto - Valor en pesos (ej. 1500)
   */
  constructor(monto) {
    if (typeof monto !== 'number' || isNaN(monto) || monto < 0) {
      throw new Error(`Dinero inválido: ${monto}`);
    }
    this._monto = monto;
    Object.freeze(this);  // 🧊 inmutable
  }

  get monto() { return this._monto; }

  // ── Operaciones ──────────────────────────────────────────
  sumar(otro) {
    return new Dinero(this._monto + otro._monto);
  }

  restar(otro) {
    return new Dinero(Math.max(0, this._monto - otro._monto));
  }

  multiplicar(factor) {
    if (factor < 0) throw new Error('No se puede multiplicar dinero por negativo');
    return new Dinero(Math.round(this._monto * factor));
  }

  // ── Comparaciones ────────────────────────────────────────
  esMayorQue(otro)  { return this._monto > otro._monto; }
  esMenorQue(otro)  { return this._monto < otro._monto; }
  esIgual(otro)     { return this._monto === otro._monto; }
  esCero()          { return this._monto === 0; }

  // ── Utilidades ───────────────────────────────────────────
  toString() {
    return fmtMoney(this._monto);   // usa la función global de utils.js
  }

  toJSON() {
    return this._monto;
  }
}

// Factory (alternativa sin lanzar excepciones)
function crearDinero(monto) {
  try {
    return new Dinero(monto);
  } catch {
    return null;
  }
}

window.Dinero = Dinero;
window.crearDinero = crearDinero;