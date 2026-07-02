const fs = require('fs');
const path = require('path');

const EXTENSIONES = ['.js', '.html'];
const CARPETAS_IGNORAR = ['node_modules', '.git', '.vscode', 'tests', 'Vendor'];
const ARCHIVOS_IGNORAR = ['mapear.js', 'mapear_servicios.js', 'mapeartodo.js'];
const ARCHIVO_SALIDA = 'mapa_proyecto.txt';

let resultado = "=== MAPA DE ARQUITECTURA DEL PROYECTO ===\n\n";
let totalLineas = 0;

function recorrerDirectorio(dir, nivel = 0) {
    const archivos = fs.readdirSync(dir);
    const sangria = " ".repeat(nivel * 4);

    archivos.forEach(archivo => {
        const rutaCompleta = path.join(dir, archivo);
        const stats = fs.statSync(rutaCompleta);

        if (stats.isDirectory()) {
            if (CARPETAS_IGNORAR.includes(archivo)) return;
            resultado += `${sangria}📁 ${archivo}/\n`;
            recorrerDirectorio(rutaCompleta, nivel + 1);
        } else {
            const ext = path.extname(archivo);
            // Excluir por extensión, nombre exacto, prefijo test- en cualquier nivel,
            // y archivos Prueba- solo si están en la raíz (nivel 0)
            if (!EXTENSIONES.includes(ext) || 
                ARCHIVOS_IGNORAR.includes(archivo) || 
                archivo.startsWith('test-') ||
                (nivel === 0 && archivo.startsWith('Prueba-'))) {
                return;
            }

            resultado += `${sangria}    📄 ${archivo}\n`;
            let lineasArchivo = 0;

            try {
                const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
                const lineas = contenido.split('\n');

                lineas.forEach(linea => {
                    const l = linea.trim();
                    // Filtros para arquitectura modular (sin manipulación del DOM)
                    if (l.startsWith('function ') || 
                        l.startsWith('export function') ||
                        l.startsWith('export const ') ||
                        l.startsWith('export class ') ||
                        (l.startsWith('const ') && l.includes('=>')) ||
                        l.startsWith('class ')) {
                        
                        if (l.length < 100) {
                            resultado += `${sangria}        🔹 ${l}\n`;
                            lineasArchivo++;
                            totalLineas++;
                        }
                    }
                });
            } catch (e) {
                // Ignorar errores de lectura
            }
        }
    });
}

console.log('Generando mapa de arquitectura...');
recorrerDirectorio('.');

// Mensaje final en el archivo de salida
resultado += `\n\n=== MAPEO COMPLETADO ===\n`;
resultado += `Total de funciones/declaraciones capturadas: ${totalLineas}\n`;
resultado += `Fecha de generación: ${new Date().toLocaleString()}\n`;

fs.writeFileSync(ARCHIVO_SALIDA, resultado, 'utf-8');
console.log(`¡Mapa generado con éxito en ${ARCHIVO_SALIDA}!`);
console.log(`Total de funciones/declaraciones capturadas: ${totalLineas}`);