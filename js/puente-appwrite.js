/* ================================================================
   Raíz — MÓDULO: puente-appwrite.js (v5.1 – crear primero para nuevos)
   Propósito: Redirigir escrituras a Appwrite. Para documentos nuevos
              (comandas, pedidos) intenta crear primero. Si ya existe,
              actualiza. Esto evita errores 404 y asegura eventos
              Realtime de tipo 'create'.
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

function _sanitizarMesa(m) {
  return {
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
}

function _sanitizarPedido(p) {
  var data = Object.assign({}, p);
  delete data.id;
  if (Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items).substring(0, 5000);
  } else {
    data.items = String(data.items || '[]').substring(0, 5000);
  }
  return data;
}

function _sanitizarComanda(c) {
  var data = Object.assign({}, c);
  delete data.id;
  if (Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items).substring(0, 5000);
  } else {
    data.items = String(data.items || '[]').substring(0, 5000);
  }
  return data;
}

async function _guardarEnAppwrite(coleccion, id, datos, esNuevo) {
  if (!DBAppwrite.habilitado) return;
  try {
    if (esNuevo) {
      // Intentar crear primero
      await DBAppwrite.crear(coleccion, id, datos);
    } else {
      // Intentar actualizar primero (para mesas, o pedidos/comandas existentes)
      await DBAppwrite.actualizar(coleccion, id, datos);
    }
  } catch (e) {
    if (esNuevo && e.code === 409) {
      // Ya existe, actualizar
      try { await DBAppwrite.actualizar(coleccion, id, datos); } catch (e2) {}
    } else if (!esNuevo && e.code === 404) {
      // No existe, crear
      try { await DBAppwrite.crear(coleccion, id, datos); } catch (e2) {}
    } else if (e.code !== 409) {
      Logger.error('[Puente] Error al guardar ' + coleccion + ' ' + id + ':', e);
    }
  }
}

function activarPuenteAppwrite() {
  if (typeof DB === 'undefined' || typeof DBAppwrite === 'undefined' || !DBAppwrite.habilitado) {
    Logger.warn('[Puente] No se puede activar aún.');
    return;
  }

  // ── SINCRONIZAR MESAS INICIALES SI ES NECESARIO ────────
  if (DB._mesasPendientesSync) {
    Logger.info('[Puente] Sincronizando mesas iniciales con Appwrite...');
    var promesas = [];
    for (var i = 0; i < DB.mesas.length; i++) {
      var m = DB.mesas[i];
      if (m.esVirtual) continue;
      promesas.push(_guardarEnAppwrite('mesas', String(m.numero), _sanitizarMesa(m), false));
    }
    Promise.all(promesas).then(function() {
      Logger.info('[Puente] Mesas iniciales sincronizadas.');
      DB._mesasPendientesSync = false;
      EventBus.emit('mesas:guardadas', DB.mesas);
    }).catch(function(e) {
      Logger.error('[Puente] Error sincronizando mesas iniciales:', e);
    });
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
    } catch (e) { Logger.error('[Puente] Error guardando producto:', e); }
    EventBus.emit('productos:cargados', DB.productos);
  };

  DB.syncEliminarProducto = async function(productoId) {
    DB.productos = DB.productos.filter(p => p.id !== productoId);
    try { await DBAppwrite.eliminar('productos', productoId); } catch (e) { Logger.error('[Puente] Error eliminando producto:', e); }
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
    } catch (e) { Logger.error('[Puente] Error guardando ingrediente:', e); }
    DB.saveIngredientes();
  };

  DB.syncEliminarIngrediente = async function(ingredienteId) {
    DB.ingredientes = DB.ingredientes.filter(i => i.id !== ingredienteId);
    try { await DBAppwrite.eliminar('ingredientes', ingredienteId); } catch (e) { Logger.error('[Puente] Error eliminando ingrediente:', e); }
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
    } catch (e) { Logger.error('[Puente] Error guardando receta:', e); }
    DB.saveRecetas();
    EventBus.emit('recetas:actualizadas');
  };

  // ── PEDIDOS / MESAS / COMANDAS (SINCRONIZACIÓN PUNTUAL) ──
  window._syncMesaAAppwrite = async function(mesa) {
    if (!mesa || mesa.esVirtual) return;
    // Las mesas normalmente ya existen, así que intentamos actualizar primero
    await _guardarEnAppwrite('mesas', String(mesa.numero), _sanitizarMesa(mesa), false);
  };

  window._syncPedidoAAppwrite = async function(pedido, esNuevo) {
    if (!pedido || !pedido.id) return;
    await _guardarEnAppwrite('pedidos', pedido.id, _sanitizarPedido(pedido), esNuevo);
  };

  window._syncComandaAAppwrite = async function(comanda, esNuevo) {
    if (!comanda || !comanda.id) return;
    await _guardarEnAppwrite('comandas', comanda.id, _sanitizarComanda(comanda), esNuevo);
  };

  if (typeof PedidoRepositoryLocal !== 'undefined') {
    var metodos = ['abrirMesa', 'crearPedidoMesa', 'enviarComanda', 'cerrarPedido', 'liberarMesa', 'agregarMesa'];
    metodos.forEach(function(metodo) {
      var original = PedidoRepositoryLocal[metodo];
      if (typeof original !== 'function') return;
      PedidoRepositoryLocal[metodo] = async function() {
        var resultado = await original.apply(this, arguments);
        if (DBAppwrite.habilitado && resultado) {
          try {
            // Sincronizar mesa afectada
            if (resultado.mesa) {
              var mesa = DB.mesas.find(m => m.numero == resultado.mesa);
              if (mesa) await window._syncMesaAAppwrite(mesa);
            }
            // Sincronizar pedido (nuevo si es 'crearPedidoMesa')
            if (resultado.id && resultado.estado) {
              var esNuevoPedido = (metodo === 'crearPedidoMesa');
              await window._syncPedidoAAppwrite(resultado, esNuevoPedido);
            }
            // Sincronizar comandas (siempre nuevas)
            if (resultado.comandas && Array.isArray(resultado.comandas)) {
              for (var c = 0; c < resultado.comandas.length; c++) {
                await window._syncComandaAAppwrite(resultado.comandas[c], true);
              }
            }
            if (metodo === 'liberarMesa' && resultado) {
              await window._syncMesaAAppwrite(resultado);
            }
          } catch (e) {
            Logger.error('[Puente] Error en sincronización puntual:', e);
          }
        }
        return resultado;
      };
    });
  }

  Logger.info('[Puente] Escrituras conectadas a Appwrite (crear primero para nuevos).');
  EventBus.emit('puente:listo');
}

window.activarPuenteAppwrite = activarPuenteAppwrite;