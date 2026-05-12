/* ================================================================
   Appwrite Function: sync-pedidos-a-sheets
   Propósito: Sincroniza la colección "Pedidos" de Appwrite hacia
              Google Sheets (solo lectura). Se ejecuta cada minuto
              vía trigger CRON en Appwrite.
   Variables de entorno necesarias (configurar en Appwrite):
   - APPWRITE_ENDPOINT: https://tor.cloud.appwrite.io/v1
   - APPWRITE_PROJECT_ID: 6a025322001f24c57d1d
   - APPWRITE_API_KEY: clave con scope databases.read
   - GOOGLE_SERVICE_ACCOUNT_EMAIL: correo de la cuenta de servicio
   - GOOGLE_PRIVATE_KEY: clave privada (con \n escapados)
   - SPREADSHEET_ID: ID de la hoja de cálculo de Google
   ================================================================ */

const { Client, Databases } = require('node-appwrite');
const { google } = require('googleapis');

// Inicializar cliente de Appwrite
const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

// Autenticación con Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Constantes de configuración
const DATABASE_ID = '6a0275cb0022ebf7d30d';
const COLLECTION_ID = 'Pedidos';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'Pedidos';

/**
 * Función principal que se ejecuta cada minuto.
 * Lee todos los documentos de la colección "Pedidos" en Appwrite
 * y los vuelca en la hoja "Pedidos" de Google Sheets.
 */
module.exports = async function(context) {
  try {
    // 1. Leer todos los documentos de la colección "Pedidos"
    const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID);
    const documentos = response.documents;

    if (documentos.length === 0) {
      context.log('No hay documentos que sincronizar.');
      return context.res.empty();
    }

    // 2. Preparar los datos para Sheets (cabeceras + filas)
    const headers = ['ID', 'Mesa', 'Mozo', 'Comensales', 'Estado', 'Total', 'Items', 'Última Actualización'];
    const rows = documentos.map(function(doc) {
      return [
        doc.$id,
        doc.mesa,
        doc.mozo,
        doc.comensales,
        doc.estado,
        doc.total,
        typeof doc.items === 'string' ? doc.items : JSON.stringify(doc.items),
        doc.updated_at || doc.$updatedAt || ''
      ];
    });

    // 3. Escribir en Google Sheets (limpiando la hoja primero)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME + '!A1:H',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [headers, ...rows] },
    });

    context.log('Sincronización exitosa: ' + documentos.length + ' pedidos escritos en Sheets.');
    return context.res.empty();
  } catch (error) {
    context.log('Error crítico en sincronización: ' + error.message);
    return context.res.json({ error: error.message }, 500);
  }
};