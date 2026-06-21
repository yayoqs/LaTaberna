const fs = require('fs');
const path = require('path');

const EXTENSIONES = ['.js'];
const CARPETAS_IGNORAR = ['node_modules', '.git'];
const ARCHIVO_REPORTE = 'reporte_servicios.txt';

let coleccionesAppwrite = new Set();
let funcionesAppwrite = new Set();
let endpointsAppsScript = [];
let variablesEntorno = new Set();

// REEMPLAZA LA FUNCIÓN INTERNA CON ESTA NUEVA LÓGICA DE DETECCIÓN DINÁMICA:

function analizarConexiones(rutaCompleta, archivo) {
    try {
        const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
        const lineas = contenido.split('\n');

        lineas.forEach((linea, numLinea) => {
            const l = linea.trim();
            const info = `${archivo} (Línea ${numLinea + 1})`;

            // 1. Detectar uso dinámico de bases de datos o colecciones
            // Busca palabras clave como "collectionId", "databaseId", "coleccion" o "tabla"
            if (l.includes('Id') && (l.includes('collection') || l.includes('database') || l.includes('db'))) {
                coleccionesAppwrite.add(`📦 Variable/Parámetro de BD: \`${l}\` -> en ${info}`);
            }

            // 2. Detectar llamadas genéricas a funciones (Appwrite o propias)
            if (l.includes('.createExecution') || l.includes('executeFunction')) {
                funcionesAppwrite.add(`⚡ Invocación detectada: \`${l}\` -> en ${info}`);
            }

            // 3. Detectar llamadas a Google Apps Script por el uso de variables comunes (urlAppsScript, scriptUrl, etc.)
            if (l.includes('fetch(') || l.includes('axios.')) {
                if (l.toLowerCase().includes('script') || l.toLowerCase().includes('google') || l.toLowerCase().includes('macro')) {
                    endpointsAppsScript.push(`📊 Petición de Red Suspecta (Posible Apps Script) -> en ${info}\n   ↳ Línea: ${l}`);
                }
            }

            // 4. Variables de entorno (Mantiene tu detección actual)
            if (l.includes('APPWRITE_') || l.includes('process.env')) {
                variablesEntorno.add(`🔑 \`${l}\` -> en ${info}`);
            }
        });
    } catch (e) {}
}


function recorrerDirectorio(dir) {
    const archivos = fs.readdirSync(dir);
    archivos.forEach(archivo => {
        const rutaCompleta = path.join(dir, archivo);
        const stats = fs.statSync(rutaCompleta);

        if (stats.isDirectory()) {
            if (CARPETAS_IGNORAR.includes(archivo)) return;
            recorrerDirectorio(rutaCompleta);
        } else {
            if (EXTENSIONES.includes(path.extname(archivo)) && archivo !== 'mapear_servicios.js') {
                analizarConexiones(rutaCompleta, archivo);
            }
        }
    });
}

// Ejecutar auditoría externa
recorrerDirectorio('.');

// Escribir reporte estructurado
let reporte = "=== AUDITORÍA DE CONEXIONES EXTERNAS (APPWRITE Y APPS SCRIPT) ===\n\n";

reporte += `1. COLECCIONES / BD APPWRITE REQUERIDAS:\n`;
reporte += coleccionesAppwrite.size > 0 ? Array.from(coleccionesAppwrite).join('\n') + '\n' : "   No se detectaron IDs estáticos de colecciones.\n";

reporte += `\n2. CLOUD FUNCTIONS EN APPWRITE:\n`;
reporte += funcionesAppwrite.size > 0 ? Array.from(funcionesAppwrite).join('\n') + '\n' : "   No se detectaron invocaciones a funciones de Appwrite.\n";

reporte += `\n3. CONEXIONES A GOOGLE APPS SCRIPT:\n`;
reporte += endpointsAppsScript.length > 0 ? endpointsAppsScript.join('\n\n') + '\n' : "   No se detectaron enlaces directos a macros de Google.\n";

reporte += `\n4. VARIABLES DE CONFIGURACIÓN CLAVE (Revisar consistencia):\n`;
reporte += variablesEntorno.size > 0 ? Array.from(variablesEntorno).join('\n') + '\n' : "   No se listaron variables de entorno explícitas.\n";

fs.writeFileSync(ARCHIVO_REPORTE, reporte, 'utf-8');
console.log(`¡Auditoría externa completada! Revisa ${ARCHIVO_REPORTE}`);
