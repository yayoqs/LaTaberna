/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/receta-repository.js
   Versión: 1.0.2
   Propósito: Repositorio de recetas y productos (Appwrite + localStorage).
              Corrección: garantiza que categoria y nivel se envíen
              explícitamente a Appwrite.
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';

export function crearRecetaRepo() {
  return {

    async guardarReceta(datos) {
      const receta = { ...datos };
      let guardadoRemoto = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          // Forzar explícitamente los campos para evitar undefined
          const docParaAppwrite = {
            productoId: receta.productoId || '',
            nivel: receta.nivel || 'sin_nivel',
            categoria: receta.categoria || 'sin_categoria',
            es_intermedio: receta.es_intermedio || false,
            destino: receta.destino || 'cocina',
            ingredientes: Array.isArray(receta.ingredientes) ? JSON.stringify(receta.ingredientes) : '[]',
            instrucciones: receta.instrucciones || '',
            stockActual: receta.stockActual || 0,
            unidadStock: receta.unidadStock || ''
          };

          Logger.debug('[RecetaRepo] Enviando a Appwrite:', JSON.stringify(docParaAppwrite));

          if (receta.id) {
            await DBAppwrite.actualizar('recetas', receta.id, docParaAppwrite);
            Logger.debug('[RecetaRepo] Receta actualizada en Appwrite:', receta.id);
          } else {
            const docRemoto = await DBAppwrite.crear('recetas', null, docParaAppwrite);
            if (docRemoto && docRemoto.id) {
              receta.id = docRemoto.id;
            }
            Logger.debug('[RecetaRepo] Receta creada en Appwrite:', receta.id);
          }
          guardadoRemoto = true;
        } catch (e) {
          Logger.warn('[RecetaRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      if (!guardadoRemoto) {
        receta._pendiente_sync = true;
        Logger.info('[RecetaRepo] Receta marcada para sincronización futura.');
        if (typeof DB.colaSync !== 'undefined') {
          DB.colaSync.push({ tipo: 'guardarReceta', datos: receta });
        }
      }

      if (!receta.id) {
        receta.id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }

      const idx = (DB.recetas || []).findIndex(r => r.id === receta.id);
      if (idx >= 0) {
        DB.recetas[idx] = receta;
      } else {
        DB.recetas.push(receta);
      }
      localStorage.setItem('pubpos_recetas', JSON.stringify(DB.recetas));

      if (Store) {
        Store.despachar({ type: 'RECETA_GUARDADA', payload: receta });
      }

      return receta;
    },

    async guardarProducto(datos) {
      const producto = { ...datos };
      let guardadoRemoto = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            nombre: producto.nombre,
            activo: producto.activo !== false,
            destino: producto.destino || 'cocina'
          };
          if (producto.id) {
            await DBAppwrite.actualizar('productos', producto.id, docParaAppwrite);
          } else {
            const docRemoto = await DBAppwrite.crear('productos', null, docParaAppwrite);
            if (docRemoto && docRemoto.id) {
              producto.id = docRemoto.id;
            }
          }
          guardadoRemoto = true;
          Logger.debug('[RecetaRepo] Producto guardado en Appwrite:', producto.id);
        } catch (e) {
          Logger.warn('[RecetaRepo] No se pudo guardar producto en Appwrite:', e);
        }
      }

      if (!guardadoRemoto) {
        producto._pendiente_sync = true;
        if (typeof DB.colaSync !== 'undefined') {
          DB.colaSync.push({ tipo: 'guardarProducto', datos: producto });
        }
      }

      if (!producto.id) {
        producto.id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }

      const idx = (DB.productos || []).findIndex(p => p.id === producto.id);
      if (idx >= 0) {
        DB.productos[idx] = producto;
      } else {
        DB.productos.push(producto);
      }
      localStorage.setItem('pubpos_productos', JSON.stringify(DB.productos));

      if (Store) {
        Store.despachar({ type: 'PRODUCTO_GUARDADO', payload: producto });
      }

      return producto;
    },

    async eliminarReceta(id) {
      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          await DBAppwrite.eliminar('recetas', id);
          Logger.debug('[RecetaRepo] Receta eliminada en Appwrite:', id);
        } catch (e) {
          Logger.warn('[RecetaRepo] No se pudo eliminar en Appwrite:', e);
        }
      }

      DB.recetas = (DB.recetas || []).filter(r => r.id !== id);
      localStorage.setItem('pubpos_recetas', JSON.stringify(DB.recetas));

      if (Store) {
        Store.despachar({ type: 'RECETA_ELIMINADA', payload: id });
      }

      return true;
    },

    async obtenerPorId(id) {
      return (DB.recetas || []).find(r => r.id === id) || null;
    },

    async obtenerPorProductoId(productoId) {
      return (DB.recetas || []).find(r => r.productoId == productoId) || null;
    },

    async actualizarStockReceta(id, nuevoStock) {
      const receta = (DB.recetas || []).find(r => r.id === id);
      if (!receta) return null;
      receta.stockActual = nuevoStock;
      return this.guardarReceta(receta);
    },

    async actualizarStockIngrediente(id, nuevoStock) {
      const ingrediente = (DB.ingredientes || []).find(i => i.id === id);
      if (!ingrediente) return null;
      ingrediente.stock = nuevoStock;
      localStorage.setItem('pubpos_ingredientes', JSON.stringify(DB.ingredientes));

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          await DBAppwrite.actualizar('ingredientes', id, { stock: nuevoStock });
          Logger.debug('[RecetaRepo] Stock de ingrediente actualizado en Appwrite:', id);
        } catch (e) {
          Logger.warn('[RecetaRepo] No se pudo actualizar stock en Appwrite:', e);
        }
      }

      if (Store) {
        Store.despachar({ type: 'INGREDIENTE_GUARDADO', payload: ingrediente });
      }
      return ingrediente;
    }
  };
}