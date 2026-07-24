/* ================================================================
   LaTaberna - PubPOS — RECETAS SUBMÓDULO (ES6)
   Archivo: js/ui/recetas/estado.js
   Versión: 1.1.0
   Propósito: Estado interno compartido del módulo de recetas.
              Añadido estado de sidebar, búsqueda y categorías.
   ================================================================ */

let _modo = null;
let _activada = false;
let _canceladores = [];
let _pestanaActiva = 'recetario';
let _busqueda = '';
let _filtroNivel = 'todos';
let _sidebarAbierto = false;
let _categoriaActiva = 'todas';
let _categorias = [];

export function getModo() { return _modo; }
export function setModo(valor) { _modo = valor; }

export function getActivada() { return _activada; }
export function setActivada(valor) { _activada = valor; }

export function getCanceladores() { return _canceladores; }

export function getPestanaActiva() { return _pestanaActiva; }
export function setPestanaActiva(valor) { _pestanaActiva = valor; }

export function getBusqueda() { return _busqueda; }
export function setBusqueda(valor) { _busqueda = valor; }

export function getFiltroNivel() { return _filtroNivel; }
export function setFiltroNivel(valor) { _filtroNivel = valor; }

export function isSidebarAbierto() { return _sidebarAbierto; }
export function setSidebarAbierto(valor) { _sidebarAbierto = valor; }

export function getCategoriaActiva() { return _categoriaActiva; }
export function setCategoriaActiva(valor) { _categoriaActiva = valor; }

export function getCategorias() { return _categorias; }
export function setCategorias(valor) { _categorias = valor; }