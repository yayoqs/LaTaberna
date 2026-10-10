/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/modulos/cliente/orden.js
   Versión: 1.1.0
   Propósito: Gestión local de la orden del cliente antes de
              confirmarla. Acepta items con opciones y alergias
              manuales.
   v1.1.0: Paquete 6.
     · Acepta items con shape completo (opciones, alergias_manuales,
       precio_unitario, precio_total, categoria, destino, persona).
     · Dedupe por prodId + JSON.stringify(opciones) +
       JSON.stringify(alergias_manuales) + obs. Dos items del mismo
       producto con opciones distintas son renglones separados.
     · Cada item recibe un _key interno determinístico para
       manipulación desde el panel (permite quitar/modificar por
       combinación sin depender del índice).
   v1.0.1: gestión local simple por prodId.

   Dependencias: (ninguna externa)
   ================================================================ */

const Orden = (() => {
  let _items = [];

  /**
   * Genera una clave interna determinística para un item a partir de
   * su prodId + opciones + alergias. Permite dedupe y manipulación
   * estable sin depender del índice.
   */
  function _claveItem(prodId, opciones, alergiasManuales, obs) {
    return [
      prodId,
      JSON.stringify(opciones || []),
      JSON.stringify(alergiasManuales || []),
      obs || ''
    ].join('||');
  }

  /**
   * Agrega un item a la orden. Si ya existe uno con la misma
   * combinación (mismo prodId, mismas opciones, mismas alergias
   * manuales, misma observación), incrementa la cantidad. En caso
   * contrario agrega un renglón nuevo.
   *
   * @param {Object} item — item con shape del contrato §5.
   */
  function agregarItem(item) {
    if (!item || !item.prodId) return;

    const opciones = Array.isArray(item.opciones) ? item.opciones : [];
    const alergiasManuales = Array.isArray(item.alergias_manuales) ? item.alergias_manuales : [];
    const obs = item.obs || '';
    const key = _claveItem(item.prodId, opciones, alergiasManuales, obs);

    const existente = _items.find(x => x._key === key);
    if (existente) {
      existente.qty += (item.qty || 1);
      existente.precio_total = existente.precio_unitario * existente.qty;
      return;
    }

    const cantidad = item.qty || 1;
    const precioUnitario = item.precio_unitario != null ? item.precio_unitario : (item.precio || 0);

    _items.push({
      _key: key,
      tipo: item.tipo || 'producto',
      prodId: item.prodId,
      nombre: item.nombre || '',
      precio_base: item.precio_base != null ? item.precio_base : (item.precio || 0),
      opciones: opciones.slice(),
      alergias_manuales: alergiasManuales.slice(),
      precio: precioUnitario,
      precio_unitario: precioUnitario,
      precio_total: precioUnitario * cantidad,
      categoria: item.categoria || '',
      destino: item.destino || '',
      qty: cantidad,
      obs: obs,
      enviado: false,
      enviadoA: null,
      enviadoTs: null,
      persona: item.persona || 'General'
    });
  }

  /**
   * Quita un item por su clave interna.
   * @param {string} key
   */
  function quitarItem(key) {
    _items = _items.filter(item => item._key !== key);
  }

  /**
   * Modifica la cantidad de un item. Si la nueva cantidad es <= 0,
   * el item se elimina.
   * @param {string} key
   * @param {number} nuevaCantidad
   */
  function modificarCantidad(key, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      quitarItem(key);
      return;
    }
    const item = _items.find(x => x._key === key);
    if (!item) return;
    item.qty = nuevaCantidad;
    item.precio_total = item.precio_unitario * nuevaCantidad;
  }

  /**
   * Modifica la observación de un item. Al cambiar la observación,
   * el `_key` del item cambia (porque la obs es parte de la clave).
   * Esto significa que si el cliente tenía un item y le agrega obs,
   * el item deja de deduplicarse con items del mismo producto sin
   * obs. Comportamiento intencional: la obs diferencia items.
   *
   * @param {string} key — clave actual del item.
   * @param {string} obs
   */
  function modificarObservacion(key, obs) {
    const item = _items.find(x => x._key === key);
    if (!item) return;
    item.obs = obs;
    item._key = _claveItem(item.prodId, item.opciones, item.alergias_manuales, obs);
  }

  /**
   * Vacía toda la orden.
   */
  function vaciar() { _items = []; }

  /**
   * Devuelve una copia de los items (para evitar mutación externa).
   * @returns {Array}
   */
  function obtenerItems() { return _items.slice(); }

  /**
   * Calcula el total de la orden como suma de precio_unitario * qty.
   * @returns {number}
   */
  function obtenerTotal() {
    return _items.reduce((total, item) => total + item.precio_unitario * item.qty, 0);
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