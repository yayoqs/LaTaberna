/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/inventario-repository.js
   Versión: 1.3.0
   Propósito: Repositorio de inventario reutilizable (Appwrite + localStorage).
              v1.3.0: A.74: se elimina registrarMovimiento. La generación
                      y persistencia de movimientos pasa a
                      db-inventario.js como operación canónica. Se
                      agrega guardarMovimiento(movimiento) como wrapper
                      de DBAppwrite.crear para futuras refactorizaciones
                      donde la persistencia se centralice en el repo.
              v1.2.0: guardarInsumo propaga vendible, precio_venta y
                      destino a Appwrite.
              v1.1.1: restaura métodos de lectura.
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';

export function crearInventarioRepo() {
  return {
    async guardarInsumo(datos) {
      const insumo = { ...datos };
      let guardadoRemoto = false;
      let errorEstructura = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            nombre: insumo.nombre,
            stock: insumo.stock,
            unidad: insumo.unidad || 'u',
            stock_minimo: insumo.stock_minimo ?? insumo.stockMinimo ?? 0,
            categoria: insumo.categoria || 'general',
            ubicacion: insumo.ubicacion || '',
            tipo: insumo.tipo || 'cocina',
            costo_manual: insumo.costo_manual != null ? insumo.costo_manual : null,
            vendible: insumo.vendible === true,
            precio_venta: insumo.vendible === true ? (Number(insumo.precio_venta) || 0) : 0,
            destino: ['cocina', 'barra', 'ambos'].includes(insumo.destino) ? insumo.destino : 'cocina'
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
              } else if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
                Logger.warn('[InventarioRepo] Estructura de documento rechazada por Appwrite (campos nuevos pendientes).');
              } else {
                throw e;
              }
            }
          } else {
            try {
              const docRemoto = await DBAppwrite.crear('insumos', null, docParaAppwrite);
              if (docRemoto && docRemoto.id) {
                insumo.id = docRemoto.id;
                guardadoRemoto = true;
              }
            } catch (e) {
              if (e.type === 'row_invalid_structure') {
                errorEstructura = true;
                Logger.warn('[InventarioRepo] Estructura de documento rechazada por Appwrite (campos nuevos pendientes).');
              } else {
                throw e;
              }
            }
          }

          if (guardadoRemoto) {
            Logger.debug('[InventarioRepo] Insumo guardado en Appwrite:', insumo.id);
          }
        } catch (e) {
          Logger.warn('[InventarioRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      if (!guardadoRemoto) {
        insumo._pendiente_sync = true;
        insumo._error_sync = errorEstructura ? 'estructura_invalida' : 'sin_conexion';
        Logger.info('[InventarioRepo] Insumo marcado para sincronización futura.');
        if (typeof DB.colaSync !== 'undefined') {
          DB.colaSync.push({ tipo: 'guardarInsumo', datos: insumo });
        }
      }

      if (!insumo.id) {
        insumo.id = 'l' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      }

      if (!DB.insumos) DB.insumos = [];
      const idx = DB.insumos.findIndex(i => i.id == insumo.id);
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

    async obtenerPorId(id) {
      return (DB.insumos || []).find(i => i.id == id) || null;
    },

    /**
     * A.74: persiste un movimiento en Appwrite.
     * Wrapper de DBAppwrite.crear('movimientos', ...).
     *
     * Disponible para futuras refactorizaciones donde la persistencia
     * de movimientos se centralice en el repo. No es llamado desde
     * db-inventario.js hoy: la operación canónica persiste directo.
     *
     * @param {object} movimiento
     * @returns {Promise<object|null>}
     */
    async guardarMovimiento(movimiento) {
      if (!movimiento || !movimiento.id) {
        Logger.warn('[InventarioRepo] guardarMovimiento: movimiento inválido.');
        return null;
      }

      if (!DBAppwrite || !DBAppwrite.habilitado) {
        Logger.warn('[InventarioRepo] guardarMovimiento: Appwrite no disponible.');
        return null;
      }

      try {
        const docRemoto = await DBAppwrite.crear('movimientos', movimiento.id, {
          insumoId: movimiento.insumoId,
          insumoNombre: movimiento.insumoNombre,
          tipo: movimiento.tipo,
          cantidad: movimiento.cantidad,
          unidad: movimiento.unidad || '',
          motivo: movimiento.motivo || '',
          referencia: movimiento.referencia || '',
          usuario: movimiento.usuario || '',
          usuarioId: movimiento.usuarioId || '',
          fecha: movimiento.fecha,
          espacioId: movimiento.espacioId
        });

        if (docRemoto && docRemoto.id) {
          Logger.debug('[InventarioRepo] Movimiento persistido en Appwrite:', docRemoto.id);
          return docRemoto;
        }

        Logger.warn('[InventarioRepo] No se pudo persistir el movimiento en Appwrite.');
        return null;
      } catch (e) {
        Logger.warn('[InventarioRepo] Error al persistir movimiento:', e);
        return null;
      }
    },

    // ── MÉTODOS DE LECTURA ───────────────────────────────────
    async obtenerInsumos() {
      return DB.insumos || [];
    },

    async obtenerRecetas() {
      return DB.recetas || [];
    },

    // ── guardarEntrada ───────────────────────────────────────
    async guardarEntrada(datos) {
      const entrada = { ...datos };
      let guardadoRemoto = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            insumoId: entrada.insumoId,
            proveedorId: entrada.proveedorId,
            formato: entrada.formato || '',
            cantidad: entrada.cantidad || 0,
            unidad_por_formato: entrada.unidad_por_formato || 1,
            costo_total: entrada.costo_total || 0,
            costo_unitario: entrada.costo_unitario || 0,
            fecha: entrada.fecha || new Date().toISOString()
          };

          const docRemoto = await DBAppwrite.crear('entradas', null, docParaAppwrite);
          if (docRemoto && docRemoto.id) {
            entrada.id = docRemoto.id;
            guardadoRemoto = true;
          }
        } catch (e) {
          Logger.warn('[InventarioRepo] No se pudo guardar entrada en Appwrite:', e);
        }
      }

      if (!entrada.id) {
        entrada.id = 'ent_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      }

      if (!DB.entradas) DB.entradas = [];
      DB.entradas.push(entrada);
      localStorage.setItem('pubpos_entradas', JSON.stringify(DB.entradas));

      if (Store) {
        Store.despachar({ type: 'ENTRADA_GUARDADA', payload: entrada });
      }

      return entrada;
    }
  };
}