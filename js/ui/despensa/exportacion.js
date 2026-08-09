/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/exportacion.js
   Versión: 1.0.4
   Propósito: Exportación del inventario a CSV y PDF.
              v1.0.4: lee insumos del Store.
   ================================================================ */

import { Store } from '../../lib/store.js';

export function exportarCSV() {
  const ing = Store.obtenerEstado().insumos || [];
  let csv = 'Nombre,Categoría,Stock,Unidad,Stock Mínimo,Ubicación,Tipo\n';
  ing.forEach(i => {
    csv += `"${i.nombre}","${i.categoria || ''}",${i.stock},"${i.unidad}",${i.stock_minimo},"${i.ubicacion || ''}","${i.tipo || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarPDF() {
  const insumos = Store.obtenerEstado().insumos || [];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Inventario</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>Inventario — ${new Date().toLocaleDateString()}</h1>
  <table>
    <thead><tr><th>Insumo</th><th>Cat.</th><th>Stock</th><th>Uni.</th><th>Mín.</th><th>Ubicación</th><th>Tipo</th></tr></thead>
    <tbody>
      ${insumos.map(i => `
        <tr>
          <td>${i.nombre}</td>
          <td>${i.categoria || ''}</td>
          <td>${i.stock}</td>
          <td>${i.unidad}</td>
          <td>${i.stock_minimo}</td>
          <td>${i.ubicacion || ''}</td>
          <td>${i.tipo || ''}</td>
        </tr>`).join('')}
    </tbody>
  </table>
  <p style="margin-top:16px;"><button onclick="window.print()">🖨️ Imprimir</button></p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}