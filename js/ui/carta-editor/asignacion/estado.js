/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · ASIGNACIÓN SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/asignacion/estado.js
   Versión: 1.0.0
   Propósito: Estado centralizado del Modo Variantes. Guarda la
              lista de productos y variantes que se van a mostrar,
              los filtros aplicados, y cuál producto tiene el panel
              lateral abierto.
   v1.0.0: creación inicial. Sin dependencias del DOM ni de
           Appwrite. El ciclo de vida inyecta los datos desde el
           Store antes de renderizar.
   ================================================================ */

const _estado = {
  productos: [],
  variantes: [],
  productosConReceta: new Set(),
  terminoBusqueda: '',
  filtroCategoria: 'todas',
  panelAbierto: null,
};

/* ── PRODUCTOS ─────────────────────────────────────────── */

export function getProductos() {
  return _estado.productos;
}

export function setProductos(lista) {
  _estado.productos = Array.isArray(lista) ? lista : [];
}

export function getProductoPorId(id) {
  return _estado.productos.find(p => p.id === id) || null;
}

export function actualizarProductoLocal(producto) {
  if (!producto || !producto.id) return;
  const idx = _estado.productos.findIndex(p => p.id === producto.id);
  if (idx >= 0) _estado.productos[idx] = producto;
  else _estado.productos.push(producto);
}

/* ── VARIANTES ─────────────────────────────────────────── */

export function getVariantes() {
  return _estado.variantes;
}

export function setVariantes(lista) {
  _estado.variantes = Array.isArray(lista) ? lista : [];
}

export function getVariantePorId(id) {
  return _estado.variantes.find(v => v.id === id) || null;
}

export function getVariantesAsignables() {
  return _estado.variantes.filter(v => v.activo !== false);
}

/* ── PRODUCTOS CON RECETA ──────────────────────────────── */

export function getProductosConReceta() {
  return _estado.productosConReceta;
}

export function setProductosConReceta(setRecetas) {
  _estado.productosConReceta = setRecetas instanceof Set ? setRecetas : new Set();
}

export function tieneReceta(productoId) {
  return _estado.productosConReceta.has(productoId);
}

/* ── FILTROS ───────────────────────────────────────────── */

export function getTerminoBusqueda() {
  return _estado.terminoBusqueda;
}

export function setTerminoBusqueda(termino) {
  _estado.terminoBusqueda = typeof termino === 'string' ? termino : '';
}

export function getFiltroCategoria() {
  return _estado.filtroCategoria;
}

export function setFiltroCategoria(categoria) {
  _estado.filtroCategoria = typeof categoria === 'string' && categoria
    ? categoria
    : 'todas';
}

export function getProductosFiltrados() {
  const term = _estado.terminoBusqueda.toLowerCase().trim();
  const cat = _estado.filtroCategoria;

  return _estado.productos.filter(p => {
    const okTerm = !term || (p.nombre || '').toLowerCase().includes(term);
    const okCat = cat === 'todas' || p.categoria === cat;
    return okTerm && okCat;
  });
}

export function getCategoriasDisponibles() {
  const set = new Set();
  _estado.productos.forEach(p => {
    if (p.categoria && p.categoria !== 'General') set.add(p.categoria);
  });
  return Array.from(set).sort();
}

/* ── PANEL LATERAL ─────────────────────────────────────── */

export function getPanelAbierto() {
  return _estado.panelAbierto;
}

export function setPanelAbierto(productoId, varianteId) {
  _estado.panelAbierto = { productoId, varianteId };
}

export function cerrarPanel() {
  _estado.panelAbierto = null;
}

/* ── RESET ─────────────────────────────────────────────── */

export function reset() {
  _estado.productos = [];
  _estado.variantes = [];
  _estado.productosConReceta = new Set();
  _estado.terminoBusqueda = '';
  _estado.filtroCategoria = 'todas';
  _estado.panelAbierto = null;
}