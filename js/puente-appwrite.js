/* ================================================================
   Raíz — MÓDULO: puente-appwrite.js (v1.0)
   Propósito: Redirigir las escrituras de la app hacia Appwrite
              cuando está habilitado. Parchea DB y PedidoRepository.
   ================================================================ */
(function() {
  // Esperar a que DB y DBAppwrite estén listos
  function parchear() {
    if (typeof DB === 'undefined' || typeof DBAppwrite === 'undefined') {
      setTimeout(parchear, 200);
      return;
    }

    // ── PRODUCTOS ──────────────────────────────────────────
    DB.syncGuardarProducto = async function(producto) {
      // Actualizar memoria local
      var idx = DB.productos.findIndex(function(p) { return p.id === producto.id; });
      if (idx >= 0) DB.productos[idx] = producto;
      else DB.productos.push(producto);

      if (DBAppwrite.habilitado) {
        try {
          // Verificar si existe en Appwrite
          var existente = await DBAppwrite.listar('productos');
          var encontrado = existente.find(function(p) { return p.id === producto.id; });
          if (encontrado) {
            await DBAppwrite.actualizar('productos', producto.id, producto);
          } else {
            await DBAppwrite.crear('productos', producto);
          }
        } catch (e) {
          Logger.error('[Bridge] Error guardando producto en Appwrite:', e);
        }
      }
      EventBus.emit('productos:cargados', DB.productos);
    };

    DB.syncEliminarProducto = async function(productoId) {
      DB.productos = DB.productos.filter(function(p) { return p.id !== productoId; });
      if (DBAppwrite.habilitado) {
        try {
          await DBAppwrite.eliminar('productos', productoId);
        } catch (e) {
          Logger.error('[Bridge] Error eliminando producto en Appwrite:', e);
        }
      }
      EventBus.emit('productos:cargados', DB.productos);
    };

    // ── INGREDIENTES ───────────────────────────────────────
    DB.syncGuardarIngrediente = async function(ingrediente) {
      var idx = DB.ingredientes.findIndex(function(i) { return i.id === ingrediente.id; });
      if (idx >= 0) DB.ingredientes[idx] = ingrediente;
      else DB.ingredientes.push(ingrediente);

      if (DBAppwrite.habilitado) {
        try {
          var existente = await DBAppwrite.listar('ingredientes');
          var encontrado = existente.find(function(i) { return i.id === ingrediente.id; });
          if (encontrado) {
            await DBAppwrite.actualizar('ingredientes', ingrediente.id, ingrediente);
          } else {
            await DBAppwrite.crear('ingredientes', ingrediente);
          }
        } catch (e) {
          Logger.error('[Bridge] Error guardando ingrediente:', e);
        }
      }
      DB.saveIngredientes();
    };

    DB.syncEliminarIngrediente = async function(ingredienteId) {
      DB.ingredientes = DB.ingredientes.filter(function(i) { return i.id !== ingredienteId; });
      if (DBAppwrite.habilitado) {
        try {
          await DBAppwrite.eliminar('ingredientes', ingredienteId);
        } catch (e) {
          Logger.error('[Bridge] Error eliminando ingrediente:', e);
        }
      }
      DB.saveIngredientes();
    };

    // ── RECETAS ────────────────────────────────────────────
    DB.syncGuardarReceta = async function(receta) {
      if (DBAppwrite.habilitado) {
        try {
          await DBAppwrite.crear('recetas', receta);
        } catch (e) {
          Logger.error('[Bridge] Error guardando receta:', e);
        }
      }
      // También actualizar localmente
      var idx = DB.recetas.findIndex(function(r) { return r.productoId === receta.productoId; });
      if (idx >= 0) DB.recetas[idx] = receta;
      else DB.recetas.push(receta);
      DB.saveRecetas();
      EventBus.emit('recetas:actualizadas');
    };

    // ── PEDIDOS Y MESAS ────────────────────────────────────
    // Parchear PedidoRepositoryLocal para que persista en Appwrite
    if (typeof PedidoRepositoryLocal !== 'undefined') {
      var repoOriginal = Object.assign({}, PedidoRepositoryLocal);

      // Envolver métodos que modifican mesas/pedidos
      ['abrirMesa', 'crearPedidoMesa', 'enviarComanda', 'cerrarPedido', 'liberarMesa', 'agregarMesa'].forEach(function(metodo) {
        var original = PedidoRepositoryLocal[metodo];
        PedidoRepositoryLocal[metodo] = async function() {
          var resultado = await original.apply(this, arguments);
          // Después de la operación local, sincronizar con Appwrite
          if (DBAppwrite.habilitado && resultado) {
            try {
              // Sincronizar mesas
              var mesasActualizadas = DB.mesas.filter(function(m) {
                // Solo mesas que no sean virtuales o recién modificadas
                return !m.esVirtual;
              });
              for (var i = 0; i < mesasActualizadas.length; i++) {
                var mesa = mesasActualizadas[i];
                await DBAppwrite.actualizar('mesas', String(mesa.numero), mesa).catch(function() {
                  // Si falla, intentar crear
                  return DBAppwrite.crear('mesas', mesa);
                });
              }

              // Sincronizar pedidos
              for (var j = 0; j < DB.pedidos.length; j++) {
                var pedido = DB.pedidos[j];
                await DBAppwrite.crear('pedidos', pedido).catch(function() {
                  return DBAppwrite.actualizar('pedidos', pedido.id, pedido);
                });
              }

              // Sincronizar comandas
              for (var k = 0; k < DB.comandas.length; k++) {
                var comanda = DB.comandas[k];
                await DBAppwrite.crear('comandas', comanda).catch(function() {
                  return DBAppwrite.actualizar('comandas', comanda.id, comanda);
                });
              }
            } catch (e) {
              Logger.error('[Bridge] Error sincronizando pedidos/mesas:', e);
            }
          }
          return resultado;
        };
      });
    }

    Logger.info('[Bridge] Escrituras conectadas a Appwrite.');
  }

  // Iniciar el parche después de que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(parchear, 1500); // dar tiempo a que DB.init termine
    });
  } else {
    setTimeout(parchear, 1500);
  }
})();