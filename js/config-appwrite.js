/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS (ES6)
   Archivo: js/config-appwrite.js
   Versión: 1.0.0
   Propósito: Configuración de conexión a Appwrite. Permite cambiar
              endpoint y projectId sin modificar el núcleo.
   ================================================================ */

/**
 * Endpoint de la API de Appwrite.
 * Puede sobrescribirse en localStorage con 'appwrite_endpoint'.
 * Valor por defecto para desarrollo local.
 */
export const APPWRITE_ENDPOINT =
  localStorage.getItem('appwrite_endpoint') ||
  'https://tor.cloud.appwrite.io/v1';

/**
 * ID del proyecto en Appwrite.
 * Puede sobrescribirse en localStorage con 'appwrite_project_id'.
 * Valor por defecto para desarrollo local.
 */
export const APPWRITE_PROJECT_ID =
  localStorage.getItem('appwrite_project_id') ||
  '6a025322001f24c57d1d';