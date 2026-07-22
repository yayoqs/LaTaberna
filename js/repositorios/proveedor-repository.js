/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/proveedor-repository.js
   Versión: 1.0.3
   Propósito: Repositorio de proveedores (Appwrite + localStorage).
              v1.0.3: corrige llamada a DBAppwrite.crear (faltaba el ID).
   ================================================================ */

import { Logger } from '../lib/logger.js';
import { DBAppwrite } from '../db-appwrite.js';
import { DB } from '../db.js';
import { Store } from '../lib/store.js';

export function crearProveedorRepo() {
  return {
    async guardarProveedor(datos) {
      const proveedor = { ...datos };
      let guardadoRemoto = false;

      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const doc = {
            nombre: proveedor.nombre,
            notas: proveedor.notas || ''
          };

          if (proveedor.id) {
            // Actualizar existente
            await DBAppwrite.actualizar('proveedores', proveedor.id, doc);
            guardadoRemoto = true;
          } else {
            // Crear nuevo: pasar null como ID para que Appwrite genere uno
            const docRemoto = await DBAppwrite.crear('proveedores', null, doc);
            if (docRemoto && docRemoto.id) {
              proveedor.id = docRemoto.id; // usar el ID generado por Appwrite
              guardadoRemoto = true;
            }
          }

          if (guardadoRemoto) {
            Logger.debug('[ProveedorRepo] Proveedor guardado en Appwrite:', proveedor.id);
          }
        } catch (e) {
          Logger.warn('[ProveedorRepo] No se pudo guardar en Appwrite, usando fallback local:', e);
        }
      }

      // Si no se guardó remoto, marcar como pendiente
      if (!guardadoRemoto) {
        proveedor._pendiente_sync = true;
        Logger.info('[ProveedorRepo] Proveedor marcado para sincronización futura.');
      }

      // Generar ID local si aún no tiene
      if (!proveedor.id) {
        proveedor.id = 'loc_prov_' + Date.now().toString(36);
      }

      // Actualizar array local y localStorage
      if (!DB.proveedores) DB.proveedores = [];
      const idx = DB.proveedores.findIndex(p => p.id === proveedor.id);
      if (idx >= 0) {
        DB.proveedores[idx] = proveedor;
      } else {
        DB.proveedores.push(proveedor);
      }
      localStorage.setItem('pubpos_proveedores', JSON.stringify(DB.proveedores));

      if (Store) {
        Store.despachar({ type: 'PROVEEDOR_GUARDADO', payload: proveedor });
      }

      return proveedor;
    },

    async obtenerProveedores() {
      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          const lista = await DBAppwrite.listar('proveedores');
          return lista.map(doc => ({ id: doc.id, nombre: doc.nombre, notas: doc.notas }));
        } catch (e) {
          Logger.warn('[ProveedorRepo] Error al listar proveedores de Appwrite:', e);
        }
      }
      return DB.proveedores || [];
    },

    async eliminarProveedor(id) {
      if (DBAppwrite && DBAppwrite.habilitado) {
        try {
          await DBAppwrite.eliminar('proveedores', id);
        } catch (e) {
          Logger.warn('[ProveedorRepo] Error al eliminar proveedor en Appwrite:', e);
        }
      }
      DB.proveedores = (DB.proveedores || []).filter(p => p.id !== id);
      localStorage.setItem('pubpos_proveedores', JSON.stringify(DB.proveedores));
      if (Store) {
        Store.despachar({ type: 'PROVEEDOR_ELIMINADO', payload: id });
      }
    }
  };
}