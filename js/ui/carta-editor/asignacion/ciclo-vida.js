/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · ASIGNACIÓN SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/asignacion/ciclo-vida.js
   Versión: 1.0.0
   Propósito: Orquestador del Modo Variantes. Monta la estructura,
              inyecta datos desde el Store, delega eventos, persiste
              cambios vía receta-repository.
   v1.0.0: creación inicial. Autoguardado NO: cada operación
           (asignar/quitar/reordenar) es una acción discreta que
           persiste de inmediato. Feedback visual con toasts.
   ================================================================ */

import { Store } from '../../../lib/store.js';
import { EventBus } from '../../../lib/eventBus.js';
import { Logger } from '../../../lib/logger.js';
import { Auth } from '../../../auth.js';
import { mostrarToast, mostrarConfirmacion } from '../../../utils.js';
import { crearRecetaRepo } from '../../../repositorios/receta-repository.js';
import { crearVarianteRepo } from '../../../repositorios/variante-repository.js';

import * as estado from './estado.js';
import * as validaciones from './validaciones.js';
import * as vista from './renderer.js';

/* ── Estado local del ciclo de vida ────────────────────── */

let _contenedor = null;
let _abortController = null;
let _desuscripciones = [];
let _recetaRepo = null;
let _varianteRepo = null;
let _asignacionPendiente = null;

/* ── API pública ───────────────────────────────────────── */

export async function montar(contenedor, opciones = {}) {
  if (!contenedor) {
    Logger.error('[Asignacion] Contenedor no provisto.');
    return;
  }

  desmontar();

  _contenedor = contenedor;
  _recetaRepo = crearRecetaRepo();
  _varianteRepo = crearVarianteRepo();
  _abortController = new AbortController();
  const { signal } = _abortController;

  vista.montarEstructura(contenedor);
  _registrarDelegacion(signal);

  _desuscripciones.push(Store.suscribir((state, action) => {
    if (
      action.type === 'PRODUCTO_GUARDADO' ||
      action.type === 'PRODUCTOS_INICIALIZAR' ||
      action.type === 'VARIANTE_GUARDADA' ||
      action.type === 'VARIANTES_INICIALIZAR' ||
      action.type === 'RECETA_GUARDADA' ||
      action.type === 'RECETAS_INICIALIZAR'
    ) {
      _inyectarDatosDesdeStore();
      _refrescar();
    }
  }));

  await _inyectarDatosIniciales();
  _refrescar();
}

export function desmontar() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];
  if (_contenedor) {
    _contenedor.innerHTML = '';
    _contenedor = null;
  }
  estado.reset();
  _asignacionPendiente = null;
  _recetaRepo = null;
  _varianteRepo = null;
}

/* ── Inyección de datos ────────────────────────────────── */

async function _inyectarDatosIniciales() {
  const state = Store.obtenerEstado();

  let productos = state.productos || [];
  if (!Array.isArray(productos) || productos.length === 0) {
    estado.setProductos([]);
  } else {
    estado.setProductos(productos);
  }

  let variantes = state.variantes || [];
  if (!Array.isArray(variantes) || variantes.length === 0) {
    try {
      variantes = await _varianteRepo.obtenerTodas();
      Store.despachar({ type: 'VARIANTES_INICIALIZAR', payload: variantes });
    } catch (e) {
      Logger.warn('[Asignacion] No se pudieron cargar variantes:', e);
      variantes = [];
    }
  }
  estado.setVariantes(variantes);

  _inyectarProductosConReceta();
}

function _inyectarProductosConReceta() {
  const state = Store.obtenerEstado();
  const recetas = state.recetas || [];
  const set = new Set(recetas.map(r => r.productoId));
  estado.setProductosConReceta(set);
}

function _inyectarDatosDesdeStore() {
  const state = Store.obtenerEstado();
  estado.setProductos(state.productos || []);
  if (Array.isArray(state.variantes) && state.variantes.length > 0) {
    estado.setVariantes(state.variantes);
  }
  _inyectarProductosConReceta();
}

/* ── Refresco visual ───────────────────────────────────── */

function _refrescar() {
  if (!_contenedor) return;

  if (estado.getProductos().length === 0) {
    vista.pintarSinProductos();
    return;
  }

  const categorias = estado.getCategoriasDisponibles();
  vista.pintarOpcionesCategoria(categorias, estado.getFiltroCategoria());

  const productosFiltrados = estado.getProductosFiltrados();
  vista.pintarTabla(
    productosFiltrados,
    estado.getVariantePorId,
    estado.tieneReceta
  );

  const panel = estado.getPanelAbierto();
  if (panel) {
    const variante = estado.getVariantePorId(panel.varianteId);
    const producto = estado.getProductoPorId(panel.productoId);
    if (variante && producto) {
      vista.pintarPanelLateral(variante, producto, estado.tieneReceta(producto.id));
      vista.abrirPanelLateral();
    } else {
      estado.cerrarPanel();
      vista.cerrarPanelLateral();
    }
  } else {
    vista.cerrarPanelLateral();
  }
}

/* ── Delegación de eventos ─────────────────────────────── */

function _registrarDelegacion(signal) {
  _contenedor.addEventListener('click', _handleClick, { signal });
  _contenedor.addEventListener('input', _handleInput, { signal });
  _contenedor.addEventListener('change', _handleChange, { signal });
}

function _handleClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'asig-abrir-modal-agregar':
      _abrirModalAgregar(target.dataset.productoId);
      return;

    case 'asig-cerrar-modal-agregar':
      _cerrarModalAgregar();
      return;

    case 'asig-seleccionar-variante':
      _seleccionarVarianteParaAsignar(target.dataset.varianteId);
      return;

    case 'asig-quitar-variante':
      _intentarQuitarVariante(target);
      return;

    case 'asig-subir-variante':
      _moverVariante(target, -1);
      return;

    case 'asig-bajar-variante':
      _moverVariante(target, +1);
      return;

    case 'asig-abrir-panel':
      _abrirPanelLateral(target);
      return;

    case 'asig-cerrar-panel':
      estado.cerrarPanel();
      vista.cerrarPanelLateral();
      return;

    case 'asig-confirmar-aviso':
      _confirmarAviso();
      return;

    case 'asig-cancelar-aviso':
      _cancelarAviso();
      return;

    default:
      return;
  }
}

function _handleInput(e) {
  const target = e.target;
  if (target.id === 'asig-buscar') {
    estado.setTerminoBusqueda(target.value);
    _refrescar();
  }
}

function _handleChange(e) {
  const target = e.target;
  if (target.id === 'asig-filtro-categoria') {
    estado.setFiltroCategoria(target.value);
    _refrescar();
  }
}

/* ── Modal de agregar variante ─────────────────────────── */

function _abrirModalAgregar(productoId) {
  const producto = estado.getProductoPorId(productoId);
  if (!producto) return;

  const variantesAsignadas = (producto.variantes_ids || [])
    .map(vid => estado.getVariantePorId(vid))
    .filter(Boolean);

  const variantesDisponibles = estado.getVariantesAsignables()
    .filter(v => !producto.variantes_ids?.includes(v.id));

  vista.pintarModalAgregar(producto, variantesDisponibles, variantesAsignadas);
  vista.abrirModalAgregar();

  _asignacionPendiente = { productoId, varianteId: null };
}

function _cerrarModalAgregar() {
  vista.cerrarModalAgregar();
  _asignacionPendiente = null;
}

function _seleccionarVarianteParaAsignar(varianteId) {
  if (!_asignacionPendiente || !_asignacionPendiente.productoId) return;

  const producto = estado.getProductoPorId(_asignacionPendiente.productoId);
  const variante = estado.getVariantePorId(varianteId);
  if (!producto || !variante) return;

  _asignacionPendiente.varianteId = varianteId;

  const advertencia = validaciones.detectarInsumosQuitarSinReceta(producto, variante);

  if (!advertencia) {
    vista.cerrarModalAgregar();
    _asignarVariante(producto, variante);
    _asignacionPendiente = null;
    return;
  }

  vista.cerrarModalAgregar();
  vista.pintarModalAviso(producto, variante, advertencia.opciones);
  vista.abrirModalAviso();
}

/* ── Modal de aviso ────────────────────────────────────── */

function _confirmarAviso() {
  if (!_asignacionPendiente) return;
  const producto = estado.getProductoPorId(_asignacionPendiente.productoId);
  const variante = estado.getVariantePorId(_asignacionPendiente.varianteId);
  vista.cerrarModalAviso();
  if (producto && variante) {
    _asignarVariante(producto, variante);
  }
  _asignacionPendiente = null;
}

function _cancelarAviso() {
  vista.cerrarModalAviso();
  _asignacionPendiente = null;
}

/* ── Asignación y desasignación ────────────────────────── */

async function _asignarVariante(producto, variante) {
  const idsActuales = Array.isArray(producto.variantes_ids) ? [...producto.variantes_ids] : [];
  if (idsActuales.includes(variante.id)) return;

  const nuevosIds = [...idsActuales, variante.id];
  await _persistirCambio(producto, nuevosIds, `Variante "${variante.nombre}" asignada`);
}

async function _intentarQuitarVariante(target) {
  const chip = target.closest('.asig-chip-variante');
  if (!chip) return;

  const productoId = chip.dataset.productoId;
  const varianteId = chip.dataset.varianteId;
  const producto = estado.getProductoPorId(productoId);
  const variante = estado.getVariantePorId(varianteId);
  if (!producto || !variante) return;

  const confirmado = await mostrarConfirmacion(
    'Quitar variante',
    validaciones.mensajeConfirmacionQuitar(producto, variante),
    { textoConfirmar: 'Quitar' }
  );
  if (!confirmado) return;

  const nuevosIds = (producto.variantes_ids || []).filter(id => id !== varianteId);

  const panel = estado.getPanelAbierto();
  if (panel && panel.productoId === productoId && panel.varianteId === varianteId) {
    estado.cerrarPanel();
  }

  await _persistirCambio(producto, nuevosIds, `Variante "${variante.nombre}" quitada`);
}

async function _moverVariante(target, direccion) {
  const chip = target.closest('.asig-chip-variante');
  if (!chip) return;

  const productoId = chip.dataset.productoId;
  const varianteId = chip.dataset.varianteId;
  const producto = estado.getProductoPorId(productoId);
  if (!producto) return;

  const ids = Array.isArray(producto.variantes_ids) ? [...producto.variantes_ids] : [];
  const idx = ids.indexOf(varianteId);
  if (idx < 0) return;

  const nuevo = idx + direccion;
  if (nuevo < 0 || nuevo >= ids.length) return;

  [ids[idx], ids[nuevo]] = [ids[nuevo], ids[idx]];

  await _persistirCambio(producto, ids, null);
}

/* ── Persistencia ──────────────────────────────────────── */

async function _persistirCambio(producto, nuevosIds, mensajeExito) {
  if (!_recetaRepo) return;

  try {
    const productoActualizado = await _recetaRepo.guardarProducto({
      ...producto,
      variantes_ids: nuevosIds
    });

    if (!productoActualizado) {
      mostrarToast('error', 'No se pudo guardar el cambio.');
      return;
    }

    estado.actualizarProductoLocal(productoActualizado);
    Store.despachar({ type: 'PRODUCTO_GUARDADO', payload: productoActualizado });

    if (mensajeExito) {
      mostrarToast('success', mensajeExito);
    }
  } catch (e) {
    Logger.error('[Asignacion] Error al persistir cambio:', e);
    mostrarToast('error', 'Error al guardar el cambio.');
  }
}

/* ── Panel lateral ─────────────────────────────────────── */

function _abrirPanelLateral(target) {
  const chip = target.closest('.asig-chip-variante');
  if (!chip) return;

  const productoId = chip.dataset.productoId;
  const varianteId = chip.dataset.varianteId;
  const producto = estado.getProductoPorId(productoId);
  const variante = estado.getVariantePorId(varianteId);
  if (!producto || !variante) return;

  estado.setPanelAbierto(productoId, varianteId);
  vista.pintarPanelLateral(variante, producto, estado.tieneReceta(producto.id));
  vista.abrirPanelLateral();
}

/* ── Exposición para tests ─────────────────────────────── */

export const _internals = {
  getProductos: estado.getProductos,
  getVariantes: estado.getVariantes,
  getProductoPorId: estado.getProductoPorId,
  getVariantePorId: estado.getVariantePorId,
  getPanelAbierto: estado.getPanelAbierto,
  refrescar: _refrescar,
  persistirCambio: _persistirCambio,
  asignarVariante: _asignarVariante
};