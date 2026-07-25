/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/proveedor-repository.js
   Versión: 1.0.4
   Propósito: Repositorio de proveedores (Appwrite + localStorage).
              v1.0.4: deja que Appwrite genere el ID y lo captura.
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
            // Intentar actualizar si ya tiene ID
            try {
              await DBAppwrite.actualizar('proveedores', proveedor.id, doc);
              guardadoRemoto = true;
            } catch (e) {
              // Si falla la actualización (404), crear nuevo
              if (e.code === 404) {
                const docRemoto = await DBAppwrite.crear('proveedores', null, doc);
                if (docRemoto && docRemoto.id) {
                  proveedor.id = docRemoto.id;
                  guardadoRemoto = true;
                }
              } else {
                throw e;
              }
            }
          } else {
            // Crear nuevo sin ID
            const docRemoto = await DBAppwrite.crear('proveedores', null, doc);
            if (docRemoto && docRemoto.id) {
              proveedor.id = docRemoto.id;
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

      if (!guardadoRemoto) {
        proveedor._pendiente_sync = true;
        Logger.info('[ProveedorRepo] Proveedor marcado para sincronización futura.');
      }

      if (!proveedor.id) {
        proveedor.id = 'loc_prov_' + Date.now().toString(36);
      }

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