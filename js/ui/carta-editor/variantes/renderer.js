/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · VARIANTES SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/variantes/renderer.js
   Versión: 1.0.1
   Propósito: Construcción del DOM y pintado del editor de variantes.
              Sin lógica de negocio: recibe datos ya validados y los
              pinta. Toda interacción va por data-action y se delega
              al ciclo de vida.
   v1.0.1: elimina el modal de confirmación custom. Se reemplaza por
           mostrarConfirmacion de utils.js en el ciclo de vida.
   v1.0.0: creación inicial. Basado en el HTML de referencia
           Prueba-D-variantes (híbrido C+A+F). Estructura de tres
           paneles para desktop, pills + cards + bottom sheet para
           móvil.
   ================================================================ */

import { ALERGENOS } from '../../../dominio/alergenos.js';
import { formatearDinero } from '../../../utils.js';

const ACCIONES_INSUMO = [
  { value: 'sumar', label: 'Sumar' },
  { value: 'quitar', label: 'Quitar' }
];

const ACCIONES_PASO = [
  { value: 'sumar', label: 'Sumar paso' },
  { value: 'ocultar', label: 'Ocultar paso' }
];

const POSICIONES_PASO = [
  { value: 'inicio', label: 'Inicio' },
  { value: 'fin', label: 'Fin' },
  { value: 'despues_de', label: 'Después de...' }
];

function _esc(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _formatDelta(n) {
  const valor = Number(n) || 0;
  if (valor === 0) return '$0';
  const signo = valor < 0 ? '−' : '+';
  return `${signo}${formatearDinero(Math.abs(valor))}`;
}

function _tipoLabel(tipo) {
  return tipo === 'unica' ? 'única' : 'múltiple';
}

function _slugAlergeno(a) {
  return a.replace(/_/g, ' ');
}

export function montarEstructura(contenedor) {
  contenedor.innerHTML = `
    <div class="ve-overlay" data-action="cerrar-editor-overlay">
      <div class="ve-editor" role="dialog" aria-label="Catálogo de variantes">
        <div class="ve-header">
          <button class="ve-icon-btn" data-action="cerrar-editor" title="Volver">←</button>
          <h2>🧩 Catálogo de Variantes</h2>
          <span class="ve-indicador limpio" id="ve-indicador">✓ Guardado</span>
          <button class="ve-btn-primary" data-action="nueva-variante">+ Nueva</button>
          <button class="ve-icon-btn" data-action="cerrar-editor" title="Cerrar">✕</button>
        </div>

        <div class="ve-layout-desktop">
          <aside class="ve-panel-vars">
            <div class="ve-search-box">
              <span>🔍</span>
              <input type="text" id="ve-buscar" placeholder="Buscar variante...">
            </div>
            <div class="ve-filtros">
              <button class="ve-chip activo" data-action="cambiar-filtro" data-filtro="todas">Todas</button>
              <button class="ve-chip" data-action="cambiar-filtro" data-filtro="activas">Activas</button>
              <button class="ve-chip" data-action="cambiar-filtro" data-filtro="inactivas">Inactivas</button>
            </div>
            <div class="ve-lista" id="ve-lista"></div>
          </aside>

          <main class="ve-panel-center" id="ve-centro"></main>

          <aside class="ve-panel-opt">
            <div class="ve-panel-opt-header">
              <h3 id="ve-panel-opt-title">Editor de opción</h3>
              <button class="ve-icon-btn" data-action="cerrar-opcion" title="Cerrar editor" style="display:none;" id="ve-panel-opt-close">✕</button>
            </div>
            <div class="ve-panel-opt-body" id="ve-panel-opt-body">
              <div class="ve-vacio">
                <div class="ve-vacio-icon">✏️</div>
                <p>Selecciona una opción de la tabla para editarla.</p>
              </div>
            </div>
            <div class="ve-panel-opt-footer" id="ve-panel-opt-footer" style="display:none;">
              <button class="ve-btn-danger-soft" data-action="desactivar-opcion" id="ve-btn-desactivar-opt-desktop">Desactivar</button>
            </div>
          </aside>
        </div>

        <div class="ve-layout-movil">
          <div class="ve-pills" id="ve-pills"></div>
          <div class="ve-cards" id="ve-cards"></div>
        </div>

        <div class="ve-sheet-overlay" data-action="cerrar-opcion"></div>
        <div class="ve-sheet" id="ve-sheet">
          <div class="ve-sheet-asidero"></div>
          <div class="ve-sheet-header">
            <h3 id="ve-sheet-title">Editar opción</h3>
            <button class="ve-icon-btn" data-action="cerrar-opcion" title="Cerrar">✕</button>
          </div>
          <div class="ve-sheet-body" id="ve-sheet-body"></div>
          <div class="ve-sheet-footer">
            <button class="ve-btn-danger-soft" data-action="desactivar-opcion" id="ve-btn-desactivar-opt-movil">Desactivar</button>
            <button class="ve-btn-primary" data-action="cerrar-opcion" id="ve-btn-guardar-opt-movil">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="ve-modal-overlay" id="ve-modal-insumo">
      <div class="ve-modal">
        <div class="ve-modal-header"><h3>🥫 Añadir insumo delta</h3></div>
        <div class="ve-modal-body">
          <div class="ve-campo">
            <label>Buscar insumo</label>
            <input type="text" id="ve-insumo-buscar" placeholder="Escribe para buscar..." autocomplete="off">
            <div class="ve-resultado-busqueda" id="ve-insumo-resultados" style="display:none;"></div>
          </div>
          <div class="ve-campo">
            <label>Acción</label>
            <select id="ve-insumo-accion">
              ${ACCIONES_INSUMO.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
            </select>
          </div>
          <div class="ve-campo">
            <label>Cantidad</label>
            <input type="number" id="ve-insumo-cantidad" step="0.1" value="1" min="0">
          </div>
          <div class="ve-aviso info" id="ve-insumo-aviso" style="display:none;">
            ℹ️ <span id="ve-insumo-aviso-texto"></span>
          </div>
        </div>
        <div class="ve-modal-footer">
          <button class="ve-btn-secondary" data-action="cerrar-modal-insumo">Cancelar</button>
          <button class="ve-btn-primary" data-action="confirmar-insumo" id="ve-insumo-confirmar" disabled>Añadir</button>
        </div>
      </div>
    </div>
  `;
}

export function pintarIndicador(estadoGuardado) {
  const el = document.getElementById('ve-indicador');
  if (!el) return;
  el.className = 've-indicador ' + (estadoGuardado || 'limpio');
  if (estadoGuardado === 'limpio') el.textContent = '✓ Guardado';
  else if (estadoGuardado === 'sucio') el.textContent = '● Cambios sin guardar';
  else el.textContent = '⟳ Guardando...';
}

export function pintarLista(variantes, varianteActivaId, filtro, termino) {
  const cont = document.getElementById('ve-lista');
  if (!cont) return;

  const term = (termino || '').toLowerCase();
  const filtradas = (variantes || []).filter(v => {
    const okFiltro = filtro === 'todas' ||
      (filtro === 'activas' && v.activo) ||
      (filtro === 'inactivas' && !v.activo);
    const okTerm = !term || (v.nombre || '').toLowerCase().includes(term);
    return okFiltro && okTerm;
  });

  if (filtradas.length === 0) {
    cont.innerHTML = '<p class="ve-empty-lista">Sin resultados.</p>';
    return;
  }

  cont.innerHTML = filtradas.map(v => {
    const activas = (v.opciones || []).filter(o => o.activo).length;
    const inactivas = (v.opciones || []).length - activas;
    const cls = [
      v.activo ? '' : 'inactiva',
      v.id === varianteActivaId ? 'activo' : ''
    ].filter(Boolean).join(' ');
    return `
      <div class="ve-item ${cls}" data-action="seleccionar-variante" data-id="${_esc(v.id)}">
        <div class="ve-item-top">
          <strong>${_esc(v.nombre || '(sin nombre)')}</strong>
          <span class="ve-tipo-badge">${_tipoLabel(v.tipo)}</span>
        </div>
        <div class="ve-item-meta">
          ${activas} activa${activas !== 1 ? 's' : ''}${inactivas > 0 ? ` · ${inactivas} inactiva${inactivas !== 1 ? 's' : ''}` : ''}
        </div>
      </div>
    `;
  }).join('');
}

export function pintarCentro(variante, validacionVariante) {
  const c = document.getElementById('ve-centro');
  if (!c) return;

  if (!variante) {
    c.innerHTML = `
      <div class="ve-vacio">
        <div class="ve-vacio-icon">🧩</div>
        <p>Selecciona una variante o crea una nueva.</p>
      </div>
    `;
    return;
  }

  const errs = (validacionVariante && validacionVariante.errores) || [];
  const warns = (validacionVariante && validacionVariante.warnings) || [];

  c.innerHTML = `
    ${errs.length ? `
      <div class="ve-aviso error">
        ⚠️ <div>
          <strong>Errores:</strong>
          <ul>${errs.map(e => `<li>${_esc(e)}</li>`).join('')}</ul>
        </div>
      </div>
    ` : ''}
    ${warns.length ? `
      <div class="ve-aviso warn">
        ⚠️ <div>
          <strong>Avisos:</strong>
          <ul>${warns.map(e => `<li>${_esc(e)}</li>`).join('')}</ul>
        </div>
      </div>
    ` : ''}

    <div class="ve-seccion-card">
      <h3>Datos de la variante</h3>
      <div class="ve-campo">
        <label>Nombre</label>
        <input type="text" data-field="var-nombre" value="${_esc(variante.nombre || '')}">
      </div>
      <div class="ve-campo">
        <label>Descripción</label>
        <input type="text" data-field="var-desc" value="${_esc(variante.descripcion || '')}">
      </div>
      <div class="ve-campo">
        <label>Tipo</label>
        <div class="ve-radios">
          <label>
            <input type="radio" name="ve-tipo-var" value="unica" data-field="var-tipo" ${variante.tipo === 'unica' ? 'checked' : ''}>
            <span>Única</span>
          </label>
          <label>
            <input type="radio" name="ve-tipo-var" value="multiple" data-field="var-tipo" ${variante.tipo === 'multiple' ? 'checked' : ''}>
            <span>Múltiple</span>
          </label>
        </div>
      </div>
      <div class="ve-toggle-fila">
        <div><strong>Requerido</strong></div>
        <label class="ve-switch">
          <input type="checkbox" data-field="var-requerido" ${variante.requerido ? 'checked' : ''}>
          <span class="ve-slider"></span>
        </label>
      </div>
      <div class="ve-campo-row">
        <div class="ve-campo">
          <label>Mín. selección</label>
          <input type="number" data-field="var-min" min="0" value="${variante.min_seleccion ?? 0}">
        </div>
        <div class="ve-campo">
          <label>Máx. selección</label>
          <input type="number" data-field="var-max" min="1" value="${variante.max_seleccion ?? 1}">
        </div>
      </div>
      <div class="ve-campo">
        <label>Orden</label>
        <input type="number" data-field="var-orden" value="${variante.orden ?? 0}">
      </div>
      <div class="ve-toggle-fila">
        <div><strong>Activa</strong></div>
        <label class="ve-switch">
          <input type="checkbox" data-field="var-activo" ${variante.activo ? 'checked' : ''}>
          <span class="ve-slider"></span>
        </label>
      </div>
    </div>

    <div class="ve-seccion-card">
      <h3>Opciones (${(variante.opciones || []).length})</h3>
      ${(variante.opciones || []).length === 0 ? `
        <p class="ve-empty-lista">Esta variante no tiene opciones todavía.</p>
      ` : `
        <table class="ve-tabla">
          <thead>
            <tr><th>Nombre</th><th>Δ precio</th><th>Tags</th></tr>
          </thead>
          <tbody>
            ${(variante.opciones || []).map(o => {
              const opActiva = o.activo !== false;
              return `
                <tr class="${opActiva ? '' : 'opcion-inactiva'}" data-action="seleccionar-opcion" data-id="${_esc(o.id)}">
                  <td><strong>${_esc(o.nombre || '(sin nombre)')}</strong></td>
                  <td>${_formatDelta(o.precio_delta)}</td>
                  <td>
                    <div class="ve-chips-mini">
                      ${(o.alergenos || []).map(a => `<span class="ve-chip-mini">${_esc(a)}</span>`).join('')}
                      ${[...(o.requiere || []), ...(o.excluye || [])].map(r => `<span class="ve-chip-mini regla">${_esc(r)}</span>`).join('')}
                      ${(o.insumos_delta || []).length ? `<span class="ve-chip-mini accion">🥫×${o.insumos_delta.length}</span>` : ''}
                      ${(o.pasos_delta || []).length ? `<span class="ve-chip-mini accion">📋×${o.pasos_delta.length}</span>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
      <button class="ve-btn-secondary ve-btn-full" data-action="nueva-opcion" style="margin-top:12px;">+ Añadir opción</button>
      <div class="ve-centro-footer">
        ${variante.activo ? `
          <button class="ve-btn-danger-soft" data-action="desactivar-variante">Desactivar variante</button>
        ` : `
          <button class="ve-btn-secondary" data-action="reactivar-variante">Reactivar variante</button>
        `}
      </div>
    </div>
  `;
}

function _renderEditorOpcion(opcion, validacion, insumosCache, esNueva) {
  const errs = (validacion && validacion.errores) || [];
  const warns = (validacion && validacion.warnings) || [];
  const insumos = Array.isArray(insumosCache) ? insumosCache : [];

  return `
    ${errs.length ? `
      <div class="ve-aviso error">
        ⛔ <div><strong>Errores:</strong>
        <ul>${errs.map(e => `<li>${_esc(e)}</li>`).join('')}</ul></div>
      </div>
    ` : ''}
    ${warns.length ? `
      <div class="ve-aviso warn">
        ⚠️ <div><strong>Avisos:</strong>
        <ul>${warns.map(e => `<li>${_esc(e)}</li>`).join('')}</ul></div>
      </div>
    ` : ''}

    <div class="ve-editor-seccion">
      <h4>🪪 Datos básicos</h4>
      <div class="ve-campo">
        <label>ID</label>
        <input type="text" value="${_esc(opcion.id || '')}" readonly>
      </div>
      <div class="ve-campo">
        <label>Nombre</label>
        <input type="text" data-field="op-nombre" value="${_esc(opcion.nombre || '')}" placeholder="Ej: Cubana">
      </div>
      <div class="ve-campo">
        <label>Descripción</label>
        <input type="text" data-field="op-desc" value="${_esc(opcion.descripcion || '')}">
      </div>
      <div class="ve-campo">
        <label>Δ Precio</label>
        <input type="number" data-field="op-precio" value="${opcion.precio_delta ?? 0}">
      </div>
      <div class="ve-toggle-fila">
        <div><strong>Activa</strong></div>
        <label class="ve-switch">
          <input type="checkbox" data-field="op-activo" ${opcion.activo !== false ? 'checked' : ''}>
          <span class="ve-slider"></span>
        </label>
      </div>
    </div>

    <div class="ve-editor-seccion">
      <h4>⚠️ Alérgenos</h4>
      <div class="ve-chips-select">
        ${ALERGENOS.map(a => `
          <button class="ve-chip-toggle ${(opcion.alergenos || []).includes(a) ? 'on' : ''}"
                  data-action="toggle-alergeno" data-alergeno="${_esc(a)}">
            ${_esc(_slugAlergeno(a))}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="ve-editor-seccion">
      <h4>🔗 Reglas</h4>
      <div class="ve-campo">
        <label>Requiere</label>
        <select data-field="op-requiere-select">
          <option value="">-- Añadir referencia --</option>
        </select>
        <div class="ve-chips-mini" style="margin-top:6px;">
          ${(opcion.requiere || []).map(r => `
            <span class="ve-chip-mini regla">
              ${_esc(r)}
              <button class="ve-chip-quitar" data-action="quitar-regla" data-tipo="requiere" data-id="${_esc(r)}" title="Quitar">✕</button>
            </span>
          `).join('') || '<span class="ve-empty-inline">Sin reglas</span>'}
        </div>
      </div>
      <div class="ve-campo">
        <label>Excluye</label>
        <select data-field="op-excluye-select">
          <option value="">-- Añadir referencia --</option>
        </select>
        <div class="ve-chips-mini" style="margin-top:6px;">
          ${(opcion.excluye || []).map(r => `
            <span class="ve-chip-mini regla">
              ${_esc(r)}
              <button class="ve-chip-quitar" data-action="quitar-regla" data-tipo="excluye" data-id="${_esc(r)}" title="Quitar">✕</button>
            </span>
          `).join('') || '<span class="ve-empty-inline">Sin reglas</span>'}
        </div>
      </div>
    </div>

    <div class="ve-editor-seccion">
      <h4>🥫 Insumos delta</h4>
      ${(opcion.insumos_delta || []).length === 0 ? '<p class="ve-empty-inline">Sin insumos delta. La opción no afecta stock.</p>' : ''}
      ${(opcion.insumos_delta || []).map((d, i) => {
        const ins = insumos.find(x => x.id === d.insumoId);
        const nombre = ins ? ins.nombre : d.insumoId;
        const unidad = ins ? ins.unidad : '';
        return `
          <div class="ve-ajuste-fila">
            <span class="ve-ajuste-info">
              <strong>${_esc(nombre)}</strong> · ${_esc(d.accion)} ${_esc(d.cantidad)} ${_esc(unidad)}
            </span>
            <button class="ve-ajuste-quitar" data-action="quitar-insumo" data-idx="${i}" title="Quitar">✕</button>
          </div>
        `;
      }).join('')}
      <button class="ve-btn-secondary ve-btn-full" data-action="abrir-modal-insumo">+ Añadir insumo delta</button>
    </div>

    <div class="ve-editor-seccion">
      <h4>📋 Pasos delta</h4>
      ${(opcion.pasos_delta || []).length === 0 ? '<p class="ve-empty-inline">Sin pasos delta.</p>' : ''}
      ${(opcion.pasos_delta || []).map((p, i) => `
        <div class="ve-ajuste-fila">
          <span class="ve-ajuste-info">[${_esc(p.accion)}] ${_esc(p.texto)}</span>
          <button class="ve-ajuste-quitar" data-action="quitar-paso" data-idx="${i}" title="Quitar">✕</button>
        </div>
      `).join('')}
      <div class="ve-paso-form">
        <select id="ve-paso-accion">
          ${ACCIONES_PASO.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
        </select>
        <input type="text" id="ve-paso-texto" placeholder="Texto del paso">
        <select id="ve-paso-posicion">
          ${POSICIONES_PASO.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
        </select>
        <button class="ve-btn-secondary" data-action="agregar-paso" title="Agregar paso">+</button>
      </div>
    </div>
  `;
}

export function pintarPanelOpcion(opcion, validacion, insumosCache, esNueva) {
  const body = document.getElementById('ve-panel-opt-body');
  const footer = document.getElementById('ve-panel-opt-footer');
  const titulo = document.getElementById('ve-panel-opt-title');
  const btnCerrar = document.getElementById('ve-panel-opt-close');
  const btnDesactivar = document.getElementById('ve-btn-desactivar-opt-desktop');

  if (!body || !footer || !titulo) return;

  if (!opcion) {
    titulo.textContent = 'Editor de opción';
    if (btnCerrar) btnCerrar.style.display = 'none';
    body.innerHTML = `
      <div class="ve-vacio">
        <div class="ve-vacio-icon">✏️</div>
        <p>Selecciona una opción de la tabla para editarla.</p>
      </div>
    `;
    footer.style.display = 'none';
    return;
  }

  titulo.textContent = opcion.nombre || 'Nueva opción';
  if (btnCerrar) btnCerrar.style.display = 'flex';
  body.innerHTML = `<div class="ve-editor">${_renderEditorOpcion(opcion, validacion, insumosCache, esNueva)}</div>`;
  footer.style.display = 'flex';
  if (btnDesactivar) btnDesactivar.style.display = esNueva ? 'none' : 'inline-block';
}

export function pintarPills(variantes, varianteActivaId) {
  const cont = document.getElementById('ve-pills');
  if (!cont) return;
  if (!variantes || variantes.length === 0) {
    cont.innerHTML = '';
    return;
  }
  cont.innerHTML = variantes.map(v => `
    <button class="ve-pill ${v.id === varianteActivaId ? 'activo' : ''} ${v.activo ? '' : 'inactiva'}"
            data-action="seleccionar-variante" data-id="${_esc(v.id)}">
      ${_esc(v.nombre || '(sin nombre)')}
    </button>
  `).join('');
}

export function pintarCards(variante) {
  const cont = document.getElementById('ve-cards');
  if (!cont) return;

  if (!variante) {
    cont.innerHTML = `
      <div class="ve-vacio">
        <div class="ve-vacio-icon">🧩</div>
        <p>Selecciona una variante para ver sus opciones.</p>
      </div>
    `;
    return;
  }

  const v = variante;
  const opciones = v.opciones || [];

  cont.innerHTML = `
    <div class="ve-seccion-card">
      <h3>${_esc(v.nombre || '(sin nombre)')}</h3>
      <div class="ve-card-meta">
        ${_tipoLabel(v.tipo)} · ${v.requerido ? 'Requerida' : 'Opcional'} · ${v.min_seleccion ?? 0}-${v.max_seleccion ?? 1}
      </div>
    </div>

    <button class="ve-btn-primary ve-btn-full" data-action="nueva-opcion" style="margin-bottom:14px;">
      + Nueva opción
    </button>

    <h4 class="ve-cards-titulo">Opciones (${opciones.length})</h4>
    ${opciones.map(o => `
      <div class="ve-card-opcion ${o.activo === false ? 'inactiva' : ''}"
           data-action="seleccionar-opcion" data-id="${_esc(o.id)}">
        <div class="ve-card-top">
          <strong>${_esc(o.nombre || '(sin nombre)')}</strong>
          <span class="ve-card-precio">${_formatDelta(o.precio_delta)}</span>
        </div>
        ${o.descripcion ? `<div class="ve-card-desc">${_esc(o.descripcion)}</div>` : ''}
        <div class="ve-chips-mini">
          ${(o.alergenos || []).map(a => `<span class="ve-chip-mini">⚠️ ${_esc(a)}</span>`).join('')}
          ${(o.excluye || []).map(r => `<span class="ve-chip-mini regla">⊘ ${_esc(r)}</span>`).join('')}
          ${(o.insumos_delta || []).map(d => `<span class="ve-chip-mini accion">🥫 ${_esc(d.accion)} ${_esc(d.cantidad)}</span>`).join('')}
        </div>
      </div>
    `).join('')}
  `;
}

export function pintarSheet(opcion, validacion, insumosCache, esNueva) {
  const body = document.getElementById('ve-sheet-body');
  const titulo = document.getElementById('ve-sheet-title');
  const btnDesactivar = document.getElementById('ve-btn-desactivar-opt-movil');
  if (!body || !titulo) return;

  if (!opcion) {
    body.innerHTML = '';
    titulo.textContent = 'Editar opción';
    return;
  }

  titulo.textContent = opcion.nombre || 'Nueva opción';
  body.innerHTML = `<div class="ve-editor">${_renderEditorOpcion(opcion, validacion, insumosCache, esNueva)}</div>`;
  if (btnDesactivar) btnDesactivar.style.display = esNueva ? 'none' : 'inline-block';
}

export function abrirSheet() {
  document.getElementById('ve-sheet')?.classList.add('activo');
  document.querySelector('.ve-sheet-overlay')?.classList.add('activo');
}

export function cerrarSheet() {
  document.getElementById('ve-sheet')?.classList.remove('activo');
  document.querySelector('.ve-sheet-overlay')?.classList.remove('activo');
}

export function abrirModalInsumo() {
  const modal = document.getElementById('ve-modal-insumo');
  if (!modal) return;
  document.getElementById('ve-insumo-buscar').value = '';
  document.getElementById('ve-insumo-resultados').innerHTML = '';
  document.getElementById('ve-insumo-resultados').style.display = 'none';
  document.getElementById('ve-insumo-accion').value = 'sumar';
  document.getElementById('ve-insumo-cantidad').value = '1';
  document.getElementById('ve-insumo-aviso').style.display = 'none';
  document.getElementById('ve-insumo-confirmar').disabled = true;
  modal.classList.add('activo');
  setTimeout(() => document.getElementById('ve-insumo-buscar')?.focus(), 60);
}

export function cerrarModalInsumo() {
  document.getElementById('ve-modal-insumo')?.classList.remove('activo');
}

export function pintarResultadosInsumo(insumos, termino) {
  const cont = document.getElementById('ve-insumo-resultados');
  if (!cont) return;

  const term = (termino || '').toLowerCase().trim();
  if (!term) {
    cont.innerHTML = '';
    cont.style.display = 'none';
    return;
  }

  const matches = (insumos || []).filter(i => (i.nombre || '').toLowerCase().includes(term));
  if (matches.length === 0) {
    cont.innerHTML = '<div class="ve-resultado-item sin-match">Sin resultados</div>';
    cont.style.display = 'block';
    return;
  }

  cont.innerHTML = matches.map(i => `
    <div class="ve-resultado-item" data-action="seleccionar-insumo-modal" data-insumo-id="${_esc(i.id)}">
      ${_esc(i.nombre)}
      <span class="ve-resultado-unidad">${_esc(i.unidad)}</span>
    </div>
  `).join('');
  cont.style.display = 'block';
}

export function ocultarResultadosInsumo() {
  const cont = document.getElementById('ve-insumo-resultados');
  if (cont) cont.style.display = 'none';
}

export function marcarInsumoSeleccionado(nombre, unidad) {
  const buscador = document.getElementById('ve-insumo-buscar');
  const aviso = document.getElementById('ve-insumo-aviso');
  const texto = document.getElementById('ve-insumo-aviso-texto');
  const btn = document.getElementById('ve-insumo-confirmar');
  if (buscador) buscador.value = nombre;
  if (aviso) aviso.style.display = 'flex';
  if (texto) texto.textContent = `Unidad del insumo: ${unidad}. El delta se expresa en esta misma unidad.`;
  if (btn) btn.disabled = false;
  ocultarResultadosInsumo();
  setTimeout(() => document.getElementById('ve-insumo-cantidad')?.focus(), 50);
}

export function leerModalInsumo() {
  return {
    accion: document.getElementById('ve-insumo-accion')?.value || 'sumar',
    cantidad: parseFloat(document.getElementById('ve-insumo-cantidad')?.value) || 0
  };
}