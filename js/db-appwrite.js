/* ================================================================
   LaTaberna - PubPOS — MÓDULO JS
   Archivo: js/db-appwrite.js
   Versión: 1.0.0
   Propósito: Cliente de Appwrite (API TablesDB), Realtime y operadores.
   ================================================================ */
var DBAppwrite = (function() {
  var modulo = {};

  modulo.cliente = null;
  modulo.baseDeDatos = null;
  modulo.cuenta = null;
  modulo.idBaseDeDatos = '6a0275cb0022ebf7d30d';
  modulo.habilitado = false;

  modulo.COLECCIONES = {
    productos: 'Productos',
    pedidos: 'Pedidos',
    mesas: 'Mesas',
    comandas: 'Comandas',
    ingredientes: 'Ingredientes',
    recetas: 'Recetas',
    pedidos_delivery: 'Pedidos_delivery',
    usuarios: 'Usuarios',
    configuracion: 'Configuracion',
    precargas_cliente: 'Precargas_cliente',
    eventos_en_vivo: 'Eventos_en_vivo'
  };

  /**
   * Limpia los metadatos internos de Appwrite y expone los timestamps
   * en español (creadoEn, actualizadoEn).
   * @param {Object} fila - Documento/fila crudo desde Appwrite.
   * @returns {Object} Datos limpios con id, creadoEn, actualizadoEn.
   */
  function _limpiarFila(fila) {
    var datos = Object.assign({}, fila);
    // Extraer timestamps antes de borrar las claves $
    var creado = datos.$createdAt || null;
    var actualizado = datos.$updatedAt || null;

    delete datos.$id;
    delete datos.$databaseId;
    delete datos.$tableId;
    delete datos.$createdAt;
    delete datos.$updatedAt;
    delete datos.$permissions;

    datos.id = fila.$id;
    datos.creadoEn = creado;
    datos.actualizadoEn = actualizado;

    return datos;
  }

  modulo.iniciar = async function() {
    if (typeof window.Appwrite === 'undefined') {
      Logger.warn('[Appwrite] SDK no cargado.');
      modulo.habilitado = false;
      return false;
    }

    var endpoint = localStorage.getItem('appwrite_endpoint') || 'https://tor.cloud.appwrite.io/v1';
    var projectId = localStorage.getItem('appwrite_project_id') || '6a025322001f24c57d1d';

    try {
      modulo.cliente = new Appwrite.Client()
        .setEndpoint(endpoint)
        .setProject(projectId);

      // Crear sesión anónima
      modulo.cuenta = new Appwrite.Account(modulo.cliente);
      try {
        await modulo.cuenta.createAnonymousSession();
        Logger.info('[Appwrite] Sesión anónima creada correctamente.');
      } catch (e) {
        Logger.info('[Appwrite] Usando sesión anónima existente.');
      }

      // Usar la nueva API TablesDB
      modulo.baseDeDatos = new Appwrite.TablesDB(modulo.cliente);
      modulo.habilitado = true;
      Logger.info('[Appwrite] Cliente inicializado (API TablesDB).');
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al iniciar:', e);
      modulo.habilitado = false;
      return false;
    }
  };

  modulo.listar = async function(coleccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return [];
    try {
      var respuesta = await modulo.baseDeDatos.listRows({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion]
      });
      return respuesta.rows.map(_limpiarFila);
    } catch (e) {
      Logger.error('[Appwrite] Error al listar ' + coleccion + ':', e);
      return [];
    }
  };

  modulo.crear = async function(coleccion, idFila, datos) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      var id = idFila || Appwrite.ID.unique();
      var datosLimpios = Object.assign({}, datos);
      delete datosLimpios.id;
      // Eliminar timestamps manuales si vienen (usaremos los automáticos)
      delete datosLimpios.creadoEn;
      delete datosLimpios.actualizadoEn;
      delete datosLimpios.created_at;
      delete datosLimpios.updated_at;

      var respuesta = await modulo.baseDeDatos.createRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: datosLimpios
      });
      return _limpiarFila(respuesta);
    } catch (e) {
      if (e.code !== 409) {
        Logger.error('[Appwrite] Error al crear en ' + coleccion + ':', e);
      }
      return null;
    }
  };

  modulo.actualizar = async function(coleccion, id, cambios) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      // Eliminar timestamps manuales si vienen (Appwrite actualiza $updatedAt solo)
      var cambiosLimpios = Object.assign({}, cambios);
      delete cambiosLimpios.creadoEn;
      delete cambiosLimpios.actualizadoEn;
      delete cambiosLimpios.created_at;
      delete cambiosLimpios.updated_at;
      delete cambiosLimpios.id;

      var respuesta = await modulo.baseDeDatos.updateRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: cambiosLimpios
      });
      return _limpiarFila(respuesta);
    } catch (e) {
      if (e.code !== 404) {
        Logger.error('[Appwrite] Error al actualizar ' + coleccion + ':', e);
      }
      return null;
    }
  };

  modulo.eliminar = async function(coleccion, id) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await modulo.baseDeDatos.deleteRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id
      });
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al eliminar en ' + coleccion + ':', e);
      return false;
    }
  };

  // ── Operadores atómicos ──────────────────────────────────
  modulo.incrementarCampo = async function(coleccion, id, columna, valor, maximo) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      var params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        column: columna,
        value: valor
      };
      if (maximo !== undefined) params.max = maximo;
      return await modulo.baseDeDatos.incrementRowColumn(params);
    } catch (e) {
      Logger.error('[Appwrite] Error al incrementar ' + columna + ':', e);
      return null;
    }
  };

  modulo.decrementarCampo = async function(coleccion, id, columna, valor, minimo) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      var params = {
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        column: columna,
        value: valor
      };
      if (minimo !== undefined) params.min = minimo;
      return await modulo.baseDeDatos.decrementRowColumn(params);
    } catch (e) {
      Logger.error('[Appwrite] Error al decrementar ' + columna + ':', e);
      return null;
    }
  };

  modulo.actualizarConOperadores = async function(coleccion, id, datosConOperadores) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      var respuesta = await modulo.baseDeDatos.updateRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: id,
        data: datosConOperadores
      });
      return _limpiarFila(respuesta);
    } catch (e) {
      Logger.error('[Appwrite] Error al actualizar con operadores:', e);
      return null;
    }
  };

  // ── Transacciones ────────────────────────────────────────
  modulo.crearTransaccion = async function() {
    if (!modulo.habilitado || !modulo.baseDeDatos) return null;
    try {
      var tx = await modulo.baseDeDatos.createTransaction();
      return tx;
    } catch (e) {
      Logger.error('[Appwrite] Error al crear transacción:', e);
      return null;
    }
  };

  modulo.confirmarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await modulo.baseDeDatos.updateTransaction({
        transactionId: idTransaccion,
        commit: true
      });
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al confirmar transacción:', e);
      return false;
    }
  };

  modulo.cancelarTransaccion = async function(idTransaccion) {
    if (!modulo.habilitado || !modulo.baseDeDatos) return false;
    try {
      await modulo.baseDeDatos.updateTransaction({
        transactionId: idTransaccion,
        rollback: true
      });
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al cancelar transacción:', e);
      return false;
    }
  };

  // ── Realtime ────────────────────────────────────────────
  var _callbacksRealtime = [];

  function _actualizarArrayLocal(nombreArray, datos, campoId) {
    if (!window.DB) window.DB = {};
    if (!window.DB[nombreArray]) window.DB[nombreArray] = [];
    var idx = window.DB[nombreArray].findIndex(function(item) {
      return item[campoId] === datos[campoId];
    });
    if (idx >= 0) {
      window.DB[nombreArray][idx] = datos;
    } else {
      window.DB[nombreArray].push(datos);
    }
  }

  modulo.suscribirRealtime = function(alCambiar) {
    if (!modulo.habilitado || !modulo.cliente) return;
    _callbacksRealtime.push(alCambiar);

    var claves = Object.keys(modulo.COLECCIONES);
    var canales = [];
    for (var i = 0; i < claves.length; i++) {
      var nombreColeccion = modulo.COLECCIONES[claves[i]];
      canales.push('databases.' + modulo.idBaseDeDatos + '.tables.' + nombreColeccion + '.rows');
    }

    try {
      var tiempoReal = new Appwrite.Realtime(modulo.cliente);
      canales.forEach(function(canal) {
        tiempoReal.subscribe(canal, function(payload) {
          var coleccion = '';
          for (var j = 0; j < claves.length; j++) {
            if (canal.indexOf(modulo.COLECCIONES[claves[j]]) !== -1) {
              coleccion = claves[j];
              break;
            }
          }
          var tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          _callbacksRealtime.forEach(function(cb) { cb(coleccion, tipo, payload.payload); });
        });
      });
      Logger.info('[Appwrite] Realtime activo para ' + claves.length + ' tablas.');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  modulo.iniciarRealtime = function() {
    if (!modulo.habilitado) return;
    modulo.suscribirRealtime(function(coleccion, tipo, payload) {
      if (!payload || !payload.$id) return;

      modulo.baseDeDatos.getRow({
        databaseId: modulo.idBaseDeDatos,
        tableId: modulo.COLECCIONES[coleccion],
        rowId: payload.$id
      }).then(function(doc) {
        var datos = _limpiarFila(doc);

        if (coleccion === 'pedidos') {
          datos.items = typeof datos.items === 'string' ? datos.items : JSON.stringify(datos.items);
          _actualizarArrayLocal('pedidos', datos, 'id');
          if (typeof Store !== 'undefined') Store.dispatch({ type: 'PEDIDOS_INICIALIZAR', payload: window.DB.pedidos });
          EventBus.emit('sincronizacion:completada');
        } else if (coleccion === 'comandas') {
          datos.items = typeof datos.items === 'string' ? JSON.parse(datos.items) : datos.items;
          _actualizarArrayLocal('comandas', datos, 'id');
          if (typeof Store !== 'undefined') Store.dispatch({ type: 'COMANDA_AGREGADA', payload: datos });
          EventBus.emit('comanda:enviada', datos);
        } else if (coleccion === 'mesas') {
          if (typeof window.DB._normalizarMesa === 'function') {
            datos = window.DB._normalizarMesa(datos);
          }
          _actualizarArrayLocal('mesas', datos, 'numero');
          if (typeof Store !== 'undefined') Store.dispatch({ type: 'MESAS_INICIALIZAR', payload: window.DB.mesas });
          EventBus.emit('mesa:actualizada', { mesa: datos.numero, estado: datos.estado });
        } else {
          var eventoGenerico = coleccion + ':actualizada';
          if (typeof Store !== 'undefined') {
            Store.dispatch({ type: coleccion.toUpperCase() + '_INICIALIZAR', payload: [datos] });
          }
          EventBus.emit(eventoGenerico, datos);
          Logger.debug('[Realtime] Evento genérico: ' + eventoGenerico);
        }
      }).catch(function(e) {
        Logger.warn('[Realtime] Error al obtener fila de ' + coleccion + ':', e);
      });
    });
  };

  return modulo;
})();

window.DBAppwrite = DBAppwrite;