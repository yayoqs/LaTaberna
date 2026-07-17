/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/barra-lateral.js
   Versión: 1.0.1
   Propósito: Lógica del panel lateral de navegación entre menús.
              v1.0.1: corrige import faltante de getMenuActivo.
   ================================================================ */

import { Store } from '../../lib/store.js';
import { renderSidebar, abrirSidebar, cerrarSidebar } from './renderer.js';
import { getMenuActivo, setMenuActivo } from './estado.js';
import { cargarMenus } from './acciones.js';

let _onMenuSeleccionado = null;

export async function inicializar(onMenuSeleccionado) {
  _onMenuSeleccionado = onMenuSeleccionado;

  await cargarMenus();
  refrescarLista();

  const lista = document.getElementById('menuSidebarList');
  if (lista) {
    lista.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const id = item.dataset.id;
      seleccionarMenu(id);
    });
  }
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