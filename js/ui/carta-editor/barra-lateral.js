/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/barra-lateral.js
   Versión: 2.0.3
   Propósito: Lógica del panel lateral de navegación entre cartas.
   v2.0.3: migra el slice del Store menus → cartas (brief D.13 /
           E.x13). Cambios:
             · state.menus → state.cartas en refrescarLista,
               seleccionarMenu y eliminarMenu.
             · MENUS_INICIALIZAR → CARTAS_INICIALIZAR en
               eliminarMenu.
             · Renombra variables locales `menus` → `cartas`.
   v2.0.2: elimina el helper coleccion.js. Se usa directamente
           DBAppwrite.COLECCIONES.cartas.
   v2.0.1: usa COLECCION_CARTAS del helper de compatibilidad en
           eliminar.
   v2.0.0: rename Menus → Cartas. Listeners atados al AbortSignal.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { renderSidebar, abrirSidebar, cerrarSidebar } from './renderer.js';
import { getMenuActivo, setMenuActivo } from './estado.js';
import { cargarMenus, guardarMenu } from './acciones.js';
import { mostrarToast, mostrarConfirmacion } from '../../utils.js';
import { Logger } from '../../lib/logger.js';

let _onMenuSeleccionado = null;

export async function inicializar(signal, onMenuSeleccionado) {
  _onMenuSeleccionado = onMenuSeleccionado;

  await cargarMenus();
  refrescarLista();

  const lista = document.getElementById('menuSidebarList');
  if (lista) {
    lista.addEventListener('click', (e) => {
      const btnEliminar = e.target.closest('.btn-eliminar-menu');
      if (btnEliminar) {
        e.stopPropagation();
        const id = btnEliminar.dataset.id;
        eliminarMenu(id);
        return;
      }

      const item = e.target.closest('.menu-item');
      if (!item) return;
      const id = item.dataset.id;
      seleccionarMenu(id);
    }, { signal });
  }

  document.getElementById('menuNuevoBtn')?.addEventListener('click', crearNuevoMenu, { signal });
}

export function refrescarLista() {
  const state = Store.obtenerEstado();
  const cartas = state.cartas || [];
  renderSidebar(cartas, getMenuActivo());
}

export function seleccionarMenu(id) {
  const state = Store.obtenerEstado();
  const cartas = state.cartas || [];
  const menu = cartas.find(m => m.id === id);
  if (menu) {
    setMenuActivo(menu);
    refrescarLista();
    cerrarSidebar();
    if (typeof _onMenuSeleccionado === 'function') {
      _onMenuSeleccionado(menu);
    }
  }
}

export function toggle() {
  const sidebar = document.getElementById('menuSidebar');
  if (sidebar && sidebar.classList.contains('active')) {
    cerrarSidebar();
  } else {
    abrirSidebar();
  }
}

async function crearNuevoMenu() {
  const nuevoMenu = {
    nombre: 'Nueva Carta',
    productos: [],
    estado: 'borrador',
    fondo: '#1a1a2e',
    tipografia: "'Inter', sans-serif",
    grilla: false
  };

  const menuCreado = await guardarMenu(nuevoMenu);
  if (menuCreado) {
    refrescarLista();
    cerrarSidebar();
    if (typeof _onMenuSeleccionado === 'function') {
      _onMenuSeleccionado(menuCreado);
    }
  }
}

async function eliminarMenu(id) {
  const state = Store.obtenerEstado();
  const cartas = state.cartas || [];
  const menu = cartas.find(m => m.id === id);
  if (!menu) return;

  const confirmado = await mostrarConfirmacion(
    'Eliminar carta',
    `¿Estás seguro de que deseas eliminar la carta "${menu.nombre}"? Esta acción no se puede deshacer.`
  );
  if (!confirmado) return;

  try {
    if (DBAppwrite && DBAppwrite.habilitado) {
      await DBAppwrite.eliminar('cartas', id);
    }

    const cartasActualizadas = cartas.filter(m => m.id !== id);
    Store.despachar({ type: 'CARTAS_INICIALIZAR', payload: cartasActualizadas });

    const menuActivo = getMenuActivo();
    if (menuActivo && menuActivo.id === id) {
      setMenuActivo(null);
      const nameInput = document.getElementById('menuNameInput');
      if (nameInput) nameInput.value = '';
      const canvas = document.getElementById('menuCanvas');
      if (canvas) canvas.innerHTML = '';
    }

    refrescarLista();
    mostrarToast('success', 'Carta eliminada');
  } catch (e) {
    Logger.error('[CartaEditor] Error al eliminar carta:', e);
    mostrarToast('error', 'No se pudo eliminar la carta');
  }
}