/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/modal-opciones.js
   Versión: 1.1.0
   Propósito: Modal de confirmación de item del cliente. Se abre al
              tocar cualquier producto del menú digital, tenga o no
              variantes. Si el producto es personalizable, muestra
              las variantes para selección. Si no, muestra solo
              cantidad. En ambos casos el pie es idéntico (total,
              cancelar, agregar).
              v1.1.0: soporte para productos sin variantes (mini-modal).
                      Unifica el flujo: siempre hay una confirmación,
                      siempre hay cantidad. Cumple con el prototipo v3
                      aprobado por Coordinación.
   v1.0.0: creación inicial con soporte solo para productos con
           variantes.

   Contrato del item (ARQUITECTURA-VARIANTES.md §5):
     {
       tipo: 'producto', prodId, nombre, precio_base,
       opciones: [{ varianteId, varianteNombre, opcionId,
                    opcionNombre, precio_delta, alergenos,
                    insumos_delta, pasos_delta }],
       alergias_manuales: string[],
       precio, precio_unitario, precio_total,
       categoria, destino, qty, obs,
       enviado: false, enviadoA: null, enviadoTs: null,
       persona: 'General'
     }

   Ciclo de vida:
     · _asegurarVista() — crea el overlay una sola vez.
     · activar()        — se suscribe a cliente:producto_con_variantes.
     · limpiar()        — aborta AbortController y desuscribe.
     · mostrar(p)       — resuelve variantes (si hay), pinta y abre.
     · ocultar()        — cierra y limpia estado local.

   Emite:
     · cliente:producto_agregado_a_orden  { item }

   Consume:
     · cliente:producto_con_variantes     { producto, variantes }

   Dependencias:
     · Store v2.0.13+ (slice `variantes`)
     · js/dominio/alergenos.js (enum ALERGENOS)
     · js/modulos/cliente/orden.js
     · js/modulos/cliente/alergias-cliente.js
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { Auth } from '../../auth.js';
import { mostrarToast, formatearDinero } from '../../utils.js';
import { Orden } from './orden.js';
import { AlergiasCliente } from './alergias-cliente.js';

const DESTINOS_VALIDOS = ['cocina', 'barra', 'ambos'];

const ModalOpciones = (() => {
  let _vista = null;
  let _activada = false;
  let _abortController = null;
  let _unsubs = [];

  let _producto = null;
  let _variantes = [];       // puede estar vacío para productos sin variantes
  let _selecciones = {};
  let _cantidad = 1;

  function _asegurarVista() {
    if (_vista) return;

    let overlay = document.getElementById('modalOpcionesCliente');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalOpcionesCliente';
      overlay.className = 'modal-overlay-cliente modal-opciones-cliente';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Confirmar producto');
      overlay.innerHTML = `
        <div class="moc-modal">
          <div class="moc-handle"></div>
          <div class="moc-header">
            <div class="moc-header-info">
              <div class="moc-nombre" id="mocNombre">Producto</div>
              <div class="moc-precio-base" id="mocPrecioBase">Base $0</div>
            </div>
            <button class="moc-cerrar" id="mocBtnCerrar" aria-label="Cerrar">✕</button>
          </div>
          <div class="moc-body" id="mocBody"></div>
          <div class="moc-footer">
            <div class="moc-total">
              <span>Total</span>
              <span class="moc-total-monto" id="mocTotal">$0</span>
            </div>
            <div class="moc-botones">
              <button class="moc-btn moc-btn-cancelar" id="mocBtnCancelar">Cancelar</button>
              <button class="moc-btn moc-btn-agregar" id="mocBtnAgregar">✓ Agregar a mi orden</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    _vista = overlay;
  }

  function _esVistaAbierta() {
    return _vista && _vista.classList.contains('active');
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _asegurarVista();

    _abortController = new AbortController();
    const { signal } = _abortController;

    document.getElementById('mocBtnCerrar').addEventListener('click', ocultar, { signal });
    document.getElementById('mocBtnCancelar').addEventListener('click', ocultar, { signal });
    document.getElementById('mocBtnAgregar').addEventListener('click', _agregar, { signal });

    _vista.addEventListener('click', (e) => {
      if (e.target === _vista) ocultar();
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _esVistaAbierta()) ocultar();
    }, { signal });

    const unsub = EventBus.on('cliente:producto_con_variantes', (payload) => {
      const producto = payload?.producto;
      if (!producto) {
        Logger.warn('[ModalOpciones] cliente:producto_con_variantes sin producto.');
        return;
      }
      mostrar(producto);
    });
    _unsubs.push(unsub);

    Logger.info('[ModalOpciones] Activado.');
  }

  function limpiar() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _unsubs.forEach(fn => {
      try { fn(); } catch (e) {
        Logger.warn('[ModalOpciones] Error al desuscribir:', e);
      }
    });
    _unsubs = [];

    if (_vista) _vista.classList.remove('active');

    _producto = null;
    _variantes = [];
    _selecciones = {};
    _cantidad = 1;
    _activada = false;

    Logger.info('[ModalOpciones] Limpiado.');
  }

  function mostrar(producto) {
    const usuario = Auth.obtenerUsuarioActual?.();
    if (!usuario) {
      Logger.warn('[ModalOpciones] Sin usuario logueado, se ignora la apertura.');
      return;
    }

    if (!DESTINOS_VALIDOS.includes(producto.destino)) {
      mostrarToast('error', 'Este producto no está disponible por el momento.');
      return;
    }

    // Resolver variantes activas (puede quedar vacío).
    const variantesIds = _normalizarVariantesIds(producto.variantes_ids);
    let variantesActivas = [];
    if (variantesIds.length > 0) {
      const todasVariantes = Store.obtenerEstado().variantes || [];
      variantesActivas = variantesIds
        .map(id => todasVariantes.find(v => v.id === id))
        .filter(v => v && v.activo !== false)
        .map(v => ({
          ...v,
          opciones: (v.opciones || []).filter(o => o.activo !== false)
        }))
        .filter(v => v.opciones.length > 0);
    }

    _producto = producto;
    _variantes = variantesActivas;
    _selecciones = {};
    _variantes.forEach(v => { _selecciones[v.id] = new Set(); });
    _cantidad = 1;

    _asegurarVista();
    _render();
    _vista.classList.add('active');
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    _producto = null;
    _variantes = [];
    _selecciones = {};
    _cantidad = 1;
  }

  function _render() {
    if (!_producto || !_vista) return;

    document.getElementById('mocNombre').textContent = _producto.nombre;
    document.getElementById('mocPrecioBase').textContent = 'Base ' + formatearDinero(_producto.precio);

    const body = document.getElementById('mocBody');
    body.innerHTML = '';

    // Variantes (solo si hay)
    _variantes.forEach(v => {
      const sec = document.createElement('div');
      sec.className = 'moc-variante';
      sec.innerHTML = `
        <div class="moc-var-header">
          <span class="moc-var-titulo">${_esc(v.nombre)}</span>
          ${v.requerido ? '<span class="moc-var-req">*</span>' : ''}
          <span class="moc-var-tipo${v.tipo === 'multiple' ? ' multiple' : ''}">${v.tipo === 'unica' ? 'única' : 'múltiple'}</span>
        </div>
        <div class="moc-opciones"></div>
      `;
      const cont = sec.querySelector('.moc-opciones');
      cont.innerHTML = _htmlOpciones(v);
      cont.addEventListener('click', (e) => {
        const card = e.target.closest('.moc-opcion');
        if (!card || card.classList.contains('deshabilitada')) return;
        _toggleOpcion(v.id, card.dataset.opcion);
      });
      body.appendChild(sec);
    });

    // Aviso de alergias declaradas (común a ambos modos)
    if (AlergiasCliente.cantidad() > 0) {
      const aviso = document.createElement('div');
      aviso.className = 'moc-aviso-alergias';
      aviso.innerHTML = `
        <span>⚠</span>
        <span class="texto">Tienes declarada: ${AlergiasCliente.obtener().map(a => AlergiasCliente.etiqueta(a)).join(', ')}</span>
        <button type="button" id="mocBtnEditarAlergias">Editar</button>
      `;
      body.appendChild(aviso);
      aviso.querySelector('#mocBtnEditarAlergias').addEventListener('click', () => {
        AlergiasCliente.mostrar();
      });
    }

    // Cantidad (común a ambos modos)
    const secC = document.createElement('div');
    secC.className = 'moc-seccion';
    secC.innerHTML = `
      <div class="moc-cantidad-fila">
        <div class="moc-cantidad-label">Cantidad</div>
        <div class="moc-cantidad-control">
          <button class="moc-cantidad-btn" id="mocBtnMenos" aria-label="Restar">−</button>
          <div class="moc-cantidad-valor" id="mocCantidad">1</div>
          <button class="moc-cantidad-btn" id="mocBtnMas" aria-label="Sumar">+</button>
        </div>
      </div>
    `;
    body.appendChild(secC);
    document.getElementById('mocBtnMenos').addEventListener('click', () => _cambiarCantidad(-1));
    document.getElementById('mocBtnMas').addEventListener('click', () => _cambiarCantidad(1));

    _actualizarCantidadUI();
    _actualizarTotal();
  }

  function _htmlOpciones(v) {
    const sel = _selecciones[v.id] || new Set();
    return v.opciones.map(o => {
      const isSel = sel.has(o.id);
      const delta = o.precio_delta || 0;
      const dc = delta > 0 ? '' : delta < 0 ? 'negativo' : 'cero';
      const dt = delta === 0
        ? 'Incluido'
        : delta > 0
          ? '+' + formatearDinero(delta)
          : '-' + formatearDinero(Math.abs(delta));

      const excl = _esExcluida(o);
      const reqFalta = _tieneRequisitoFaltante(o);

      const clases = ['moc-opcion',
        isSel ? 'seleccionada' : '',
        excl ? 'deshabilitada' : '',
        reqFalta ? 'requerida-falta' : ''
      ].filter(Boolean).join(' ');

      const checkClass = v.tipo === 'multiple' ? 'moc-check checkbox' : 'moc-check';
      const warn = reqFalta ? '<span class="warn-icon">⚠</span>' : '';
      const exclIco = excl ? '<span class="moc-exclusion-icon">⊘ excluida</span>' : '';
      const reqIco = reqFalta ? '<span class="moc-req-aviso">requiere otra</span>' : '';

      return `
        <div class="${clases}" data-opcion="${_esc(o.id)}">
          <div class="${checkClass}">✓</div>
          <div class="moc-opcion-info">
            <div class="moc-opcion-nombre">${_esc(o.nombre)} ${warn}</div>
            ${o.descripcion ? `<div class="moc-opcion-desc">${_esc(o.descripcion)}</div>` : ''}
          </div>
          <div class="moc-opcion-delta ${dc}">${dt}</div>
          ${exclIco}${reqIco}
        </div>
      `;
    }).join('');
  }

  function _esExcluida(op) {
    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (!s) continue;
      for (const id of s) {
        if (id === op.id) continue;
        const o = v.opciones.find(x => x.id === id);
        if (o && Array.isArray(o.excluye) && o.excluye.includes(op.id)) return true;
      }
    }
    return false;
  }

  function _tieneRequisitoFaltante(op) {
    if (!Array.isArray(op.requiere) || op.requiere.length === 0) return false;
    return op.requiere.some(id => !_estaSeleccionada(id));
  }

  function _estaSeleccionada(id) {
    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (s && s.has(id)) return true;
    }
    return false;
  }

  function _toggleOpcion(vid, oid) {
    const v = _variantes.find(x => x.id === vid);
    if (!v) return;
    const s = _selecciones[vid];

    if (v.tipo === 'unica') {
      if (s.has(oid)) s.delete(oid);
      else { s.clear(); s.add(oid); }
    } else {
      if (s.has(oid)) s.delete(oid);
      else {
        const max = v.max_seleccion || 1;
        if (s.size >= max) {
          mostrarToast('warning', 'Máximo ' + max + ' opciones en ' + v.nombre + '.');
          return;
        }
        s.add(oid);
      }
    }

    _limpiarExcluidas();
    _render();
  }

  function _limpiarExcluidas() {
    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (!s) continue;
      [...s].forEach(id => {
        const op = v.opciones.find(x => x.id === id);
        if (op && _esExcluida(op)) s.delete(id);
      });
    }
  }

  function _calcularPrecioUnitario() {
    let total = _producto.precio || 0;
    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (!s) continue;
      for (const id of s) {
        const o = v.opciones.find(x => x.id === id);
        if (o) total += (o.precio_delta || 0);
      }
    }
    return total;
  }

  function _actualizarTotal() {
    const u = _calcularPrecioUnitario();
    const total = u * _cantidad;
    const el = document.getElementById('mocTotal');
    if (el) el.textContent = formatearDinero(total);
  }

  function _cambiarCantidad(d) {
    _cantidad = Math.max(1, Math.min(20, _cantidad + d));
    _actualizarCantidadUI();
    _actualizarTotal();
  }

  function _actualizarCantidadUI() {
    const el = document.getElementById('mocCantidad');
    if (el) el.textContent = _cantidad;
    const bm = document.getElementById('mocBtnMenos');
    const bp = document.getElementById('mocBtnMas');
    if (bm) bm.disabled = _cantidad <= 1;
    if (bp) bp.disabled = _cantidad >= 20;
  }

  function _validar() {
    const errores = [];

    for (const v of _variantes) {
      if (!v.requerido) continue;
      const s = _selecciones[v.id];
      const c = s ? s.size : 0;
      const min = v.min_seleccion || 0;
      if (c < min) errores.push('Falta seleccionar ' + v.nombre);
    }

    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (!s) continue;
      for (const id of s) {
        const o = v.opciones.find(x => x.id === id);
        if (!o || !Array.isArray(o.requiere) || o.requiere.length === 0) continue;
        for (const reqId of o.requiere) {
          if (!_estaSeleccionada(reqId)) {
            errores.push('"' + o.nombre + '" requiere "' + _nombreOpcion(reqId) + '"');
          }
        }
      }
    }

    return { ok: errores.length === 0, errores };
  }

  function _nombreOpcion(id) {
    for (const v of _variantes) {
      const o = v.opciones.find(x => x.id === id);
      if (o) return o.nombre;
    }
    return id;
  }

  function _agregar() {
    const val = _validar();
    if (!val.ok) {
      mostrarToast('warning', '⚠ ' + val.errores[0]);
      return;
    }

    // Snapshot ordenado por índice de variante y de opción.
    const opcionesSnapshot = [];
    for (const v of _variantes) {
      const s = _selecciones[v.id];
      if (!s || s.size === 0) continue;
      const ordenadas = [...s]
        .map(id => ({ id, idx: v.opciones.findIndex(o => o.id === id) }))
        .filter(x => x.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      for (const { id } of ordenadas) {
        const o = v.opciones.find(x => x.id === id);
        if (!o) continue;
        opcionesSnapshot.push({
          varianteId: v.id,
          varianteNombre: v.nombre,
          opcionId: o.id,
          opcionNombre: o.nombre,
          precio_delta: o.precio_delta || 0,
          alergenos: Array.isArray(o.alergenos) ? o.alergenos : [],
          insumos_delta: Array.isArray(o.insumos_delta) ? o.insumos_delta : [],
          pasos_delta: Array.isArray(o.pasos_delta) ? o.pasos_delta : []
        });
      }
    }

    const precioUnitario = _calcularPrecioUnitario();
    const item = {
      tipo: 'producto',
      prodId: _producto.id,
      nombre: _producto.nombre,
      precio_base: _producto.precio || 0,
      opciones: opcionesSnapshot,
      alergias_manuales: AlergiasCliente.obtener(),
      precio: precioUnitario,
      precio_unitario: precioUnitario,
      precio_total: precioUnitario * _cantidad,
      categoria: _producto.categoria,
      destino: _producto.destino,
      qty: _cantidad,
      obs: '',
      enviado: false,
      enviadoA: null,
      enviadoTs: null,
      persona: 'General'
    };

    try {
      Orden.agregarItem(item);
      EventBus.emit('cliente:producto_agregado_a_orden', { item });

      const partesNombre = opcionesSnapshot.map(o => o.opcionNombre).join(' ');
      const label = partesNombre ? _producto.nombre + ' ' + partesNombre : _producto.nombre;
      mostrarToast('success', `✓ ${_cantidad}× ${label} agregada`);
      ocultar();
    } catch (e) {
      Logger.error('[ModalOpciones] Error al agregar item:', e);
      mostrarToast('error', 'No se pudo agregar el producto.');
    }
  }

  function _normalizarVariantesIds(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string') {
      try { const p = JSON.parse(valor); return Array.isArray(p) ? p : []; }
      catch { return []; }
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

  return { activar, limpiar, mostrar, ocultar };
})();

export { ModalOpciones };