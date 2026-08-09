/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/inventario-service.js
   Versión: 1.2.2
   Propósito: Servicio de casos de uso para inventario e insumos.
              v1.2.2: confirma uso del repositorio en validarStock.
   ================================================================ */

import { Ingrediente, reconstruirIngrediente } from '../dominio/ingrediente.js';
import { Cantidad, crearCantidad } from '../dominio/cantidad.js';
import { Dinero, crearDinero } from '../dominio/dinero.js';
import { Resultado } from '../dominio/resultado.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DBInventario } from '../db-inventario.js';
import { Store } from '../lib/store.js';

const InventarioService = (() => {
  let _inventarioRepo = null;

  function configurar(repo) {
    _inventarioRepo = repo;
  }

  async function guardarInsumo(datos) {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio de inventario no configurado');

    const stock = crearCantidad(datos.stock);
    const stockMin = crearCantidad(datos.stock_minimo || 5);

    if (!stock || !stockMin) {
      return Resultado.fallo('Datos numéricos inválidos (stock o mínimo)');
    }

    const insumoData = {
      id: datos.id || undefined,
      nombre: datos.nombre,
      stock: stock.valor,
      unidad: datos.unidad || 'u',
      stock_minimo: stockMin.valor,
      categoria: datos.categoria || 'general',
      ubicacion: datos.ubicacion || '',
      tipo: datos.tipo || 'cocina',
      costo_manual: datos.costo_manual != null ? datos.costo_manual : null
    };

    let insumoGuardado;
    try {
      insumoGuardado = await _inventarioRepo.guardarInsumo(insumoData);
    } catch (e) {
      return Resultado.fallo(`Error al guardar insumo: ${e.message}`);
    }

    try {
      Store.despachar({ type: 'INSUMO_GUARDADO', payload: insumoGuardado });
    } catch (e) {
      Logger.warn('[InventarioService] No se pudo actualizar Store:', e);
    }

    EventBus.emit('insumos:actualizados');
    return Resultado.ok(insumoGuardado);
  }

  async function ajustarStock(id, delta, motivo = 'Ajuste manual') {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _inventarioRepo.obtenerPorId(id);
    if (!datos) return Resultado.fallo('Insumo no encontrado');

    const stockActual = Number(datos.stock);
    if (isNaN(stockActual)) return Resultado.fallo('Stock actual inválido');

    const nuevoStock = Math.max(0, stockActual + delta);
    const insumoActualizado = { ...datos, stock: nuevoStock };

    try {
      await _inventarioRepo.guardarInsumo(insumoActualizado);
    } catch (e) {
      return Resultado.fallo(`Error al guardar ajuste: ${e.message}`);
    }

    EventBus.emit('inventario:actualizado');
    if (nuevoStock <= Number(datos.stock_minimo)) {
      EventBus.emit('inventario:stock_bajo', {
        insumo: datos.nombre,
        stock: nuevoStock,
        unidad: datos.unidad
      });
    }

    if (typeof _inventarioRepo.registrarMovimiento === 'function') {
      _inventarioRepo.registrarMovimiento({
        insumoId: id,
        tipo: delta >= 0 ? 'entrada' : 'salida',
        cantidad: delta,
        motivo: motivo
      });
    }

    return Resultado.ok(insumoActualizado);
  }

  async function validarStockParaArticulos(items) {
    if (!_inventarioRepo) return { ok: false, faltantes: [{ insumo: 'Sistema', faltante: 0, stockActual: 0, unidad: '', error: 'Repositorio no configurado' }] };

    const faltantes = [];
    const totalNecesario = new Map();

    // ✅ Usar el repositorio inyectado, no DB directo
    const [insumosState, recetasState] = await Promise.all([
      _inventarioRepo.obtenerInsumos(),
      _inventarioRepo.obtenerRecetas()
    ]);

    for (const item of items) {
      const receta = recetasState.find(r => r.productoId == item.prodId);
      if (!receta) continue;

      const insumosPlanos = DBInventario.getInsumosDeProducto(
        item.prodId,
        item.qty,
        recetasState,
        insumosState
      );

      for (const datos of insumosPlanos) {
        const ingData = insumosState.find(i => i.id === datos.insumoId);
        const nombre = ingData ? ingData.nombre : datos.insumoId;
        const stockActual = ingData ? ingData.stock : 0;
        const unidad = ingData ? ingData.unidad : 'u';
        const cantidadNecesaria = datos.cantidadNecesaria;

        if (!totalNecesario.has(datos.insumoId)) {
          totalNecesario.set(datos.insumoId, {
            nombre: nombre,
            unidad: unidad,
            stockActual: stockActual,
            cantidadNecesaria: 0
          });
        }
        totalNecesario.get(datos.insumoId).cantidadNecesaria += cantidadNecesaria;
      }
    }

    for (const [ingId, datos] of totalNecesario.entries()) {
      if (datos.stockActual < datos.cantidadNecesaria) {
        faltantes.push({
          insumo: datos.nombre,
          faltante: datos.cantidadNecesaria - datos.stockActual,
          stockActual: datos.stockActual,
          unidad: datos.unidad
        });
      }
    }

    return { ok: faltantes.length === 0, faltantes };
  }

  return { configurar, guardarInsumo, ajustarStock, validarStockParaArticulos };
})();

export { InventarioService };