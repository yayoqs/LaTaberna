/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/direccion.js
   Versión: 1.1.0
   Propósito: Objeto de Valor Direccion: dirección de entrega inmutable.
              Migrado a módulo ES6 con export.
   Dependencias: (ninguna externa)
   ================================================================ */
   
export class Direccion {
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

export function crearDireccion(calle, numero, depto, referencia, telefono) {
  try {
    return new Direccion(calle, numero, depto, referencia, telefono);
  } catch {
    return null;
  }
}

window.Direccion = Direccion;
window.crearDireccion = crearDireccion;