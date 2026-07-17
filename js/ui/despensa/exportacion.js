/* ================================================================
   LaTaberna - PubPOS — DESPENSA SUBMÓDULO (ES6)
   Archivo: js/ui/despensa/exportacion.js
   Versión: 1.0.1
   Propósito: Exportación del inventario a CSV y PDF.
              v1.0.1: migra a nombres en español (store).
   ================================================================ */

import { Store } from '../../lib/store.js';
import { DB } from '../../db.js';

export function exportarCSV() {
  const ing = DB.ingredientes || [];
  let csv = 'Nombre,Categoría,Stock,Unidad,Stock Mínimo,Ubicación,Valor Unitario,Valor Total\n';
  ing.forEach(i => {
    csv += `"${i.nombre}","${i.categoria || ''}",${i.stock},"${i.unidad}",${i.stock_minimo},"${i.ubicacion || ''}",${i.valor_unitario || 0},${i.stock * (i.valor_unitario || 0)}\n`;
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
  const ingredientes = Store.obtenerEstado().ingredientes || DB.ingredientes || [];

  const html = `
    <html>
    <head><title>Inventario</title>
    <style>
      body { font-family: sans-serif; padding: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 12px; }
      th { background: #f5f5f5; }
    </style>
    </head>
    <body>
      <h1>Inventario — ${new Date().toLocaleDateString()}</h1>
      <table>
        <thead><tr><th>Ingrediente</th><th>Cat.</th><th>Stock</th><th>Uni.</th><th>Mín.</th><th>Ubicación</th><th>Valor Un.</th><th>Valor Total</th></tr></thead>
        <tbody>
          ${ingredientes.map(i => `
            <tr>
              <td>${i.nombre}</td>
              <td>${i.categoria || ''}</td>
              <td>${i.stock}</td>
              <td>${i.unidad}</td>
              <td>${i.stock_minimo}</td>
              <td>${i.ubicacion || ''}</td>
              <td>${i.valor_unitario || ''}</td>
              <td>${(i.stock * (i.valor_unitario || 0)).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank', 'width=800,height=600');
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  ventana.print();
  ventana.close();
}