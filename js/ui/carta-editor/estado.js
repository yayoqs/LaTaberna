/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/estado.js
   Versión: 2.0.0
   Propósito: Estado centralizado del diseñador de cartas.
   v2.0.0: rename Menus → Cartas. Misma estructura y API.
   ================================================================ */

let _menuActivo = null;
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