/* ================================================================
   LaTaberna - PubPOS — SERVICIO JS (ES6)
   Archivo: js/servicios/inventario-service.js
   Versión: 1.4.0
   Propósito: Servicio de casos de uso para inventario e insumos.
              v1.4.0: A.74: ajustarStock delega en
                      DBInventario.ajustarStock (operación canónica).
                      Elimina el patrón anterior (guardarInsumo +
                      registrarMovimiento) que duplicaba el delta
                      de stock y desincronizaba capas.
              v1.3.0: guardarInsumo propaga vendible, precio_venta y
                      destino al repositorio.
              v1.2.3: validarStockParaArticulos soporta productos
                      sin receta con insumoId directo.
   ================================================================ */

import { Ingrediente, reconstruirIngrediente } from '../dominio/ingrediente.js';
import { Cantidad, crearCantidad } from '../dominio/cantidad.js';
import { Dinero, crearDinero } from '../dominio/dinero.js';
import { Resultado } from '../dominio/resultado.js';
import { EventBus } from '../lib/eventBus.js';
import { Logger } from '../lib/logger.js';
import { DBInventario } from '../db-inventario.js';
import { Store } from '../lib/store.js';
import { Auth } from '../auth.js';

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

    // Campos del modelo insumo-vendible (Fase 2, Paso 3/4).
    // Si vendible !== true, se normaliza a valores neutros para no
    // dejar rastros de precio/destino en insumos operativos.
    const vendible = datos.vendible === true;
    const destinosValidos = ['cocina', 'barra', 'ambos'];
    const destino = vendible && destinosValidos.includes(datos.destino)
      ? datos.destino
      : 'cocina';
    const precioVenta = vendible ? (Number(datos.precio_venta) || 0) : 0;

    const insumoData = {
      id: datos.id || undefined,
      nombre: datos.nombre,
      stock: stock.valor,
      unidad: datos.unidad || 'u',
      stock_minimo: stockMin.valor,
      categoria: datos.categoria || 'general',
      ubicacion: datos.ubicacion || '',
      tipo: datos.tipo || 'cocina',
      costo_manual: datos.costo_manual != null ? datos.costo_manual : null,
      vendible,
      precio_venta: precioVenta,
      destino
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

  /**
   * A.74: ajusta el stock de un insumo delegando en la operación
   * canónica DBInventario.ajustarStock.
   *
   * La operación canónica:
   *   · Calcula el delta efectivo tras el recorte a 0.
   *   · Sale temprano si delta === 0.
   *   · Persiste en Appwrite antes de modificar memoria.
   *   · Despacha al Store (INSUMO_GUARDADO + MOVIMIENTO_REGISTRADO).
   *   · Registra el movimiento con todos los campos.
   *   · Emite eventos.
   *
   * El service solo envuelve el resultado en un Resultado.
   */
  async function ajustarStock(id, delta, motivo = 'Ajuste manual') {
    try {
      const resultado = await DBInventario.ajustarStock(id, delta, motivo);

      if (!resultado || !resultado.exito) {
        const mensaje = resultado?.error || 'Error al ajustar stock';
        Logger.warn('[InventarioService] ajustarStock falló:', mensaje);
        return Resultado.fallo(mensaje);
      }

      if (resultado.sinCambio) {
        return Resultado.ok(resultado.datos);
      }

      return Resultado.ok(resultado.datos);
    } catch (e) {
      Logger.error('[InventarioService] Error inesperado en ajustarStock:', e);
      return Resultado.fallo(`Error al ajustar stock: ${e.message}`);
    }
  }

  async function validarStockParaArticulos(items) {
    if (!_inventarioRepo) {
      return {
        ok: false,
        faltantes: [{
          insumo: 'Sistema',
          faltante: 0,
          stockActual: 0,
          unidad: '',
          error: 'Repositorio no configurado'
        }]
      };
    }

    const faltantes = [];
    const totalNecesario = new Map();

    const [insumosState, recetasState] = await Promise.all([
      _inventarioRepo.obtenerInsumos(),
      _inventarioRepo.obtenerRecetas()
    ]);

    // Productos en Store para resolver insumoId directo (sin receta).
    let productosState = [];
    try {
      const state = Store.obtenerEstado();
      productosState = state.productos || [];
    } catch (e) {
      Logger.warn('[InventarioService] No se pudo leer productos del Store:', e);
    }

    function _acumular(insumoId, cantidadNecesaria) {
      const ingData = insumosState.find(i => i.id === insumoId);
      const nombre = ingData ? ingData.nombre : insumoId;
      const stockActual = ingData ? ingData.stock : 0;
      const unidad = ingData ? ingData.unidad : 'u';

      if (!totalNecesario.has(insumoId)) {
        totalNecesario.set(insumoId, {
          nombre: nombre,
          unidad: unidad,
          stockActual: stockActual,
          cantidadNecesaria: 0
        });
      }
      totalNecesario.get(insumoId).cantidadNecesaria += cantidadNecesaria;
    }

    for (const item of items) {
      const receta = recetasState.find(r => r.productoId == item.prodId);

      if (receta) {
        const insumosPlanos = DBInventario.getInsumosDeProducto(
          item.prodId,
          item.qty,
          recetasState,
          insumosState
        );

        for (const datos of insumosPlanos) {
          _acumular(datos.insumoId, datos.cantidadNecesaria);
        }
        continue;
      }

      const producto = productosState.find(p => p.id == item.prodId);
      if (producto && producto.insumoId) {
        _acumular(producto.insumoId, item.qty);
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