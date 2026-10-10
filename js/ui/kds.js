/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/kds.js
   Versión: 5.2.0
   Propósito: Vista del Jefe de Cocina/Barra. Gestión de comandas con
              pestañas de estado, filtros, progreso, checkeo de ítems,
              swipe entre pestañas, acceso rápido a receta (toque largo),
              y soporte de variantes (Paquete 5):
                · Badges resumidos con iconografía y colores por tipo.
                · Colapso de opciones estéticas con kds_colapso_variantes.
                · Modal de toque largo con pasos combinados.
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { CommandBus } from '../lib/command-bus.js';
import { Auth } from '../auth.js';
import { Logger } from '../lib/logger.js';
import { mostrarToast } from '../utils.js';
import { Recetas } from './recetas.js';
import { DBInventario } from '../db-inventario.js';

const MINUTOS_URGENTE = 15;
const MINUTOS_OCULTAR_LISTA = 10;

let _activada = false;
let _canceladores = [];
let _filtroActivo = 'todos';
let _estadoActivo = 'nueva';
let _vistaDestino = 'todas';
let _ctxAudio = null;
let _comandas = [];
let _soloLectura = false;

function _cambiarEstado(id, estado) {
  const comandas = Store.obtenerEstado().comandas || [];
  let c = comandas.find(x => x.id === id);
  if (!c && (id.endsWith('_cocina') || id.endsWith('_barra'))) {
    c = comandas.find(x => x.id === id.replace(/_(cocina|barra)$/, ''));
  }
  if (!c) return;

  if (estado === 'en-proceso') {
    Store.despachar({ type: 'COMANDA_ACTUALIZADA', payload: { id, cambios: { estado } } });
    mostrarToast('success', `<i class="fas fa-check"></i> ${c.mesa} → En proceso`);
    _actualizarLocal(id, { estado });
    return;
  }

  if (estado === 'lista') {
    if (id.endsWith('_cocina') || id.endsWith('_barra')) {
      const original = id.replace(/_(cocina|barra)$/, '');
      const destino = id.endsWith('_cocina') ? 'cocina' : 'barra';
      CommandBus.ejecutar({ type: 'completarSubcomanda', datos: { idOriginal: original, destino } })
        .then(r => {
          if (r.exito) {
            mostrarToast('success', `<i class="fas fa-check"></i> ${c.mesa} → ${destino} LISTA ✓`);
            if (r.ambasListas) mostrarToast('success', `<i class="fas fa-check-double"></i> Comanda completada en ambos destinos`);
            _actualizarLocal(id, { estado });
            setTimeout(recargar, 300);
          } else mostrarToast('error', 'Error al marcar como listo');
        }).catch(e => Logger.error('[KDS] Error en completarSubcomanda:', e));
      return;
    }
    Store.despachar({ type: 'COMANDA_ACTUALIZADA', payload: { id, cambios: { estado } } });
    EventBus.emit('comanda:lista', { id, mesa: c.mesa });
    if (c.deliveryId) EventBus.emit('delivery:listo', { deliveryId: c.deliveryId, comandaId: id, estado: 'listo' });
    _actualizarLocal(id, { estado });
    mostrarToast('success', `<i class="fas fa-check"></i> ${c.mesa} → LISTA ✓`);
  }
}

function _actualizarLocal(id, cambios) {
  const i = _comandas.findIndex(c => c.id === id);
  if (i >= 0) Object.assign(_comandas[i], cambios);
  _pintar();
}

function _asegurarVista() {
  let main = document.getElementById('view-cocina');
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-cocina';
    main.className = 'view';
    document.body.appendChild(main);
  }
  if (!main.querySelector('#kds-pestanas')) {
    _construirVista(main);
  }
}

function _construirVista(main) {
  main.innerHTML = `
    <div class="kds-filtros" id="kds-filtros">
      <span class="kds-chip activo" data-filtro="todos">Todos</span>
      <span class="kds-chip" data-filtro="mesa">Mesa</span>
      <span class="kds-chip" data-filtro="reparto">Reparto</span>
    </div>
    <div class="kds-filtro-destino" id="kds-filtro-destino">
      <span class="kds-chip-destino activo" data-destino="todas">Todas</span>
      <span class="kds-chip-destino" data-destino="cocina">Cocina</span>
      <span class="kds-chip-destino" data-destino="barra">Barra</span>
    </div>
    <div class="kds-pestanas" id="kds-pestanas">
      <div class="kds-pestana activo" data-estado="nueva"><b id="kds-num-nuevas">0</b><span>Nuevas</span></div>
      <div class="kds-pestana" data-estado="en-proceso"><b id="kds-num-proceso">0</b><span>En preparación</span></div>
      <div class="kds-pestana" data-estado="lista"><b id="kds-num-listas">0</b><span>Listas</span></div>
    </div>
    <div class="kds-resumen" id="kds-resumen"></div>
    <div class="kds-lista" id="kds-lista"></div>
  `;

  document.getElementById('kds-filtros').addEventListener('click', e => {
    const chip = e.target.closest('.kds-chip');
    if (!chip) return;
    document.querySelectorAll('#kds-filtros .kds-chip').forEach(c => c.classList.remove('activo'));
    chip.classList.add('activo');
    _filtroActivo = chip.dataset.filtro;
    _pintar();
  });

  document.getElementById('kds-filtro-destino').addEventListener('click', e => {
    const chip = e.target.closest('.kds-chip-destino');
    if (!chip) return;
    document.querySelectorAll('#kds-filtro-destino .kds-chip-destino').forEach(c => c.classList.remove('activo'));
    chip.classList.add('activo');
    _vistaDestino = chip.dataset.destino;
    recargar();
  });

  document.getElementById('kds-pestanas').addEventListener('click', e => {
    const pestana = e.target.closest('.kds-pestana');
    if (!pestana) return;
    _activarPestana(pestana.dataset.estado);
  });

  let touchStartX = 0, touchStartY = 0;
  const lista = document.getElementById('kds-lista');
  lista.addEventListener('touchstart', e => {
    if (!e.touches || !e.touches.length) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  lista.addEventListener('touchend', e => {
    if (!e.changedTouches || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
      const estados = ['nueva', 'en-proceso', 'lista'];
      const actual = estados.indexOf(_estadoActivo);
      if (dx < 0) _activarPestana(estados[(actual + 1) % estados.length]);
      else _activarPestana(estados[(actual - 1 + estados.length) % estados.length]);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  });
}

function _activarPestana(estado) {
  _estadoActivo = estado;
  document.querySelectorAll('#kds-pestanas .kds-pestana').forEach(p => p.classList.toggle('activo', p.dataset.estado === estado));
  _pintar();
}

function _clasificarTiempo(ms) {
  const min = ms / 60000;
  if (min < 5) return 't-ok';
  if (min < 12) return 't-warn';
  return 't-peligro';
}

function _formatearTiempo(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function _reproducirAlerta() {
  try {
    _ctxAudio = _ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
    const o = _ctxAudio.createOscillator(), g = _ctxAudio.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.001, _ctxAudio.currentTime);
    g.gain.linearRampToValueAtTime(0.12, _ctxAudio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, _ctxAudio.currentTime + 0.35);
    o.connect(g); g.connect(_ctxAudio.destination);
    o.start(); o.stop(_ctxAudio.currentTime + 0.4);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(120);
}

function _obtenerLimiteColapso() {
  const state = Store.obtenerEstado();
  const cfg = state.config || {};
  const limite = parseInt(cfg.kds_colapso_variantes, 10);
  return isNaN(limite) ? 3 : limite;
}

function _clasificarOpcion(opcion) {
  const tieneAlergenos = (opcion.alergenos || []).length > 0;
  const insumosDelta = opcion.insumos_delta || [];
  const pasosDelta = opcion.pasos_delta || [];

  const sumarPaso = pasosDelta.some(d => d && d.accion === 'sumar');
  const sumarInsumo = insumosDelta.some(d => d && d.accion === 'sumar');
  const quitarInsumo = insumosDelta.some(d => d && d.accion === 'quitar');

  if (tieneAlergenos) return { color: 'rojo', icono: '⚠', texto: 'alergia' };
  if (sumarPaso) return { color: 'ambar', icono: '⚙', texto: '+paso' };
  if (sumarInsumo) return { color: 'ambar', icono: '⊕', texto: '+insumo' };
  if (quitarInsumo) return { color: 'ambar', icono: '⊖', texto: '-insumo' };
  return { color: 'gris', icono: '·', texto: '' };
}

function _htmlBadge(clasif, etiqueta, oculto) {
  const clases = `kds-badge-variante ${clasif.color}${oculto ? ' kds-badge-oculto' : ''}`;
  const iconoHtml = clasif.icono ? `<span class="kds-badge-icono">${clasif.icono}</span>` : '';
  const textoHtml = clasif.texto ? `<span class="kds-badge-tipo">${clasif.texto}</span>` : '';
  return `<span class="${clases}">${iconoHtml}<span class="kds-badge-label">${etiqueta}</span>${textoHtml}</span>`;
}

function _crearBadgesVariantes(item) {
  const opciones = item.opciones || [];
  const alergiasManuales = item.alergias_manuales || [];

  if (!opciones.length && !alergiasManuales.length) return '';

  const limite = _obtenerLimiteColapso();
  const badges = [];

  if (alergiasManuales.length) {
    const clasif = { color: 'rojo', icono: '⚠', texto: 'alergia' };
    badges.push({
      clasif,
      etiqueta: `alergia: ${alergiasManuales.join(', ')}`,
      colapsable: false
    });
  }

  opciones.forEach(op => {
    const clasif = _clasificarOpcion(op);
    const varianteNom = op.varianteNombre || '';
    const opcionNom = op.opcionNombre || '';
    const etiqueta = varianteNom ? `${varianteNom}: ${opcionNom}` : opcionNom;
    badges.push({
      clasif,
      etiqueta,
      colapsable: clasif.color === 'gris'
    });
  });

  const noColapsables = badges.filter(b => !b.colapsable);
  const colapsables = badges.filter(b => b.colapsable);

  let colapsablesVisibles = colapsables;
  let colapsablesOcultas = [];

  if (colapsables.length > limite) {
    colapsablesVisibles = colapsables.slice(0, limite);
    colapsablesOcultas = colapsables.slice(limite);
  }

  const html = [];
  noColapsables.forEach(b => html.push(_htmlBadge(b.clasif, b.etiqueta, false)));
  colapsablesVisibles.forEach(b => html.push(_htmlBadge(b.clasif, b.etiqueta, false)));
  colapsablesOcultas.forEach(b => html.push(_htmlBadge(b.clasif, b.etiqueta, true)));

  if (colapsablesOcultas.length) {
    html.push(`<button type="button" class="kds-badge-toggle">Ver +${colapsablesOcultas.length} opciones</button>`);
  }

  return `<div class="kds-item-badges">${html.join('')}</div>`;
}

function _obtenerRecetaPorProdId(prodId) {
  if (!prodId) return null;
  const recetas = DBInventario.recetas || [];
  const productos = DBInventario.productos || [];
  const receta = recetas.find(r => r.productoId === prodId);
  if (!receta) return null;
  const prod = productos.find(p => p.id === receta.productoId);
  return { ...receta, nombre: prod ? prod.nombre : 'Sin nombre' };
}

function _resolverPasosCombinados(item, recetaBase) {
  const instruccionesBase = (recetaBase && recetaBase.instrucciones) || '';
  const pasosBase = instruccionesBase.split('\n').filter(l => l.trim());

  const pasosOcultos = [];
  const pasosSumados = [];

  (item.opciones || []).forEach(op => {
    const origen = op.varianteNombre && op.opcionNombre
      ? `${op.varianteNombre}: ${op.opcionNombre}`
      : (op.opcionNombre || '');
    (op.pasos_delta || []).forEach(delta => {
      if (!delta || !delta.accion) return;
      if (delta.accion === 'sumar') {
        pasosSumados.push({
          texto: delta.texto || '',
          posicion: delta.posicion || 'fin',
          despuesDe: delta.pasoRef || null,
          origen
        });
      } else if (delta.accion === 'ocultar') {
        pasosOcultos.push(delta.pasoRef);
      }
    });
  });

  const baseFiltrados = pasosBase.filter((p, i) => {
    const idPaso = `paso_${i}`;
    return !pasosOcultos.includes(idPaso) && !pasosOcultos.includes(i) && !pasosOcultos.includes(p);
  });

  const resultado = [];

  pasosSumados.filter(p => p.posicion === 'inicio').forEach(p => {
    resultado.push({ texto: p.texto, esVariante: true, origen: p.origen });
  });

  baseFiltrados.forEach((paso, idx) => {
    resultado.push({ texto: paso, esVariante: false });
    const despues = pasosSumados.filter(p =>
      p.posicion === 'despues_de' &&
      (p.despuesDe === `paso_${idx}` || p.despuesDe === idx || p.despuesDe === paso)
    );
    despues.forEach(p => {
      resultado.push({ texto: p.texto, esVariante: true, origen: p.origen });
    });
  });

  pasosSumados.filter(p => p.posicion === 'fin' || !p.posicion).forEach(p => {
    resultado.push({ texto: p.texto, esVariante: true, origen: p.origen });
  });

  return resultado;
}

function _asegurarModalPreparacion() {
  if (document.getElementById('kdsModalPreparacion')) return;

  const overlay = document.createElement('div');
  overlay.id = 'kdsModalPreparacion';
  overlay.className = 'kds-modal-overlay';
  overlay.innerHTML = `
    <div class="kds-modal-preparacion">
      <div class="kds-modal-preparacion-header">
        <h3 id="kdsModalPrepTitulo">Preparación</h3>
        <button type="button" class="kds-modal-preparacion-cerrar" id="btnCerrarModalPrep"><i class="fas fa-times"></i></button>
      </div>
      <div class="kds-modal-preparacion-cuerpo" id="kdsModalPrepCuerpo"></div>
    </div>
  `;

  const vista = document.getElementById('view-cocina');
  if (vista) vista.appendChild(overlay);
  else document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('activo');
  });
  document.getElementById('btnCerrarModalPrep').addEventListener('click', () => {
    overlay.classList.remove('activo');
  });
}

function _abrirModalPreparacion(item) {
  _asegurarModalPreparacion();
  const overlay = document.getElementById('kdsModalPreparacion');
  const titulo = document.getElementById('kdsModalPrepTitulo');
  const cuerpo = document.getElementById('kdsModalPrepCuerpo');

  titulo.innerHTML = `<i class="fas fa-fire-burner"></i> ${item.nombre || 'Preparación'}`;

  const variantesHtml = (item.opciones || []).length
    ? `
      <div class="kds-modal-bloque">
        <h4>Variantes seleccionadas</h4>
        <ul class="kds-modal-variantes-lista">
          ${item.opciones.map(op => `
            <li>
              <span class="kds-modal-var-nombre">${op.varianteNombre || 'Opción'}:</span>
              <span class="kds-modal-var-valor">${op.opcionNombre || ''}</span>
              ${(op.alergenos || []).length ? `<span class="kds-modal-var-alergia">⚠ ${op.alergenos.join(', ')}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '';

  const alergiasManualesHtml = (item.alergias_manuales || []).length
    ? `
      <div class="kds-modal-bloque">
        <h4>Alergias informadas por el mesero</h4>
        <p class="kds-modal-alergia-manual">⚠ ${item.alergias_manuales.join(', ')}</p>
      </div>
    `
    : '';

  const recetaBase = _obtenerRecetaPorProdId(item.prodId);
  const pasos = _resolverPasosCombinados(item, recetaBase);

  const pasosHtml = pasos.length
    ? `
      <div class="kds-modal-bloque">
        <h4>Pasos de preparación</h4>
        <ol class="kds-modal-pasos-lista">
          ${pasos.map(p => {
            const clase = p.esVariante ? 'kds-modal-paso-variante' : '';
            const origen = p.esVariante && p.origen
              ? ` <span class="kds-modal-paso-origen">(${p.origen})</span>`
              : '';
            return `<li class="${clase}">${p.texto}${origen}</li>`;
          }).join('')}
        </ol>
      </div>
    `
    : `
      <div class="kds-modal-bloque">
        <p class="kds-modal-sin-pasos">Sin pasos de preparación registrados.</p>
      </div>
    `;

  cuerpo.innerHTML = variantesHtml + alergiasManualesHtml + pasosHtml;
  overlay.classList.add('activo');
}

function _crearTicket(c) {
  const el = document.createElement('div');
  el.id = 'kds-' + c.id;
  el.dataset.id = c.id;
  const transcurrido = Date.now() - (c.ts || 0);
  const claseTiempo = _clasificarTiempo(transcurrido);
  const urgente = claseTiempo === 't-peligro';
  const esDelivery = !!c.deliveryId;
  const tipo = c.tipo || (esDelivery ? 'reparto' : 'mesa');
  const claseTipo = tipo === 'mesa' ? 'kds-tipo-mesa' : (tipo === 'reparto' ? 'kds-tipo-reparto' : 'kds-tipo-retiro');
  const interactivo = c.estado === 'en-proceso' && !_soloLectura;
  const listos = (c.items || []).filter(i => i.listo).length;

  el.className = 'kds-ticket' + (urgente ? ' kds-urgente' : '');
  el.innerHTML = `
    <div class="kds-ticket-cabecera">
      <div><div class="kds-ticket-numero">#${c.numero || c.mesa}</div><div class="kds-ticket-mesa">${c.mesa || ''} ${esDelivery ? '(Delivery)' : ''}</div></div>
      <span class="kds-ticket-tipo ${claseTipo}">${tipo}</span>
    </div>
    <span class="kds-ticket-tiempo ${claseTiempo}">⏱ ${_formatearTiempo(transcurrido)}</span>
    <div class="kds-ticket-items">${(c.items || []).map((i, idx) => `
      <div class="kds-item-wrapper">
        <div class="kds-item ${interactivo ? 'kds-item-tocable' : ''} ${i.listo ? 'kds-item-listo' : ''}" data-idx="${idx}">
          <span class="kds-item-check ${i.listo ? 'kds-item-marcado' : ''}"><i class="fas fa-check"></i></span>
          <span class="kds-item-cantidad">${i.qty}</span>
          <span class="kds-item-nombre">${i.nombre} ${i.icono || ''}</span>
        </div>
        ${_crearBadgesVariantes(i)}
      </div>`).join('')}
    </div>
    ${interactivo ? `<div class="kds-progreso"><span>${listos}/${c.items.length} listos</span><span class="kds-progreso-barra"><span class="kds-progreso-lleno" style="width:${(listos/c.items.length)*100}%"></span></span></div>` : ''}
    ${(c._grupo || c.observaciones) ? `<div class="kds-ticket-banderas"><span class="kds-bandera kds-bandera-grupo">${c._grupo || c.observaciones}</span></div>` : ''}
    ${!_soloLectura ? `
    <div class="kds-ticket-acciones">
      ${c.estado === 'nueva' ? `<button class="kds-boton kds-boton-iniciar"><i class="fas fa-fire"></i> Iniciar</button>` : ''}
      ${c.estado === 'en-proceso' ? `<button class="kds-boton kds-boton-listo"><i class="fas fa-check-double"></i> Marcar todo listo</button>` : ''}
      ${c.estado === 'lista' ? `<button class="kds-boton kds-boton-entregar"><i class="fas fa-box-open"></i> Entregar / Retirar</button>` : ''}
    </div>
    ${c.estado === 'lista' ? `<div class="kds-acciones-secundarias"><button class="kds-boton-reabrir"><i class="fas fa-undo"></i> Reabrir</button></div>` : ''}
    ` : ''}
  `;

  el.querySelectorAll('.kds-badge-toggle').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const contenedor = btn.closest('.kds-item-badges');
      if (contenedor) contenedor.classList.toggle('expandido');
    });
  });

  if (interactivo) {
    el.querySelectorAll('.kds-item').forEach(row => {
      let longPressTimer;
      let isLongPress = false;

      const startLongPress = () => {
        isLongPress = false;
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          const idx = Number(row.dataset.idx);
          const item = c.items[idx];
          if (!item) return;
          if (navigator.vibrate) navigator.vibrate(15);
          if ((item.opciones || []).length > 0) {
            _abrirModalPreparacion(item);
          } else if (item.prodId) {
            Recetas.mostrarDetalle(item.prodId);
          } else {
            mostrarToast('warning', 'Receta no disponible');
          }
        }, 600);
      };

      const cancelLongPress = () => clearTimeout(longPressTimer);

      const handleClick = (ev) => {
        if (isLongPress) {
          ev.stopPropagation();
          ev.preventDefault();
          return;
        }
        ev.stopPropagation();
        const idx = Number(row.dataset.idx);
        c.items[idx].listo = !c.items[idx].listo;
        if (navigator.vibrate) navigator.vibrate(20);
        if (c.items.every(i => i.listo)) _cambiarEstado(c.id, 'lista');
        else _pintar();
      };

      row.addEventListener('touchstart', startLongPress, { passive: true });
      row.addEventListener('touchend', cancelLongPress);
      row.addEventListener('touchmove', cancelLongPress);
      row.addEventListener('mousedown', startLongPress);
      row.addEventListener('mouseup', cancelLongPress);
      row.addEventListener('mouseleave', cancelLongPress);
      row.addEventListener('click', handleClick);
    });
  }

  if (!_soloLectura) {
    const btn = el.querySelector('.kds-boton');
    if (btn) {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(30);
        if (c.estado === 'en-proceso') {
          c.items.forEach(i => i.listo = true);
          _cambiarEstado(c.id, 'lista');
        } else if (c.estado === 'lista') {
          el.classList.add('kds-saliendo');
          setTimeout(() => {
            _comandas = _comandas.filter(x => x.id !== c.id);
            _pintar();
          }, 240);
          mostrarToast('success', `📦 Comanda ${c.mesa} entregada`);
        } else {
          _cambiarEstado(c.id, 'en-proceso');
        }
      });
    }

    const btnReabrir = el.querySelector('.kds-boton-reabrir');
    if (btnReabrir) {
      btnReabrir.addEventListener('click', ev => {
        ev.stopPropagation();
        _cambiarEstado(c.id, 'en-proceso');
      });
    }
  }

  return el;
}

function _pintar() {
  _asegurarVista();
  const filtradas = _filtroActivo === 'todos' ? _comandas : _comandas.filter(c => (c.tipo || 'mesa') === _filtroActivo);
  const visibles = filtradas.filter(c => c.estado === _estadoActivo).sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const lista = document.getElementById('kds-lista');
  if (!lista) return;
  lista.innerHTML = '';

  if (!visibles.length) {
    const textos = { nueva: 'Sin pedidos nuevos', 'en-proceso': 'Nada en preparación', lista: 'Nada listo por ahora' };
    lista.innerHTML = `<div class="kds-vacio"><p>${textos[_estadoActivo]}</p></div>`;
  } else {
    visibles.forEach(c => lista.appendChild(_crearTicket(c)));
  }

  document.getElementById('kds-num-nuevas').textContent = filtradas.filter(c => c.estado === 'nueva').length;
  document.getElementById('kds-num-proceso').textContent = filtradas.filter(c => c.estado === 'en-proceso').length;
  document.getElementById('kds-num-listas').textContent = filtradas.filter(c => c.estado === 'lista').length;

  const urgentes = _comandas.filter(c => c.estado !== 'lista' && _clasificarTiempo(Date.now() - (c.ts || 0)) === 't-peligro').length;
  document.getElementById('kds-resumen').innerHTML = `
    <div class="kds-pildora"><span class="kds-swatch" style="background:var(--color-warning)"></span> Activos <b>${_comandas.filter(c => c.estado !== 'lista').length}</b></div>
    <div class="kds-pildora"><span class="kds-swatch" style="background:var(--color-danger)"></span> Demorados <b>${urgentes}</b></div>
    <div class="kds-pildora"><span class="kds-swatch" style="background:var(--color-success)"></span> Listos <b>${_comandas.filter(c => c.estado === 'lista').length}</b></div>
  `;
}

function recargar() {
  if (!_activada) activar();

  const state = Store.obtenerEstado();
  const ahora = Date.now();
  const roles = Auth.obtenerRolesEfectivos();

  const veCocina = roles.some(rol => ['chef', 'cocinaAyudante', 'owner', 'admin', 'master'].includes(rol));
  const veBarra = roles.some(rol => ['barman', 'barraAyudante', 'owner', 'admin', 'master'].includes(rol));

  let comandas = state.comandas || [];

  const procesadas = [];
  comandas.forEach(c => {
    if (c.destino === 'ambos') {
      const itemsCocina = c.items.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
      const itemsBarra = c.items.filter(it => it.destino === 'barra' || it.destino === 'ambos');
      if (itemsCocina.length) procesadas.push({ ...c, id: c.id + '_cocina', destino: 'cocina', items: itemsCocina, _originalId: c.id, _grupo: c.observaciones || 'Combo' });
      if (itemsBarra.length) procesadas.push({ ...c, id: c.id + '_barra', destino: 'barra', items: itemsBarra, _originalId: c.id, _grupo: c.observaciones || 'Combo' });
    } else {
      procesadas.push(c);
    }
  });

  comandas = procesadas.filter(c => {
    if (c.estado === 'lista') return (ahora - (c.ts || 0)) < MINUTOS_OCULTAR_LISTA * 60 * 1000;
    return true;
  });

  if (veCocina && veBarra) {
    if (_vistaDestino === 'cocina') comandas = comandas.filter(c => c.destino === 'cocina');
    else if (_vistaDestino === 'barra') comandas = comandas.filter(c => c.destino === 'barra');
  } else if (veCocina) {
    comandas = comandas.filter(c => c.destino === 'cocina');
    _vistaDestino = 'cocina';
  } else if (veBarra) {
    comandas = comandas.filter(c => c.destino === 'barra');
    _vistaDestino = 'barra';
  } else {
    comandas = [];
    _vistaDestino = 'todas';
  }

  _comandas = comandas;
  _actualizarControlDestino(veCocina, veBarra);
  _pintar();
}

function _actualizarControlDestino(veCocina, veBarra) {
  const cont = document.getElementById('kds-filtro-destino');
  if (!cont) return;
  cont.classList.toggle('visible', veCocina && veBarra);
  cont.querySelectorAll('.kds-chip-destino').forEach(chip => {
    chip.classList.toggle('activo', chip.dataset.destino === _vistaDestino);
  });
}

function activar() {
  if (_activada) return;
  _activada = true;
  _canceladores.push(Store.suscribir((_, action) => { if (action.type.startsWith('COMANDA')) recargar(); }));
  _canceladores.push(EventBus.on('comanda:enviada', c => { Logger.debug(`[KDS] Nueva: ${c.id}`); _reproducirAlerta(); recargar(); }));
  _canceladores.push(EventBus.on('db:inicializada', () => setTimeout(recargar, 100)));
  _canceladores.push(EventBus.on('vista:cambiada', v => { if (v === 'cocina') recargar(); }));
  recargar();
}

function limpiar() {
  if (!_activada) return;
  _activada = false;
  _canceladores.forEach(fn => { if (typeof fn === 'function') fn(); });
  _canceladores = [];
  const main = document.getElementById('view-cocina');
  if (main) main.innerHTML = '';
}

export const KDS = { refresh: recargar, activar, limpiar };