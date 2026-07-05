/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/kds.js
   Versión: 2.0.3
   Propósito: Monitor de cocina (KDS): tarjetas de comandas, estados y recetario.
              _asegurarVista refactorizada para contenedores estáticos.
   Dependencias: ../lib/store.js, ../lib/eventBus.js, ../lib/command-bus.js,
                 ../auth.js, ../utils.js, ../lib/logger.js, ./recetas.js
   ================================================================ */

import { Store } from '../lib/store.js';
import { EventBus } from '../lib/eventBus.js';
import { CommandBus } from '../lib/command-bus.js';
import { Auth } from '../auth.js';
import { Logger } from '../lib/logger.js';
import { $id, showToast, fmtMoney } from '../utils.js';
import { Recetas } from './recetas.js';

const MINUTOS_URGENTE = 15;
const MINUTOS_OCULTAR_LISTA = 10;

function _asegurarVista() {
  let main = document.getElementById('view-cocina');

  // Si ya está completo, no hacer nada
  if (main && main.querySelector('#cocinaKDS')) return;

  // Crear contenedor si no existe (modo dinámico / fallback)
  if (!main) {
    main = document.createElement('main');
    main.id = 'view-cocina';
    main.className = 'view';
    const referencia = $id('toastContainer') || document.body.lastChild;
    document.body.insertBefore(main, referencia);
  }

  _construirContenidoKDS(main);
}

function _construirContenidoKDS(main) {
  // Limpiar cualquier resto y construir estructura interna
  main.innerHTML = `
    <div class="view-toolbar">
      <h2><i class="fas fa-fire-burner"></i> Monitor de Cocina</h2>
      <div class="toolbar-actions">
        <button class="btn-secondary" id="kds-refresh-btn">
          <i class="fas fa-sync-alt"></i> Actualizar
        </button>
        <button class="btn-secondary" id="kds-recetario-btn">
          <i class="fas fa-book-open"></i> Recetario
        </button>
      </div>
    </div>
    <div id="cocinaKDS" class="kds-grid"></div>
  `;

  // Asignar eventos a los botones (sin duplicar)
  $id('kds-refresh-btn').addEventListener('click', () => refresh());
  $id('kds-recetario-btn').addEventListener('click', () => Recetas.render('consulta'));
}

function refresh() {
  _asegurarVista();
  const cont = $id('cocinaKDS');
  if (!cont) return;

  const ahora = Date.now();
  const rol = Auth.getRol();

  let comandas = Store.getState().comandas || [];
  comandas = comandas.filter(c => c && Array.isArray(c.items));

  const procesadas = [];
  comandas.forEach(c => {
    if (c.destino === 'ambos') {
      const itemsCocina = c.items.filter(it => it.destino === 'cocina' || it.destino === 'ambos');
      const itemsBarra = c.items.filter(it => it.destino === 'barra' || it.destino === 'ambos');

      if (itemsCocina.length > 0) {
        procesadas.push({
          ...c,
          id: c.id + '_cocina',
          destino: 'cocina',
          items: itemsCocina,
          _originalId: c.id,
          _grupo: c.observaciones || 'Combo'
        });
      }
      if (itemsBarra.length > 0) {
        procesadas.push({
          ...c,
          id: c.id + '_barra',
          destino: 'barra',
          items: itemsBarra,
          _originalId: c.id,
          _grupo: c.observaciones || 'Combo'
        });
      }
    } else {
      procesadas.push(c);
    }
  });

  comandas = procesadas;

  comandas = comandas.filter(c => {
    if (c.estado === 'lista') {
      return (ahora - c.ts) < MINUTOS_OCULTAR_LISTA * 60 * 1000;
    }
    return true;
  });

  if (rol === 'cocina') {
    comandas = comandas.filter(c => c.destino === 'cocina');
  } else if (rol === 'barra') {
    comandas = comandas.filter(c => c.destino === 'barra');
  }

  Logger.debug(`[KDS] ${comandas.length} comandas activas en Store.`);

  if (!comandas.length) {
    cont.innerHTML = `<div class="kds-empty"><i class="fas fa-check-circle"></i><p class="kds-empty-title">Todo en orden</p><p>No hay comandas pendientes</p></div>`;
    return;
  }

  cont.innerHTML = comandas.map(_htmlKdsCard).join('');
}

function _htmlKdsCard(c) {
  const minutos = Math.floor((Date.now() - c.ts) / 60000);
  const urgente = minutos > MINUTOS_URGENTE;
  const tiempoTxt = minutos === 0 ? 'Ahora' : `Hace ${minutos} min`;
  const destLabel = { cocina: 'Cocina', barra: 'Barra' }[c.destino] || c.destino;
  const destCss = c.destino === 'barra' ? 'barra' : 'cocina';
  const esDelivery = !!c.deliveryId;
  const etiquetaDelivery = esDelivery ? `<span class="kds-destino-tag" style="background:rgba(34,197,94,.2);color:var(--color-success);">Delivery</span>` : '';
  const etiquetaGrupo = c._grupo ? `<span class="kds-grupo-tag"><i class="fas fa-layer-group"></i> ${c._grupo}</span>` : '';

  const rol = Auth.getRol();
  const puedePanico = rol === 'admin' || rol === 'master';

  const items = c.items || [];
  const itemsHTML = items.map(it => {
    const icono = it.enviadoA === 'barra' ? '🍹' : '🍳';
    const botonPanico = puedePanico ? `<button class="kds-panico-btn" title="Marcar como agotado" data-prod-id="${it.prodId}"><i class="fas fa-exclamation-triangle"></i></button>` : '';
    return `
      <div class="kds-item">
        <span class="kds-qty">${it.qty}</span>
        <div>
          <div class="kds-item-name">${it.nombre} ${icono} ${botonPanico}</div>
          ${it.obs ? `<div class="kds-item-obs"><i class="fas fa-exclamation-circle"></i> ${it.obs}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  let botonesHTML = '';
  if (c.estado !== 'lista') {
    botonesHTML += c.estado === 'nueva'
      ? `<button class="kds-btn kds-btn-proceso" data-accion="en-proceso" data-id="${c.id}"><i class="fas fa-fire"></i> En proceso</button>`
      : '';
    botonesHTML += `<button class="kds-btn kds-btn-lista" data-accion="lista" data-id="${c.id}"><i class="fas fa-check"></i> Listo</button>`;
  } else {
    botonesHTML = `<div class="kds-lista-ok"><i class="fas fa-check-circle"></i> LISTO</div>`;
  }

  return `
    <article class="kds-card ${c.estado}" id="kds-${c.id}">
      <div class="kds-header">
        <div class="kds-mesa"><i class="fas fa-chair"></i> ${c.mesa} ${etiquetaDelivery} ${etiquetaGrupo} <span class="kds-mozo">${c.mozo}</span></div>
        <div class="kds-meta"><span class="kds-destino-tag ${destCss}">${destLabel}</span><span class="kds-time${urgente ? ' urgente' : ''}">${tiempoTxt}</span></div>
      </div>
      <div class="kds-items">${itemsHTML}</div>
      ${c.observaciones ? `<p class="kds-obs"><i class="fas fa-comment"></i> ${c.observaciones}</p>` : ''}
      <div class="kds-footer">${botonesHTML}</div>
    </article>`;
}

function _panico(prodId) {
  if (!confirm('¿Marcar este producto como NO disponible?')) return;
  CommandBus.ejecutar({
    type: 'producto:marcar_agotado',
    datos: { prodId }
  }).then(resultado => {
    if (resultado.exito) showToast('success', 'Producto marcado como agotado.');
    else showToast('error', 'Error al marcar producto.');
  }).catch(err => Logger.error('[KDS] Error en botón de pánico:', err));
}

function _setEstado(id, estado) {
  const comandas = Store.getState().comandas || [];
  let c = comandas.find(x => x.id === id);

  if (!c && (id.endsWith('_cocina') || id.endsWith('_barra'))) {
    const idOriginal = id.replace(/_(cocina|barra)$/, '');
    c = comandas.find(x => x.id === idOriginal);
  }

  if (!c) return;

  if (estado === 'en-proceso') {
    Store.dispatch({ type: 'COMANDA_ACTUALIZADA', payload: { id, cambios: { estado } } });
    showToast('success', `<i class="fas fa-check"></i> ${c.mesa} → En proceso`);
    return;
  }

  if (estado === 'lista') {
    if (id.endsWith('_cocina') || id.endsWith('_barra')) {
      const idOriginal = id.replace(/_(cocina|barra)$/, '');
      const destino = id.endsWith('_cocina') ? 'cocina' : 'barra';

      CommandBus.ejecutar({
        type: 'completarSubcomanda',
        datos: { idOriginal, destino }
      }).then(resultado => {
        if (resultado.exito) {
          showToast('success', `<i class="fas fa-check"></i> ${c.mesa} → ${destino} LISTA ✓`);
          if (resultado.ambasListas) {
            showToast('success', `<i class="fas fa-check-double"></i> Comanda completada en ambos destinos`);
          }
          setTimeout(refresh, 300);
        } else {
          showToast('error', 'Error al marcar como listo');
        }
      }).catch(err => {
        Logger.error('[KDS] Error en completarSubcomanda:', err);
      });
      return;
    }

    Store.dispatch({ type: 'COMANDA_ACTUALIZADA', payload: { id, cambios: { estado } } });
    EventBus.emit('comanda:lista', { id, mesa: c.mesa });

    if (c.deliveryId) {
      EventBus.emit('delivery:listo', { deliveryId: c.deliveryId, comandaId: id, estado: 'listo' });
      Logger.info(`[KDS] Delivery listo: ${c.deliveryId}`);
    }

    showToast('success', `<i class="fas fa-check"></i> ${c.mesa} → LISTA ✓`);
  }
}

function _setupEventDelegation() {
  document.addEventListener('click', (e) => {
    const panicoBtn = e.target.closest('.kds-panico-btn');
    if (panicoBtn) {
      const prodId = panicoBtn.dataset.prodId;
      if (prodId) _panico(prodId);
      return;
    }

    const estadoBtn = e.target.closest('.kds-btn[data-accion]');
    if (estadoBtn) {
      const accion = estadoBtn.dataset.accion;
      const id = estadoBtn.dataset.id;
      if (accion && id) _setEstado(id, accion);
      return;
    }
  });
}

function _initListeners() {
  Store.subscribe((state, action) => {
    if (action.type.startsWith('COMANDA')) {
      Logger.debug('[KDS] Cambio detectado en Store, refrescando...');
      refresh();
    }
  });

  EventBus.on('comanda:enviada', (comanda) => {
    Logger.debug(`[KDS] Evento comanda:enviada recibido: ${comanda.id}`);
    refresh();
  });

  EventBus.on('db:inicializada', () => {
    setTimeout(refresh, 100);
  });
  EventBus.on('vista:cambiada', (vista) => {
    if (vista === 'cocina') refresh();
  });
}

_setupEventDelegation();
_initListeners();

export const KDS = { refresh, _setEstado, _panico };