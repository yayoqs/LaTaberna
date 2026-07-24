/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/barra-lateral.js
   Versión: 1.2.0
   Propósito: Lógica del panel lateral de navegación entre menús.
              v1.2.0: soporte para eliminar menú desde la barra lateral.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { DBAppwrite } from '../../db-appwrite.js';
import { renderSidebar, abrirSidebar, cerrarSidebar } from './renderer.js';
import { getMenuActivo, setMenuActivo } from './estado.js';
import { cargarMenus, guardarMenu } from './acciones.js';
import { mostrarToast, mostrarConfirmacion } from '../../utils.js';
import { Logger } from '../../lib/logger.js';

let _onMenuSeleccionado = null;

export async function inicializar(onMenuSeleccionado) {
  _onMenuSeleccionado = onMenuSeleccionado;

  await cargarMenus();
  refrescarLista();

  const lista = document.getElementById('menuSidebarList');
  if (lista) {
    lista.addEventListener('click', (e) => {
      // Verificar si el clic fue en el botón de eliminar
      const btnEliminar = e.target.closest('.btn-eliminar-menu');
      if (btnEliminar) {
        e.stopPropagation();
        const id = btnEliminar.dataset.id;
        eliminarMenu(id);
        return;
      }

      // Si no, seleccionar el menú
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const id = item.dataset.id;
      seleccionarMenu(id);
    });
  }

  document.getElementById('menuNuevoBtn')?.addEventListener('click', crearNuevoMenu);
}

export function refrescarLista() {
  const state = Store.obtenerEstado();
  const menus = state.menus || [];
  renderSidebar(menus, getMenuActivo());
}

export function seleccionarMenu(id) {
  const state = Store.obtenerEstado();
  const menus = state.menus || [];
  const menu = menus.find(m => m.id === id);
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
    nombre: 'Nuevo Menú',
    productos: [],
    estado: 'borrador'
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
  const menus = state.menus || [];
  const menu = menus.find(m => m.id === id);
  if (!menu) return;

  const confirmado = await mostrarConfirmacion(
    'Eliminar menú',
    `¿Estás seguro de que deseas eliminar el menú "${menu.nombre}"? Esta acción no se puede deshacer.`
  );
  if (!confirmado) return;

  try {
    // Eliminar de Appwrite
    if (DBAppwrite && DBAppwrite.habilitado) {
      await DBAppwrite.eliminar('menus', id);
    }

    // Actualizar Store
    const menusActualizados = menus.filter(m => m.id !== id);
    Store.despachar({ type: 'MENUS_INICIALIZAR', payload: menusActualizados });

    // Si era el menú activo, limpiar la vista
    const menuActivo = getMenuActivo();
    if (menuActivo && menuActivo.id === id) {
      setMenuActivo(null);
      document.getElementById('menuNameInput').value = '';
      const canvas = document.getElementById('menuCanvas');
      if (canvas) canvas.innerHTML = '';
    }

    refrescarLista();
    mostrarToast('success', 'Menú eliminado');
  } catch (e) {
    Logger.error('[Menú] Error al eliminar menú:', e);
    mostrarToast('error', 'No se pudo eliminar el menú');
  }
}