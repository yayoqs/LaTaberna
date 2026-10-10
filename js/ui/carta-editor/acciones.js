/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/acciones.js
   Versión: 2.0.3
   Propósito: Persistencia de cartas en Appwrite y sincronización
              con Store.
   v2.0.3: migra el slice del Store menus → cartas (brief D.13 /
           E.x13). El slice legacy ya no existía en el reducer:
           los despachos caían silenciosamente en default y el
           Store nunca reflejaba las cartas cargadas o guardadas.
           Cambios:
             · state.menus → state.cartas en guardarMenu.
             · MENUS_INICIALIZAR → CARTAS_INICIALIZAR en guardarMenu
               y en cargarMenus.
             · Renombra variables locales `menus` → `cartas` para
               no confundirlas con el slice legacy.
   v2.0.2: elimina el helper coleccion.js. Se usa directamente
           DBAppwrite.COLECCIONES.cartas, activo desde db-appwrite
           v1.18.0.
   v2.0.1: fix de persistencia. productos se serializa como JSON
           string. Verificación de retorno de crear/actualizar.
   v2.0.0: rename Menus → Cartas.
   ================================================================ */

import { DBAppwrite } from '../../db-appwrite.js';
import { Store } from '../../lib/store.js';
import { EventBus } from '../../lib/eventBus.js';
import { Logger } from '../../lib/logger.js';
import { mostrarToast } from '../../utils.js';
import { getMenuActivo, setMenuActivo } from './estado.js';

function _parseProductos(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.trim()) {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function guardarMenu(menu) {
  if (!menu || !menu.nombre) {
    mostrarToast('error', 'La carta necesita un nombre');
    return null;
  }

  try {
    const datosMenu = {
      nombre: menu.nombre,
      productos: JSON.stringify(Array.isArray(menu.productos) ? menu.productos : []),
      estado: menu.estado || 'borrador',
      fondo: menu.fondo || '#1a1a2e',
      tipografia: menu.tipografia || "'Inter', sans-serif",
      grilla: menu.grilla === true,
      actualizadoEn: Date.now()
    };

    let resultado;

    if (menu.id) {
      resultado = await DBAppwrite.actualizar('cartas', menu.id, datosMenu);
      if (!resultado) {
        Logger.error('[CartaEditor] Falló la actualización de carta', menu.id);
        mostrarToast('error', 'No se pudo actualizar la carta');
        return null;
      }
      Logger.info('[CartaEditor] Carta actualizada:', menu.id);
    } else {
      menu.id = 'carta_' + Date.now();
      resultado = await DBAppwrite.crear('cartas', menu.id, {
        ...datosMenu,
        creadoPor: 'Admin'
      });
      if (!resultado) {
        Logger.error('[CartaEditor] Falló la creación de carta', menu.id);
        mostrarToast('error', 'No se pudo crear la carta');
        menu.id = null;
        return null;
      }
      Logger.info('[CartaEditor] Carta creada:', menu.id);
    }

    const menuParaStore = {
      ...menu,
      productos: Array.isArray(menu.productos) ? menu.productos : []
    };

    const state = Store.obtenerEstado();
    const cartas = [...(state.cartas || [])];
    const idx = cartas.findIndex(m => m.id === menu.id);
    if (idx >= 0) {
      cartas[idx] = { ...cartas[idx], ...menuParaStore };
    } else {
      cartas.push(menuParaStore);
    }
    Store.despachar({ type: 'CARTAS_INICIALIZAR', payload: cartas });

    setMenuActivo(menuParaStore);
    mostrarToast('success', menu.id ? 'Carta guardada' : 'Carta creada');
    return menuParaStore;
  } catch (e) {
    Logger.error('[CartaEditor] Error inesperado al guardar carta:', e);
    mostrarToast('error', 'Error al guardar la carta');
    return null;
  }
}

export async function publicarMenu() {
  const menu = getMenuActivo();
  if (!menu) {
    mostrarToast('error', 'No hay una carta activa para publicar');
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
    const crudos = await DBAppwrite.listar('cartas');
    const cartas = (crudos || []).map(m => ({
      ...m,
      productos: _parseProductos(m.productos)
    }));
    Store.despachar({ type: 'CARTAS_INICIALIZAR', payload: cartas });
    Logger.info('[CartaEditor] Cartas cargadas desde Appwrite:', cartas.length);
    return cartas;
  } catch (e) {
    Logger.error('[CartaEditor] Error al cargar cartas:', e);
    return [];
  }
}