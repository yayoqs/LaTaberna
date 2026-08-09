/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/ciclo-vida.js
   Versión: 1.2.1
   Propósito: Ciclo de vida de la vista de menú.
              v1.2.1: _serializarLienzo usa getComputedStyle para
                      capturar dimensiones reales del CSS.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { asegurarVista, renderLienzo, abrirSidebar, cerrarSidebar, toggleFabMenu, abrirBiblioteca, cerrarBiblioteca } from './renderer.js';
import { getMenuActivo, setMenuActivo, getProductosMenuActivo, agregarProductoAlMenu, quitarProductoDelMenu } from './estado.js';
import { abrir as abrirProps, cerrar as cerrarProps, guardarCambios, eliminarFicha } from './modal-propiedades.js';
import { guardarMenu, publicarMenu, cargarMenus } from './acciones.js';
import { inicializar as inicializarSidebar, refrescarLista } from './barra-lateral.js';
import { inicializar as inicializarBiblioteca, refrescar as refrescarBiblioteca } from './biblioteca.js';
import { mostrarToast } from '../../utils.js';

let _abortController = null;
let _desuscripciones = [];

export function activar() {
  limpiar();
  _abortController = new AbortController();
  const { signal } = _abortController;

  asegurarVista();
  inicializarSidebar(onMenuSeleccionado);
  inicializarBiblioteca(onProductoAgregado);
  _vincularEventosDOM(signal);

  const unsubscribeStore = Store.suscribir((state, action) => {
    if (action.type === 'MENUS_INICIALIZAR' || action.type === 'PRODUCTOS_INICIALIZAR' || action.type === 'RECETAS_INICIALIZAR') {
      refrescarLista();
      refrescarBiblioteca();
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
}

// ── CALLBACKS ─────────────────────────────────────────────

function onMenuSeleccionado(menu) {
  setMenuActivo(menu);
  document.getElementById('menuNameInput').value = menu.nombre;
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

// ── VINCULACIÓN DE EVENTOS DEL DOM ───────────────────────

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

      switch(action) {
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

  document.getElementById('menuBgSelect')?.addEventListener('change', function() {
    const canvas = document.getElementById('menuCanvas');
    if (canvas) canvas.style.backgroundColor = this.value;
  }, { signal });
  document.getElementById('menuFontSelect')?.addEventListener('change', function() {
    const canvas = document.getElementById('menuCanvas');
    if (canvas) canvas.style.fontFamily = this.value;
  }, { signal });
  document.getElementById('menuGridToggle')?.addEventListener('change', function() {
    document.getElementById('menuCanvas')?.classList.toggle('grid', this.checked);
  }, { signal });

  document.getElementById('menuSaveBtn')?.addEventListener('click', async () => {
    const menu = getMenuActivo() || {};
    menu.nombre = document.getElementById('menuNameInput')?.value || 'Sin nombre';
    menu.productos = _serializarLienzo();
    await guardarMenu(menu);
    refrescarLista();
  }, { signal });

  document.getElementById('menuPublishBtn')?.addEventListener('click', async () => {
    const menu = getMenuActivo();
    if (!menu) {
      mostrarToast('error', 'Primero guarda el menú');
      return;
    }
    menu.nombre = document.getElementById('menuNameInput')?.value || menu.nombre;
    menu.productos = _serializarLienzo();
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
  }, { signal});
}

// ── HELPERS ────────────────────────────────────────────────

function agregarFichaNoProducto(tipo, data) {
  const menu = getMenuActivo();
  if (!menu) return;
  const productos = getProductosMenuActivo();
  const nueva = {
    id: tipo + '_' + Date.now(),
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
    // ✅ Corrección H16: usar getComputedStyle para obtener dimensiones reales
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