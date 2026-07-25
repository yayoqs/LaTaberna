/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/receta-repository.js
   Versión: 1.0.5
   Propósito: Repositorio de recetas y productos (Appwrite + localStorage).
              v1.0.5: usa 'Compuesto' como valor para el campo 'tipo'
                      en productos. Omite stockActual en recetas hasta
                      que la columna exista en Appwrite.
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
      let errorEstructura = false;

      if (!receta.productoId) {
        const productoCreado = await this.guardarProducto({
          nombre: receta._nombreProducto || 'Producto ' + Date.now(),
          activo: true,
          destino: receta.destino || 'cocina'
        });
        receta.productoId = productoCreado.id;
      }

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            productoId: receta.productoId,
            nivel: receta.nivel || '',
            categoria: receta.categoria || 'sin_categoria',
            es_intermedio: receta.es_intermedio || false,
            destino: receta.destino || 'cocina',
            ingredientes: Array.isArray(receta.ingredientes) ? JSON.stringify(receta.ingredientes) : '[]',
            instrucciones: receta.instrucciones || ''
            // stockActual se omite hasta que Appwrite tenga la columna
          };

          if (receta.id) {
            try {
              await DBAppwrite.actualizar('recetas', receta.id, docParaAppwrite);
              guardadoRemoto = true;
            } catch (e) {
              if (e.code === 404) {
                const docRemoto = await DBAppwrite.crear('recetas', null, docParaAppwrite);
                if (docRemoto && docRemoto.id) {
                  receta.id = docRemoto.id;
                  guardadoRemoto = true;
                }
              } else if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
                Logger.warn('[RecetaRepo] Estructura rechazada por Appwrite:', e.message);
              } else {
                throw e;
              }
            }
          } else {
            try {
              const docRemoto = await DBAppwrite.crear('recetas', null, docParaAppwrite);
              if (docRemoto && docRemoto.id) {
                receta.id = docRemoto.id;
                guardadoRemoto = true;
              }
            } catch (e) {
              if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
                Logger.warn('[RecetaRepo] Estructura rechazada por Appwrite:', e.message);
              } else {
                throw e;
              }
            }
          }

          if (guardadoRemoto) {
            Logger.debug('[RecetaRepo] Receta guardada en Appwrite:', receta.id);
          }
        } catch (e) {
          Logger.warn('[RecetaRepo] Error al guardar en Appwrite:', e);
        }
      }

      if (!guardadoRemoto) {
        receta._pendiente_sync = true;
        receta._error_sync = errorEstructura ? 'estructura_invalida' : 'sin_conexion';
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
      let errorEstructura = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            nombre: producto.nombre,
            activo: producto.activo !== false,
            tipo: 'Compuesto',   // valor requerido por Appwrite (Simple | Compuesto)
            destino: producto.destino || 'cocina'
          };

          if (producto.id) {
            try {
              await DBAppwrite.actualizar('productos', producto.id, docParaAppwrite);
              guardadoRemoto = true;
            } catch (e) {
              if (e.code === 404) {
                const docRemoto = await DBAppwrite.crear('productos', null, docParaAppwrite);
                if (docRemoto && docRemoto.id) {
                  producto.id = docRemoto.id;
                  guardadoRemoto = true;
                }
              } else if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
              } else {
                throw e;
              }
            }
          } else {
            try {
              const docRemoto = await DBAppwrite.crear('productos', null, docParaAppwrite);
              if (docRemoto && docRemoto.id) {
                producto.id = docRemoto.id;
                guardadoRemoto = true;
              }
            } catch (e) {
              if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
              } else {
                throw e;
              }
            }
          }

          if (guardadoRemoto) {
            Logger.debug('[RecetaRepo] Producto guardado en Appwrite:', producto.id);
          }
        } catch (e) {
          Logger.warn('[RecetaRepo] Error al guardar producto en Appwrite:', e);
        }
      }

      if (!guardadoRemoto) {
        producto._pendiente_sync = true;
        producto._error_sync = errorEstructura ? 'estructura_invalida' : 'sin_conexion';
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
          Logger.warn('[RecetaRepo] Error al eliminar en Appwrite:', e);
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
          Logger.debug('[RecetaRepo] Stock actualizado en Appwrite:', id);
        } catch (e) {
          Logger.warn('[RecetaRepo] Error al actualizar stock en Appwrite:', e);
        }
      }

      if (Store) {
        Store.despachar({ type: 'INGREDIENTE_GUARDADO', payload: ingrediente });
      }
      return ingrediente;
    }
  };
}