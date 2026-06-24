/* ================================================================
   LaTaberna - PubPOS — DOMINIO JS (ES6)
   Archivo: js/dominio/delivery.js
   Versión: 1.1.0
   Propósito: Agregado Delivery: pedido de entrega con máquina de estados.
              Migrado a módulo ES6 con export.
   Dependencias: js/dominio/direccion.js, js/dominio/dinero.js,
                 js/dominio/cantidad.js
   ================================================================ */
export class Delivery {
  constructor(id, direccion, repartidor = '') {
    if (!id) throw new Error('Delivery debe tener un ID');
    if (!(direccion instanceof Direccion)) throw new Error('Direccion inválida');

    this._id           = id;
    this._direccion    = direccion;
    this._repartidor   = repartidor || 'Sin repartidor';
    this._items        = [];
    this._estado       = 'pendiente';
    this._creadoEn     = new Date().toISOString();
    this._observaciones = '';
  }

  get id()             { return this._id; }
  get direccion()      { return this._direccion; }
  get repartidor()     { return this._repartidor; }
  get items()          { return [...this._items]; }
  get estado()         { return this._estado; }
  get creadoEn()       { return this._creadoEn; }
  get observaciones()  { return this._observaciones; }

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

  enviarACocina() {
    if (this._estado !== 'pendiente') throw new Error('Solo pedidos pendientes pueden enviarse a cocina');
    if (this._items.length === 0) throw new Error('No se puede enviar un pedido vacío');
    this._estado = 'en_preparacion';
  }

  despachar() {
    if (this._estado !== 'en_preparacion') throw new Error('El pedido no está listo para despachar');
    this._estado = 'en_camino';
  }

  confirmarEntrega() {
    if (this._estado !== 'en_camino') throw new Error('El pedido no está en camino');
    this._estado = 'entregado';
  }

  cancelar() {
    if (this._estado === 'entregado') throw new Error('No se puede cancelar un pedido ya entregado');
    this._estado = 'cancelado';
  }

  calcularTotal() {
    if (this._items.length === 0) return new Dinero(0);
    return this._items.reduce((total, it) => {
      return total.sumar(it.precio.multiplicar(it.cantidad.valor));
    }, new Dinero(0));
  }

  setObservaciones(obs) { this._observaciones = obs || ''; }

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

export function reconstruirDelivery(datos) {
  let direccion;
  if (datos.direccion instanceof Direccion) {
    direccion = datos.direccion;
  } else {
    direccion = new Direccion(
      datos.direccion.calle,
      datos.direccion.numero,
      datos.direccion.depto,
      datos.direccion.referencia,
      datos.direccion.telefono
    );
  }

  const delivery = new Delivery(datos.id, direccion, datos.repartidor);

  (datos.items || []).forEach(it => {
    delivery.agregarItem(
      it.nombre,
      crearDinero(it.precio),
      crearCantidad(it.cantidad)
    );
  });

  const estado = datos.estado;
  if (estado === 'en_preparacion') {
    delivery.enviarACocina();
  } else if (estado === 'en_camino') {
    delivery.enviarACocina();
    delivery.despachar();
  } else if (estado === 'entregado') {
    delivery.enviarACocina();
    delivery.despachar();
    delivery.confirmarEntrega();
  } else if (estado === 'cancelado') {
    delivery.cancelar();
  }

  delivery.setObservaciones(datos.observaciones);
  return delivery;
}

window.Delivery = Delivery;
window.reconstruirDelivery = reconstruirDelivery;