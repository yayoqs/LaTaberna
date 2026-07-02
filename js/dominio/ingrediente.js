/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/ingrediente.js
   Versión: 1.1.2
   Propósito: Objeto de Valor Ingrediente con factory de reconstrucción.
              Sin asignaciones window.
   ================================================================ */

export class Ingrediente {
  constructor(id, nombre, stock, unidad, stockMinimo, categoria, ubicacion, valorUnitario) {
    if (!id) throw new Error('Ingrediente debe tener un ID');
    if (!nombre) throw new Error('Ingrediente debe tener un nombre');
    this._id = id;
    this._nombre = nombre;
    this._stock = stock || 0;
    this._unidad = unidad || 'u';
    this._stockMinimo = stockMinimo || 0;
    this._categoria = categoria || '';
    this._ubicacion = ubicacion || '';
    this._valorUnitario = valorUnitario || 0;
    Object.freeze(this);
  }

  get id()             { return this._id; }
  get nombre()         { return this._nombre; }
  get stock()          { return this._stock; }
  get unidad()         { return this._unidad; }
  get stockMinimo()    { return this._stockMinimo; }
  get categoria()      { return this._categoria; }
  get ubicacion()      { return this._ubicacion; }
  get valorUnitario()  { return this._valorUnitario; }

  get bajoMinimo() { return this._stock <= this._stockMinimo; }
  get valorTotal() { return this._stock * this._valorUnitario; }

  ajustarStock(delta) {
    return new Ingrediente(this._id, this._nombre, Math.max(0, this._stock + delta), this._unidad, this._stockMinimo, this._categoria, this._ubicacion, this._valorUnitario);
  }

  actualizarValor(nuevoValor) {
    return new Ingrediente(this._id, this._nombre, this._stock, this._unidad, this._stockMinimo, this._categoria, this._ubicacion, nuevoValor);
  }

  toJSON() {
    return { id: this._id, nombre: this._nombre, stock: this._stock, unidad: this._unidad, stockMinimo: this._stockMinimo, categoria: this._categoria, ubicacion: this._ubicacion, valorUnitario: this._valorUnitario };
  }
}

export function crearIngrediente(id, nombre, stock, unidad, stockMinimo, categoria, ubicacion, valorUnitario) {
  try { return new Ingrediente(id, nombre, stock, unidad, stockMinimo, categoria, ubicacion, valorUnitario); } catch { return null; }
}

export function reconstruirIngrediente(datos) {
  return new Ingrediente(datos.id, datos.nombre, datos.stock, datos.unidad, datos.stock_minimo || datos.stockMinimo, datos.categoria, datos.ubicacion, datos.valor_unitario || datos.valorUnitario);
}