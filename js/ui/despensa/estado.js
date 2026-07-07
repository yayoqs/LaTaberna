/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/estado.js
   Versión: 1.0.0
   Propósito: Estado centralizado de la vista de despensa: filtros,
              ordenamiento y paginación.
   ================================================================ */

let _categoriaFiltro = 'todas';
let _ordenColumnas = [];       // [{columna, direccion}, ...]
let _paginaMovimientos = 0;
const _MOVS_POR_PAGINA = 10;

// ── Filtro de categoría ──
export function getCategoriaFiltro() {
  return _categoriaFiltro;
}

export function setCategoriaFiltro(categoria) {
  _categoriaFiltro = categoria;
}

// ── Ordenamiento múltiple ──
export function getOrdenColumnas() {
  return _ordenColumnas;
}

export function setOrdenColumnas(orden) {
  _ordenColumnas = orden;
}

export function toggleOrdenColumna(columna, shiftKey) {
  if (shiftKey) {
    const existente = _ordenColumnas.findIndex(o => o.columna === columna);
    if (existente >= 0) {
      if (_ordenColumnas[existente].direccion === 1) {
        _ordenColumnas[existente].direccion = -1;
      } else {
        _ordenColumnas.splice(existente, 1);
      }
    } else {
      _ordenColumnas.push({ columna, direccion: 1 });
    }
  } else {
    if (_ordenColumnas.length === 1 && _ordenColumnas[0].columna === columna) {
      _ordenColumnas[0].direccion *= -1;
    } else {
      _ordenColumnas = [{ columna, direccion: 1 }];
    }
  }
}

export function resetearOrden() {
  _ordenColumnas = [];
}

// ── Paginación de movimientos ──
export function getPaginaMovimientos() {
  return _paginaMovimientos;
}

export function incrementarPaginaMovimientos() {
  _paginaMovimientos++;
}

export function resetearPaginaMovimientos() {
  _paginaMovimientos = 0;
}

export function getMovsPorPagina() {
  return _MOVS_POR_PAGINA;
}