// listar_versiones.js
const fs = require('fs');
const path = require('path');

// Configuración
const EXTENSIONES = ['.js', '.css'];
const CARPETAS_IGNORAR = ['node_modules', '.git', '.vscode', 'tests', 'Vendor'];
const ARCHIVO_SALIDA = 'versiones.txt';

let resultados = [];

/**
 * Extrae la información de versión del primer bloque de comentario (/* ... * /) de un archivo.
 * @param {string} rutaArchivo Ruta absoluta del archivo.
 * @returns {{ archivo: string, version: string } | null}
 */
function extraerVersion(rutaArchivo) {
  try {
    const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
    const inicio = contenido.indexOf('/*');
    if (inicio === -1) return null;

    const fin = contenido.indexOf('*/', inicio);
    if (fin === -1) return null;

    const cabecera = contenido.substring(inicio, fin + 2);

    const matchArchivo = cabecera.match(/^\s*Archivo:\s*(.+)$/m);
    const matchVersion = cabecera.match(/^\s*Versión:\s*([\d.]+)$/m);

    if (matchArchivo && matchVersion) {
      return {
        archivo: matchArchivo[1].trim(),
        version: matchVersion[1].trim()
      };
    }
    return null;
  } catch (e) {
    // Si no se puede leer el archivo, lo ignoramos
    return null;
  }
}

/**
 * Recorre recursivamente el directorio dado.
 * @param {string} dir Directorio a recorrer.
 */
function recorrerDirectorio(dir) {
  let elementos;
  try {
    elementos = fs.readdirSync(dir);
  } catch (e) {
    return;
  }

  for (const elemento of elementos) {
    const rutaCompleta = path.join(dir, elemento);
    const stats = fs.statSync(rutaCompleta);

    if (stats.isDirectory()) {
      if (CARPETAS_IGNORAR.includes(elemento)) continue;
      recorrerDirectorio(rutaCompleta);
    } else {
      const ext = path.extname(elemento);
      if (!EXTENSIONES.includes(ext)) continue;

      const info = extraerVersion(rutaCompleta);
      if (info) {
        resultados.push(info);
      }
    }
  }
}

// ----- EJECUCIÓN -----
console.log('Buscando versiones en archivos .js y .css...\n');
recorrerDirectorio('.');

// Ordenar resultados por nombre de archivo (el valor extraído de "Archivo:")
resultados.sort((a, b) => a.archivo.localeCompare(b.archivo));

// Generar salida en texto
let salida = '=== VERSIONES DEL PROYECTO ===\n\n';
resultados.forEach(({ archivo, version }) => {
  salida += `${archivo} -> ${version}\n`;
});
salida += `\nTotal de archivos con versión: ${resultados.length}`;
salida += `\nFecha de generación: ${new Date().toLocaleString()}\n`;

// Guardar en archivo
fs.writeFileSync(ARCHIVO_SALIDA, salida, 'utf-8');

// Mostrar en consola
console.log(salida);
console.log(`\nResultados guardados en ${ARCHIVO_SALIDA}`);