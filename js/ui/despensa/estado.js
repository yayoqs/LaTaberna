/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/estado.js
   Versión: 2.2.0
   Propósito: Estado centralizado de la nueva vista de despensa.
              v2.2.0: agrega filtro "vendibles" para D.7 (Fase 2
                      Paso 4). Expuesto vía getFiltroVendibles /
                      setFiltroVendibles.
              v2.1.0: persiste lista de compras en localStorage.
   ================================================================ */

const STORAGE_KEY = 'pubpos_lista_compras';

let _listaCompras = [];
let _terminoBusqueda = '';
let _espacioAbierto = null;
let _filtroVendibles = false;

// ── Inicialización desde localStorage ──
try {
  const guardada = localStorage.getItem(STORAGE_KEY);
  if (guardada) {
    _listaCompras = JSON.parse(guardada);
  }
} catch (e) {
  _listaCompras = [];
}

function _guardar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_listaCompras));
}

// ── Lista de compras ──

export function getListaCompras() {
  return [..._listaCompras];
}

export function agregarAListaCompras(item) {
  if (typeof item !== 'object' || !item.nombre) return;
  if (!_listaCompras.some(i => i.nombre === item.nombre)) {
    _listaCompras.push({ nombre: item.nombre, stock: item.stock || '' });
    _guardar();
  }
}

export function quitarDeListaCompras(item) {
  const nombre = item?.nombre;
  if (!nombre) return;
  _listaCompras = _listaCompras.filter(i => i.nombre !== nombre);
  _guardar();
}

export function limpiarListaCompras() {
  _listaCompras = [];
  _guardar();
}

// ── Búsqueda ──

export function getTerminoBusqueda() {
  return _terminoBusqueda;
}

export function setTerminoBusqueda(termino) {
  _terminoBusqueda = termino;
}

// ── Filtro vendibles (D.7) ──

export function getFiltroVendibles() {
  return _filtroVendibles;
}

export function setFiltroVendibles(activo) {
  _filtroVendibles = activo === true;
}

// ── Espacio abierto ──

export function getEspacioAbierto() {
  return _espacioAbierto;
}

export function setEspacioAbierto(espacio) {
  _espacioAbierto = espacio;
}