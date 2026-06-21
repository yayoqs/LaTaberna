/**
 * Módulo de gestión de la Orden del cliente (v1.0.0)
 *
 * @module Orden
 * @version 1.0.0
 *
 * Estado local en memoria. No persiste en Appwrite.
 * Almacena la selección de productos antes de confirmarla.
 */
const Orden = (() => {
  /** @type {Array<{prodId: string, nombre: string, precio: number, categoria: string, destino: string, qty: number, obs: string}>} */
  let _items = [];

  /**
   * Agrega un producto a la orden.
   * Si ya existe, incrementa la cantidad en 1.
   * @param {object} producto - Producto desde el Store
   */
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

  /**
   * Elimina un producto de la orden.
   * @param {string} prodId - ID del producto
   */
  function quitarItem(prodId) {
    _items = _items.filter(item => item.prodId !== prodId);
  }

  /**
   * Modifica la cantidad de un ítem. Si es 0, lo elimina.
   * @param {string} prodId - ID del producto
   * @param {number} nuevaCantidad - Nueva cantidad (debe ser >= 0)
   */
  function modificarCantidad(prodId, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      quitarItem(prodId);
      return;
    }
    const item = _items.find(item => item.prodId === prodId);
    if (item) {
      item.qty = nuevaCantidad;
    }
  }

  /**
   * Modifica la observación de un ítem.
   * @param {string} prodId - ID del producto
   * @param {string} obs - Texto de observación
   */
  function modificarObservacion(prodId, obs) {
    const item = _items.find(item => item.prodId === prodId);
    if (item) {
      item.obs = obs;
    }
  }

  /** Vacía la orden por completo */
  function vaciar() {
    _items = [];
  }

  /**
   * Devuelve una copia de los ítems para evitar mutaciones externas.
   * @returns {Array} Copia del array de ítems
   */
  function obtenerItems() {
    return _items.slice();
  }

  /**
   * Calcula el total de la orden.
   * @returns {number} Suma de precio * qty de todos los ítems
   */
  function obtenerTotal() {
    return _items.reduce((total, item) => total + item.precio * item.qty, 0);
  }

  return {
    agregarItem,
    quitarItem,
    modificarCantidad,
    modificarObservacion,
    vaciar,
    obtenerItems,
    obtenerTotal
  };
})();

export { Orden };