/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/acciones.js
   Versión: 1.2.0
   Propósito: Persistencia de menús en Appwrite y sincronización con Store.
              v1.2.0: incluye estilos visuales (fondo, tipografía, grilla).
   ================================================================ */

import { DBAppwrite } from '../../db-appwrite.js';
import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';
import { getMenuActivo, setMenuActivo } from './estado.js';

export async function guardarMenu(menu) {
  if (!menu || !menu.nombre) {
    mostrarToast('error', 'El menú necesita un nombre');
    return null;
  }

  try {
    const datosMenu = {
      nombre: menu.nombre,
      productos: menu.productos || [],
      estado: menu.estado || 'borrador',
      fondo: menu.fondo || '#1a1a2e',
      tipografia: menu.tipografia || "'Inter', sans-serif",
      grilla: menu.grilla || false,
      actualizadoEn: Date.now()
    };

    if (menu.id) {
      await DBAppwrite.actualizar('menus', menu.id, datosMenu);
      mostrarToast('success', 'Menú actualizado');
      Logger.info('[Menú] Menú actualizado:', menu.id);
    } else {
      menu.id = 'menu_' + Date.now();
      await DBAppwrite.crear('menus', menu.id, {
        ...datosMenu,
        creadoPor: 'Admin'
      });
      mostrarToast('success', 'Menú creado');
      Logger.info('[Menú] Menú creado:', menu.id);
    }

    const state = Store.obtenerEstado();
    const menus = [...(state.menus || [])];
    const idx = menus.findIndex(m => m.id === menu.id);
    if (idx >= 0) {
      menus[idx] = { ...menus[idx], ...menu, ...datosMenu };
    } else {
      menus.push({ ...menu, ...datosMenu });
    }
    Store.despachar({ type: 'MENUS_INICIALIZAR', payload: menus });

    setMenuActivo(menu);
    return menu;
  } catch (e) {
    Logger.error('[Menú] Error al guardar menú:', e);
    mostrarToast('error', 'No se pudo guardar el menú');
    return null;
  }
}

export async function publicarMenu() {
  const menu = getMenuActivo();
  if (!menu) {
    mostrarToast('error', 'No hay un menú activo para publicar');
    return null;
  }
  menu.estado = 'publicado';
  const resultado = await guardarMenu(menu);
  if (resultado) {
    EventBus.emit('menus:actualizados', resultado);
  }
  return resultado;
}

export async function cargarMenus() {
  try {
    const menus = await DBAppwrite.listar('menus');
    Store.despachar({ type: 'MENUS_INICIALIZAR', payload: menus || [] });
    Logger.info('[Menú] Menús cargados desde Appwrite:', menus?.length || 0);
    return menus || [];
  } catch (e) {
    Logger.error('[Menú] Error al cargar menús:', e);
    return [];
  }
}