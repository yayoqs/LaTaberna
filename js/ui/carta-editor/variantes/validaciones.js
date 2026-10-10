/* ================================================================
   LaTaberna - PubPOS — CARTA EDITOR · VARIANTES SUBMÓDULO (ES6)
   Archivo: js/ui/carta-editor/variantes/validaciones.js
   Versión: 1.0.0
   Propósito: Validaciones de variantes y opciones según el contrato
              ARQUITECTURA-VARIANTES.md v1.2.0. Cubre invariantes de
              tipo, unicidad de IDs por espacio, unidades de
              insumos_delta, referencias de requiere/excluye y
              consistencia de pasos_delta.
   v1.0.0: creación inicial. Fase 1. Reconoce acciones de Fase 2 en
           el JSON pero las marca como advertencia, no como error.
   ================================================================ */

import { ALERGENOS } from '../../../dominio/alergenos.js';
import { Logger } from '../../../lib/logger.js';

const TIPOS_VARIANTE = ['unica', 'multiple'];
const ACCIONES_INSUMO_FASE1 = ['sumar', 'quitar'];
const ACCIONES_INSUMO_FASE2 = ['multiplicar', 'sustituir'];
const ACCIONES_INSUMO_VALIDAS = [...ACCIONES_INSUMO_FASE1, ...ACCIONES_INSUMO_FASE2];

const ACCIONES_PASO_FASE1 = ['sumar', 'ocultar'];
const ACCIONES_PASO_FASE2 = ['sustituir'];
const ACCIONES_PASO_VALIDAS = [...ACCIONES_PASO_FASE1, ...ACCIONES_PASO_FASE2];

const POSICIONES_PASO = ['inicio', 'fin', 'despues_de'];

function _resultadoVacio() {
  return { errores: [], warnings: [] };
}

export function normalizarVariante(variante) {
  const v = { ...variante };

  if (v.tipo === 'unica') {
    v.max_seleccion = 1;
    v.min_seleccion = v.requerido ? 1 : 0;
  }

  if (!v.requerido) {
    v.min_seleccion = 0;
  }

  if (v.tipo === 'multiple') {
    v.min_seleccion = Math.max(0, Number.isInteger(v.min_seleccion) ? v.min_seleccion : 0);
    v.max_seleccion = Math.max(v.min_seleccion, Number.isInteger(v.max_seleccion) ? v.max_seleccion : 1);
  }

  if (typeof v.activo !== 'boolean') v.activo = true;
  if (!Number.isInteger(v.orden)) v.orden = 0;
  if (!Array.isArray(v.opciones)) v.opciones = [];
  if (typeof v.nombre !== 'string') v.nombre = '';
  if (typeof v.descripcion !== 'string') v.descripcion = '';

  return v;
}

export function validarVariante(variante) {
  const r = _resultadoVacio();
  if (!variante) {
    r.errores.push('Variante vacía.');
    return r;
  }

  if (!variante.nombre || !variante.nombre.trim()) {
    r.errores.push('El nombre de la variante es obligatorio.');
  }

  if (!TIPOS_VARIANTE.includes(variante.tipo)) {
    r.errores.push(`Tipo inválido: "${variante.tipo}". Debe ser "unica" o "multiple".`);
  }

  if (variante.tipo === 'unica') {
    if (variante.max_seleccion !== 1) {
      r.errores.push('Tipo "única" requiere máx. selección = 1.');
    }
    if (variante.requerido && variante.min_seleccion !== 1) {
      r.errores.push('Tipo "única" requerida requiere mín. selección = 1.');
    }
    if (!variante.requerido && variante.min_seleccion !== 0) {
      r.errores.push('Tipo "única" no requerida requiere mín. selección = 0.');
    }
  }

  if (variante.tipo === 'multiple') {
    if (!Number.isInteger(variante.min_seleccion) || variante.min_seleccion < 0) {
      r.errores.push('Mín. selección debe ser un entero ≥ 0.');
    }
    if (!Number.isInteger(variante.max_seleccion) || variante.max_seleccion < 1) {
      r.errores.push('Máx. selección debe ser un entero ≥ 1.');
    }
    if (variante.max_seleccion < variante.min_seleccion) {
      r.errores.push('Máx. selección debe ser ≥ mín. selección.');
    }
  }

  if (!variante.requerido && variante.min_seleccion !== 0) {
    r.errores.push('Si la variante no es requerida, mín. selección debe ser 0.');
  }

  if (!Number.isInteger(variante.orden)) {
    r.warnings.push('Orden no definido. Se usará 0 por defecto.');
  }

  return r;
}

export function validarOpcion(opcion, contexto) {
  const r = _resultadoVacio();
  if (!opcion) {
    r.errores.push('Opción vacía.');
    return r;
  }

  const ctx = contexto || {};

  if (!opcion.id || !String(opcion.id).trim()) {
    r.errores.push('El ID de la opción es obligatorio.');
  } else if (!/^[a-z0-9_]+$/.test(opcion.id)) {
    r.errores.push('El ID solo admite minúsculas, números y guion bajo.');
  }

  if (!opcion.nombre || !opcion.nombre.trim()) {
    r.errores.push('El nombre de la opción es obligatorio.');
  }

  if (!Number.isFinite(opcion.precio_delta)) {
    r.errores.push('El precio delta debe ser un número.');
  }

  const alergenosValidos = Array.isArray(opcion.alergenos) ? opcion.alergenos : [];
  const alergenosInvalidos = alergenosValidos.filter(a => !ALERGENOS.includes(a));
  if (alergenosInvalidos.length > 0) {
    r.errores.push(`Alérgenos no reconocidos: ${alergenosInvalidos.join(', ')}.`);
  }

  if (opcion.requiere && !Array.isArray(opcion.requiere)) {
    r.errores.push('El campo "requiere" debe ser un array.');
  }
  if (opcion.excluye && !Array.isArray(opcion.excluye)) {
    r.errores.push('El campo "excluye" debe ser un array.');
  }
  const autoRef =
    (opcion.requiere || []).includes(opcion.id) ||
    (opcion.excluye || []).includes(opcion.id);
  if (autoRef) {
    r.errores.push('Una opción no puede requerirse ni excluirse a sí misma.');
  }

  if (opcion.id && Array.isArray(ctx.variantes)) {
    const colision = _buscarColisionId(opcion.id, ctx.variantes, ctx.exclusionId);
    if (colision) {
      r.errores.push(`El ID "${opcion.id}" ya existe en otra opción. Los IDs deben ser únicos dentro del espacio.`);
    }
  }

  if (Array.isArray(ctx.variantes) && (opcion.requiere?.length || opcion.excluye?.length)) {
    const referenciasValidas = _construirSetOpcionesValidas(ctx.variantes, opcion.id);
    (opcion.requiere || []).forEach(ref => {
      if (!referenciasValidas.has(ref)) {
        r.errores.push(`La referencia "${ref}" en "requiere" no existe en el espacio.`);
      }
    });
    (opcion.excluye || []).forEach(ref => {
      if (!referenciasValidas.has(ref)) {
        r.errores.push(`La referencia "${ref}" en "excluye" no existe en el espacio.`);
      }
    });
  }

  const insumosDelta = Array.isArray(opcion.insumos_delta) ? opcion.insumos_delta : [];
  const insumosCache = Array.isArray(ctx.insumosCache) ? ctx.insumosCache : [];
  insumosDelta.forEach((d, i) => {
    const prefijo = `Insumo delta #${i + 1}: `;
    if (!d.insumoId) {
      r.errores.push(`${prefijo}falta el insumo.`);
      return;
    }
    const insumoBase = insumosCache.find(x => x.id === d.insumoId);
    if (!insumoBase) {
      r.errores.push(`${prefijo}el insumo "${d.insumoId}" no existe.`);
      return;
    }
    if (!Number.isFinite(d.cantidad) || d.cantidad < 0) {
      r.errores.push(`${prefijo}la cantidad debe ser un número ≥ 0.`);
    }
    if (!ACCIONES_INSUMO_VALIDAS.includes(d.accion)) {
      r.errores.push(`${prefijo}acción "${d.accion}" no reconocida.`);
    } else if (ACCIONES_INSUMO_FASE2.includes(d.accion)) {
      r.warnings.push(`${prefijo}acción "${d.accion}" es de Fase 2. Se guardará pero el motor la ignorará.`);
    }
    if (d.unidad && d.unidad !== insumoBase.unidad) {
      r.errores.push(`${prefijo}unidad "${d.unidad}" no coincide con la del insumo (${insumoBase.unidad}).`);
    }
  });

  const pasosDelta = Array.isArray(opcion.pasos_delta) ? opcion.pasos_delta : [];
  pasosDelta.forEach((p, i) => {
    const prefijo = `Paso delta #${i + 1}: `;
    if (!ACCIONES_PASO_VALIDAS.includes(p.accion)) {
      r.errores.push(`${prefijo}acción "${p.accion}" no reconocida.`);
    } else if (ACCIONES_PASO_FASE2.includes(p.accion)) {
      r.warnings.push(`${prefijo}acción "${p.accion}" es de Fase 2.`);
    }
    if (p.accion === 'sumar') {
      if (!p.texto || !String(p.texto).trim()) {
        r.errores.push(`${prefijo}falta el texto del paso.`);
      }
      if (p.posicion && !POSICIONES_PASO.includes(p.posicion)) {
        r.errores.push(`${prefijo}posición "${p.posicion}" no válida.`);
      }
    }
    if (p.accion === 'ocultar' && !p.pasoRef) {
      r.warnings.push(`${prefijo}falta pasoRef. Se validará al asignar al producto.`);
    }
    if (p.posicion === 'despues_de' && !p.pasoRef) {
      r.warnings.push(`${prefijo}posición "despues_de" requiere pasoRef. Se validará al asignar.`);
    }
  });

  return r;
}

function _buscarColisionId(id, variantes, exclusionId) {
  for (const v of variantes) {
    if (!Array.isArray(v.opciones)) continue;
    for (const op of v.opciones) {
      if (op.id === id && op.id !== exclusionId) return op;
    }
  }
  return null;
}

function _construirSetOpcionesValidas(variantes, idPropio) {
  const set = new Set();
  for (const v of variantes) {
    if (!Array.isArray(v.opciones)) continue;
    for (const op of v.opciones) {
      if (op.id && op.id !== idPropio) set.add(op.id);
    }
  }
  return set;
}

export function slugDesdeNombre(nombre) {
  if (!nombre || typeof nombre !== 'string') return '';
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function idExisteEnEspacio(id, variantes, exclusionId) {
  return _buscarColisionId(id, variantes, exclusionId) !== null;
}

export function obtenerUnidadInsumo(insumoId, insumosCache) {
  if (!Array.isArray(insumosCache)) return null;
  const insumo = insumosCache.find(x => x.id === insumoId);
  return insumo ? insumo.unidad : null;
}