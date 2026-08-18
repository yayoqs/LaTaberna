/* ================================================================
   LaTaberna - PubPOS — CONFIGURACIÓN JS (ES6)
   Archivo: js/config-appwrite.js
   Versión: 2.0.0
   Propósito: Configuración de conexión a Appwrite.
              v2.0.0: Eliminadas credenciales hardcodeadas del frontend.
                      URLs de funciones serverless centralizadas.
   ================================================================ */

export const APPWRITE_ENDPOINT =
  localStorage.getItem('appwrite_endpoint') ||
  'https://tor.cloud.appwrite.io/v1';

export const APPWRITE_PROJECT_ID =
  localStorage.getItem('appwrite_project_id') ||
  '6a025322001f24c57d1d';

export const URL_FUNCION_REGISTRAR_USUARIO =
  localStorage.getItem('funcion_registrar_usuario') ||
  'https://6a81573b000d2f0660d5.tor.appwrite.run';

export const URL_FUNCION_ASIGNAR_ROL =
  localStorage.getItem('funcion_asignar_rol') ||
  'https://6a6b3c8a003b634646cc.tor.appwrite.run';