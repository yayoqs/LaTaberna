/* ================================================================
   PubPOS — DOMINIO: Direccion (Value Object)
   Propósito: Representa una dirección de entrega para delivery.
              Es inmutable. Ningún campo es obligatorio excepto la calle.
   ================================================================ */
class Direccion {
  /**
   * @param {string} calle - Calle principal (obligatorio)
   * @param {string} numero - Número (opcional)
   * @param {string} depto - Departamento (opcional)
   * @param {string} referencia - Referencia adicional (opcional)
   * @param {string} telefono - Teléfono de contacto (opcional)
   */
  constructor(calle, numero = '', depto = '', referencia = '', telefono = '') {
    if (!calle || typeof calle !== 'string' || calle.trim().length === 0) {
      throw new Error('La calle es obligatoria');
    }
    this._calle      = calle.trim();
    this._numero     = String(numero).trim();
    this._depto      = String(depto).trim();
    this._referencia = String(referencia).trim();
    this._telefono   = String(telefono).trim();
    Object.freeze(this);
  }

  get calle()      { return this._calle; }
  get numero()     { return this._numero; }
  get depto()      { return this._depto; }
  get referencia() { return this._referencia; }
  get telefono()   { return this._telefono; }

  // ── Utilidades ───────────────────────────────────────────
  /**
   * Devuelve la dirección en una sola línea para mostrar en tickets.
   */
  toString() {
    let dir = this._calle;
    if (this._numero)     dir += ' ' + this._numero;
    if (this._depto)      dir += ', ' + this._depto;
    if (this._referencia) dir += ' (Ref: ' + this._referencia + ')';
    if (this._telefono)   dir += ' Tel: ' + this._telefono;
    return dir;
  }

  toJSON() {
    return {
      calle:      this._calle,
      numero:     this._numero,
      depto:      this._depto,
      referencia: this._referencia,
      telefono:   this._telefono
    };
  }
}

// Factory segura
function crearDireccion(calle, numero, depto, referencia, telefono) {
  try {
    return new Direccion(calle, numero, depto, referencia, telefono);
  } catch {
    return null;
  }
}

window.Direccion = Direccion;
window.crearDireccion = crearDireccion;