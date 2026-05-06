/* ================================================================
   PubPOS — DOMINIO: PedidoAgregado (Agregado)
   Propósito: Representa un pedido de mesa. Encapsula las reglas de
              negocio y garantiza que siempre esté en un estado válido.
              Renombrado desde "Pedido" para evitar conflicto con el
              módulo de interfaz js/pedido.js.
   ================================================================ */
class PedidoAgregado {
  /**
   * @param {string} id - Identificador único del pedido
   * @param {number} mesa - Número de mesa
   * @param {string} mozo - Nombre del mesero
   * @param {Cantidad} comensales - Cantidad de comensales
   */
  constructor(id, mesa, mozo, comensales) {
    if (!id) throw new Error('Pedido debe tener un ID');
    if (!mesa) throw new Error('Pedido debe tener una mesa');
    if (!(comensales instanceof Cantidad)) throw new Error('comensales debe ser una Cantidad');

    this._id         = id;
    this._mesa       = mesa;
    this._mozo       = mozo || 'Sin mozo';
    this._comensales = comensales;
    this._items      = [];
    this._descuento  = 0;
    this._estado     = 'abierto';
    this._creadoEn   = new Date().toISOString();
    this._observaciones = '';
  }

  get id()           { return this._id; }
  get mesa()         { return this._mesa; }
  get mozo()         { return this._mozo; }
  get comensales()   { return this._comensales; }
  get items()        { return [...this._items]; }
  get descuento()    { return this._descuento; }
  get estado()       { return this._estado; }
  get creadoEn()     { return this._creadoEn; }
  get observaciones(){ return this._observaciones; }

  agregarItem(nombre, precio, cantidad) {
    if (this._estado === 'cerrado') throw new Error('No se puede modificar un pedido cerrado');
    if (!(precio instanceof Dinero)) throw new Error('Precio inválido');
    if (!(cantidad instanceof Cantidad)) throw new Error('Cantidad inválida');

    const existente = this._items.find(it => it.nombre === nombre);
    if (existente) {
      existente.cantidad = existente.cantidad.sumar(cantidad);
    } else {
      this._items.push({ nombre, precio, cantidad });
    }
  }

  eliminarItem(indice) {
    if (this._estado === 'cerrado') throw new Error('No se puede modificar un pedido cerrado');
    if (indice < 0 || indice >= this._items.length) throw new Error('Índice de ítem inválido');
    this._items.splice(indice, 1);
  }

  aplicarDescuento(porcentaje) {
    if (this._estado === 'cerrado') throw new Error('No se puede modificar un pedido cerrado');
    if (porcentaje < 0 || porcentaje > 100) throw new Error('Descuento inválido');
    this._descuento = porcentaje;
  }

  calcularSubtotal() {
    if (this._items.length === 0) return new Dinero(0);
    return this._items.reduce((total, it) => {
      return total.sumar(it.precio.multiplicar(it.cantidad.valor));
    }, new Dinero(0));
  }

  calcularTotal() {
    const subtotal = this.calcularSubtotal();
    if (this._descuento === 0) return subtotal;
    return subtotal.multiplicar(1 - this._descuento / 100);
  }

  cerrar() {
    if (this._items.length === 0) throw new Error('No se puede cerrar un pedido vacío');
    this._estado = 'cerrado';
  }

  setObservaciones(obs) {
    this._observaciones = obs || '';
  }

  toJSON() {
    return {
      id:           this._id,
      mesa:         this._mesa,
      mozo:         this._mozo,
      comensales:   this._comensales.toJSON(),
      items:        this._items.map(it => ({
                      nombre:   it.nombre,
                      precio:   it.precio.toJSON(),
                      cantidad: it.cantidad.toJSON()
                    })),
      descuento:    this._descuento,
      estado:       this._estado,
      creadoEn:     this._creadoEn,
      observaciones: this._observaciones
    };
  }
}

window.PedidoAgregado = PedidoAgregado;