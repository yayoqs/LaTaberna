/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/receta-repository.js
   Versión: 1.1.0
   Propósito: Repositorio de recetas y productos (Appwrite + localStorage).
              v1.1.0: agregados métodos guardarInsumo y actualizarStockInsumo.
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
            tipo: 'Compuesto',
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

    async guardarInsumo(datos) {
      const insumo = { ...datos };
      let guardadoRemoto = false;

      if (!DB.insumos) DB.insumos = [];

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            nombre: insumo.nombre,
            stock: insumo.stock ?? 0,
            unidad: insumo.unidad || 'u',
            stock_minimo: insumo.stock_minimo || 0,
            categoria: insumo.categoria || 'general',
            ubicacion: insumo.ubicacion || '',
            tipo: insumo.tipo || 'cocina',
            costo_manual: insumo.costo_manual ?? null
          };

          if (insumo.id) {
            try {
              await DBAppwrite.actualizar('insumos', insumo.id, docParaAppwrite);
              guardadoRemoto = true;
            } catch (e) {
              if (e.code === 404) {
                const docRemoto = await DBAppwrite.crear('insumos', null, docParaAppwrite);
                if (docRemoto && docRemoto.id) {
                  insumo.id = docRemoto.id;
                  guardadoRemoto = true;
                }
              } else {
                Logger.warn('[RecetaRepo] Error al guardar insumo en Appwrite:', e);
              }
            }
          } else {
            const docRemoto = await DBAppwrite.crear('insumos', null, docParaAppwrite);
            if (docRemoto && docRemoto.id) {
              insumo.id = docRemoto.id;
              guardadoRemoto = true;
            }
          }

          if (guardadoRemoto) {
            Logger.debug('[RecetaRepo] Insumo guardado en Appwrite:', insumo.id);
          }
        } catch (e) {
          Logger.warn('[RecetaRepo] No se pudo guardar insumo en Appwrite, usando fallback local:', e);
        }
      }

      if (!insumo.id) {
        insumo.id = 'ins_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }

      const idx = DB.insumos.findIndex(i => i.id === insumo.id);
      if (idx >= 0) {
        DB.insumos[idx] = insumo;
      } else {
        DB.insumos.push(insumo);
      }
      localStorage.setItem('pubpos_insumos', JSON.stringify(DB.insumos));

      if (Store) {
        Store.despachar({ type: 'INSUMO_GUARDADO', payload: insumo });
      }

      return insumo;
    },

    async actualizarStockInsumo(id, nuevoStock) {
      const insumo = (DB.insumos || []).find(i => i.id === id);
      if (!insumo) return null;
      insumo.stock = nuevoStock;
      return this.guardarInsumo(insumo);
    },

    async actualizarStockIngrediente(id, nuevoStock) {
      const insumo = (DB.insumos || DB.ingredientes || []).find(i => i.id === id);
      if (!insumo) return null;
      insumo.stock = nuevoStock;
      return this.guardarInsumo(insumo);
    }
  };
}