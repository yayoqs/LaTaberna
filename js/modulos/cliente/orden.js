/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/modulos/cliente/orden.js
   Versión: 1.0.1
   Propósito: Gestión local de la orden del cliente antes de confirmarla.
              Sin asignaciones window.
   Dependencias: (ninguna externa)
   ================================================================ */

const Orden = (() => {
  let _items = [];

  function agregarItem(producto) {
    const existente = _items.find(item => item.prodId === producto.id);
    if (existente) {
      existente.qty += 1;
    } else {
      _items.push({
        prodId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        categoria: producto.categoria,
        destino: producto.destino || producto.categoria || 'general',
        qty: 1,
        obs: ''
      });
    }
  }

  function quitarItem(prodId) {
    _items = _items.filter(item => item.prodId !== prodId);
  }

  function modificarCantidad(prodId, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      quitarItem(prodId);
      return;
    }
    const item = _items.find(item => item.prodId === prodId);
    if (item) item.qty = nuevaCantidad;
  }

  function modificarObservacion(prodId, obs) {
    const item = _items.find(item => item.prodId === prodId);
    if (item) item.obs = obs;
  }

  function vaciar() { _items = []; }

  function obtenerItems() { return _items.slice(); }

  function obtenerTotal() {
    return _items.reduce((total, item) => total + item.precio * item.qty, 0);
  }

  return {
    agregarItem, quitarItem, modificarCantidad,
    modificarObservacion, vaciar, obtenerItems, obtenerTotal
  };
})();

export { Orden };