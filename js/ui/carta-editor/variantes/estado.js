/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · VARIANTES SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/variantes/estado.js
   Versión: 1.0.0
   Propósito: Estado centralizado del editor de variantes. Mantiene
              la variante activa, la opción en edición, los filtros
              de la lista, el indicador de guardado y las cachés
              necesarias para las validaciones.
   v1.0.0: creación inicial. Sin dependencias del DOM ni de
           Appwrite. El ciclo de vida inyecta la lista de insumos
           y las variantes cargadas.
   ================================================================ */

const _estado = {
  variantes: [],
  varianteActiva: null,
  opcionActiva: null,
  esOpcionNueva: false,
  filtroLista: 'todas',
  terminoBusqueda: '',
  estadoGuardado: 'limpio',
  espacioId: null,
  insumosCache: []
};

export function getVariantes() {
  return _estado.variantes;
}

export function setVariantes(lista) {
  _estado.variantes = Array.isArray(lista) ? lista : [];
}

export function agregarVarianteAlEstado(variante) {
  if (!variante || !variante.id) return;
  const idx = _estado.variantes.findIndex(v => v.id === variante.id);
  if (idx >= 0) _estado.variantes[idx] = variante;
  else _estado.variantes.push(variante);
}

export function eliminarVarianteDelEstado(varianteId) {
  _estado.variantes = _estado.variantes.filter(v => v.id !== varianteId);
}

export function getVarianteActiva() {
  return _estado.varianteActiva;
}

export function setVarianteActiva(variante) {
  _estado.varianteActiva = variante;
}

export function getOpcionActiva() {
  return _estado.opcionActiva;
}

export function setOpcionActiva(opcion, esNueva = false) {
  _estado.opcionActiva = opcion;
  _estado.esOpcionNueva = esNueva === true;
}

export function limpiarOpcionActiva() {
  _estado.opcionActiva = null;
  _estado.esOpcionNueva = false;
}

export function esOpcionNueva() {
  return _estado.esOpcionNueva;
}

export function getFiltroLista() {
  return _estado.filtroLista;
}

export function setFiltroLista(filtro) {
  _estado.filtroLista = ['todas', 'activas', 'inactivas'].includes(filtro) ? filtro : 'todas';
}

export function getTerminoBusqueda() {
  return _estado.terminoBusqueda;
}

export function setTerminoBusqueda(termino) {
  _estado.terminoBusqueda = typeof termino === 'string' ? termino : '';
}

export function getEstadoGuardado() {
  return _estado.estadoGuardado;
}

export function setEstadoGuardado(estado) {
  _estado.estadoGuardado = ['limpio', 'sucio', 'guardando'].includes(estado) ? estado : 'limpio';
}

export function getEspacioId() {
  return _estado.espacioId;
}

export function setEspacioId(id) {
  _estado.espacioId = typeof id === 'string' && id.trim() ? id : null;
}

export function getInsumosCache() {
  return _estado.insumosCache;
}

export function setInsumosCache(insumos) {
  _estado.insumosCache = Array.isArray(insumos) ? insumos : [];
}

export function reset() {
  _estado.varianteActiva = null;
  _estado.opcionActiva = null;
  _estado.esOpcionNueva = false;
  _estado.terminoBusqueda = '';
  _estado.estadoGuardado = 'limpio';
}

export function resetCompleto() {
  _estado.variantes = [];
  _estado.varianteActiva = null;
  _estado.opcionActiva = null;
  _estado.esOpcionNueva = false;
  _estado.filtroLista = 'todas';
  _estado.terminoBusqueda = '';
  _estado.estadoGuardado = 'limpio';
  _estado.espacioId = null;
  _estado.insumosCache = [];
}