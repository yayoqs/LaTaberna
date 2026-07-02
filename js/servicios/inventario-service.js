/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/inventario-service.js
   Versión: 1.0.1
   Propósito: Servicio de casos de uso para inventario e ingredientes.
              Sin asignaciones window.
   Dependencias: js/dominio/ingrediente.js, js/dominio/cantidad.js,
                 js/dominio/dinero.js, js/dominio/resultado.js,
                 js/lib/eventBus.js, js/db.js, js/lib/logger.js
   ================================================================ */

import { Ingrediente, reconstruirIngrediente } from '../dominio/ingrediente.js';
import { Cantidad, crearCantidad } from '../dominio/cantidad.js';
import { Dinero, crearDinero } from '../dominio/dinero.js';
import { Resultado } from '../dominio/resultado.js';
import { EventBus } from '../lib/eventBus.js';
import { DB } from '../db.js';
import { Logger } from '../lib/logger.js';

const InventarioService = (() => {
  let _inventarioRepo = null;

  function configurar(repo) {
    _inventarioRepo = repo;
  }

  async function guardarIngrediente(datos) {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio de inventario no configurado');

    const stock = crearCantidad(datos.stock);
    const stockMin = crearCantidad(datos.stock_minimo || 5);
    const valorUnit = crearDinero(datos.valor_unitario || 0);

    if (!stock || !stockMin || !valorUnit) {
      return Resultado.fallo('Datos numéricos inválidos (stock, mínimo o valor unitario)');
    }

    let ingrediente;
    try {
      ingrediente = new Ingrediente(
        datos.id || `ins_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
        datos.nombre,
        stock,
        datos.unidad || 'u',
        stockMin,
        datos.categoria || 'general',
        datos.ubicacion || '',
        valorUnit
      );
    } catch (e) {
      return Resultado.fallo(`Error al crear ingrediente: ${e.message}`);
    }

    try {
      await _inventarioRepo.guardarIngrediente(ingrediente.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar ingrediente: ${e.message}`);
    }

    EventBus.emit('ingredientes:actualizados');
    return Resultado.ok(ingrediente);
  }

  async function ajustarStock(id, delta, motivo = 'Ajuste manual') {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio no configurado');

    const datos = await _inventarioRepo.obtenerPorId(id);
    if (!datos) return Resultado.fallo('Ingrediente no encontrado');

    const ingredienteActual = reconstruirIngrediente(datos);
    if (!ingredienteActual) return Resultado.fallo('Error al reconstruir ingrediente');

    let ingredienteNuevo;
    try {
      ingredienteNuevo = ingredienteActual.ajustarStock(delta);
    } catch (e) {
      return Resultado.fallo(`Error al ajustar stock: ${e.message}`);
    }

    try {
      await _inventarioRepo.guardarIngrediente(ingredienteNuevo.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar ajuste: ${e.message}`);
    }

    EventBus.emit('inventario:actualizado');
    if (ingredienteNuevo.bajoMinimo) {
      EventBus.emit('inventario:stock_bajo', {
        ingrediente: ingredienteNuevo.nombre,
        stock: ingredienteNuevo.stock.valor,
        unidad: ingredienteNuevo.unidad
      });
    }

    if (typeof _inventarioRepo.registrarMovimiento === 'function') {
      _inventarioRepo.registrarMovimiento({
        ingredienteId: id,
        tipo: delta >= 0 ? 'entrada' : 'salida',
        cantidad: delta,
        motivo: motivo
      });
    }

    return Resultado.ok(ingredienteNuevo);
  }

  function validarStockParaItems(items) {
    const faltantes = [];
    const totalNecesario = new Map();

    for (const item of items) {
      const receta = DB.recetas.find(r => r.productoId == item.prodId);
      if (!receta) continue;

      for (const ingReceta of receta.ingredientes) {
        const ingData = DB.ingredientes.find(i => i.id === ingReceta.ingredienteId);
        if (!ingData) continue;

        const cantidadNecesaria = ingReceta.cantidad * item.qty;

        if (!totalNecesario.has(ingReceta.ingredienteId)) {
          totalNecesario.set(ingReceta.ingredienteId, {
            nombre: ingData.nombre,
            unidad: ingData.unidad,
            stockActual: ingData.stock,
            cantidadNecesaria: 0
          });
        }
        totalNecesario.get(ingReceta.ingredienteId).cantidadNecesaria += cantidadNecesaria;
      }
    }

    for (const [ingId, datos] of totalNecesario.entries()) {
      if (datos.stockActual < datos.cantidadNecesaria) {
        faltantes.push({
          ingrediente: datos.nombre,
          faltante: datos.cantidadNecesaria - datos.stockActual,
          stockActual: datos.stockActual,
          unidad: datos.unidad
        });
      }
    }

    return { ok: faltantes.length === 0, faltantes };
  }

  return { configurar, guardarIngrediente, ajustarStock, validarStockParaItems };
})();

export { InventarioService };