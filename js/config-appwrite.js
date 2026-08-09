/* ================================================================
   LaTaberna - PubPOS — CONFIGURACIÓN JS (ES6)
   Archivo: js/config-appwrite.js
   Versión: 1.1.0
   Propósito: Configuración de conexión a Appwrite. Permite cambiar
              endpoint y projectId sin modificar el núcleo.
              v1.1.0: Agrega USUARIOS_POR_DEFECTO para auth.js.
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

// Credenciales por defecto para el sistema de fallback local.
// TODO: Migrar a self-hosted o variables de entorno en el futuro.
export const USUARIOS_POR_DEFECTO = [
  { nombre: 'master',   password: 'master123', rol: 'master' },
  { nombre: 'admin',    password: 'admin123',  rol: 'admin' },
  { nombre: 'cocina',   password: 'cocina',    rol: 'cocina' },
  { nombre: 'barra',    password: 'barra',     rol: 'barra' },
  { nombre: 'caja',     password: 'caja',      rol: 'caja' },
  { nombre: 'mesero',   password: 'mesero',    rol: 'mesero' },
  { nombre: 'despensa', password: 'despensa',  rol: 'despensa' },
  { nombre: 'eventos',  password: 'eventos',   rol: 'eventos' },
  { nombre: 'reparto',  password: 'reparto',   rol: 'reparto' },
  { nombre: 'cliente',  password: 'cliente',   rol: 'cliente' },
  { nombre: 'artista',  password: 'artista',   rol: 'artista' }
];