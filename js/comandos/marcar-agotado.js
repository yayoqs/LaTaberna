/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/marcar-agotado.js
   Versión: 1.0.3
   Propósito: Comando para marcar un producto como agotado.
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
        
        Store.despachar({
            type: 'PRODUCTO_GUARDADO',
            payload: { id: prodId, estado: 'agotado' }
        });
        
        return { exito: true };
    } catch (e) {
        Logger.error(`[producto:marcar_agotado] Error al marcar producto ${prodId}:`, e);
        return { exito: false, error: e.message };
    }
});