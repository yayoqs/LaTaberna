/* ================================================================
   LaTaberna - PubPOS — UI JS (ES6)
   Archivo: js/ui/carta-editor.js
   Versión: 2.0.0
   Propósito: Fachada del diseñador de cartas. Reexporta funciones
              de los submódulos. Delega inicialización a ciclo-vida.
   v2.0.0: rename Menus → Cartas. Módulo Menu → CartaEditor.
           Carpeta menu/ → carta-editor/. Deja de exponer
           render(), que era redundante con activar().
   ================================================================ */

import { activar, limpiar } from './carta-editor/ciclo-vida.js';
import { getMenuActivo, setMenuActivo, getProductosMenuActivo } from './carta-editor/estado.js';
import { renderLienzo } from './carta-editor/renderer.js';
import { guardarMenu, publicarMenu, cargarMenus } from './carta-editor/acciones.js';
import { toggle as toggleSidebar } from './carta-editor/barra-lateral.js';
import { toggle as toggleBiblioteca } from './carta-editor/biblioteca.js';

const CartaEditor = {
  activar,
  limpiar,

  guardar() {
    const menu = getMenuActivo();
    if (menu) guardarMenu(menu);
  },

  publicar() {
    publicarMenu();
  },

  toggleSidebar,
  toggleBiblioteca,

  getProductos: getProductosMenuActivo,
  setMenuActivo,
  cargarMenus,
  renderLienzo
};

export { CartaEditor };