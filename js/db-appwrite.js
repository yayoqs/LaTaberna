/* ================================================================
   Raíz — MÓDULO: db-appwrite.js (v2.10 – Realtime dinámico)
   Propósito: Cliente de Appwrite con autenticación anónima.
              Realtime optimizado que solo actualiza el documento
              modificado, y se suscribe automáticamente a todas
              las colecciones definidas en COLECCIONES.
   ================================================================ */
var DBAppwrite = (function() {
  var module = {};

  module.client = null;
  module.databases = null;
  module.account = null;
  module.databaseId = '6a0275cb0022ebf7d30d';
  module.habilitado = false;

  module.COLECCIONES = {
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

  module.init = async function() {
    if (typeof window.Appwrite === 'undefined') {
      Logger.warn('[Appwrite] SDK no cargado.');
      module.habilitado = false;
      return false;
    }

    var endpoint = localStorage.getItem('appwrite_endpoint') || 'https://tor.cloud.appwrite.io/v1';
    var projectId = localStorage.getItem('appwrite_project_id') || '6a025322001f24c57d1d';

    try {
      module.client = new Appwrite.Client()
        .setEndpoint(endpoint)
        .setProject(projectId);

      // Crear sesión anónima (no expone API Key)
      module.account = new Appwrite.Account(module.client);
      try {
        await module.account.createAnonymousSession();
        Logger.info('[Appwrite] Sesión anónima creada correctamente.');
      } catch (e) {
        Logger.info('[Appwrite] Usando sesión anónima existente.');
      }

      module.databases = new Appwrite.Databases(module.client);
      module.habilitado = true;
      Logger.info('[Appwrite] Cliente inicializado (sesión anónima).');
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al inicializar:', e);
      module.habilitado = false;
      return false;
    }
  };

  module.listar = async function(coleccion) {
    if (!module.habilitado || !module.databases) return [];
    try {
      var response = await module.databases.listDocuments(
        module.databaseId,
        module.COLECCIONES[coleccion]
      );
      return response.documents.map(function(doc) {
        var data = Object.assign({}, doc);
        delete data.$id;
        delete data.$databaseId;
        delete data.$collectionId;
        delete data.$createdAt;
        delete data.$updatedAt;
        delete data.$permissions;
        data.id = doc.$id;
        return data;
      });
    } catch (e) {
      Logger.error('[Appwrite] Error al listar ' + coleccion + ':', e);
      return [];
    }
  };

  module.crear = async function(coleccion, docId, datos) {
    if (!module.habilitado || !module.databases) return null;
    try {
      var id = docId || 'unique()';
      var datosLimpios = Object.assign({}, datos);
      delete datosLimpios.id;

      var response = await module.databases.createDocument(
        module.databaseId,
        module.COLECCIONES[coleccion],
        id,
        datosLimpios
      );
      var data = Object.assign({}, response);
      data.id = response.$id;
      return data;
    } catch (e) {
      if (e.code !== 409) {
        Logger.error('[Appwrite] Error al crear en ' + coleccion + ':', e);
      }
      return null;
    }
  };

  module.actualizar = async function(coleccion, id, cambios) {
    if (!module.habilitado || !module.databases) return null;
    try {
      var response = await module.databases.updateDocument(
        module.databaseId,
        module.COLECCIONES[coleccion],
        id,
        cambios
      );
      var data = Object.assign({}, response);
      data.id = response.$id;
      return data;
    } catch (e) {
      if (e.code !== 404) {
        Logger.error('[Appwrite] Error al actualizar ' + coleccion + ':', e);
      }
      return null;
    }
  };

  module.eliminar = async function(coleccion, id) {
    if (!module.habilitado || !module.databases) return false;
    try {
      await module.databases.deleteDocument(
        module.databaseId,
        module.COLECCIONES[coleccion],
        id
      );
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al eliminar en ' + coleccion + ':', e);
      return false;
    }
  };

  // ── Función auxiliar para actualizar un array local (insertar o reemplazar) ──
  function actualizarArrayLocal(nombreArray, datos, campoId) {
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
    // Guardar si existe el método
    var metodoSave = 'save' + nombreArray.charAt(0).toUpperCase() + nombreArray.slice(1);
    if (typeof window.DB[metodoSave] === 'function') {
      window.DB[metodoSave]();
    }
  }

  var _realtimeCallbacks = [];
  module.suscribirRealtime = function(onCambio) {
    if (!module.habilitado || !module.client) return;
    _realtimeCallbacks.push(onCambio);

    // Construir canales dinámicamente para TODAS las colecciones definidas
    var canales = [];
    var colecciones = Object.keys(module.COLECCIONES);
    for (var i = 0; i < colecciones.length; i++) {
      var nombreColeccion = module.COLECCIONES[colecciones[i]];
      canales.push('databases.' + module.databaseId + '.collections.' + nombreColeccion + '.documents');
    }

    try {
      var realtime = new Appwrite.Realtime(module.client);
      canales.forEach(function(canal) {
        realtime.subscribe(canal, function(payload) {
          // Determinar el nombre corto de la colección desde el canal
          var coleccion = '';
          for (var j = 0; j < colecciones.length; j++) {
            if (canal.indexOf(module.COLECCIONES[colecciones[j]]) !== -1) {
              coleccion = colecciones[j];
              break;
            }
          }

          var tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          _realtimeCallbacks.forEach(function(cb) { cb(coleccion, tipo, payload.payload); });
        });
      });
      Logger.info('[Appwrite] Suscripciones Realtime activas para ' + colecciones.length + ' colecciones.');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  module.iniciarRealtime = function() {
    if (!module.habilitado) return;
    module.suscribirRealtime(function(coleccion, tipo, payload) {
      if (!payload || !payload.$id) return;

      // Obtener solo el documento modificado, no toda la colección
      module.databases.getDocument(module.databaseId, module.COLECCIONES[coleccion], payload.$id)
        .then(function(doc) {
          var datos = Object.assign({}, doc);
          datos.id = doc.$id;
          delete datos.$id;
          delete datos.$databaseId;
          delete datos.$collectionId;
          delete datos.$createdAt;
          delete datos.$updatedAt;
          delete datos.$permissions;

          // Actualizar el array local correspondiente
          if (coleccion === 'pedidos') {
            datos.items = typeof datos.items === 'string' ? datos.items : JSON.stringify(datos.items);
            actualizarArrayLocal('pedidos', datos, 'id');
            if (typeof Store !== 'undefined') Store.dispatch({ type: 'PEDIDOS_INICIALIZAR', payload: window.DB.pedidos });
            EventBus.emit('sincronizacion:completada');
          } else if (coleccion === 'comandas') {
            datos.items = typeof datos.items === 'string' ? JSON.parse(datos.items) : datos.items;
            actualizarArrayLocal('comandas', datos, 'id');
            if (typeof Store !== 'undefined') Store.dispatch({ type: 'COMANDA_AGREGADA', payload: datos });
            EventBus.emit('comanda:enviada', datos);
          } else if (coleccion === 'mesas') {
            if (typeof window.DB._normalizarMesa === 'function') {
              datos = window.DB._normalizarMesa(datos);
            }
            actualizarArrayLocal('mesas', datos, 'numero');
            if (typeof Store !== 'undefined') Store.dispatch({ type: 'MESAS_INICIALIZAR', payload: window.DB.mesas });
            EventBus.emit('mesa:actualizada', { mesa: datos.numero, estado: datos.estado });
          } else {
            // Para cualquier otra colección, emitir un evento genérico
            var eventoGenerico = coleccion + ':actualizada';
            if (typeof Store !== 'undefined') {
              Store.dispatch({ type: coleccion.toUpperCase() + '_INICIALIZAR', payload: [datos] });
            }
            EventBus.emit(eventoGenerico, datos);
            Logger.debug('[Realtime] Evento genérico emitido: ' + eventoGenerico);
          }
        })
        .catch(function(e) { Logger.warn('[Realtime] Error al obtener documento de ' + coleccion + ':', e); });
    });
  };

  return module;
})();

window.DBAppwrite = DBAppwrite;