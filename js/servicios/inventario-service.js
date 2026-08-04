/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/inventario-service.js
   Versión: 1.2.0
   Propósito: Servicio de casos de uso para inventario e ingredientes.
              v1.2.0: validarStockParaArticulos ahora usa el repositorio
                      en lugar de DB directo.
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

    // Guardar en repositorio y obtener el objeto definitivo (con ID)
    let ingredienteGuardado;
    try {
      ingredienteGuardado = await _inventarioRepo.guardarIngrediente(ingrediente.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar ingrediente: ${e.message}`);
    }

    // Actualizar Store con el objeto que tiene el ID correcto
    try {
      Store.despachar({ type: 'INGREDIENTE_GUARDADO', payload: ingredienteGuardado });
    } catch (e) {
      Logger.warn('[InventarioService] No se pudo actualizar Store:', e);
    }

    EventBus.emit('ingredientes:actualizados');
    return Resultado.ok(ingredienteGuardado);
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

  async function validarStockParaArticulos(items) {
    if (!_inventarioRepo) return { ok: false, faltantes: [{ ingrediente: 'Sistema', faltante: 0, stockActual: 0, unidad: '', error: 'Repositorio no configurado' }] };

    const faltantes = [];
    const totalNecesario = new Map();

    // ✅ Leer desde el repositorio, no desde DB
    const [ingredientesState, recetasState] = await Promise.all([
      _inventarioRepo.obtenerIngredientes(),
      _inventarioRepo.obtenerRecetas()
    ]);

    for (const item of items) {
      const receta = recetasState.find(r => r.productoId == item.prodId);
      if (!receta) continue;

      const ingredientesPlanos = DBInventario.getIngredientesDeProducto(
        item.prodId,
        item.qty,
        recetasState,
        ingredientesState
      );

      for (const datos of ingredientesPlanos) {
        const ingData = ingredientesState.find(i => i.id === datos.ingredienteId);
        const nombre = ingData ? ingData.nombre : datos.ingredienteId;
        const stockActual = ingData ? ingData.stock : 0;
        const unidad = ingData ? ingData.unidad : 'u';
        const cantidadNecesaria = datos.cantidadNecesaria;

        if (!totalNecesario.has(datos.ingredienteId)) {
          totalNecesario.set(datos.ingredienteId, {
            nombre: nombre,
            unidad: unidad,
            stockActual: stockActual,
            cantidadNecesaria: 0
          });
        }
        totalNecesario.get(datos.ingredienteId).cantidadNecesaria += cantidadNecesaria;
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

  return { configurar, guardarIngrediente, ajustarStock, validarStockParaArticulos };
})();

export { InventarioService };