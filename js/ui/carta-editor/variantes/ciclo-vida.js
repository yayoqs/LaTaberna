/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · VARIANTES SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/variantes/ciclo-vida.js
   Versión: 1.1.5
   Propósito: Orquestador del editor de variantes. Monta el editor,
              carga datos, delega eventos, autoguarda cambios y
              sincroniza con variante-repository.
   v1.1.5: Paquete 5 — race condition y solapamiento de guardados.
           Tres fixes:
             · Fix 1: cola global de persistencia (_colaGuardado) +
               secuencia (_secuenciaPersistencia). Las escrituras se
               serializan FIFO para evitar HTTP en paralelo sobre la
               misma fila. Al resolver, solo la última llamada emitida
               aplica su resultado al Store y al estado local: si una
               respuesta intermedia llega tarde, no pisa. Resuelve el
               caso "editar rápido + operación destructiva" (§5.11).
             · Fix 2: _persistir y _persistirInmediato se unifican en
               _persistirVariante(variante, { validar }). Un solo
               camino de escritura con el mismo contrato: despacho al
               Store primero, luego al repo, luego aplicación del
               resultado si la llamada sigue siendo la vigente.
             · Fix 3: _seleccionarVariante y _nuevaVariante fuerzan la
               persistencia pendiente antes de cambiar de foco. Sin
               esto, el timer del autoguardado disparaba después del
               cambio de variante activa y persistía la variante
               nueva en lugar de la que estaba siendo editada. El
               nombre editado en la variante anterior se perdía.
   v1.1.4: fix de race condition. Al confirmar una operación
           destructiva (desactivar variante u opción), se persiste
           inmediatamente sin depender del debounce del autoguardado.
   v1.1.3: fix de referencia stale en callbacks de confirmación.
   v1.1.2: mostrarConfirmacion de utils.js.
   v1.1.1: fix de referencia stale.
   v1.1.0: filtro por espacio activo. Slug con sufijo numérico.
   v1.0.3: propagación en vivo del clon de la opción.
   v1.0.2: fix de orden. Slug antes de validar.
   v1.0.1: fix de idioma en mensaje de confirmación.
   v1.0.0: creación inicial.
   ================================================================ */

import { Store } from '../../../lib/store.js';
import { EventBus } from '../../../lib/eventBus.js';
import { Logger } from '../../../lib/logger.js';
import { Auth } from '../../../auth.js';
import { mostrarToast, mostrarConfirmacion } from '../../../utils.js';
import { crearVarianteRepo } from '../../../repositorios/variante-repository.js';

import * as estado from './estado.js';
import * as validaciones from './validaciones.js';
import * as vista from './renderer.js';

/* ── Estado local del ciclo de vida ────────────────────── */

let _contenedor = null;
let _abortController = null;
let _desuscripciones = [];
let _timerAutoguardado = null;
let _onCerrarCallback = null;
let _insumoSeleccionado = null;
let _insumoHoverIdx = -1;
let _repo = null;

// v1.1.5: cola y secuencia para serializar persistencia.
let _colaGuardado = Promise.resolve();
let _secuenciaPersistencia = 0;

const DEBOUNCE_MS = 600;

/* ── API pública ───────────────────────────────────────── */

export async function montar(contenedor, opciones = {}) {
  if (!contenedor) {
    Logger.error('[Variantes] Contenedor no provisto.');
    return;
  }

  desmontar();

  _contenedor = contenedor;
  _onCerrarCallback = opciones.onCerrar || null;
  _repo = crearVarianteRepo();
  _abortController = new AbortController();
  const { signal } = _abortController;

  const espacioId = Auth.obtenerLocalActivo?.()?.id || null;
  estado.setEspacioId(espacioId);

  const state = Store.obtenerEstado();
  estado.setInsumosCache(state.insumos || []);

  vista.montarEstructura(contenedor);
  vista.pintarIndicador(estado.getEstadoGuardado());

  _registrarDelegacion(signal);

  _desuscripciones.push(EventBus.on('variantes:actualizadas', () => {
    const actuales = Store.obtenerEstado().variantes || [];
    const filtradas = _filtrarPorEspacio(actuales, espacioId);
    estado.setVariantes(filtradas);
    _refrescar();
  }));

  _desuscripciones.push(Store.suscribir((s, action) => {
    if (action.type === 'INSUMOS_INICIALIZAR' || action.type === 'INSUMOS_GUARDADO' || action.type === 'INSUMO_GUARDADO') {
      estado.setInsumosCache(s.insumos || []);
      _refrescar();
    }
  }));

  try {
    const lista = await _repo.obtenerTodas();
    const filtradas = _filtrarPorEspacio(lista, espacioId);
    estado.setVariantes(filtradas);
    if (filtradas.length > 0) {
      estado.setVarianteActiva(filtradas[0]);
    }
  } catch (e) {
    Logger.error('[Variantes] Error al cargar variantes:', e);
    mostrarToast('error', 'No se pudieron cargar las variantes.');
  }

  _refrescar();
}

export function desmontar() {
  if (_timerAutoguardado) {
    clearTimeout(_timerAutoguardado);
    _timerAutoguardado = null;
  }
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
  _insumoSeleccionado = null;
  _insumoHoverIdx = -1;
  _onCerrarCallback = null;
  _repo = null;
}

export function cerrar() {
  const cb = _onCerrarCallback;
  _aplicarOpcionActivaSiCorresponde();
  desmontar();
  if (typeof cb === 'function') {
    try { cb(); } catch (e) { Logger.warn('[Variantes] onCerrar lanzó:', e); }
  }
}

/* ── Filtrado por espacio ──────────────────────────────── */

function _filtrarPorEspacio(lista, espacioId) {
  if (!Array.isArray(lista)) return [];
  if (!espacioId) return lista;
  return lista.filter(v => v && v.espacioId === espacioId);
}

/* ── Refresco global ───────────────────────────────────── */

function _refrescar() {
  if (!_contenedor) return;

  const variantes = estado.getVariantes();
  const varianteActiva = estado.getVarianteActiva();
  const opcionActiva = estado.getOpcionActiva();
  const insumosCache = estado.getInsumosCache();

  const validacionVar = varianteActiva ? validaciones.validarVariante(varianteActiva) : null;

  let validacionOp = null;
  if (opcionActiva) {
    validacionOp = validaciones.validarOpcion(opcionActiva, {
      variantes,
      insumosCache,
      espacioId: estado.getEspacioId(),
      exclusionId: opcionActiva.id
    });
  }

  vista.pintarIndicador(estado.getEstadoGuardado());
  vista.pintarLista(variantes, varianteActiva?.id, estado.getFiltroLista(), estado.getTerminoBusqueda());
  vista.pintarCentro(varianteActiva, validacionVar);
  vista.pintarPanelOpcion(opcionActiva, validacionOp, insumosCache, estado.esOpcionNueva());
  vista.pintarPills(variantes, varianteActiva?.id);
  vista.pintarCards(varianteActiva);
  vista.pintarSheet(opcionActiva, validacionOp, insumosCache, estado.esOpcionNueva());

  _rellenarSelectsReglas(variantes, opcionActiva);

  if (opcionActiva && _esMovil()) vista.abrirSheet();
  else vista.cerrarSheet();
}

/* ── Registro de delegación ────────────────────────────── */

function _registrarDelegacion(signal) {
  _contenedor.addEventListener('click', _handleClick, { signal });
  _contenedor.addEventListener('input', _handleInput, { signal });
  _contenedor.addEventListener('change', _handleChange, { signal });
  _contenedor.addEventListener('keydown', _handleKeydown, { signal });
  document.addEventListener('keydown', _handleEscapeGlobal, { signal });
}

function _handleEscapeGlobal(e) {
  if (e.key !== 'Escape') return;
  const modalInsumo = document.getElementById('ve-modal-insumo');
  if (modalInsumo?.classList.contains('activo')) {
    vista.cerrarModalInsumo();
    return;
  }
  if (estado.getOpcionActiva()) {
    _cerrarOpcionEditor();
  }
}

/* ── Handler de click ──────────────────────────────────── */

function _handleClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'cerrar-editor':
    case 'cerrar-editor-overlay':
      if (action === 'cerrar-editor-overlay' && e.target !== target) return;
      cerrar();
      return;

    case 'nueva-variante':
      _nuevaVariante();
      return;

    case 'seleccionar-variante':
      _seleccionarVariante(target.dataset.id);
      return;

    case 'seleccionar-opcion':
      _seleccionarOpcion(target.dataset.id);
      return;

    case 'nueva-opcion':
      _nuevaOpcion();
      return;

    case 'cerrar-opcion':
      _cerrarOpcionEditor();
      return;

    case 'desactivar-variante':
      _confirmarDesactivarVariante();
      return;

    case 'reactivar-variante':
      _reactivarVariante();
      return;

    case 'desactivar-opcion':
      _confirmarDesactivarOpcion();
      return;

    case 'toggle-alergeno':
      _toggleAlergeno(target.dataset.alergeno);
      return;

    case 'quitar-regla':
      _quitarRegla(target.dataset.tipo, target.dataset.id);
      return;

    case 'quitar-insumo':
      _quitarInsumoDelta(parseInt(target.dataset.idx, 10));
      return;

    case 'quitar-paso':
      _quitarPasoDelta(parseInt(target.dataset.idx, 10));
      return;

    case 'abrir-modal-insumo':
      _abrirModalInsumo();
      return;

    case 'cerrar-modal-insumo':
      vista.cerrarModalInsumo();
      return;

    case 'confirmar-insumo':
      _confirmarModalInsumo();
      return;

    case 'seleccionar-insumo-modal':
      _seleccionarInsumoDesdeModal(target.dataset.insumoId);
      return;

    case 'agregar-paso':
      _agregarPasoDelta();
      return;

    case 'cambiar-filtro':
      estado.setFiltroLista(target.dataset.filtro);
      _refrescar();
      return;

    default:
      return;
  }
}

/* ── Handler de input ──────────────────────────────────── */

function _handleInput(e) {
  const target = e.target;
  const field = target.dataset?.field;

  if (field) {
    _actualizarCampo(field, target);
    if (field.startsWith('op-')) {
      _sincronizarOpcionActivaEnVariante();
    }
    _programarAutoguardado();
    return;
  }

  if (target.id === 've-buscar') {
    estado.setTerminoBusqueda(target.value);
    vista.pintarLista(
      estado.getVariantes(),
      estado.getVarianteActiva()?.id,
      estado.getFiltroLista(),
      target.value
    );
    return;
  }

  if (target.id === 've-insumo-buscar') {
    _insumoHoverIdx = -1;
    vista.pintarResultadosInsumo(estado.getInsumosCache(), target.value);
    return;
  }
}

function _handleChange(e) {
  const target = e.target;
  const field = target.dataset?.field;
  if (!field) return;
  _actualizarCampo(field, target);
  if (field.startsWith('op-')) {
    _sincronizarOpcionActivaEnVariante();
  }
  _programarAutoguardado();
}

function _handleKeydown(e) {
  if (e.target.id !== 've-insumo-buscar') return;
  const cont = document.getElementById('ve-insumo-resultados');
  if (!cont) return;
  const items = cont.querySelectorAll('.ve-resultado-item[data-insumo-id]');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _insumoHoverIdx = Math.min(_insumoHoverIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('hover', i === _insumoHoverIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _insumoHoverIdx = Math.max(_insumoHoverIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('hover', i === _insumoHoverIdx));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_insumoHoverIdx >= 0) {
      _seleccionarInsumoDesdeModal(items[_insumoHoverIdx].dataset.insumoId);
    } else if (items.length > 0) {
      _seleccionarInsumoDesdeModal(items[0].dataset.insumoId);
    }
  }
}

/* ── Actualización de campos ───────────────────────────── */

function _actualizarCampo(field, input) {
  const varActiva = estado.getVarianteActiva();
  const opActiva = estado.getOpcionActiva();

  if (field.startsWith('var-') && varActiva) {
    if (field === 'var-nombre') varActiva.nombre = input.value.trim();
    else if (field === 'var-desc') varActiva.descripcion = input.value.trim();
    else if (field === 'var-tipo') {
      varActiva.tipo = input.value;
      Object.assign(varActiva, validaciones.normalizarVariante(varActiva));
      _refrescar();
    }
    else if (field === 'var-requerido') {
      varActiva.requerido = input.checked;
      Object.assign(varActiva, validaciones.normalizarVariante(varActiva));
      _refrescar();
    }
    else if (field === 'var-min') varActiva.min_seleccion = parseInt(input.value, 10) || 0;
    else if (field === 'var-max') varActiva.max_seleccion = parseInt(input.value, 10) || 0;
    else if (field === 'var-orden') varActiva.orden = parseInt(input.value, 10) || 0;
    else if (field === 'var-activo') varActiva.activo = input.checked;

    vista.pintarLista(
      estado.getVariantes(),
      varActiva.id,
      estado.getFiltroLista(),
      estado.getTerminoBusqueda()
    );
    return;
  }

  if (field.startsWith('op-') && opActiva) {
    if (field === 'op-nombre') {
      opActiva.nombre = input.value.trim();
      const t1 = document.getElementById('ve-panel-opt-title');
      if (t1) t1.textContent = opActiva.nombre || 'Nueva opción';
      const t2 = document.getElementById('ve-sheet-title');
      if (t2) t2.textContent = opActiva.nombre || 'Nueva opción';
    }
    else if (field === 'op-desc') opActiva.descripcion = input.value.trim();
    else if (field === 'op-precio') opActiva.precio_delta = parseFloat(input.value) || 0;
    else if (field === 'op-activo') opActiva.activo = input.checked;
    else if (field === 'op-requiere-select') {
      const val = input.value;
      if (val && !opActiva.requiere.includes(val)) {
        opActiva.requiere.push(val);
        _refrescar();
      }
      input.value = '';
    }
    else if (field === 'op-excluye-select') {
      const val = input.value;
      if (val && !opActiva.excluye.includes(val)) {
        opActiva.excluye.push(val);
        _refrescar();
      }
      input.value = '';
    }
    return;
  }
}

/* ── Acciones del usuario ──────────────────────────────── */

function _nuevaVariante() {
  // v1.1.5 (Fix 3): forzar persistencia pendiente antes de crear una
  // nueva. Sin esto, el timer del autoguardado disparaba DESPUÉS de
  // crear la variante y persistía la nueva en lugar de la anterior.
  _forzarPersistenciaPendiente();

  _cerrarOpcionEditor();

  const nueva = {
    id: 'var_' + Date.now(),
    nombre: 'Nueva variante',
    descripcion: '',
    tipo: 'unica',
    requerido: false,
    min_seleccion: 0,
    max_seleccion: 1,
    activo: true,
    orden: estado.getVariantes().length,
    opciones: [],
    espacioId: estado.getEspacioId() || ''
  };

  estado.agregarVarianteAlEstado(nueva);
  estado.setVarianteActiva(nueva);
  _marcarSucio();
  _programarAutoguardado();
  _refrescar();
}

function _seleccionarVariante(id) {
  if (id === estado.getVarianteActiva()?.id) return;

  _cerrarOpcionEditor();

  // v1.1.5 (Fix 3): _cerrarOpcionEditor puede haber programado un
  // autoguardado. Forzarlo antes de cambiar de variante activa para
  // que la persistencia apunte a la variante correcta.
  _forzarPersistenciaPendiente();

  const variante = estado.getVariantes().find(v => v.id === id);
  if (!variante) return;
  estado.setVarianteActiva(variante);
  _refrescar();
}

function _seleccionarOpcion(id) {
  const varActiva = estado.getVarianteActiva();
  if (!varActiva) return;
  const opcion = (varActiva.opciones || []).find(o => o.id === id);
  if (!opcion) return;

  _aplicarOpcionActivaSiCorresponde();

  const clon = JSON.parse(JSON.stringify(opcion));
  estado.setOpcionActiva(clon, false);
  _refrescar();
}

function _nuevaOpcion() {
  const varActiva = estado.getVarianteActiva();
  if (!varActiva) {
    mostrarToast('error', 'Selecciona una variante antes de crear una opción.');
    return;
  }

  _aplicarOpcionActivaSiCorresponde();

  const nueva = {
    id: '',
    nombre: '',
    descripcion: '',
    precio_delta: 0,
    activo: true,
    alergenos: [],
    requiere: [],
    excluye: [],
    insumos_delta: [],
    pasos_delta: []
  };

  estado.setOpcionActiva(nueva, true);
  _refrescar();
}

function _cerrarOpcionEditor() {
  const opActiva = estado.getOpcionActiva();
  if (!opActiva) return;

  _aplicarOpcionActivaSiCorresponde();
  estado.limpiarOpcionActiva();
  vista.cerrarSheet();
  _refrescar();
}

function _generarIdUnico(nombre, variantes, exclusionId) {
  const slugBase = validaciones.slugDesdeNombre(nombre);
  if (!slugBase) return '';

  if (!validaciones.idExisteEnEspacio(slugBase, variantes, exclusionId)) {
    return slugBase;
  }

  for (let i = 2; i <= 100; i++) {
    const candidato = `${slugBase}_${i}`;
    if (!validaciones.idExisteEnEspacio(candidato, variantes, exclusionId)) {
      return candidato;
    }
  }

  return slugBase + '_' + Date.now().toString(36);
}

function _sincronizarOpcionActivaEnVariante() {
  const opActiva = estado.getOpcionActiva();
  const varActiva = estado.getVarianteActiva();
  if (!opActiva || !varActiva) return;

  if (!opActiva.id && opActiva.nombre) {
    const idUnico = _generarIdUnico(opActiva.nombre, estado.getVariantes(), null);
    if (idUnico) opActiva.id = idUnico;
  }

  if (!opActiva.id) return;

  const idx = varActiva.opciones.findIndex(x => x.id === opActiva.id);
  if (idx >= 0) varActiva.opciones[idx] = opActiva;
  else varActiva.opciones.push(opActiva);

  estado.agregarVarianteAlEstado(varActiva);
}

function _aplicarOpcionActivaSiCorresponde() {
  const opActiva = estado.getOpcionActiva();
  const varActiva = estado.getVarianteActiva();
  if (!opActiva || !varActiva) return;

  const esNueva = estado.esOpcionNueva();

  if (esNueva && _opcionVacia(opActiva)) return;

  _sincronizarOpcionActivaEnVariante();

  if (!opActiva.id) return;

  const ctx = {
    variantes: estado.getVariantes(),
    insumosCache: estado.getInsumosCache(),
    espacioId: estado.getEspacioId(),
    exclusionId: opActiva.id || null
  };
  const val = validaciones.validarOpcion(opActiva, ctx);
  if (val.errores.length > 0) return;

  _programarAutoguardado();
}

function _opcionVacia(o) {
  return (!o.nombre || !o.nombre.trim()) &&
    !o.descripcion &&
    o.precio_delta === 0 &&
    (!o.alergenos || o.alergenos.length === 0) &&
    (!o.requiere || o.requiere.length === 0) &&
    (!o.excluye || o.excluye.length === 0) &&
    (!o.insumos_delta || o.insumos_delta.length === 0) &&
    (!o.pasos_delta || o.pasos_delta.length === 0);
}

/* ── Persistencia (v1.1.5: cola + secuencia) ───────────── */

/**
 * Cancela el autoguardado pendiente. Se usa antes de una operación
 * destructiva para evitar que un guardado en vuelo pise el estado.
 */
function _cancelarAutoguardado() {
  if (_timerAutoguardado) {
    clearTimeout(_timerAutoguardado);
    _timerAutoguardado = null;
  }
}

/**
 * v1.1.5 (Fix 3): fuerza la persistencia pendiente antes de cambiar
 * de foco (variante activa u opción). Si hay un autoguardado
 * programado, lo dispara inmediatamente sobre la variante activa
 * actual.
 */
function _forzarPersistenciaPendiente() {
  if (!_timerAutoguardado) return;
  clearTimeout(_timerAutoguardado);
  _timerAutoguardado = null;
  const activa = estado.getVarianteActiva();
  if (activa && activa.id) {
    _persistirVariante(activa, { validar: true });
  }
}

/**
 * v1.1.5: unifica _persistir (autoguardado con debounce) y
 * _persistirInmediato (operaciones destructivas). Un solo camino.
 *
 * §5.11 del brief: se despacha al Store ANTES del repo, para que el
 * listener del repo no pueda pisar el estado local con una versión
 * en vuelo.
 *
 * v1.1.5 (Fix 1): las escrituras se serializan con _colaGuardado
 * (FIFO). Si dos llamadas se solapan, la segunda espera a que la
 * primera resuelva. Esto evita dos HTTP en paralelo sobre la misma
 * fila.
 *
 * v1.1.5 (Fix 1): cada llamada lleva un número de secuencia. Al
 * resolver, solo la ÚLTIMA llamada emitida aplica su resultado al
 * Store y al estado local. Si una respuesta intermedia llega tarde,
 * no pisa. Resuelve el caso "editar rápido + operación destructiva".
 *
 * @param {Object} variante — variante ya mutada.
 * @param {Object} opciones
 * @param {boolean} opciones.validar — si true, valida antes de
 *   persistir. Se usa en el autoguardado; las operaciones
 *   destructivas ya validaron su contexto.
 */
function _persistirVariante(variante, { validar = false } = {}) {
  if (!variante || !variante.id || !_repo) return Promise.resolve();

  if (validar) {
    const val = validaciones.validarVariante(variante);
    if (val.errores.length > 0) {
      estado.setEstadoGuardado('sucio');
      vista.pintarIndicador('sucio');
      return Promise.resolve();
    }
  }

  const seq = ++_secuenciaPersistencia;

  const ejecutar = async () => {
    // §5.11: despachar al Store ANTES del repo.
    Store.despachar({ type: 'VARIANTE_GUARDADA', payload: variante });
    estado.setEstadoGuardado('guardando');
    vista.pintarIndicador('guardando');

    try {
      const guardada = await _repo.guardarVariante(variante);

      // Fix 1: solo aplicar si seguimos siendo la llamada vigente.
      if (seq !== _secuenciaPersistencia) return;

      if (guardada && guardada.id) {
        estado.agregarVarianteAlEstado(guardada);
        if (estado.getVarianteActiva()?.id === guardada.id) {
          estado.setVarianteActiva(guardada);
        }
        estado.setEstadoGuardado('limpio');
      } else {
        estado.setEstadoGuardado('sucio');
        mostrarToast('error', 'No se pudo guardar en el servidor.');
      }
    } catch (e) {
      if (seq !== _secuenciaPersistencia) return;
      Logger.error('[Variantes] Error al persistir:', e);
      estado.setEstadoGuardado('sucio');
      mostrarToast('error', 'Error al guardar.');
    } finally {
      if (seq === _secuenciaPersistencia) {
        vista.pintarIndicador(estado.getEstadoGuardado());
      }
    }
  };

  // Serializar escrituras: cola FIFO.
  const promesa = _colaGuardado.then(ejecutar, ejecutar);
  _colaGuardado = promesa.catch(() => {});
  return promesa;
}

async function _confirmarDesactivarVariante() {
  const v = estado.getVarianteActiva();
  if (!v) return;
  const nombre = v.nombre;
  const varianteId = v.id;

  const confirmado = await mostrarConfirmacion(
    'Desactivar variante',
    `¿Desactivar "${nombre}"? La variante quedará inactiva pero no se elimina. Los productos que la tengan asignada seguirán apuntando a ella hasta que la reactives.`,
    { textoConfirmar: 'Desactivar' }
  );
  if (!confirmado) return;

  // Cancelar autoguardado pendiente: puede tener una versión previa
  // que pisaría el cambio que estamos por aplicar.
  _cancelarAutoguardado();

  const fresca = estado.getVarianteActiva();
  if (!fresca || fresca.id !== varianteId) {
    // La variante cambió mientras el modal estaba abierto. Usar
    // la activa actual.
    const activaActual = estado.getVarianteActiva();
    if (!activaActual) return;
    activaActual.activo = false;
    estado.agregarVarianteAlEstado(activaActual);
    await _persistirVariante(activaActual);
    _refrescar();
    return;
  }

  fresca.activo = false;
  estado.agregarVarianteAlEstado(fresca);

  await _persistirVariante(fresca);
  _refrescar();
}

function _reactivarVariante() {
  const fresca = estado.getVarianteActiva();
  if (!fresca) return;
  fresca.activo = true;
  estado.agregarVarianteAlEstado(fresca);
  _cancelarAutoguardado();
  _persistirVariante(fresca);
  _refrescar();
}

async function _confirmarDesactivarOpcion() {
  const o = estado.getOpcionActiva();
  if (!o || estado.esOpcionNueva()) return;
  const nombre = o.nombre;
  const opcionId = o.id;

  const confirmado = await mostrarConfirmacion(
    'Desactivar opción',
    `¿Desactivar "${nombre}"? Quedará inactiva pero conservará su ID reservado. Puedes reactivarla después.`,
    { textoConfirmar: 'Desactivar' }
  );
  if (!confirmado) return;

  _cancelarAutoguardado();

  const opActiva = estado.getOpcionActiva();
  if (!opActiva || opActiva.id !== opcionId) return;

  opActiva.activo = false;
  const varActiva = estado.getVarianteActiva();
  if (varActiva) {
    const idx = varActiva.opciones.findIndex(x => x.id === opActiva.id);
    if (idx >= 0) varActiva.opciones[idx] = opActiva;
    else varActiva.opciones.push(opActiva);
    estado.agregarVarianteAlEstado(varActiva);
  }

  estado.limpiarOpcionActiva();
  vista.cerrarSheet();

  if (varActiva) {
    await _persistirVariante(varActiva);
  }
  _refrescar();
}

/* ── Alérgenos y reglas ────────────────────────────────── */

function _toggleAlergeno(alergeno) {
  const o = estado.getOpcionActiva();
  if (!o || !alergeno) return;
  if (!Array.isArray(o.alergenos)) o.alergenos = [];
  const idx = o.alergenos.indexOf(alergeno);
  if (idx >= 0) o.alergenos.splice(idx, 1);
  else o.alergenos.push(alergeno);
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

function _quitarRegla(tipo, id) {
  const o = estado.getOpcionActiva();
  if (!o || !['requiere', 'excluye'].includes(tipo)) return;
  o[tipo] = (o[tipo] || []).filter(x => x !== id);
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

/* ── Insumos delta ─────────────────────────────────────── */

function _abrirModalInsumo() {
  if (!estado.getOpcionActiva()) return;
  _insumoSeleccionado = null;
  _insumoHoverIdx = -1;
  vista.abrirModalInsumo();
}

function _seleccionarInsumoDesdeModal(insumoId) {
  const insumo = estado.getInsumosCache().find(i => i.id === insumoId);
  if (!insumo) return;
  _insumoSeleccionado = insumo;
  vista.marcarInsumoSeleccionado(insumo.nombre, insumo.unidad);
}

function _confirmarModalInsumo() {
  const o = estado.getOpcionActiva();
  if (!o || !_insumoSeleccionado) return;
  const { accion, cantidad } = vista.leerModalInsumo();
  if (!o.insumos_delta) o.insumos_delta = [];
  o.insumos_delta.push({
    insumoId: _insumoSeleccionado.id,
    cantidad,
    accion
  });
  _insumoSeleccionado = null;
  vista.cerrarModalInsumo();
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

function _quitarInsumoDelta(idx) {
  const o = estado.getOpcionActiva();
  if (!o || !Array.isArray(o.insumos_delta)) return;
  if (idx < 0 || idx >= o.insumos_delta.length) return;
  o.insumos_delta.splice(idx, 1);
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

/* ── Pasos delta ───────────────────────────────────────── */

function _agregarPasoDelta() {
  const o = estado.getOpcionActiva();
  if (!o) return;
  const accion = document.getElementById('ve-paso-accion')?.value || 'sumar';
  const texto = (document.getElementById('ve-paso-texto')?.value || '').trim();
  const posicion = document.getElementById('ve-paso-posicion')?.value || 'fin';

  if (accion === 'sumar' && !texto) {
    mostrarToast('warning', 'El paso debe tener texto.');
    return;
  }

  if (!o.pasos_delta) o.pasos_delta = [];
  o.pasos_delta.push({ accion, texto, posicion });
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

function _quitarPasoDelta(idx) {
  const o = estado.getOpcionActiva();
  if (!o || !Array.isArray(o.pasos_delta)) return;
  if (idx < 0 || idx >= o.pasos_delta.length) return;
  o.pasos_delta.splice(idx, 1);
  _sincronizarOpcionActivaEnVariante();
  _programarAutoguardado();
  _refrescar();
}

/* ── Autoguardado ──────────────────────────────────────── */

function _marcarSucio() {
  estado.setEstadoGuardado('sucio');
  vista.pintarIndicador('sucio');
}

function _programarAutoguardado() {
  _marcarSucio();
  if (_timerAutoguardado) clearTimeout(_timerAutoguardado);
  _timerAutoguardado = setTimeout(() => {
    _timerAutoguardado = null;
    const v = estado.getVarianteActiva();
    if (v && v.id) {
      _persistirVariante(v, { validar: true });
    }
  }, DEBOUNCE_MS);
}

/* ── Utilidades internas ───────────────────────────────── */

function _esMovil() {
  return window.innerWidth < 1100;
}

function _rellenarSelectsReglas(variantes, opActiva) {
  if (!opActiva) return;
  const opciones = [];
  (variantes || []).forEach(v => {
    (v.opciones || []).forEach(o => {
      if (o.id && o.id !== opActiva.id) {
        opciones.push({ id: o.id, nombre: o.nombre, variante: v.nombre });
      }
    });
  });

  const rellenar = (select) => {
    if (!select) return;
    const actual = select.value;
    const opcionesHTML = opciones
      .map(o => `<option value="${_escapeAttr(o.id)}">${_escapeAttr(o.nombre || o.id)} (${_escapeAttr(o.variante)})</option>`)
      .join('');
    select.innerHTML = `<option value="">-- Añadir referencia --</option>${opcionesHTML}`;
    if (actual && opciones.some(o => o.id === actual)) select.value = actual;
  };

  rellenar(document.querySelector('[data-field="op-requiere-select"]'));
  rellenar(document.querySelector('[data-field="op-excluye-select"]'));
}

function _escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── Exposición de utilidades para tests ───────────────── */

export const _internals = {
  getVariantes: estado.getVariantes,
  getVarianteActiva: estado.getVarianteActiva,
  getOpcionActiva: estado.getOpcionActiva,
  marcarSucio: _marcarSucio,
  persistir: (v) => _persistirVariante(v || estado.getVarianteActiva(), { validar: true }),
  persistirInmediato: (v) => _persistirVariante(v),
  rellenarSelectsReglas: _rellenarSelectsReglas,
  sincronizarOpcionActiva: _sincronizarOpcionActivaEnVariante,
  generarIdUnico: _generarIdUnico,
  filtrarPorEspacio: _filtrarPorEspacio,
  cancelarAutoguardado: _cancelarAutoguardado,
  forzarPersistenciaPendiente: _forzarPersistenciaPendiente
};