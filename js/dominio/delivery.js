/* ================================================================
   PubPOS — DOMINIO: Delivery (Agregado)
   Propósito: Representa un pedido de entrega (delivery). Encapsula
              los estados y las reglas de transición (pendiente →
              en preparación → en camino → entregado).
   ================================================================ */
class Delivery {
  /**
   * @param {string} id - Identificador único del delivery
   * @param {Direccion} direccion - Dirección de entrega
   * @param {string} repartidor - Nombre del repartidor
   */
  constructor(id, direccion, repartidor = '') {
    if (!id) throw new Error('Delivery debe tener un ID');
    if (!(direccion instanceof Direccion)) throw new Error('Direccion inválida');

    this._id           = id;
    this._direccion    = direccion;
    this._repartidor   = repartidor || 'Sin repartidor';
    this._items        = [];            // { nombre, precio: Dinero, cantidad: Cantidad }
    this._estado       = 'pendiente';   // pendiente | en_preparacion | en_camino | entregado
    this._creadoEn     = new Date().toISOString();
    this._observaciones = '';
  }

  // ── GETTERS ──────────────────────────────────────────────
  get id()             { return this._id; }
  get direccion()      { return this._direccion; }
  get repartidor()     { return this._repartidor; }
  get items()          { return [...this._items]; }
  get estado()         { return this._estado; }
  get creadoEn()       { return this._creadoEn; }
  get observaciones()  { return this._observaciones; }

  // ── REGLAS DE NEGOCIO ────────────────────────────────────

  /**
   * Agrega un ítem al pedido.
   * Solo permitido en estado 'pendiente'.
   */
  agregarItem(nombre, precio, cantidad) {
    if (this._estado !== 'pendiente') throw new Error('Solo se pueden agregar ítems a pedidos pendientes');
    if (!(precio instanceof Dinero)) throw new Error('Precio inválido');
    if (!(cantidad instanceof Cantidad)) throw new Error('Cantidad inválida');

    const existente = this._items.find(it => it.nombre === nombre);
    if (existente) {
      existente.cantidad = existente.cantidad.sumar(cantidad);
    } else {
      this._items.push({ nombre, precio, cantidad });
    }
  }

  /**
   * Transición: pendiente → en_preparacion.
   * Se llama cuando el pedido se envía a cocina/barra.
   */
  enviarACocina() {
    if (this._estado !== 'pendiente') throw new Error('Solo pedidos pendientes pueden enviarse a cocina');
    if (this._items.length === 0) throw new Error('No se puede enviar un pedido vacío');
    this._estado = 'en_preparacion';
  }

  /**
   * Transición: en_preparacion → en_camino.
   * El repartidor recoge el pedido y sale a entregar.
   */
  despachar() {
    if (this._estado !== 'en_preparacion') throw new Error('El pedido no está listo para despachar');
    this._estado = 'en_camino';
  }

  /**
   * Transición: en_camino → entregado.
   * El cliente recibe el pedido.
   */
  confirmarEntrega() {
    if (this._estado !== 'en_camino') throw new Error('El pedido no está en camino');
    this._estado = 'entregado';
  }

  /**
   * Cancela el pedido (solo si está pendiente).
   */
  cancelar() {
    if (this._estado === 'entregado') throw new Error('No se puede cancelar un pedido ya entregado');
    this._estado = 'cancelado';
  }

  /**
   * Calcula el total del pedido.
   * @returns {Dinero}
   */
  calcularTotal() {
    if (this._items.length === 0) return new Dinero(0);
    return this._items.reduce((total, it) => {
      return total.sumar(it.precio.multiplicar(it.cantidad.valor));
    }, new Dinero(0));
  }

  setObservaciones(obs) { this._observaciones = obs || ''; }

  // ── SERIALIZACIÓN ────────────────────────────────────────
  toJSON() {
    return {
      id:             this._id,
      direccion:      this._direccion.toJSON(),
      repartidor:     this._repartidor,
      items:          this._items.map(it => ({
                        nombre:   it.nombre,
                        precio:   it.precio.toJSON(),
                        cantidad: it.cantidad.toJSON()
                      })),
      estado:         this._estado,
      creadoEn:       this._creadoEn,
      observaciones:  this._observaciones
    };
  }
}

window.Delivery = Delivery;