/* ================================================================
   LaTaberna - PubPOS — REPOSITORIO JS (ES6)
   Archivo: js/repositorios/proveedor-repository.js
   Versión: 1.1.0
   Propósito: Repositorio de proveedores (Appwrite + localStorage).
              v1.1.0: adaptado a laTaberna_Proveedores con todos los nuevos campos.
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
            tipo: proveedor.tipo || 'otro',
            contacto: proveedor.contacto || '',
            telefono: proveedor.telefono || '',
            email: proveedor.email || '',
            direccion: proveedor.direccion || '',
            rubro: proveedor.rubro || '',
            notas: proveedor.notas || '',
            activo: proveedor.activo !== false
          };

          if (proveedor.id) {
            try {
              await DBAppwrite.actualizar('proveedores', proveedor.id, doc);
              guardadoRemoto = true;
            } catch (e) {
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
          return lista.map(doc => ({
            id: doc.id,
            nombre: doc.nombre,
            tipo: doc.tipo,
            contacto: doc.contacto,
            telefono: doc.telefono,
            email: doc.email,
            direccion: doc.direccion,
            rubro: doc.rubro,
            notas: doc.notas,
            activo: doc.activo
          }));
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