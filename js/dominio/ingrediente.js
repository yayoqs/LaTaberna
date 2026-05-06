/* ================================================================
   PubPOS — DOMINIO: Ingrediente (Agregado)
   Propósito: Representa un ingrediente o insumo del inventario.
              Encapsula las reglas de stock y garantiza que nunca
              quede en un estado inválido.
   ================================================================ */
class Ingrediente {
  /**
   * @param {string} id - Identificador único
   * @param {string} nombre - Nombre del ingrediente
   * @param {Cantidad} stock - Cantidad actual en inventario
   * @param {string} unidad - Unidad de medida (kg, g, L, u)
   * @param {Cantidad} stockMinimo - Nivel mínimo de alerta
   * @param {string} categoria - Categoría (cocina, barra, general)
   * @param {string} ubicacion - Ubicación física (estante, refrigerador)
   * @param {Dinero} valorUnitario - Costo por unidad
   */
  constructor(id, nombre, stock, unidad, stockMinimo, categoria = 'general', ubicacion = '', valorUnitario = null) {
    if (!id) throw new Error('Ingrediente debe tener un ID');
    if (!nombre || typeof nombre !== 'string') throw new Error('Nombre inválido');
    if (!(stock instanceof Cantidad)) throw new Error('Stock debe ser una Cantidad');
    if (!(stockMinimo instanceof Cantidad)) throw new Error('Stock mínimo debe ser una Cantidad');
    if (!unidad || typeof unidad !== 'string') throw new Error('Unidad inválida');

    this._id            = id;
    this._nombre        = nombre.trim();
    this._stock         = stock;
    this._unidad        = unidad.trim().toLowerCase();
    this._stockMinimo   = stockMinimo;
    this._categoria     = categoria;
    this._ubicacion     = ubicacion.trim();
    this._valorUnitario = valorUnitario instanceof Dinero ? valorUnitario : new Dinero(0);
  }

  // ── GETTERS ──────────────────────────────────────────────
  get id()            { return this._id; }
  get nombre()        { return this._nombre; }
  get stock()         { return this._stock; }
  get unidad()        { return this._unidad; }
  get stockMinimo()   { return this._stockMinimo; }
  get categoria()     { return this._categoria; }
  get ubicacion()     { return this._ubicacion; }
  get valorUnitario() { return this._valorUnitario; }

  /**
   * Indica si el stock está bajo el mínimo.
   */
  get bajoMinimo() {
    return this._stock.esMenorQue(this._stockMinimo) || this._stock.esIgual(this._stockMinimo);
  }

  /**
   * Valor total del inventario para este ingrediente.
   */
  get valorTotal() {
    return this._valorUnitario.multiplicar(this._stock.valor);
  }

  // ── REGLAS DE NEGOCIO ────────────────────────────────────

  /**
   * Ajusta el stock sumando o restando una cantidad.
   * El stock nunca puede ser negativo.
   * @param {Cantidad} delta - Positivo para agregar, negativo para quitar (usa Cantidad con signo)
   * @returns {Ingrediente} nueva instancia con el stock ajustado (inmutable)
   */
  ajustarStock(delta) {
    const nuevoValor = this._stock.valor + delta.valor;
    const nuevoStock = crearCantidad(Math.max(0, nuevoValor));
    return new Ingrediente(
      this._id, this._nombre, nuevoStock, this._unidad,
      this._stockMinimo, this._categoria, this._ubicacion, this._valorUnitario
    );
  }

  /**
   * Cambia el valor unitario del ingrediente.
   * @param {Dinero} nuevoValor
   * @returns {Ingrediente} nueva instancia con el valor actualizado
   */
  actualizarValor(nuevoValor) {
    if (!(nuevoValor instanceof Dinero)) throw new Error('Valor unitario inválido');
    return new Ingrediente(
      this._id, this._nombre, this._stock, this._unidad,
      this._stockMinimo, this._categoria, this._ubicacion, nuevoValor
    );
  }

  // ── SERIALIZACIÓN ────────────────────────────────────────
  toJSON() {
    return {
      id:             this._id,
      nombre:         this._nombre,
      stock:          this._stock.toJSON(),
      unidad:         this._unidad,
      stock_minimo:   this._stockMinimo.toJSON(),
      categoria:      this._categoria,
      ubicacion:      this._ubicacion,
      valor_unitario: this._valorUnitario.toJSON()
    };
  }
}

window.Ingrediente = Ingrediente;

/**
 * Reconstruye un Ingrediente desde un objeto plano (JSON).
 * @param {object} datos - Datos planos con stock, stock_minimo y valor_unitario como números.
 * @returns {Ingrediente|null}
 */
function reconstruirIngrediente(datos) {
  try {
    return new Ingrediente(
      datos.id,
      datos.nombre,
      crearCantidad(datos.stock),
      datos.unidad,
      crearCantidad(datos.stock_minimo || 0),
      datos.categoria || 'general',
      datos.ubicacion || '',
      crearDinero(datos.valor_unitario || 0)
    );
  } catch (e) {
    console.error('[Dominio] Error al reconstruir Ingrediente:', e);
    return null;
  }
}

window.reconstruirIngrediente = reconstruirIngrediente;