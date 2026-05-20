/* ================================================================
   Raíz — MÓDULO: puente-appwrite.js (v3.1)
   Propósito: Redirigir escrituras a Appwrite. Debe llamarse
              explícitamente después de que DBAppwrite esté listo.
   ================================================================ */
function activarPuenteAppwrite() {
  if (typeof DB === 'undefined' || typeof DBAppwrite === 'undefined' || !DBAppwrite.habilitado) {
    Logger.warn('[Puente] No se puede activar aún.');
    return;
  }

  // ── PRODUCTOS ──────────────────────────────────────────
  DB.syncGuardarProducto = async function(producto) {
    var idx = DB.productos.findIndex(p => p.id === producto.id);
    if (idx >= 0) DB.productos[idx] = producto;
    else DB.productos.push(producto);

    var dataSinId = Object.assign({}, producto);
    delete dataSinId.id;

    try {
      var existente = await DBAppwrite.listar('productos');
      var encontrado = existente.find(p => p.id === producto.id);
      if (encontrado) {
        await DBAppwrite.actualizar('productos', encontrado.id, dataSinId);
      } else {
        var creado = await DBAppwrite.crear('productos', producto.id, dataSinId);
        if (creado && creado.id && creado.id !== producto.id) {
          producto.id = creado.id; // actualizar con el $id real si cambió
          DB.productos = DB.productos.map(p => p.id === producto.id ? producto : p);
        }
      }
    } catch (e) {
      Logger.error('[Puente] Error guardando producto:', e);
    }
    EventBus.emit('productos:cargados', DB.productos);
  };

  DB.syncEliminarProducto = async function(productoId) {
    DB.productos = DB.productos.filter(p => p.id !== productoId);
    try {
      await DBAppwrite.eliminar('productos', productoId);
    } catch (e) {
      Logger.error('[Puente] Error eliminando producto:', e);
    }
    EventBus.emit('productos:cargados', DB.productos);
  };

  // ── INGREDIENTES ───────────────────────────────────────
  DB.syncGuardarIngrediente = async function(ingrediente) {
    var idx = DB.ingredientes.findIndex(i => i.id === ingrediente.id);
    if (idx >= 0) DB.ingredientes[idx] = ingrediente;
    else DB.ingredientes.push(ingrediente);

    var dataSinId = Object.assign({}, ingrediente);
    delete dataSinId.id;

    try {
      var existente = await DBAppwrite.listar('ingredientes');
      var encontrado = existente.find(i => i.id === ingrediente.id);
      if (encontrado) {
        await DBAppwrite.actualizar('ingredientes', encontrado.id, dataSinId);
      } else {
        var creado = await DBAppwrite.crear('ingredientes', ingrediente.id, dataSinId);
        if (creado && creado.id && creado.id !== ingrediente.id) {
          ingrediente.id = creado.id;
          DB.ingredientes = DB.ingredientes.map(i => i.id === ingrediente.id ? ingrediente : i);
        }
      }
    } catch (e) {
      Logger.error('[Puente] Error guardando ingrediente:', e);
    }
    DB.saveIngredientes();
  };

  DB.syncEliminarIngrediente = async function(ingredienteId) {
    DB.ingredientes = DB.ingredientes.filter(i => i.id !== ingredienteId);
    try {
      await DBAppwrite.eliminar('ingredientes', ingredienteId);
    } catch (e) {
      Logger.error('[Puente] Error eliminando ingrediente:', e);
    }
    DB.saveIngredientes();
  };

  // ── RECETAS ────────────────────────────────────────────
  DB.syncGuardarReceta = async function(receta) {
    var idx = DB.recetas.findIndex(r => r.productoId === receta.productoId);
    if (idx >= 0) DB.recetas[idx] = receta;
    else DB.recetas.push(receta);

    var dataSinId = Object.assign({}, receta);
    delete dataSinId.id;

    try {
      // Las recetas usan unique() como id
      var creado = await DBAppwrite.crear('recetas', null, dataSinId);
      if (creado && creado.id && creado.id !== receta.id) {
        receta.id = creado.id;
        DB.recetas = DB.recetas.map(r => r.productoId === receta.productoId ? receta : r);
      }
    } catch (e) {
      Logger.error('[Puente] Error guardando receta:', e);
    }
    DB.saveRecetas();
    EventBus.emit('recetas:actualizadas');
  };

  // ── PEDIDOS / MESAS / COMANDAS ─────────────────────────
  if (typeof PedidoRepositoryLocal !== 'undefined') {
    var metodos = ['abrirMesa', 'crearPedidoMesa', 'enviarComanda', 'cerrarPedido', 'liberarMesa', 'agregarMesa'];
    metodos.forEach(function(metodo) {
      var original = PedidoRepositoryLocal[metodo];
      if (typeof original !== 'function') return;
      PedidoRepositoryLocal[metodo] = async function() {
        var resultado = await original.apply(this, arguments);
        if (DBAppwrite.habilitado && resultado) {
          try {
            for (var i = 0; i < DB.mesas.length; i++) {
              var m = DB.mesas[i];
              if (m.esVirtual) continue;
              var dataMesa = Object.assign({}, m);
              delete dataMesa.numero; // no enviar el id
              await DBAppwrite.crear('mesas', String(m.numero), dataMesa).catch(function() {
                return DBAppwrite.actualizar('mesas', String(m.numero), dataMesa);
              });
            }
            for (var j = 0; j < DB.pedidos.length; j++) {
              var p = DB.pedidos[j];
              var dataPedido = Object.assign({}, p);
              delete dataPedido.id;
              await DBAppwrite.crear('pedidos', p.id, dataPedido).catch(function() {
                return DBAppwrite.actualizar('pedidos', p.id, dataPedido);
              });
            }
            for (var k = 0; k < DB.comandas.length; k++) {
              var c = DB.comandas[k];
              var dataComanda = Object.assign({}, c);
              delete dataComanda.id;
              await DBAppwrite.crear('comandas', c.id, dataComanda).catch(function() {
                return DBAppwrite.actualizar('comandas', c.id, dataComanda);
              });
            }
          } catch (e) {
            Logger.error('[Puente] Error sincronizando pedidos/mesas/comandas:', e);
          }
        }
        return resultado;
      };
    });
  }

  Logger.info('[Puente] Escrituras conectadas a Appwrite.');
  EventBus.emit('puente:listo');
}

window.activarPuenteAppwrite = activarPuenteAppwrite;