/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/inventario-repository.js
   Versión: 1.0.4
   Propósito: Repositorio de inventario reutilizable (Appwrite + localStorage).
              v1.0.4: soporte para editar ingredientes existentes (upsert).
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';

/**
 * Crea y devuelve un repositorio de inventario.
 * @returns {object} Repositorio con métodos guardarIngrediente, obtenerPorId, registrarMovimiento.
 */
export function crearInventarioRepo() {
  return {
    async guardarIngrediente(datos) {
      const ingrediente = { ...datos };
      let guardadoRemoto = false;

      // Preparar documento normalizado para Appwrite (snake_case)
      const docAppwrite = {
        nombre: ingrediente.nombre,
        stock: ingrediente.stock,
        unidad: ingrediente.unidad,
        stock_minimo: ingrediente.stock_minimo ?? ingrediente.stockMinimo ?? 0,
        categoria: ingrediente.categoria || 'general',
        ubicacion: ingrediente.ubicacion || '',
        valor_unitario: ingrediente.valor_unitario ?? ingrediente.valorUnitario ?? 0
      };

      // 1. Intentar guardar en Appwrite (crear o actualizar)
      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          // Verificar si existe localmente para decidir si crear o actualizar
          const existeLocal = DB.ingredientes.some(i => i.id == ingrediente.id);
          if (existeLocal) {
            await DBAppwrite.actualizar('ingredientes', ingrediente.id, docAppwrite);
          } else {
            await DBAppwrite.crear('ingredientes', ingrediente.id, docAppwrite);
          }
          guardadoRemoto = true;
          Logger.debug('[InventarioRepo] Ingrediente guardado en Appwrite:', ingrediente.id);
        } catch (e) {
          Logger.warn('[InventarioRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      // 2. Si no se guardó remoto, marcar como pendiente
      if (!guardadoRemoto) {
        ingrediente._pendiente_sync = true;
        Logger.info('[InventarioRepo] Ingrediente marcado para sincronización futura.');
        if (typeof DB.colaSync !== 'undefined') {
          DB.colaSync.push({ tipo: 'guardarIngrediente', datos: ingrediente });
        }
      }

      // 3. Generar ID local corto si es necesario
      if (!ingrediente.id) {
        ingrediente.id = 'l' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      }

      // 4. Actualizar array local y persistir en localStorage
      const idx = DB.ingredientes.findIndex(i => i.id == ingrediente.id);
      if (idx >= 0) {
        DB.ingredientes[idx] = ingrediente;
      } else {
        DB.ingredientes.push(ingrediente);
      }
      localStorage.setItem('pubpos_ingredientes', JSON.stringify(DB.ingredientes));

      // 5. Actualizar Store para reflejar en UI
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