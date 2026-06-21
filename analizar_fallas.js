const fs = require('fs');
const path = require('path');

const EXTENSIONES = ['.js', '.html'];
const CARPETAS_IGNORAR = ['node_modules', '.git'];
const ARCHIVO_REPORTE = 'reporte_fallas.txt';

let funcionesDefinidas = {};
let selectoresDOM = [];
let tareasPendientes = [];
let alertasDuplicados = [];

function analizarArchivo(rutaCompleta, archivo) {
    try {
        const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
        const lineas = contenido.split('\n');

        lineas.forEach((linea, numLinea) => {
            const l = linea.trim();
            const infoLinea = `[${archivo} - Línea ${numLinea + 1}]`;

            // 1. Buscar funciones o constantes declaradas
            let nombreFuncion = null;
            if (l.startsWith('function ')) {
                nombreFuncion = l.split('function ')[1].split('(')[0].trim();
            } else if ((l.startsWith('const ') || l.startsWith('let ')) && l.includes('=')) {
                // Detectar funciones flecha básicas: const miFunc = () =>
                const partes = l.split('=');
                if (partes[1] && partes[1].includes('=>')) {
                    nombreFuncion = partes[0].replace('const', '').replace('let', '').trim();
                }
            }

            if (nombreFuncion && !nombreFuncion.includes(' ')) {
                if (funcionesDefinidas[nombreFuncion]) {
                    funcionesDefinidas[nombreFuncion].push(infoLinea);
                } else {
                    funcionesDefinidas[nombreFuncion] = [infoLinea];
                }
            }

            // 2. Buscar selectores del DOM (IDs)
            if (l.includes('getElementById')) {
                const coincidencia = l.match(/getElementById\(['"`](.*?)['"`]\)/);
                if (coincidencia && coincidencia[1]) {
                    selectoresDOM.push({ id: coincidencia[1], ubicacion: infoLinea });
                }
            }

            // 3. Buscar código incompleto u olvidado por la IA
            if (l.toUpperCase().includes('TODO') || l.toUpperCase().includes('FIXME') || l.includes('//...')) {
                tareasPendientes.push(`${infoLinea}: ${l}`);
            }
        });
    } catch (e) {}
}

function recorrerYAnalizar(dir) {
    const archivos = fs.readdirSync(dir);
    archivos.forEach(archivo => {
        const rutaCompleta = path.join(dir, archivo);
        const stats = fs.statSync(rutaCompleta);

        if (stats.isDirectory()) {
            if (CARPETAS_IGNORAR.includes(archivo)) return;
            recorrerYAnalizar(rutaCompleta);
        } else {
            const ext = path.extname(archivo);
            if (EXTENSIONES.includes(ext) && archivo !== 'analizar_fallas.js' && archivo !== 'mapear.js') {
                analizarArchivo(rutaCompleta, archivo);
            }
        }
    });
}

// Ejecutar análisis
recorrerYAnalizar('.');

// Procesar duplicados
for (const [funcion, ubicaciones] of Object.entries(funcionesDefinidas)) {
    if (ubicaciones.length > 1) {
        alertasDuplicados.push(`⚠️ FUNCIÓN DUPLICADA: "${funcion}" encontrada en:\n   ${ubicaciones.join('\n   ')}`);
    }
}

// Generar el reporte de texto limpio
let reporte = "=== REPORTE AUTOMÁTICO DE FALLAS Y LOGÍSTICA ===\n\n";

reporte += `1. FUNCIONES DUPLICADAS ENCONTRADAS (${alertasDuplicados.length})\n`;
reporte += alertasDuplicados.length > 0 ? alertasDuplicados.join('\n\n') + '\n' : "✅ Ninguna función duplicada detectada.\n";

reporte += `\n2. CÓDIGO INCOMPLETO / PENDIENTES DE LA IA (${tareasPendientes.length})\n`;
reporte += tareasPendientes.length > 0 ? tareasPendientes.join('\n') + '\n' : "✅ No hay comentarios de código incompleto.\n";

reporte += `\n3. ELEMENTOS DEL DOM REQUERIDOS (Para verificar en tu HTML)\n`;
if (selectoresDOM.length > 0) {
    selectoresDOM.forEach(item => {
        reporte += `   🔹 Busca ID "${item.id}" en HTML -> usado en ${item.ubicacion}\n`;
    });
} else {
    reporte += "   No se detectaron llamadas a getElementById.\n";
}

fs.writeFileSync(ARCHIVO_REPORTE, reporte, 'utf-8');
console.log(`¡Análisis completado! Revisa ${ARCHIVO_REPORTE}`);
