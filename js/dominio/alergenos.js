/* ================================================================
   LaTaberna - Ecosistema Elisekai — DOMINIO JS (ES6)
   Archivo: js/dominio/alergenos.js
   Versión: 1.0.0
   Propósito: Enum cerrado de alérgenos del ecosistema. Fuente de
              verdad única para catálogo de productos, variantes,
              items de pedido y perfiles de usuario.
              El valor 'otro' opera como canal de reporte: cuando
              un operador necesita un alérgeno que no está en el
              listado, lo selecciona y Coordinación evalúa agregarlo
              al contrato con un deploy posterior. No hay mecanismo
              automático de reporte; el flujo es manual.
   v1.0.0: creación inicial. Contrato cerrado según
           ARQUITECTURA-VARIANTES.md §8.2. Consumidores previstos:
           Célula D (editor de variantes), Célula B1 (control de
           alergias del item), Célula C (menú digital), Core
           (normalizadores de producto, variante y opción).
   ================================================================ */

export const ALERGENOS = [
  'mani',
  'gluten',
  'lactosa',
  'mariscos',
  'huevo',
  'soya',
  'frutos_secos',
  'pescado',
  'otro'
];

export function esAlergenoValido(valor) {
  return ALERGENOS.includes(valor);
}