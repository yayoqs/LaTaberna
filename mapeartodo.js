const fs = require('fs');
const path = require('path');

const EXTENSIONES = ['.js', '.html'];
const CARPETAS_IGNORAR = ['node_modules', '.git', '.vscode'];
const ARCHIVO_SALIDA = 'mapa_proyecto.txt';

let resultado = "=== MAPA DE ARQUITECTURA DEL PROYECTO ===\n\n";

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
            if (!EXTENSIONES.includes(ext) || archivo === 'mapear.js') return;

            resultado += `${sangria}    📄 ${archivo}\n`;

            try {
                const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
                const lineas = contenido.split('\n');

                lineas.forEach(linea => {
                    const l = linea.trim();
                    // Filtros específicos para JS Vanilla y manipulación del DOM
                    if (l.startsWith('function ') || 
                        l.startsWith('export function') ||
                        l.includes('=>') && (l.startsWith('const ') || l.startsWith('let ')) ||
                        l.startsWith('class ') ||
                        l.includes('document.getElementById') ||
                        l.includes('addEventListener')) {
                        
                        // Limitar el largo de la línea para mantener el mapa limpio
                        if (l.length < 100) {
                            resultado += `${sangria}        🔹 ${l}\n`;
                        }
                    }
                });
            } catch (e) {
                // Ignorar errores de lectura
            }
        }
    });
}

// Ejecutar el script desde la carpeta actual
recorrerDirectorio('.');

// Guardar el resultado
fs.writeFileSync(ARCHIVO_SALIDA, resultado, 'utf-8');
console.log(`¡Mapa generado con éxito en ${ARCHIVO_SALIDA}!`);
