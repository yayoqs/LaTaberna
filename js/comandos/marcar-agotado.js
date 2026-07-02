/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/marcar-agotado.js
   Versión: 1.0.1
   Propósito: Comando para marcar un producto como agotado.
              Se activa desde el botón de pánico del KDS.
              Actualiza Appwrite, Store local y emite evento.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { DBAppwrite } from '../db-appwrite.js';
import { Logger } from '../lib/logger.js';
import { EventBus } from '../lib/eventBus.js';
import { Store } from '../lib/store.js';

CommandBus.registrar('producto:marcar_agotado', async (cmd) => {
    const { prodId } = cmd.datos;
    if (!prodId) {
        return { exito: false, error: 'ID de producto no proporcionado.' };
    }

    Logger.info(`[producto:marcar_agotado] Marcando producto ${prodId} como agotado.`);
    try {
        await DBAppwrite.actualizar('productos', prodId, { disponible: false });
        
        EventBus.emit('producto:agotado', { prodId });
        
        Store.dispatch({
            type: 'PRODUCTO_GUARDADO',
            payload: { id: prodId, disponible: false }
        });
        
        return { exito: true };
    } catch (e) {
        Logger.error(`[producto:marcar_agotado] Error:`, e);
        return { exito: false, error: e.message };
    }
});