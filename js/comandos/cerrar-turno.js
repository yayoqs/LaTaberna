/* ================================================================
   LaTaberna - PubPOS — COMANDO JS (ES6)
   Archivo: js/comandos/cerrar-turno.js
   Versión: 1.0.3
   Propósito: Comando para cerrar el turno actual. Centraliza la
              confirmación (modal estilizado), lógica de negocio
              y emisión de evento. Sin acoplamiento a vistas UI.
              v1.0.3: A.8: se elimina la emisión de EventBus
                      'turno:cerrado'. El evento lo emite el
                      TurnoManager. Se acepta claveIdempotencia.
   ================================================================ */

import { CommandBus } from '../lib/command-bus.js';
import { TurnoManager } from '../managers/turno-manager.js';
import { mostrarConfirmacion } from '../utils.js';

CommandBus.registrar('turno:cerrar', async (comando) => {
    const datos = comando && comando.datos ? comando.datos : {};
    const claveIdempotencia = datos.claveIdempotencia || null;
    const observaciones = datos.observaciones || '';

    // 1. Confirmación del usuario con modal estilizado
    const confirmado = await mostrarConfirmacion(
        'Cerrar Turno',
        '¿Estás seguro de cerrar el turno actual? Se resetearán mesas y pedidos. Se guardará un respaldo en Drive.'
    );
    if (!confirmado) {
        return { exito: false, mensaje: 'Cierre cancelado por el usuario.' };
    }

    // 2. Ejecutar lógica de cierre.
    // El evento turno:cerrado lo emite TurnoManager internamente.
    // No se emite aquí para evitar duplicación.
    const resultado = await TurnoManager.cerrarTurno({
        claveIdempotencia,
        observaciones
    });

    return resultado;
});