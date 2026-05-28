/* ================================================================
   Raíz — MÓDULO: puente-appwrite.js (v4.7)
   Propósito: Redirigir escrituras a Appwrite. Ahora intenta
              actualizar primero (para evitar 409) y solo crea
              si el documento no existe (404).
   ================================================================ */

function _normalizarFecha(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') {
    return new Date(valor).toISOString();
  }
  var str = String(valor);
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return str.substring(0, 100);
}

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
          producto.id = creado.id;
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
            // Sincronizar mesas (actualizar primero, crear solo si falla con 404)
            for (var i = 0; i < DB.mesas.length; i++) {
              var m = DB.mesas[i];
              if (m.esVirtual) continue;

              var dataMesa = {
                numero: m.numero,
                estado: String(m.estado || 'libre'),
                pedidoId: String(m.pedidoId || '').substring(0, 50),
                items: Array.isArray(m.items) ? JSON.stringify(m.items).substring(0, 5000) : String(m.items || '[]').substring(0, 5000),
                mozo: String(m.mozo || '').substring(0, 100),
                comensales: Number(m.comensales) || 1,
                abiertaEn: _normalizarFecha(m.abiertaEn),
                observaciones: String(m.observaciones || '').substring(0, 500),
                zona: String(m.zona || 'salon').substring(0, 50),
                mesasFusionadas: Array.isArray(m.mesasFusionadas) ? JSON.stringify(m.mesasFusionadas).substring(0, 500) : String(m.mesasFusionadas || '').substring(0, 500),
                esVirtual: Boolean(m.esVirtual)
              };

              await DBAppwrite.actualizar('mesas', String(m.numero), dataMesa).catch(async function(e) {
                if (e && e.code === 404) {
                  return await DBAppwrite.crear('mesas', String(m.numero), dataMesa);
                }
                throw e;
              });
            }
            // Sincronizar pedidos (actualizar primero, crear solo si 404)
            for (var j = 0; j < DB.pedidos.length; j++) {
              var p = DB.pedidos[j];
              var dataPedido = Object.assign({}, p);
              delete dataPedido.id;
              if (Array.isArray(dataPedido.items)) {
                dataPedido.items = JSON.stringify(dataPedido.items).substring(0, 5000);
              } else {
                dataPedido.items = String(dataPedido.items || '[]').substring(0, 5000);
              }
              await DBAppwrite.actualizar('pedidos', p.id, dataPedido).catch(async function(e) {
                if (e && e.code === 404) {
                  return await DBAppwrite.crear('pedidos', p.id, dataPedido);
                }
                throw e;
              });
            }
            // Sincronizar comandas (actualizar primero, crear solo si 404)
            for (var k = 0; k < DB.comandas.length; k++) {
              var c = DB.comandas[k];
              var dataComanda = Object.assign({}, c);
              delete dataComanda.id;
              if (Array.isArray(dataComanda.items)) {
                dataComanda.items = JSON.stringify(dataComanda.items).substring(0, 5000);
              } else {
                dataComanda.items = String(dataComanda.items || '[]').substring(0, 5000);
              }
              await DBAppwrite.actualizar('comandas', c.id, dataComanda).catch(async function(e) {
                if (e && e.code === 404) {
                  return await DBAppwrite.crear('comandas', c.id, dataComanda);
                }
                throw e;
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