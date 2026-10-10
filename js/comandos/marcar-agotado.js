/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/marcar-agotado.js
   Versión: 1.0.4
   Propósito: Comando para marcar un producto como agotado.
              v1.0.4: fix de corrupción del slice productos del
                      Store. El despacho anterior enviaba un payload
                      parcial ({ id, estado }) a PRODUCTO_GUARDADO,
                      y el reducer reemplazaba la fila completa por
                      ese objeto mutilado. Ahora se lee el producto
                      completo desde el Store y se despacha con el
                      campo estado actualizado. Si el producto no
                      está en el Store, no se despacha (se loguea
                      warning) y el cambio queda persistido solo en
                      Appwrite, a la espera de la próxima carga.
              v1.0.3: actualiza campo `estado` en lugar de `disponible`.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { DBAppwrite } from '../db-appwrite.js';
import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';

CommandBus.registrar('producto:marcar_agotado', async (cmd) => {
    const { prodId } = cmd.datos;
    if (!prodId) {
        Logger.warn('[producto:marcar_agotado] ID de producto no proporcionado.');
        return { exito: false, error: 'ID de producto no proporcionado.' };
    }

    Logger.info(`[producto:marcar_agotado] Marcando producto ${prodId} como agotado.`);
    try {
        await DBAppwrite.actualizar('productos', prodId, { estado: 'agotado' });

        EventBus.emit('producto:agotado', { prodId });

        // Fix v1.0.4: el reducer productosReducer reemplaza la fila
        // completa por el payload. Despachar un objeto parcial
        // corrompía el producto en el Store (nombre, precio,
        // categoría, variantes_ids, alergenos quedaban perdidos).
        // Se lee el producto completo antes de despachar.
        const productos = Store.obtenerEstado().productos || [];
        const producto = productos.find(p => p.id === prodId);

        if (producto) {
            Store.despachar({
                type: 'PRODUCTO_GUARDADO',
                payload: { ...producto, estado: 'agotado' }
            });
        } else {
            Logger.warn(
                '[producto:marcar_agotado] Producto ' + prodId +
                ' no encontrado en Store. No se despacha al slice. ' +
                'El cambio queda persistido solo en Appwrite.'
            );
        }

        return { exito: true };
    } catch (e) {
        Logger.error(`[producto:marcar_agotado] Error al marcar producto ${prodId}:`, e);
        return { exito: false, error: e.message };
    }
});