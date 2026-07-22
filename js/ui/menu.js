/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/menu.js
   Versión: 1.0.1
   Propósito: Fachada del diseñador de menú. Reexporta funciones
              de los submódulos. Delega inicialización a ciclo-vida.
              v1.0.1: elimina autoactivación en scope de módulo.
   ================================================================ */

import { activar, limpiar } from './menu/ciclo-vida.js';
import { getMenuActivo, setMenuActivo, getProductosMenuActivo } from './menu/estado.js';
import { renderLienzo, renderSidebar } from './menu/renderer.js';
import { guardarMenu, publicarMenu, cargarMenus } from './menu/acciones.js';
import { toggle as toggleSidebar } from './menu/barra-lateral.js';
import { toggle as toggleBiblioteca } from './menu/biblioteca.js';

const Menu = {
  activar,
  limpiar,

  /**
   * Renderiza la vista completa del diseñador de menú.
   */
  render() {
    activar();
    const menu = getMenuActivo();
    if (menu) {
      renderLienzo(menu.productos || []);
    }
  },

  /**
   * Guarda el menú actual (crea o actualiza).
   */
  guardar() {
    const menu = getMenuActivo();
    if (menu) {
      guardarMenu(menu);
    }
  },

  /**
   * Publica el menú activo.
   */
  publicar() {
    publicarMenu();
  },

  /**
   * Abre/cierra el panel lateral de menús.
   */
  toggleSidebar,

  /**
   * Abre/cierra la biblioteca de productos.
   */
  toggleBiblioteca,

  /**
   * Obtiene los productos del menú activo.
   */
  getProductos: getProductosMenuActivo,

  /**
   * Establece el menú activo por su id.
   */
  setMenuActivo,

  /**
   * Carga los menús desde Appwrite.
   */
  cargarMenus
};

// ❌ Eliminada autoactivación: activar();

export { Menu };