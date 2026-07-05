/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/cerrar-turno.js
   Versión: 1.0.2
   Propósito: Comando para cerrar el turno actual. Centraliza la
              confirmación (modal estilizado), lógica de negocio
              y emisión de evento. Sin acoplamiento a vistas UI.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { EventBus } from '../lib/eventBus.js';
import { TurnoManager } from '../managers/turno-manager.js';
import { mostrarConfirmacion } from '../utils.js';

CommandBus.registrar('turno:cerrar', async () => {
    // 1. Confirmación del usuario con modal estilizado
    const confirmado = await mostrarConfirmacion(
        'Cerrar Turno',
        '¿Estás seguro de cerrar el turno actual? Se resetearán mesas y pedidos. Se guardará un respaldo en Drive.'
    );
    if (!confirmado) {
        return { exito: false, mensaje: 'Cierre cancelado por el usuario.' };
    }

    // 2. Ejecutar lógica de cierre
    const resultado = await TurnoManager.cerrarTurno();

    // 3. Si fue exitoso, emitir evento para que la UI se actualice
    if (resultado.exito) {
        EventBus.emit('turno:cerrado', { timestamp: new Date().toISOString() });
    }

    return resultado;
});