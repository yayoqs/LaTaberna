/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · ASIGNACIÓN SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/asignacion/validaciones.js
   Versión: 1.0.0
   Propósito: Lógica de detección de casos borde del Modo Variantes.
              No valida formularios: detecta advertencias que el
              admin debe ver al asignar variantes a productos.
   v1.0.0: creación inicial. Tres casos cubiertos:
            1. Variante con insumos_delta de acción 'quitar'
               asignada a un producto sin receta.
            2. Variante inactiva referenciada por un producto.
            3. Confirmación al quitar variante.
   ================================================================ */

import * as estado from './estado.js';

/* ── 1. INSUMOS_QUITAR SIN RECETA ──────────────────────── */

export function detectarInsumosQuitarSinReceta(producto, variante) {
  if (!producto || !variante) return null;

  if (estado.tieneReceta(producto.id)) return null;

  const problematicas = (variante.opciones || []).filter(o =>
    o.activo !== false &&
    (o.insumos_delta || []).some(d => d.accion === 'quitar')
  );

  if (problematicas.length === 0) return null;

  return { opciones: problematicas };
}

/* ── 2. VARIANTES INACTIVAS ────────────────────────────── */

export function detectarVariantesInactivas(producto) {
  if (!producto || !Array.isArray(producto.variantes_ids)) return [];

  return producto.variantes_ids
    .map(vid => estado.getVariantePorId(vid))
    .filter(v => v && v.activo === false);
}

export function esVarianteInactiva(variante) {
  return variante && variante.activo === false;
}

/* ── 3. CONFIRMACIÓN AL QUITAR ─────────────────────────── */

export function mensajeConfirmacionQuitar(producto, variante) {
  const nombreProducto = producto?.nombre || 'el producto';
  const nombreVariante = variante?.nombre || 'la variante';
  return `¿Quitar "${nombreVariante}" de "${nombreProducto}"? Los productos que tengan esta variante asignada seguirán existiendo. Solo se desvincula del producto.`;
}

/* ── 4. HELPERS DE CHIPS ───────────────────────────────── */

export function resumenVariante(variante) {
  if (!variante) return { opcionesActivas: 0, tipoLabel: '—' };
  const opcionesActivas = (variante.opciones || []).filter(o => o.activo !== false).length;
  const tipoLabel = variante.tipo === 'unica' ? 'única' : 'múltiple';
  return { opcionesActivas, tipoLabel };
}

/* ── 5. INFORMACIÓN DE OPCIONES (panel lateral) ────────── */

export function describirOpciones(variante) {
  if (!variante || !Array.isArray(variante.opciones)) return [];

  return variante.opciones.map(o => {
    const chips = [];

    (o.alergenos || []).forEach(a => {
      chips.push({ tipo: 'alergeno', texto: `⚠️ ${a}` });
    });

    (o.insumos_delta || []).forEach(d => {
      const signo = d.accion === 'quitar' ? '−' : '+';
      const cls = d.accion === 'quitar' ? 'quitar' : 'sumar';
      chips.push({ tipo: cls, texto: `🥫 ${signo} ${d.cantidad}` });
    });

    (o.pasos_delta || []).forEach(p => {
      chips.push({ tipo: 'paso', texto: `📋 ${p.texto}` });
    });

    if (o.activo === false) {
      chips.push({ tipo: 'inactiva', texto: 'Desactivada' });
    }

    return {
      id: o.id,
      nombre: o.nombre,
      descripcion: o.descripcion || '',
      precio_delta: Number(o.precio_delta) || 0,
      activo: o.activo !== false,
      chips
    };
  });
}

/* ── 6. FORMATEO DE PRECIO ─────────────────────────────── */

export function formatearDelta(valor) {
  const v = Number(valor) || 0;
  if (v === 0) return '$0';
  const signo = v < 0 ? '−' : '+';
  return `${signo}$${Math.abs(v)}`;
}