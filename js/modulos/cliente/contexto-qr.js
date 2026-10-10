/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/contexto-qr.js
   Versión: 1.0.0
   Propósito: Contexto del cliente cuando llega vía QR del
              restaurante. Lee el parámetro ?espacio= del URL y lo
              expone al resto de los módulos de Célula C a través
              de sessionStorage.

   Origen: extraído de principal.js v2.0.3 para romper el ciclo de
           importación entre principal.js y menu-digital.js.

   Expone:
     · leerEspacioDelQR()           — Lee el URL y persiste.
     · obtenerEspacioRestaurante()  — Devuelve el valor persistido.
   ================================================================ */

import { Logger } from '../../lib/logger.js';

const CLAVE_SESSION_ESPACIO = 'cliente_espacioId_restaurante';

/**
 * Lee el parámetro ?espacio= de la URL actual. Si existe, lo
 * guarda en sessionStorage. Si no existe, limpia cualquier valor
 * previo.
 * @returns {string|null} El espacioId leído, o null.
 */
export function leerEspacioDelQR() {
  try {
    const parametros = new URLSearchParams(window.location.search || '');
    const espacioId = parametros.get('espacio');

    if (espacioId && typeof espacioId === 'string' && espacioId.trim()) {
      const limpio = espacioId.trim();
      sessionStorage.setItem(CLAVE_SESSION_ESPACIO, limpio);
      Logger.info('[ContextoQR] Espacio de restaurante detectado en QR:', limpio);
      return limpio;
    }

    sessionStorage.removeItem(CLAVE_SESSION_ESPACIO);
    Logger.info('[ContextoQR] Sin parámetro ?espacio= en el URL.');
    return null;
  } catch (e) {
    Logger.warn('[ContextoQR] Error al leer ?espacio= del URL:', e.message);
    return null;
  }
}

/**
 * Devuelve el espacioId del restaurante leído del QR, si existe.
 * @returns {string|null}
 */
export function obtenerEspacioRestaurante() {
  try {
    const valor = sessionStorage.getItem(CLAVE_SESSION_ESPACIO);
    return (valor && valor.trim()) ? valor.trim() : null;
  } catch (e) {
    return null;
  }
}