/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/estado.js
   Versión: 1.0.0
   Propósito: Estado centralizado del diseñador de menú.
   ================================================================ */

let _menuActivo = null;           // { id, nombre, estado, productos: [] }
let _categoriaFiltro = 'todas';
let _terminoBusqueda = '';

export function getMenuActivo() {
  return _menuActivo;
}

export function setMenuActivo(menu) {
  _menuActivo = menu;
}

export function getCategoriaFiltro() {
  return _categoriaFiltro;
}

export function setCategoriaFiltro(categoria) {
  _categoriaFiltro = categoria;
}

export function getTerminoBusqueda() {
  return _terminoBusqueda;
}

export function setTerminoBusqueda(termino) {
  _terminoBusqueda = termino;
}

// Productos del menú activo
export function getProductosMenuActivo() {
  return _menuActivo?.productos || [];
}

export function agregarProductoAlMenu(producto) {
  if (!_menuActivo) return;
  if (!_menuActivo.productos) _menuActivo.productos = [];
  if (!_menuActivo.productos.find(p => p.id === producto.id)) {
    _menuActivo.productos.push(producto);
  }
}

export function quitarProductoDelMenu(productoId) {
  if (!_menuActivo) return;
  _menuActivo.productos = (_menuActivo.productos || []).filter(p => p.id !== productoId);
}