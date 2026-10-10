/* ================================================================
   LaTaberna - PubPOS — PEDIDO SUBMÓDULO (ES6)
   Archivo: js/ui/pedido/modal-opciones.js
   Versión: 1.2.0
   Propósito: Modal de selección de opciones para productos con
              variantes. Calcula precio_unitario en tiempo real,
              aplica reglas requiere/excluye, y arma el item con
              snapshot completo de opciones. Consume variantes del
              slice `variantes` del Store.

   v1.2.0:
     · FIX: el item que se envía a Comanda.agregarItem ahora copia
       `categoria` y `destino` desde `_producto`. Sin esto, el
       handler `enviarComanda` abortaba el envío completo con
       "Los ítems no tienen un destino válido" (D2 test v2.1,
       suite 4). Los campos son datos del producto, no del modal.

   v1.1.0:
     · Ciclo de vida activar()/limpiar(). Se suscribe a
       `producto:con_variantes`. Ya NO reemite
       `producto:seleccionado` salvo fallback defensivo.
     · Chips de observación agrupados por pares mutuamente
       excluyentes (hielo, limón, sal, picante, temperatura).
     · Snapshot de opciones ordenado por índice de variante y de
       opción → dedupe determinístico en el reducer.
     · alergias_manuales ordenadas alfabéticamente → dedupe
       determinístico.
     · Item guarda `precio` = `precio_unitario` para
       compatibilidad con el reducer de Store v2.0.13.
     · Keydown global guardado y removido en cerrar().

   Contratos:
     Consume:  EventBus 'producto:con_variantes'
               { producto, variantes } (el payload se ignora,
               se re-resuelve del Store por seguridad)
     Emite:    EventBus 'producto:agregado_a_comanda' { item }
               EventBus 'producto:seleccionado' (solo fallback)

   Dependencias:
     · Store v2.0.13+ (slice `variantes`)
     · js/dominio/alergenos.js (enum ALERGENOS)
     · js/repositorios/variante-repository.js v1.1.0+ (shape de
       las variantes cargadas)
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { Auth } from '../../auth.js';
import { mostrarToast, formatearDinero } from '../../utils.js';
import { Comanda } from '../comanda.js';
import { ALERGENOS } from '../../dominio/alergenos.js';

const ETIQUETAS_ALERGENO = {
  mani: 'Maní',
  gluten: 'Gluten',
  lactosa: 'Lactosa',
  mariscos: 'Mariscos',
  huevo: 'Huevo',
  soya: 'Soya',
  frutos_secos: 'Frutos secos',
  pescado: 'Pescado',
  otro: 'Otro'
};

/**
 * Chips de observación agrupados por par mutuamente excluyente.
 * Tocar una opción del grupo desmarca las demás del mismo grupo.
 * El grupo 'temp' tiene una sola opción: siempre toggleable.
 */
const GRUPOS_CHIPS = [
  { id: 'hielo',   opciones: ['Sin hielo', 'Con hielo extra'] },
  { id: 'limon',   opciones: ['Sin limón', 'Con doble limón'] },
  { id: 'sal',     opciones: ['Sin sal', 'Con sal'] },
  { id: 'picante', opciones: ['Sin picante', 'Con picante'] },
  { id: 'temp',    opciones: ['Bien fría'] }
];

const CHIPS_OBS = GRUPOS_CHIPS.flatMap(g => g.opciones);

/* ── Estado del módulo ─────────────────────────────────────── */

let _activada = false;
let _desuscripciones = [];

let _overlay = null;
let _keydownHandler = null;
let _producto = null;
let _variantes = [];
let _estado = null;

function _estadoInicial() {
  return {
    selecciones: {},          // varianteId -> Set de opcionId
    alergias_manuales: new Set(),
    obs_chips: new Set(),
    obs_libre: '',
    cantidad: 1
  };
}

/* ── Ciclo de vida ─────────────────────────────────────────── */

export function activar() {
  if (_activada) return;
  _activada = true;

  _desuscripciones.push(
    EventBus.on('producto:con_variantes', (payload) => {
      const producto = payload?.producto;
      if (!producto) {
        Logger.warn('[ModalOpciones] producto:con_variantes sin producto.');
        return;
      }
      abrir(producto);
    })
  );

  Logger.info('[ModalOpciones] Activado.');
}

export function limpiar() {
  if (!_activada) return;
  _activada = false;

  _desuscripciones.forEach(fn => {
    try { fn(); } catch (e) { Logger.warn('[ModalOpciones] Error al desuscribir:', e); }
  });
  _desuscripciones = [];

  if (_overlay) {
    _overlay.style.display = 'none';
  }
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }

  _producto = null;
  _variantes = [];
  _estado = null;

  Logger.info('[ModalOpciones] Limpiado.');
}

/* ── Estructura del modal ──────────────────────────────────── */

function _asegurarOverlay() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.id = 'modalOpciones';
  _overlay.className = 'modal-overlay mo-overlay';
  _overlay.style.display = 'none';
  _overlay.setAttribute('role', 'dialog');
  _overlay.setAttribute('aria-modal', 'true');
  _overlay.setAttribute('aria-label', 'Opciones del producto');

  _overlay.innerHTML = `
    <div class="mo-modal">
      <div class="mo-handle"></div>

      <div class="mo-header">
        <div class="mo-header-info">
          <div class="mo-nombre" id="moNombre">Producto</div>
          <div class="mo-precio-base" id="moPrecioBase">Base $0</div>
        </div>
        <button class="mo-cerrar" id="moBtnCerrar" aria-label="Cerrar">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="mo-body" id="moBody"></div>

      <div class="mo-footer">
        <div class="mo-total">
          <span>Total</span>
          <span class="mo-total-monto" id="moTotal">$0</span>
        </div>
        <div class="mo-botones">
          <button class="mo-btn mo-btn-cancelar" id="moBtnCancelar">Cancelar</button>
          <button class="mo-btn mo-btn-agregar" id="moBtnAgregar">
            <i class="fas fa-check"></i> Agregar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(_overlay);

  document.getElementById('moBtnCerrar').addEventListener('click', cerrar);
  document.getElementById('moBtnCancelar').addEventListener('click', cerrar);
  document.getElementById('moBtnAgregar').addEventListener('click', _agregar);

  _overlay.addEventListener('click', (e) => {
    if (e.target === _overlay) cerrar();
  });
}

/* ── Render ────────────────────────────────────────────────── */

function _render() {
  if (!_producto || !_overlay) return;

  document.getElementById('moNombre').textContent = _producto.nombre;
  document.getElementById('moPrecioBase').textContent = `Base ${formatearDinero(_producto.precio)}`;

  const body = document.getElementById('moBody');
  body.innerHTML = '';

  // Variantes
  _variantes.forEach(v => {
    const seccion = document.createElement('div');
    seccion.className = 'mo-variante';
    seccion.dataset.variante = v.id;

    const reqHtml = v.requerido ? '<span class="mo-var-req">*</span>' : '';
    const tipoLabel = v.tipo === 'unica' ? 'única' : 'múltiple';
    const tipoClass = v.tipo === 'multiple' ? 'mo-var-tipo multiple' : 'mo-var-tipo';

    seccion.innerHTML = `
      <div class="mo-var-header">
        <span class="mo-var-titulo">${_esc(v.nombre)}</span>
        ${reqHtml}
        <span class="${tipoClass}">${tipoLabel}</span>
      </div>
      <div class="mo-opciones" data-variante-id="${_esc(v.id)}"></div>
    `;

    const opcionesCont = seccion.querySelector('.mo-opciones');
    opcionesCont.innerHTML = _htmlOpciones(v);

    opcionesCont.addEventListener('click', (e) => {
      const card = e.target.closest('.mo-opcion');
      if (!card || card.classList.contains('deshabilitada')) return;
      _toggleOpcion(v.id, card.dataset.opcion);
    });

    body.appendChild(seccion);
  });

  // Alergias
  const secAlergias = document.createElement('div');
  secAlergias.className = 'mo-seccion';
  secAlergias.innerHTML = `
    <div class="mo-seccion-titulo">
      <i class="fas fa-exclamation-triangle"></i>
      Alergias del cliente (opcional)
    </div>
    <div class="mo-seccion-sub">Solo marcar aquí si el cliente informa una alergia que no está en las opciones.</div>
    <div class="mo-chips" id="moChipsAlergias"></div>
  `;
  body.appendChild(secAlergias);
  _renderChipsAlergias();

  // Observación
  const secObs = document.createElement('div');
  secObs.className = 'mo-seccion';
  secObs.innerHTML = `
    <div class="mo-seccion-titulo">
      <i class="fas fa-comment-dots"></i>
      Nota para esta ${_esc(_producto.nombre)}
    </div>
    <div class="mo-seccion-sub">Toca una opción rápida o escribe algo específico.</div>
    <div class="mo-chips" id="moChipsObs"></div>
    <input type="text" class="mo-input" id="moObsLibre" placeholder="O escribe una observación libre..." maxlength="120">
  `;
  body.appendChild(secObs);
  _renderChipsObs();

  // Cantidad
  const secCant = document.createElement('div');
  secCant.className = 'mo-seccion';
  secCant.innerHTML = `
    <div class="mo-cantidad-fila">
      <div class="mo-cantidad-label">Cantidad</div>
      <div class="mo-cantidad-control">
        <button class="mo-cantidad-btn" id="moBtnMenos" aria-label="Restar">−</button>
        <div class="mo-cantidad-valor" id="moCantidad">1</div>
        <button class="mo-cantidad-btn" id="moBtnMas" aria-label="Sumar">+</button>
      </div>
    </div>
  `;
  body.appendChild(secCant);

  // Listeners
  document.getElementById('moBtnMenos').addEventListener('click', () => _cambiarCantidad(-1));
  document.getElementById('moBtnMas').addEventListener('click', () => _cambiarCantidad(1));
  document.getElementById('moObsLibre').addEventListener('input', (e) => {
    _estado.obs_libre = e.target.value;
  });

  _actualizarCantidadUI();
  _actualizarTotal();
}

function _htmlOpciones(variante) {
  const seleccionadas = _estado.selecciones[variante.id] || new Set();

  return variante.opciones.map(o => {
    const sel = seleccionadas.has(o.id);
    const delta = o.precio_delta || 0;
    const deltaClass = delta > 0 ? '' : delta < 0 ? 'negativo' : 'cero';
    const deltaTexto = delta === 0
      ? 'Incluido'
      : delta > 0
        ? `+${formatearDinero(delta)}`
        : `-${formatearDinero(Math.abs(delta))}`;

    const excluida = _esExcluida(o);
    const faltaRequisito = _tieneRequisitoFaltante(o);

    const clases = [
      'mo-opcion',
      sel ? 'seleccionada' : '',
      excluida ? 'deshabilitada' : '',
      faltaRequisito ? 'requerida-falta' : ''
    ].filter(Boolean).join(' ');

    const checkClass = variante.tipo === 'multiple' ? 'mo-check checkbox' : 'mo-check';
    const warnIcon = faltaRequisito ? '<i class="fas fa-exclamation-triangle warn-icon"></i>' : '';
    const exclIcon = excluida ? '<span class="mo-exclusion-icon">⊘ excluida</span>' : '';

    return `
      <div class="${clases}" data-opcion="${_esc(o.id)}">
        <div class="${checkClass}"><i class="fas fa-check"></i></div>
        <div class="mo-opcion-info">
          <div class="mo-opcion-nombre">${_esc(o.nombre)} ${warnIcon}</div>
          ${o.descripcion ? `<div class="mo-opcion-desc">${_esc(o.descripcion)}</div>` : ''}
        </div>
        <div class="mo-opcion-delta ${deltaClass}">${deltaTexto}</div>
        ${exclIcon}
      </div>
    `;
  }).join('');
}

function _renderChipsAlergias() {
  const cont = document.getElementById('moChipsAlergias');
  if (!cont) return;
  cont.innerHTML = ALERGENOS.map(a => `
    <button class="mo-chip alergia ${_estado.alergias_manuales.has(a) ? 'on' : ''}" data-alergeno="${_esc(a)}">
      ${ETIQUETAS_ALERGENO[a] || a}
    </button>
  `).join('');

  cont.querySelectorAll('.mo-chip').forEach(btn => {
    btn.addEventListener('click', () => _toggleAlergia(btn.dataset.alergeno));
  });
}

function _renderChipsObs() {
  const cont = document.getElementById('moChipsObs');
  if (!cont) return;
  cont.innerHTML = CHIPS_OBS.map(c => `
    <button class="mo-chip ${_estado.obs_chips.has(c) ? 'on' : ''}" data-chip="${_esc(c)}">
      ${_esc(c)}
    </button>
  `).join('');

  cont.querySelectorAll('.mo-chip').forEach(btn => {
    btn.addEventListener('click', () => _toggleObsChip(btn.dataset.chip));
  });
}

/* ── Reglas requiere / excluye ─────────────────────────────── */

function _esExcluida(opcion) {
  // Buscar si alguna opción seleccionada en CUALQUIER variante la excluye
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (!sel) continue;
    for (const opId of sel) {
      if (opId === opcion.id) continue;
      const op = v.opciones.find(o => o.id === opId);
      if (op && Array.isArray(op.excluye) && op.excluye.includes(opcion.id)) {
        return true;
      }
    }
  }
  return false;
}

function _tieneRequisitoFaltante(opcion) {
  if (!Array.isArray(opcion.requiere) || opcion.requiere.length === 0) return false;
  return opcion.requiere.some(reqId => !_estaSeleccionada(reqId));
}

function _estaSeleccionada(opcionId) {
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (sel && sel.has(opcionId)) return true;
  }
  return false;
}

/* ── Interacciones ─────────────────────────────────────────── */

function _toggleOpcion(varianteId, opcionId) {
  const variante = _variantes.find(v => v.id === varianteId);
  if (!variante) return;

  if (!_estado.selecciones[varianteId]) {
    _estado.selecciones[varianteId] = new Set();
  }
  const set = _estado.selecciones[varianteId];

  if (variante.tipo === 'unica') {
    if (set.has(opcionId)) {
      set.delete(opcionId);
    } else {
      set.clear();
      set.add(opcionId);
    }
  } else {
    if (set.has(opcionId)) {
      set.delete(opcionId);
    } else {
      const maxSel = variante.max_seleccion || 1;
      if (set.size >= maxSel) {
        mostrarToast('warning', `Máximo ${maxSel} opciones en ${variante.nombre}.`);
        return;
      }
      set.add(opcionId);
    }
  }

  _limpiarExcluidas();
  _render();
}

function _limpiarExcluidas() {
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (!sel) continue;
    [...sel].forEach(opId => {
      const op = v.opciones.find(o => o.id === opId);
      if (!op) return;
      if (_esExcluida(op)) {
        sel.delete(opId);
      }
    });
  }
}

function _toggleAlergia(alergeno) {
  if (_estado.alergias_manuales.has(alergeno)) {
    _estado.alergias_manuales.delete(alergeno);
  } else {
    _estado.alergias_manuales.add(alergeno);
  }
  _renderChipsAlergias();
}

function _toggleObsChip(chip) {
  // Buscar el grupo del chip
  const grupo = GRUPOS_CHIPS.find(g => g.opciones.includes(chip));
  if (!grupo) return;

  if (_estado.obs_chips.has(chip)) {
    _estado.obs_chips.delete(chip);
  } else {
    // Excluir cualquier otra opción del mismo grupo
    grupo.opciones.forEach(o => _estado.obs_chips.delete(o));
    _estado.obs_chips.add(chip);
  }
  _renderChipsObs();
}

function _cambiarCantidad(delta) {
  _estado.cantidad = Math.max(1, Math.min(20, _estado.cantidad + delta));
  _actualizarCantidadUI();
  _actualizarTotal();
}

function _actualizarCantidadUI() {
  const el = document.getElementById('moCantidad');
  if (el) el.textContent = _estado.cantidad;
  const btnMenos = document.getElementById('moBtnMenos');
  const btnMas = document.getElementById('moBtnMas');
  if (btnMenos) btnMenos.disabled = _estado.cantidad <= 1;
  if (btnMas) btnMas.disabled = _estado.cantidad >= 20;
}

/* ── Precio ────────────────────────────────────────────────── */

function _calcularPrecioUnitario() {
  let total = _producto.precio || 0;
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (!sel) continue;
    for (const opId of sel) {
      const op = v.opciones.find(o => o.id === opId);
      if (op) total += (op.precio_delta || 0);
    }
  }
  return total;
}

function _actualizarTotal() {
  const unitario = _calcularPrecioUnitario();
  const total = unitario * _estado.cantidad;
  const el = document.getElementById('moTotal');
  if (el) el.textContent = formatearDinero(total);
}

/* ── Validaciones ──────────────────────────────────────────── */

function _validar() {
  const errores = [];

  for (const v of _variantes) {
    if (!v.requerido) continue;
    const sel = _estado.selecciones[v.id];
    const cantidad = sel ? sel.size : 0;
    const minSel = v.min_seleccion || 0;
    if (cantidad < minSel) {
      errores.push(`Falta seleccionar ${v.nombre}`);
    }
  }

  // Reglas requiere
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (!sel) continue;
    for (const opId of sel) {
      const op = v.opciones.find(o => o.id === opId);
      if (!op || !Array.isArray(op.requiere) || op.requiere.length === 0) continue;
      for (const reqId of op.requiere) {
        if (!_estaSeleccionada(reqId)) {
          const nombreReq = _nombreOpcion(reqId);
          errores.push(`"${op.nombre}" requiere "${nombreReq}"`);
        }
      }
    }
  }

  return { ok: errores.length === 0, errores };
}

function _nombreOpcion(opcionId) {
  for (const v of _variantes) {
    const op = v.opciones.find(o => o.id === opcionId);
    if (op) return op.nombre;
  }
  return opcionId;
}

/* ── Agregar a la comanda ──────────────────────────────────── */

function _agregar() {
  const val = _validar();
  if (!val.ok) {
    mostrarToast('warning', '⚠ ' + val.errores[0]);
    return;
  }

  // Observación: chips en orden canónico + texto libre al final
  const obsPartes = CHIPS_OBS.filter(c => _estado.obs_chips.has(c));
  if (_estado.obs_libre.trim()) obsPartes.push(_estado.obs_libre.trim());
  const obsFinal = obsPartes.join(' · ');

  // Snapshot ordenado por índice de variante y de opción.
  // Garantiza dedupe determinístico en el reducer (JSON.stringify).
  const opcionesSnapshot = [];
  for (const v of _variantes) {
    const sel = _estado.selecciones[v.id];
    if (!sel || sel.size === 0) continue;

    const ordenadas = [...sel]
      .map(id => ({ id, idx: v.opciones.findIndex(o => o.id === id) }))
      .filter(x => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    for (const { id: opId } of ordenadas) {
      const op = v.opciones.find(o => o.id === opId);
      if (!op) continue;
      opcionesSnapshot.push({
        varianteId: v.id,
        varianteNombre: v.nombre,
        opcionId: op.id,
        opcionNombre: op.nombre,
        precio_delta: op.precio_delta || 0,
        alergenos: Array.isArray(op.alergenos) ? op.alergenos : [],
        insumos_delta: Array.isArray(op.insumos_delta) ? op.insumos_delta : [],
        pasos_delta: Array.isArray(op.pasos_delta) ? op.pasos_delta : []
      });
    }
  }

  const precioUnitario = _calcularPrecioUnitario();
  const precioTotal = precioUnitario * _estado.cantidad;

  const item = {
    tipo: 'producto',
    prodId: _producto.id,
    nombre: _producto.nombre,
    precio_base: _producto.precio || 0,
    // Compatibilidad con reducer de Store v2.0.13 (suma it.precio * it.qty).
    // precio_unitario y precio_total quedan como informativos.
    precio: precioUnitario,
    precio_unitario: precioUnitario,
    precio_total: precioTotal,
    opciones: opcionesSnapshot,
    // Orden alfabético para dedupe determinístico.
    alergias_manuales: [..._estado.alergias_manuales].sort(),
    // v1.2.0: datos del producto que el handler `enviarComanda`
    // valida antes de crear la comanda. Sin `destino` válido
    // (cocina|barra|ambos) aborta el envío completo.
    categoria: _producto.categoria,
    destino: _producto.destino,
    qty: _estado.cantidad,
    obs: obsFinal,
    enviado: false,
    enviadoA: null,
    enviadoTs: null,
    persona: Comanda.obtenerPedidoActivo()?.personaActiva || 'General'
  };

  try {
    Comanda.agregarItem(item);
    EventBus.emit('producto:agregado_a_comanda', { item });

    const partesNombre = opcionesSnapshot.map(o => o.opcionNombre).join(' ');
    const label = partesNombre ? `${_producto.nombre} ${partesNombre}` : _producto.nombre;
    mostrarToast('success', `✓ ${_estado.cantidad}× ${label} agregada`);

    cerrar();
  } catch (e) {
    Logger.error('[ModalOpciones] Error al agregar item:', e);
    mostrarToast('error', 'No se pudo agregar el producto.');
  }
}

/* ── API pública ───────────────────────────────────────────── */

export function abrir(producto) {
  if (!producto) {
    Logger.warn('[ModalOpciones] Producto no provisto.');
    return;
  }

  // Verificar permiso (§B1.5 del comunicado)
  if (!Auth.tienePermiso('tomarPedido')) {
    mostrarToast('error', 'No tienes permiso para tomar pedidos.');
    return;
  }

  // Verificar que hay pedido activo
  if (!Comanda.obtenerPedidoActivo()) {
    mostrarToast('warning', 'Abre una mesa antes de agregar productos.');
    return;
  }

  // Resolver variantes del producto desde el Store (fuente de verdad)
  const variantesIds = _normalizarVariantesIds(producto.variantes_ids);
  if (variantesIds.length === 0) {
    // Fallback defensivo: producto sin variantes llegó por error.
    // Delegar al flujo normal.
    EventBus.emit('producto:seleccionado', producto);
    return;
  }

  const todasVariantes = Store.obtenerEstado().variantes || [];
  const variantesActivas = variantesIds
    .map(id => todasVariantes.find(v => v.id === id))
    .filter(v => v && v.activo !== false)
    .map(v => ({
      ...v,
      opciones: (v.opciones || []).filter(o => o.activo !== false)
    }))
    .filter(v => v.opciones.length > 0);

  if (variantesActivas.length === 0) {
    // Fallback defensivo: todas las variantes se desactivaron entre
    // el chequeo de Carta y este punto (race condition). Delegar
    // al flujo normal.
    EventBus.emit('producto:seleccionado', producto);
    return;
  }

  _producto = producto;
  _variantes = variantesActivas;
  _estado = _estadoInicial();

  _asegurarOverlay();
  _render();
  _overlay.style.display = 'flex';

  // Keydown: se agrega al abrir, se quita al cerrar. Ciclo de vida limpio.
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
  }
  _keydownHandler = (e) => {
    if (e.key === 'Escape' && _overlay && _overlay.style.display === 'flex') {
      cerrar();
    }
  };
  document.addEventListener('keydown', _keydownHandler);

  Logger.info('[ModalOpciones] Abierto para', producto.nombre, 'con', variantesActivas.length, 'variantes.');
}

export function cerrar() {
  if (_overlay) _overlay.style.display = 'none';
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }
  _producto = null;
  _variantes = [];
  _estado = null;
}

/* ── Utilidades ────────────────────────────────────────────── */

function _normalizarVariantesIds(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function _esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const ModalOpciones = { activar, limpiar, abrir, cerrar };