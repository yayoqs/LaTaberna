/* ================================================================
   LaTaberna - PubPOS — MENÚ SUBMÓDULO (ES6)
   Archivo: js/ui/menu/acciones.js
   Versión: 1.0.0
   Propósito: Persistencia de menús en Appwrite y sincronización con Store.
   ================================================================ */

import { DBAppwrite } from '../../db-appwrite.js';
import { Store } from '../../lib/store.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';
import { getMenuActivo, setMenuActivo } from './estado.js';

/**
 * Guarda un menú (crea o actualiza) en Appwrite y lo refleja en el Store.
 * @param {object} menu - El menú a guardar { id, nombre, productos, estado }
 * @returns {Promise<object>} El menú guardado con su id definitivo.
 */
export async function guardarMenu(menu) {
  if (!menu || !menu.nombre) {
    mostrarToast('error', 'El menú necesita un nombre');
    return null;
  }

  try {
    let doc;
    if (menu.id) {
      // Actualizar existente
      doc = await DBAppwrite.actualizar('menus', menu.id, {
        nombre: menu.nombre,
        productos: menu.productos || [],
        estado: menu.estado || 'borrador',
        actualizadoEn: Date.now()
      });
      mostrarToast('success', 'Menú actualizado');
      Logger.info('[Menú] Menú actualizado:', menu.id);
    } else {
      // Crear nuevo
      menu.id = 'menu_' + Date.now();
      doc = await DBAppwrite.crear('menus', menu.id, {
        nombre: menu.nombre,
        productos: menu.productos || [],
        estado: menu.estado || 'borrador',
        creadoPor: 'Admin',
        actualizadoEn: Date.now()
      });
      mostrarToast('success', 'Menú creado');
      Logger.info('[Menú] Menú creado:', menu.id);
    }

    // Sincronizar con el Store local
    const state = Store.obtenerEstado();
    const menus = [...(state.menus || [])];
    const idx = menus.findIndex(m => m.id === menu.id);
    if (idx >= 0) {
      menus[idx] = { ...menus[idx], ...menu };
    } else {
      menus.push(menu);
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

/**
 * Publica el menú activo (cambia su estado a 'publicado').
 * @returns {Promise<object>} El menú publicado.
 */
export async function publicarMenu() {
  const menu = getMenuActivo();
  if (!menu) {
    mostrarToast('error', 'No hay un menú activo para publicar');
    return null;
  }
  menu.estado = 'publicado';
  return guardarMenu(menu);
}

/**
 * Obtiene todos los menús desde Appwrite y los carga en el Store.
 * @returns {Promise<Array>} Lista de menús.
 */
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