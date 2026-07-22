/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/estado.js
   Versión: 2.0.2
   Propósito: Estado centralizado de la nueva vista de despensa.
              v2.0.2: normaliza tipos en lista de compras (solo objetos).
   ================================================================ */

let _listaCompras = [];
let _terminoBusqueda = '';
let _espacioAbierto = null;

// ── Lista de compras ──

export function getListaCompras() {
  return [..._listaCompras];
}

export function agregarAListaCompras(item) {
  // Solo acepta objetos { nombre, stock }
  if (typeof item !== 'object' || !item.nombre) return;
  if (!_listaCompras.some(i => i.nombre === item.nombre)) {
    _listaCompras.push({ nombre: item.nombre, stock: item.stock || '' });
  }
}

export function quitarDeListaCompras(item) {
  // Solo acepta objetos con nombre
  const nombre = item?.nombre;
  if (!nombre) return;
  _listaCompras = _listaCompras.filter(i => i.nombre !== nombre);
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