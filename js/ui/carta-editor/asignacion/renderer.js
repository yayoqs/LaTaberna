/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · ASIGNACIÓN SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/asignacion/renderer.js
   Versión: 1.0.0
   Propósito: Construcción del DOM y pintado del Modo Variantes.
              Sin lógica de negocio: recibe datos ya preparados
              y los pinta. Toda interacción va por data-action y
              se delega al ciclo de vida.
   v1.0.0: creación inicial.
   ================================================================ */

import * as validaciones from './validaciones.js';

/* ── Helpers de escape ─────────────────────────────────── */

function esc(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Estructura base del modo ──────────────────────────── */

export function montarEstructura(contenedor) {
  contenedor.innerHTML = `
    <div class="asig-toolbar">
      <div class="asig-buscador">
        <span>🔍</span>
        <input type="text" id="asig-buscar" placeholder="Buscar producto por nombre...">
      </div>
      <select id="asig-filtro-categoria">
        <option value="todas">Todas las categorías</option>
      </select>
      <span class="asig-contador" id="asig-contador-productos">0 productos</span>
    </div>

    <div class="asig-tabla-wrap">
      <table class="asig-tabla">
        <thead>
          <tr>
            <th class="col-producto">Producto</th>
            <th>Variantes asignadas</th>
          </tr>
        </thead>
        <tbody id="asig-cuerpo-tabla"></tbody>
      </table>
    </div>

    <aside class="asig-panel-lateral" id="asig-panel-lateral">
      <div class="asig-panel-header">
        <h3 id="asig-panel-titulo">Variante</h3>
        <button class="asig-btn-cerrar" data-action="asig-cerrar-panel" title="Cerrar">✕</button>
      </div>
      <div class="asig-panel-body" id="asig-panel-body"></div>
    </aside>

    <div class="asig-modal-overlay" id="asig-modal-agregar">
      <div class="asig-modal">
        <div class="asig-modal-header">
          <h3 id="asig-modal-agregar-titulo">Añadir variante</h3>
          <button class="asig-btn-cerrar" data-action="asig-cerrar-modal-agregar" title="Cerrar">✕</button>
        </div>
        <div class="asig-modal-body" id="asig-modal-agregar-body"></div>
        <div class="asig-modal-footer">
          <button class="asig-btn-secondary" data-action="asig-cerrar-modal-agregar">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="asig-modal-overlay" id="asig-modal-aviso">
      <div class="asig-aviso-modal">
        <div class="asig-aviso-cabecera">
          <span class="asig-aviso-icono">⚠️</span>
          <h3>Advertencia al asignar</h3>
        </div>
        <div class="asig-aviso-body" id="asig-aviso-body"></div>
        <div class="asig-aviso-footer">
          <button class="asig-btn-secondary" data-action="asig-cancelar-aviso">Cancelar</button>
          <button class="asig-btn-primary" data-action="asig-confirmar-aviso">Asignar de todas formas</button>
        </div>
      </div>
    </div>
  `;
}

/* ── Filtros: select de categorías ─────────────────────── */

export function pintarOpcionesCategoria(categorias, categoriaActual) {
  const select = document.getElementById('asig-filtro-categoria');
  if (!select) return;

  const opciones = ['<option value="todas">Todas las categorías</option>']
    .concat(categorias.map(c => `<option value="${esc(c)}">${esc(c)}</option>`))
    .join('');

  select.innerHTML = opciones;
  if (categoriaActual && (categoriaActual === 'todas' || categorias.includes(categoriaActual))) {
    select.value = categoriaActual;
  } else {
    select.value = 'todas';
  }
}

/* ── Tabla principal ───────────────────────────────────── */

export function pintarTabla(productos, getVariantePorId, tieneReceta) {
  const cuerpo = document.getElementById('asig-cuerpo-tabla');
  if (!cuerpo) return;

  const contador = document.getElementById('asig-contador-productos');
  if (contador) {
    contador.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;
  }

  if (productos.length === 0) {
    cuerpo.innerHTML = `
      <tr>
        <td colspan="2">
          <div class="asig-vacio">
            <div class="asig-vacio-icono">🔍</div>
            <h3>Sin resultados</h3>
            <p>Ajusta los filtros o la búsqueda.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  cuerpo.innerHTML = productos.map(p => _filaProducto(p, getVariantePorId, tieneReceta)).join('');
}

function _filaProducto(producto, getVariantePorId, tieneReceta) {
  const variantesIds = Array.isArray(producto.variantes_ids) ? producto.variantes_ids : [];
  const conReceta = tieneReceta(producto.id);

  const chipsHTML = variantesIds.length > 0
    ? variantesIds.map((vid, idx) => _chipVariante(vid, producto.id, idx, variantesIds.length, getVariantePorId)).join('')
    : '<span class="asig-sin-variantes">Sin variantes asignadas</span>';

  const claseFila = [
    'asig-fila-producto',
    variantesIds.length === 0 ? 'sin-variantes' : '',
    _tieneAdvertenciaInsumos(producto, getVariantePorId, conReceta) ? 'con-advertencia' : ''
  ].filter(Boolean).join(' ');

  const badgeSinReceta = !conReceta
    ? '<span class="asig-sin-receta">Sin receta base</span>'
    : '';

  return `
    <tr class="${claseFila}">
      <td>
        <div class="asig-producto-info">
          <strong>${esc(producto.nombre || '(sin nombre)')}</strong>
          <div class="asig-producto-meta">${esc(producto.categoria || 'sin categoría')}</div>
          ${badgeSinReceta}
        </div>
      </td>
      <td>
        <div class="asig-variantes-chips">
          ${chipsHTML}
          <button class="asig-btn-add-variante"
                  data-action="asig-abrir-modal-agregar"
                  data-producto-id="${esc(producto.id)}">
            + Añadir variante
          </button>
        </div>
      </td>
    </tr>
  `;
}

function _chipVariante(varianteId, productoId, idx, total, getVariantePorId) {
  const variante = getVariantePorId(varianteId);
  if (!variante) return '';

  const inactiva = validaciones.esVarianteInactiva(variante);
  const { opcionesActivas } = validaciones.resumenVariante(variante);

  const tooltip = inactiva
    ? 'Variante inactiva. No aparecerá en la carta del mesero ni del cliente.'
    : '';

  const claseChip = `asig-chip-variante${inactiva ? ' inactiva' : ''}`;
  const tituloAttr = tooltip ? ` title="${esc(tooltip)}"` : '';

  const puedeSubir = idx > 0;
  const puedeBajar = idx < total - 1;

  return `
    <div class="${claseChip}"${tituloAttr}
         data-variante-id="${esc(varianteId)}"
         data-producto-id="${esc(productoId)}">
      <span class="asig-chip-nombre" data-action="asig-abrir-panel">
        ${esc(variante.nombre || '(sin nombre)')}
        <span class="asig-chip-contador">· ${opcionesActivas}</span>
      </span>
      <div class="asig-chip-acciones">
        <button class="asig-chip-btn"
                data-action="asig-subir-variante"
                title="Subir"
                ${puedeSubir ? '' : 'disabled'}>▲</button>
        <button class="asig-chip-btn"
                data-action="asig-bajar-variante"
                title="Bajar"
                ${puedeBajar ? '' : 'disabled'}>▼</button>
        <button class="asig-chip-btn quitar"
                data-action="asig-quitar-variante"
                title="Quitar">✕</button>
      </div>
    </div>
  `;
}

function _tieneAdvertenciaInsumos(producto, getVariantePorId, conReceta) {
  if (conReceta) return false;
  const ids = Array.isArray(producto.variantes_ids) ? producto.variantes_ids : [];
  return ids.some(vid => {
    const v = getVariantePorId(vid);
    if (!v) return false;
    return (v.opciones || []).some(o =>
      o.activo !== false &&
      (o.insumos_delta || []).some(d => d.accion === 'quitar')
    );
  });
}

/* ── Panel lateral ─────────────────────────────────────── */

export function pintarPanelLateral(variante, producto, tieneRecetaProducto) {
  const titulo = document.getElementById('asig-panel-titulo');
  const body = document.getElementById('asig-panel-body');
  if (!titulo || !body) return;

  titulo.textContent = variante.nombre || 'Variante';

  const opciones = validaciones.describirOpciones(variante);

  const avisoInactiva = validaciones.esVarianteInactiva(variante)
    ? `
      <div class="asig-panel-aviso inactiva">
        💤 Esta variante está inactiva. No aparecerá en la carta del mesero ni del cliente hasta que la reactives.
      </div>
    `
    : '';

  const advertencia = validaciones.detectarInsumosQuitarSinReceta(producto, variante);
  const avisoInsumos = advertencia
    ? `
      <div class="asig-panel-aviso error">
        ⚠️ Este producto no tiene receta base. Las opciones que quitan insumos no se aplicarán al descontar stock. Las que suman sí.
      </div>
    `
    : '';

  const opcionesHTML = opciones.length > 0
    ? opciones.map(op => _cardOpcion(op)).join('')
    : '<p class="asig-panel-vacio">Esta variante no tiene opciones configuradas.</p>';

  body.innerHTML = avisoInactiva + avisoInsumos + opcionesHTML;
}

function _cardOpcion(op) {
  const claseCard = op.activo ? 'asig-opcion-card' : 'asig-opcion-card inactiva';

  const chipsHTML = op.chips.length > 0
    ? `<div class="asig-chips-mini">${
        op.chips.map(c => `<span class="asig-chip-mini ${esc(c.tipo)}">${esc(c.texto)}</span>`).join('')
      }</div>`
    : '';

  return `
    <div class="${claseCard}">
      <div class="asig-opcion-top">
        <strong>${esc(op.nombre || '(sin nombre)')}</strong>
        <span class="asig-opcion-precio">${esc(validaciones.formatearDelta(op.precio_delta))}</span>
      </div>
      ${op.descripcion ? `<div class="asig-opcion-desc">${esc(op.descripcion)}</div>` : ''}
      ${chipsHTML}
    </div>
  `;
}

export function abrirPanelLateral() {
  document.getElementById('asig-panel-lateral')?.classList.add('abierto');
}

export function cerrarPanelLateral() {
  document.getElementById('asig-panel-lateral')?.classList.remove('abierto');
}

/* ── Modal agregar variante ────────────────────────────── */

export function pintarModalAgregar(producto, disponibles, yaAsignadas) {
  const titulo = document.getElementById('asig-modal-agregar-titulo');
  const body = document.getElementById('asig-modal-agregar-body');
  if (!titulo || !body) return;

  titulo.textContent = `Añadir variante a "${producto.nombre || 'producto'}"`;

  if (disponibles.length === 0 && yaAsignadas.length === 0) {
    body.innerHTML = `
      <p class="asig-modal-vacio">
        No hay variantes en el catálogo maestro. Crear una desde
        <strong>Config → Catálogo → Gestionar variantes</strong>.
      </p>
    `;
    return;
  }

  const htmlDisponibles = disponibles.length > 0
    ? disponibles.map(v => {
        const { opcionesActivas, tipoLabel } = validaciones.resumenVariante(v);
        return `
          <div class="asig-opcion-lista" data-action="asig-seleccionar-variante" data-variante-id="${esc(v.id)}">
            <div class="asig-opcion-lista-info">
              <strong>${esc(v.nombre || '(sin nombre)')}</strong>
              <span>${opcionesActivas} opciones · ${esc(tipoLabel)}</span>
            </div>
            <span class="asig-opcion-lista-add">+</span>
          </div>
        `;
      }).join('')
    : '<p class="asig-modal-vacio-menor">Todas las variantes activas ya están asignadas a este producto.</p>';

  const htmlAsignadas = yaAsignadas.length > 0
    ? `
      <h4 class="asig-modal-subtitulo">Ya asignadas</h4>
      ${yaAsignadas.map(v => `
        <div class="asig-opcion-lista deshabilitada">
          <div class="asig-opcion-lista-info">
            <strong>${esc(v.nombre || '(sin nombre)')}</strong>
            <span>Ya asignada</span>
          </div>
          <span class="asig-opcion-lista-check">✓</span>
        </div>
      `).join('')}
    `
    : '';

  body.innerHTML = htmlDisponibles + htmlAsignadas;
}

export function abrirModalAgregar() {
  document.getElementById('asig-modal-agregar')?.classList.add('activo');
}

export function cerrarModalAgregar() {
  document.getElementById('asig-modal-agregar')?.classList.remove('activo');
}

/* ── Modal de advertencia ──────────────────────────────── */

export function pintarModalAviso(producto, variante, opcionesProblematicas) {
  const body = document.getElementById('asig-aviso-body');
  if (!body) return;

  const lista = opcionesProblematicas
    .map(o => `<li><strong>${esc(o.nombre)}</strong> intenta quitar insumos</li>`)
    .join('');

  body.innerHTML = `
    La variante <strong>"${esc(variante.nombre)}"</strong> tiene opciones con acción de quitar insumos:
    <ul>${lista}</ul>
    Como el producto <strong>"${esc(producto.nombre)}"</strong> no tiene receta base, esas restas no aplicarán al descontar stock. Las opciones que suman sí funcionarán.
    <br><br>
    ¿Asignar de todas formas?
  `;
}

export function abrirModalAviso() {
  document.getElementById('asig-modal-aviso')?.classList.add('activo');
}

export function cerrarModalAviso() {
  document.getElementById('asig-modal-aviso')?.classList.remove('activo');
}

/* ── Estado vacío global ───────────────────────────────── */

export function pintarSinProductos() {
  const cuerpo = document.getElementById('asig-cuerpo-tabla');
  if (!cuerpo) return;
  cuerpo.innerHTML = `
    <tr>
      <td colspan="2">
        <div class="asig-vacio">
          <div class="asig-vacio-icono">📦</div>
          <h3>Sin productos en el catálogo</h3>
          <p>Los productos se crean desde el módulo de Recetas.</p>
        </div>
      </td>
    </tr>
  `;
}