/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/variante-repository.js
   Versión: 1.1.1
   Propósito: Repositorio del catálogo de variantes
              (laTaberna_Variantes). CRUD con persistencia en
              Appwrite y fallback local. Emite
              'variantes:actualizadas' tras cada operación y
              despacha al Store para que las vistas suscriptoras
              refresquen sin recargar.
              El borrado es lógico (activo: false), nunca físico,
              según ARQUITECTURA-VARIANTES.md §3.2.
   v1.1.1: A.77 (Regla 22 del brief). desactivarVariante y
           reactivarVariante verifican el retorno real de
           DBAppwrite.actualizar antes de despachar al Store y
           emitir el evento. Si Appwrite rechaza, se retorna
           null sin tocar Store, sin persistir local, sin
           emitir 'variantes:actualizadas'. Fin del patrón
           "despacha al Store como si hubiera guardado"
           reportado por Célula D. Cierra el último caso de
           verificación de retornos en este repositorio
           (guardarVariante ya lo hacía desde v1.1.0).
   v1.1.0: A.45: Store.despachar('VARIANTE_GUARDADA') en guardar,
           desactivar y reactivar. cargarVariantes() despacha
           'VARIANTES_INICIALIZAR'. Requiere Store v2.0.13 o
           superior.
   v1.0.0: creación inicial.
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';

export function crearVarianteRepo() {
  return {

    async guardarVariante(datos) {
      const variante = { ...datos };
      let guardadoRemoto = false;

      const docParaAppwrite = _construirDocumento(variante);

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          if (variante.id) {
            try {
              const actualizada = await DBAppwrite.actualizar('variantes', variante.id, docParaAppwrite);
              if (actualizada) {
                guardadoRemoto = true;
              } else {
                const creada = await DBAppwrite.crear('variantes', variante.id, docParaAppwrite);
                if (creada && creada.id) {
                  variante.id = creada.id;
                  guardadoRemoto = true;
                }
              }
            } catch (e) {
              if (e.code === 404) {
                const creada = await DBAppwrite.crear('variantes', variante.id, docParaAppwrite);
                if (creada && creada.id) {
                  variante.id = creada.id;
                  guardadoRemoto = true;
                }
              } else {
                throw e;
              }
            }
          } else {
            const creada = await DBAppwrite.crear('variantes', null, docParaAppwrite);
            if (creada && creada.id) {
              variante.id = creada.id;
              guardadoRemoto = true;
            }
          }
        } catch (e) {
          Logger.warn('[VarianteRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      if (!guardadoRemoto) {
        variante._pendiente_sync = true;
        Logger.info('[VarianteRepo] Variante marcada para sincronización futura.');
      }

      if (!variante.id) {
        variante.id = 'loc_var_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      }

      _persistirLocal(variante);
      EventBus.emit('variantes:actualizadas', variante);
      Store.despachar({ type: 'VARIANTE_GUARDADA', payload: variante });
      return variante;
    },

    async desactivarVariante(id) {
      if (!id) throw new Error('Se requiere id de variante');
      const variante = await this.obtenerPorId(id);
      if (!variante) throw new Error('Variante no encontrada');

      const cambios = { activo: false };

      // A.77: verificar retorno antes de despachar al Store.
      if (DBAppwrite && DBAppwrite.habilitado) {
        const resultado = await DBAppwrite.actualizar('variantes', id, cambios);
        if (!resultado) {
          Logger.error('[VarianteRepo] Appwrite rechazó desactivar la variante ' + id + '. Store intacto.');
          return null;
        }
      }

      const actualizada = { ...variante, activo: false };
      _persistirLocal(actualizada);
      EventBus.emit('variantes:actualizadas', actualizada);
      Store.despachar({ type: 'VARIANTE_GUARDADA', payload: actualizada });
      return actualizada;
    },

    async reactivarVariante(id) {
      if (!id) throw new Error('Se requiere id de variante');
      const variante = await this.obtenerPorId(id);
      if (!variante) throw new Error('Variante no encontrada');

      const cambios = { activo: true };

      // A.77: verificar retorno antes de despachar al Store.
      if (DBAppwrite && DBAppwrite.habilitado) {
        const resultado = await DBAppwrite.actualizar('variantes', id, cambios);
        if (!resultado) {
          Logger.error('[VarianteRepo] Appwrite rechazó reactivar la variante ' + id + '. Store intacto.');
          return null;
        }
      }

      const actualizada = { ...variante, activo: true };
      _persistirLocal(actualizada);
      EventBus.emit('variantes:actualizadas', actualizada);
      Store.despachar({ type: 'VARIANTE_GUARDADA', payload: actualizada });
      return actualizada;
    },

    async obtenerTodas() {
      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const lista = await DBAppwrite.listar('variantes');
          return lista.map(_parsearFila);
        } catch (e) {
          Logger.warn('[VarianteRepo] Error al listar variantes de Appwrite:', e);
        }
      }
      return _leerLocal();
    },

    async obtenerPorId(id) {
      const todas = await this.obtenerTodas();
      return todas.find(v => v.id === id) || null;
    },

    /**
     * Carga el catálogo completo de variantes del espacio activo y
     * lo publica en el Store. Se usa al arranque (bootstrap) y en
     * recargas manuales.
     * @returns {Promise<Array>} Lista de variantes cargadas.
     */
    async cargarVariantes() {
      const lista = await this.obtenerTodas();
      Store.despachar({ type: 'VARIANTES_INICIALIZAR', payload: lista });
      Logger.info('[VarianteRepo] Variantes cargadas al Store: ' + lista.length);
      return lista;
    }
  };

  /* ── Helpers privados ──────────────────────────────────── */

  function _construirDocumento(variante) {
    const doc = {
      nombre: variante.nombre || '',
      descripcion: variante.descripcion || '',
      tipo: ['unica', 'multiple'].includes(variante.tipo) ? variante.tipo : 'unica',
      requerido: variante.requerido === true,
      min_seleccion: Number.isInteger(variante.min_seleccion) ? variante.min_seleccion : 0,
      max_seleccion: Number.isInteger(variante.max_seleccion) ? variante.max_seleccion : 1,
      opciones: Array.isArray(variante.opciones)
        ? JSON.stringify(variante.opciones)
        : String(variante.opciones || '[]'),
      activo: variante.activo !== false,
      orden: Number.isInteger(variante.orden) ? variante.orden : 0
    };

    if (variante.espacioId) doc.espacioId = variante.espacioId;

    return doc;
  }

  function _parsearFila(fila) {
    const v = { ...fila };
    if (typeof v.opciones === 'string') {
      try { v.opciones = JSON.parse(v.opciones); } catch { v.opciones = []; }
    }
    if (!Array.isArray(v.opciones)) v.opciones = [];
    return v;
  }

  function _leerLocal() {
    try {
      const raw = localStorage.getItem('pubpos_variantes');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(_parsearFila);
    } catch (e) {
      Logger.warn('[VarianteRepo] Error al leer variantes locales:', e);
      return [];
    }
  }

  function _persistirLocal(variante) {
    try {
      const lista = _leerLocal();
      const idx = lista.findIndex(v => v.id === variante.id);
      if (idx >= 0) lista[idx] = variante;
      else lista.push(variante);
      localStorage.setItem('pubpos_variantes', JSON.stringify(lista));

      // Sincronizar el array en memoria de db-inventario si DB está disponible.
      if (typeof DB !== 'undefined' && DB) {
        if (!Array.isArray(DB.variantes)) DB.variantes = [];
        const i = DB.variantes.findIndex(v => v.id === variante.id);
        if (i >= 0) DB.variantes[i] = variante;
        else DB.variantes.push(variante);
      }
    } catch (e) {
      Logger.warn('[VarianteRepo] Error al persistir variante local:', e);
    }
  }
}