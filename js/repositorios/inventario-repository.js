/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/inventario-repository.js
   Versión: 1.0.5
   Propósito: Repositorio de inventario reutilizable (Appwrite + localStorage).
              v1.0.5: conserva proveedor y precio_proveedor.
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';

export function crearInventarioRepo() {
  return {
    async guardarIngrediente(datos) {
      const ingrediente = { ...datos };
      let guardadoRemoto = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const docParaAppwrite = {
            nombre: ingrediente.nombre,
            stock: ingrediente.stock,
            unidad: ingrediente.unidad,
            stock_minimo: ingrediente.stock_minimo ?? ingrediente.stockMinimo ?? 0,
            categoria: ingrediente.categoria || 'general',
            ubicacion: ingrediente.ubicacion || '',
            valor_unitario: ingrediente.valor_unitario ?? ingrediente.valorUnitario ?? 0,
            proveedor: ingrediente.proveedor || '',
            precio_proveedor: ingrediente.precio_proveedor || 0
          };
          if (ingrediente.id) {
            await DBAppwrite.actualizar('ingredientes', ingrediente.id, docParaAppwrite);
          } else {
            const docRemoto = await DBAppwrite.crear('ingredientes', null, docParaAppwrite);
            if (docRemoto && docRemoto.id) {
              ingrediente.id = docRemoto.id;
            }
          }
          guardadoRemoto = true;
          Logger.debug('[InventarioRepo] Ingrediente guardado en Appwrite:', ingrediente.id);
        } catch (e) {
          Logger.warn('[InventarioRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      if (!guardadoRemoto) {
        ingrediente._pendiente_sync = true;
        Logger.info('[InventarioRepo] Ingrediente marcado para sincronización futura.');
        if (typeof DB.colaSync !== 'undefined') {
          DB.colaSync.push({ tipo: 'guardarIngrediente', datos: ingrediente });
        }
      }

      if (!ingrediente.id) {
        ingrediente.id = 'l' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      }

      const idx = DB.ingredientes.findIndex(i => i.id == ingrediente.id);
      if (idx >= 0) {
        DB.ingredientes[idx] = ingrediente;
      } else {
        DB.ingredientes.push(ingrediente);
      }
      localStorage.setItem('pubpos_ingredientes', JSON.stringify(DB.ingredientes));

      if (Store) {
        Store.despachar({ type: 'INGREDIENTE_GUARDADO', payload: ingrediente });
      }

      return ingrediente;
    },

    async obtenerPorId(id) {
      return (DB.ingredientes || []).find(i => i.id == id) || null;
    },

    async registrarMovimiento(movimiento) {
      if (typeof DB.ajustarStock === 'function') {
        DB.ajustarStock(movimiento.ingredienteId, movimiento.cantidad, movimiento.motivo);
      }
    }
  };
}