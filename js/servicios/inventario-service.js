/* ================================================================
   PubPOS — SERVICIO: InventarioService
   Propósito: Coordina las operaciones del inventario usando el
              agregado Ingrediente. Retorna Resultado en cada caso.
   ================================================================ */
const InventarioService = (() => {

  let _inventarioRepo = null;

  /** @param {object} repo – implementación del repositorio de inventario */
  function configurar(repo) {
    _inventarioRepo = repo;
  }

  /**
   * Guarda (crea o actualiza) un ingrediente.
   * @param {object} datos – { id?, nombre, stock, unidad, stock_minimo, categoria, ubicacion, valor_unitario }
   * @returns {Promise<Resultado>}
   */
  async function guardarIngrediente(datos) {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio de inventario no configurado');

    // 1. Validar campos obligatorios con Value Objects
    const stock = crearCantidad(datos.stock);
    const stockMin = crearCantidad(datos.stock_minimo || 5);
    const valorUnit = crearDinero(datos.valor_unitario || 0);

    if (!stock || !stockMin || !valorUnit) {
      return Resultado.fallo('Datos numéricos inválidos (stock, mínimo o valor unitario)');
    }

    // 2. Crear o actualizar el agregado
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

    // 3. Persistir
    try {
      await _inventarioRepo.guardarIngrediente(ingrediente.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar ingrediente: ${e.message}`);
    }

    EventBus.emit('ingredientes:actualizados');
    return Resultado.ok(ingrediente);
  }

  /**
   * Ajusta el stock de un ingrediente.
   * @param {string} id – ID del ingrediente
   * @param {number} delta – Cantidad a sumar (positivo) o restar (negativo)
   * @param {string} motivo – Motivo del ajuste
   * @returns {Promise<Resultado>}
   */
  async function ajustarStock(id, delta, motivo = 'Ajuste manual') {
    if (!_inventarioRepo) return Resultado.fallo('Repositorio no configurado');

    // 1. Obtener el estado actual
    const datos = await _inventarioRepo.obtenerPorId(id);
    if (!datos) return Resultado.fallo('Ingrediente no encontrado');

    const ingredienteActual = reconstruirIngrediente(datos);
    if (!ingredienteActual) return Resultado.fallo('Error al reconstruir ingrediente');

    // 2. Aplicar ajuste (el agregado valida que no sea negativo)
    const deltaCant = crearCantidad(delta);
    if (!deltaCant) return Resultado.fallo('Delta inválido');

    let ingredienteNuevo;
    try {
      ingredienteNuevo = ingredienteActual.ajustarStock(deltaCant);
    } catch (e) {
      return Resultado.fallo(`Error al ajustar stock: ${e.message}`);
    }

    // 3. Persistir
    try {
      await _inventarioRepo.guardarIngrediente(ingredienteNuevo.toJSON());
    } catch (e) {
      return Resultado.fallo(`Error al guardar ajuste: ${e.message}`);
    }

    // 4. Emitir eventos
    EventBus.emit('inventario:actualizado');
    if (ingredienteNuevo.bajoMinimo) {
      EventBus.emit('inventario:stock_bajo', {
        ingrediente: ingredienteNuevo.nombre,
        stock: ingredienteNuevo.stock.valor,
        unidad: ingredienteNuevo.unidad
      });
    }

    // Registrar movimiento (delegamos al repositorio si corresponde)
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

  /**
   * Valida si hay stock suficiente para una lista de ítems.
   * @param {Array} items – [{ prodId, nombre, qty }]
   * @returns {{ ok: boolean, faltantes: Array }}
   */
  function validarStockParaItems(items) {
    // Conservamos la misma lógica que estaba en db-inventario.js
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

  return {
    configurar,
    guardarIngrediente,
    ajustarStock,
    validarStockParaItems
  };
})();

window.InventarioService = InventarioService;