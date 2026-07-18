/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/estado.js
   Versión: 2.0.0
   Propósito: Estado centralizado de la nueva vista de despensa.
              Lista de compras, filtros por espacio y búsqueda.
   ================================================================ */

let _listaCompras = [];
let _terminoBusqueda = '';
let _espacioAbierto = null;

// ── Lista de compras ──

export function getListaCompras() {
  return [..._listaCompras];
}

export function agregarAListaCompras(item) {
  if (!_listaCompras.includes(item)) {
    _listaCompras.push(item);
  }
}

export function quitarDeListaCompras(item) {
  _listaCompras = _listaCompras.filter(i => i !== item);
}

export function limpiarListaCompras() {
  _listaCompras = [];
}

// ── Búsqueda ──

export function getTerminoBusqueda() {
  return _terminoBusqueda;
}

export function setTerminoBusqueda(termino) {
  _terminoBusqueda = termino;
}

// ── Espacio abierto ──

export function getEspacioAbierto() {
  return _espacioAbierto;
}

export function setEspacioAbierto(espacio) {
  _espacioAbierto = espacio;
}