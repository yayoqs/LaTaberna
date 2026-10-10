/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/ciclo-vida.js
   Versión: 2.1.1
   Propósito: Ciclo de vida de la vista del diseñador de cartas.
   v2.1.1: · Agrega el import faltante de Logger. El archivo usaba
             Logger.error y Logger.warn dentro de los catch de
             _montarModuloAsignacion y _desmontarModuloAsignacion,
             pero nunca importaba el símbolo. Cuando el módulo de
             asignación fallaba, el propio catch lanzaba
             ReferenceError y enmascaraba el error original.
           · Migra el listener del Store de MENUS_INICIALIZAR a
             CARTAS_INICIALIZAR (brief D.13 / E.x13).
   v2.1.0: integra el Modo Variantes. Switch en el header que
           alterna entre Lienzo y Variantes. Al pasar a Variantes,
           monta dinámicamente el módulo de asignación. Al volver
           a Lienzo, lo desmonta.
   v2.0.2: reenvío del archivo. Se había perdido en el repo tras
           el rename Menus → Cartas.
   v2.0.1: asegurarVista recibe el signal.
   v2.0.0: rename Menus → Cartas. Fix de listeners duplicados.
           limpiar() destruye el DOM. Fondo, tipografía y grilla
           se persisten y se leen al cargar.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import {
  asegurarVista,
  renderLienzo,
  abrirSidebar,
  cerrarSidebar,
  toggleFabMenu,
  abrirBiblioteca,
  cerrarBiblioteca,
  actualizarModoActivo,
  obtenerContenedorVariantes
} from './renderer.js';
import {
  getMenuActivo,
  setMenuActivo,
  getProductosMenuActivo,
  agregarProductoAlMenu
} from './estado.js';
import { abrir as abrirProps, cerrar as cerrarProps, guardarCambios, eliminarFicha } from './modal-propiedades.js';
import { guardarMenu, publicarMenu, cargarMenus } from './acciones.js';
import { inicializar as inicializarSidebar, refrescarLista } from './barra-lateral.js';
import { inicializar as inicializarBiblioteca, refrescar as refrescarBiblioteca } from './biblioteca.js';
import { mostrarToast } from '../../utils.js';

let _abortController = null;
let _desuscripciones = [];
let _modoActual = 'lienzo';
let _moduloAsignacion = null;
let _contenedorVariantes = null;

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista(signal);
  inicializarSidebar(signal, onMenuSeleccionado);
  inicializarBiblioteca(signal, onProductoAgregado);
  _vincularEventosDOM(signal);
  _vincularSwitchModo(signal);

  _cambiarModo('lienzo');

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (action.type === 'CARTAS_INICIALIZAR' ||
        action.type === 'PRODUCTOS_INICIALIZAR' ||
        action.type === 'RECETAS_INICIALIZAR') {
      refrescarLista();
      refrescarBiblioteca();
      if (_modoActual === 'variantes' && _moduloAsignacion) {
        _moduloAsignacion._internals?.refrescar?.();
      }
    }
  });
  _desuscripciones.push(unsubscribeStore);

  _desuscripciones.push(EventBus.on('db:inicializada', () => {
    setTimeout(async () => {
      await cargarMenus();
      refrescarLista();
      refrescarBiblioteca();
      const menu = getMenuActivo();
      if (menu) {
        document.getElementById('menuNameInput').value = menu.nombre;
        _aplicarEsteticaAlCanvas(menu);
        renderLienzo(getProductosMenuActivo());
      }
    }, 100);
  }));
}

export function limpiar() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _desuscripciones.forEach(fn => fn());
  _desuscripciones = [];

  _desmontarModuloAsignacion();

  _modoActual = 'lienzo';

  const main = document.getElementById('view-carta-editor');
  if (main) main.innerHTML = '';
}

function _vincularSwitchModo(signal) {
  const switchEl = document.getElementById('menuModoSwitch');
  if (!switchEl) return;

  switchEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-modo-btn');
    if (!btn) return;
    const modo = btn.dataset.modo;
    if (!modo || modo === _modoActual) return;
    _cambiarModo(modo);
  }, { signal });
}

async function _cambiarModo(modo) {
  _modoActual = modo;
  actualizarModoActivo(modo);

  if (modo === 'variantes') {
    await _montarModuloAsignacion();
  } else {
    _desmontarModuloAsignacion();
  }
}

async function _montarModuloAsignacion() {
  if (_moduloAsignacion) return;

  _contenedorVariantes = obtenerContenedorVariantes();
  if (!_contenedorVariantes) {
    mostrarToast('error', 'No se encontró el contenedor del modo Variantes.');
    return;
  }

  try {
    const modulo = await import('./asignacion/ciclo-vida.js');
    _moduloAsignacion = modulo;
    await modulo.montar(_contenedorVariantes, {
      onSolicitarCambioModo: (nuevoModo) => {
        if (nuevoModo && nuevoModo !== _modoActual) {
          _cambiarModo(nuevoModo);
        }
      }
    });
  } catch (e) {
    Logger.error('[CartaEditor] Error al montar Modo Variantes:', e);
    mostrarToast('error', 'No se pudo cargar el Modo Variantes.');
    _moduloAsignacion = null;
  }
}

function _desmontarModuloAsignacion() {
  if (_moduloAsignacion) {
    try {
      _moduloAsignacion.desmontar();
    } catch (e) {
      Logger.warn('[CartaEditor] Error al desmontar Modo Variantes:', e);
    }
    _moduloAsignacion = null;
  }
  if (_contenedorVariantes) {
    _contenedorVariantes.innerHTML = '';
    _contenedorVariantes = null;
  }
}

function onMenuSeleccionado(menu) {
  setMenuActivo(menu);
  document.getElementById('menuNameInput').value = menu.nombre;
  _aplicarEsteticaAlCanvas(menu);
  renderLienzo(menu.productos || []);
}

function onProductoAgregado(producto, x, y) {
  if (producto.tipo === 'producto' || !producto.tipo) {
    const productosActuales = getProductosMenuActivo();
    const yaExiste = productosActuales.some(p => p.id === producto.id && (p.tipo === 'producto' || !p.tipo));
    if (yaExiste) {
      mostrarToast('warning', `"${producto.nombre}" ya está en el lienzo.`);
      return;
    }
  }

  agregarProductoAlMenu({
    ...producto,
    x: x || 100,
    y: y || 100,
    tipo: producto.tipo || 'producto',
    shape: 'rect',
    display: 'both',
    price: producto.precio || Math.round((producto.costo || 0) * 1.5)
  });
  renderLienzo(getProductosMenuActivo());
  cerrarBiblioteca();
}

function _leerEsteticaActual() {
  return {
    fondo: document.getElementById('menuBgSelect')?.value || '#1a1a2e',
    tipografia: document.getElementById('menuFontSelect')?.value || "'Inter', sans-serif",
    grilla: document.getElementById('menuGridToggle')?.checked === true
  };
}

function _aplicarEsteticaAlCanvas(menu) {
  const canvas = document.getElementById('menuCanvas');
  if (!canvas) return;

  const fondo = menu.fondo || '#1a1a2e';
  const tipografia = menu.tipografia || "'Inter', sans-serif";
  const grilla = menu.grilla === true;

  canvas.style.backgroundColor = fondo;
  canvas.style.fontFamily = tipografia;
  canvas.classList.toggle('grid', grilla);

  const bgSelect = document.getElementById('menuBgSelect');
  if (bgSelect) bgSelect.value = fondo;
  const fontSelect = document.getElementById('menuFontSelect');
  if (fontSelect) fontSelect.value = tipografia;
  const gridToggle = document.getElementById('menuGridToggle');
  if (gridToggle) gridToggle.checked = grilla;
}

function _vincularEventosDOM(signal) {
  document.getElementById('menuHamburgerBtn')?.addEventListener('click', abrirSidebar, { signal });
  document.getElementById('menuCloseSidebarBtn')?.addEventListener('click', cerrarSidebar, { signal });
  document.getElementById('menuSidebarOverlay')?.addEventListener('click', cerrarSidebar, { signal });

  document.getElementById('menuFabBtn')?.addEventListener('click', toggleFabMenu, { signal });
  document.getElementById('menuFabOverlay')?.addEventListener('click', toggleFabMenu, { signal });
  document.querySelectorAll('.radial-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      toggleFabMenu();
      const canvas = document.getElementById('menuCanvas');
      if (!canvas) return;

      switch (action) {
        case 'producto':
          abrirBiblioteca();
          break;
        case 'titulo':
          agregarFichaNoProducto('titulo', { texto: 'Título de sección' });
          break;
        case 'descripcion':
          agregarFichaNoProducto('descripcion', { texto: 'Descripción de la sección...' });
          break;
        case 'imagen':
          agregarFichaNoProducto('imagen', { imagen: 'https://placehold.co/200x100/6366f1/fff?text=Imagen' });
          break;
        case 'fondo':
          agregarFichaNoProducto('fondo', { color: 'rgba(255,255,255,0.03)' });
          break;
      }
    }, { signal });
  });

  document.getElementById('menuSheetOverlay')?.addEventListener('click', cerrarBiblioteca, { signal });

  document.getElementById('menuCanvas')?.addEventListener('click', (e) => {
    const ficha = e.target.closest('.ficha');
    if (ficha) {
      abrirProps(ficha, () => {
        guardarCambios();
        const menu = getMenuActivo();
        if (menu) {
          menu.productos = _serializarLienzo();
          renderLienzo(menu.productos);
        }
      });
    }
  }, { signal });

  document.getElementById('menuClosePropsBtn')?.addEventListener('click', () => {
    guardarCambios();
    cerrarProps();
    const menu = getMenuActivo();
    if (menu) {
      menu.productos = _serializarLienzo();
      renderLienzo(menu.productos);
    }
  }, { signal });

  document.getElementById('menuPropsOverlay')?.addEventListener('click', () => {
    guardarCambios();
    cerrarProps();
    const menu = getMenuActivo();
    if (menu) {
      menu.productos = _serializarLienzo();
      renderLienzo(menu.productos);
    }
  }, { signal });

  document.getElementById('menuDeleteFichaBtn')?.addEventListener('click', () => {
    eliminarFicha();
    const menu = getMenuActivo();
    if (menu) {
      menu.productos = _serializarLienzo();
      renderLienzo(menu.productos);
    }
  }, { signal });

  document.getElementById('menuCtxBtn')?.addEventListener('click', () => {
    document.getElementById('menuContextMenu')?.classList.toggle('active');
  }, { signal });

  document.getElementById('menuBgSelect')?.addEventListener('change', function () {
    const canvas = document.getElementById('menuCanvas');
    if (canvas) canvas.style.backgroundColor = this.value;
  }, { signal });
  document.getElementById('menuFontSelect')?.addEventListener('change', function () {
    const canvas = document.getElementById('menuCanvas');
    if (canvas) canvas.style.fontFamily = this.value;
  }, { signal });
  document.getElementById('menuGridToggle')?.addEventListener('change', function () {
    document.getElementById('menuCanvas')?.classList.toggle('grid', this.checked);
  }, { signal });

  document.getElementById('menuSaveBtn')?.addEventListener('click', async () => {
    const menu = getMenuActivo() || {};
    menu.nombre = document.getElementById('menuNameInput')?.value || 'Sin nombre';
    if (_modoActual === 'lienzo') {
      menu.productos = _serializarLienzo();
    }
    Object.assign(menu, _leerEsteticaActual());
    await guardarMenu(menu);
    refrescarLista();
  }, { signal });

  document.getElementById('menuPublishBtn')?.addEventListener('click', async () => {
    const menu = getMenuActivo();
    if (!menu) {
      mostrarToast('error', 'Primero guarda la carta');
      return;
    }
    menu.nombre = document.getElementById('menuNameInput')?.value || menu.nombre;
    if (_modoActual === 'lienzo') {
      menu.productos = _serializarLienzo();
    }
    Object.assign(menu, _leerEsteticaActual());
    await publicarMenu();
    refrescarLista();
    document.getElementById('menuContextMenu')?.classList.remove('active');
  }, { signal });

  document.getElementById('menuPreviewBtn')?.addEventListener('click', () => {
    const canvas = document.getElementById('menuCanvas');
    if (!canvas) return;
    const clone = canvas.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = 'auto';
    clone.style.minHeight = '400px';
    clone.querySelectorAll('.ficha').forEach(f => {
      f.style.cursor = 'default';
      f.style.touchAction = 'auto';
    });
    const previewContent = document.getElementById('menuPreviewContent');
    previewContent.innerHTML = '<button class="close-btn" id="menuClosePreviewBtn">✕ Cerrar</button>';
    previewContent.appendChild(clone);
    document.getElementById('menuPreviewModal')?.classList.add('active');
    document.getElementById('menuClosePreviewBtn')?.addEventListener('click', () => {
      document.getElementById('menuPreviewModal')?.classList.remove('active');
    });
  }, { signal });
}

function agregarFichaNoProducto(tipo, data) {
  const menu = getMenuActivo();
  if (!menu) return;
  const productos = getProductosMenuActivo();
  const nueva = {
    id: tipo + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    tipo,
    x: 100,
    y: 100 + productos.length * 30,
    ...data
  };
  agregarProductoAlMenu(nueva);
  renderLienzo(getProductosMenuActivo());
}

function _serializarLienzo() {
  const canvas = document.getElementById('menuCanvas');
  if (!canvas) return [];
  const fichas = canvas.querySelectorAll('.ficha');
  return Array.from(fichas).map(f => {
    const computed = getComputedStyle(f);
    return {
      id: f.dataset.id,
      tipo: f.dataset.tipo || 'producto',
      x: parseFloat(f.style.left) || 0,
      y: parseFloat(f.style.top) || 0,
      nombre: f.querySelector('.nombre')?.textContent || '',
      precio: parseFloat(f.dataset.price) || 0,
      costo: parseFloat(f.dataset.cost) || 0,
      imagen: f.dataset.imagen || '',
      shape: f.dataset.shape || 'rect',
      display: f.dataset.display || 'both',
      content: f.dataset.content || '',
      color: f.dataset.color || '',
      width: computed.width,
      height: computed.height
    };
  });
}