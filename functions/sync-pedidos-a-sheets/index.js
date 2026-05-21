/* ================================================================
   Appwrite Function: sync-pedidos-a-sheets (v2.0)
   Propósito: Sincroniza TODAS las colecciones de Appwrite hacia
              Google Sheets. Se ejecuta cada minuto vía trigger CRON.
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
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Mapeo de colecciones a nombres de hoja y columnas
const COLECCIONES = [
  {
    id: 'Productos',
    hoja: 'Productos',
    headers: ['id', 'nombre', 'precio', 'categoria', 'destino', 'descripcion', 'activo', 'stock', 'imagen'],
    campos: ['$id', 'nombre', 'precio', 'categoria', 'destino', 'descripcion', 'activo', 'stock', 'imagen']
  },
  {
    id: 'Ingredientes',
    hoja: 'Insumos',
    headers: ['id', 'nombre', 'stock', 'unidad', 'stock_minimo', 'categoria', 'ubicacion', 'valor_unitario'],
    campos: ['$id', 'nombre', 'stock', 'unidad', 'stock_minimo', 'categoria', 'ubicacion', 'valor_unitario']
  },
  {
    id: 'Recetas',
    hoja: 'Recetas',
    headers: ['productoId', 'insumoId', 'cantidad', 'instrucciones'],
    campos: ['productoId', 'insumoId', 'cantidad', 'instrucciones']
  },
  {
    id: 'Pedidos',
    hoja: 'Pedidos',
    headers: ['id', 'mesa', 'mozo', 'comensales', 'estado', 'items', 'total', 'created_at', 'updated_at'],
    campos: ['$id', 'mesa', 'mozo', 'comensales', 'estado', 'items', 'total', 'created_at', 'updated_at']
  },
  {
    id: 'Mesas',
    hoja: 'Mesas',
    headers: ['numero', 'estado', 'pedidoId', 'items', 'mozo', 'comensales', 'abiertaEn', 'observaciones', 'zona', 'mesasFusionadas', 'esVirtual'],
    campos: ['numero', 'estado', 'pedidoId', 'items', 'mozo', 'comensales', 'abiertaEn', 'observaciones', 'zona', 'mesasFusionadas', 'esVirtual']
  },
  {
    id: 'Comandas',
    hoja: 'Comandas',
    headers: ['id', 'mesa', 'mozo', 'destino', 'items', 'observaciones', 'estado', 'ts', 'deliveryId'],
    campos: ['$id', 'mesa', 'mozo', 'destino', 'items', 'observaciones', 'estado', 'ts', 'deliveryId']
  },
  {
    id: 'Pedidos_delivery',
    hoja: 'Pedidos_delivery',
    headers: ['id', 'direccion', 'telefono', 'items', 'total', 'estado', 'repartidor', 'created_at', 'observaciones'],
    campos: ['$id', 'direccion', 'telefono', 'items', 'total', 'estado', 'repartidor', 'created_at', 'observaciones']
  },
  {
    id: 'Usuarios',
    hoja: 'Usuarios',
    headers: ['nombre', 'hash', 'rol'],
    campos: ['nombre', 'hash', 'rol']
  }
];

/**
 * Función principal que se ejecuta cada minuto.
 * Lee todas las colecciones de Appwrite y las vuelca en Sheets.
 */
module.exports = async function(context) {
  try {
    for (const col of COLECCIONES) {
      await sincronizarColeccion(col, context);
    }
    context.log('Sincronización completa de todas las colecciones.');
    return context.res.empty();
  } catch (error) {
    context.log('Error crítico en sincronización: ' + error.message);
    return context.res.json({ error: error.message }, 500);
  }
};

async function sincronizarColeccion(coleccion, context) {
  try {
    // 1. Leer todos los documentos de la colección
    const response = await databases.listDocuments(DATABASE_ID, coleccion.id);
    const documentos = response.documents;

    // 2. Preparar filas
    const rows = documentos.map(doc => {
      return coleccion.campos.map(campo => {
        let valor = doc[campo];
        if (valor === undefined || valor === null) valor = '';
        else if (typeof valor === 'object') valor = JSON.stringify(valor);
        return valor;
      });
    });

    // 3. Escribir en Google Sheets (limpiando la hoja primero)
    const range = coleccion.hoja + '!A1:' + String.fromCharCode(65 + coleccion.headers.length - 1);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: coleccion.hoja + '!A:Z',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: coleccion.hoja + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [coleccion.headers, ...rows] },
    });

    context.log(`Sincronizado ${coleccion.hoja}: ${documentos.length} documentos.`);
  } catch (error) {
    context.log(`Error en ${coleccion.hoja}: ${error.message}`);
  }
}