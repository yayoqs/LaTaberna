/* ================================================================
   Raíz — MÓDULO: db-appwrite.js (v2.9 – Fase 1 completa)
   Propósito: Cliente de Appwrite con autenticación anónima (sin API Key),
              sin notificación a Sheets desde el frontend, y con
              Realtime optimizado (actualiza solo el elemento modificado).
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
    configuracion: 'Configuracion'
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

  var _realtimeCallbacks = [];
  module.suscribirRealtime = function(onCambio) {
    if (!module.habilitado || !module.client) return;
    _realtimeCallbacks.push(onCambio);
    var canales = [
      'databases.' + module.databaseId + '.collections.' + module.COLECCIONES.pedidos + '.documents',
      'databases.' + module.databaseId + '.collections.' + module.COLECCIONES.comandas + '.documents',
      'databases.' + module.databaseId + '.collections.' + module.COLECCIONES.mesas + '.documents'
    ];
    try {
      var realtime = new Appwrite.Realtime(module.client);
      canales.forEach(function(canal) {
        realtime.subscribe(canal, function(payload) {
          var coleccion = '';
          if (canal.indexOf('Pedidos') !== -1) coleccion = 'pedidos';
          else if (canal.indexOf('Comandas') !== -1) coleccion = 'comandas';
          else if (canal.indexOf('Mesas') !== -1) coleccion = 'mesas';

          var tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          _realtimeCallbacks.forEach(function(cb) { cb(coleccion, tipo, payload.payload); });
        });
      });
      Logger.info('[Appwrite] Suscripciones Realtime activas.');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  module.iniciarRealtime = function() {
    if (!module.habilitado) return;
    module.suscribirRealtime(function(coleccion, tipo, payload) {
      // Optimización: actualizar solo el documento modificado, no toda la colección
      if (!payload || !payload.$id) return;

      if (coleccion === 'pedidos') {
        // Obtener solo el documento modificado
        module.databases.getDocument(module.databaseId, module.COLECCIONES.pedidos, payload.$id)
          .then(function(doc) {
            var pedido = Object.assign({}, doc);
            pedido.id = doc.$id;
            pedido.items = typeof pedido.items === 'string' ? pedido.items : JSON.stringify(pedido.items);
            delete pedido.$id;
            delete pedido.$databaseId;
            delete pedido.$collectionId;
            delete pedido.$createdAt;
            delete pedido.$updatedAt;
            delete pedido.$permissions;

            var idx = window.DB.pedidos.findIndex(function(p) { return p.id === pedido.id; });
            if (idx >= 0) {
              window.DB.pedidos[idx] = pedido;
            } else {
              window.DB.pedidos.push(pedido);
            }
            window.DB.savePedidos();
            if (typeof Store !== 'undefined') {
              Store.dispatch({ type: 'PEDIDOS_INICIALIZAR', payload: window.DB.pedidos });
            }
            EventBus.emit('sincronizacion:completada');
          })
          .catch(function(e) { Logger.warn('[Realtime] Error al obtener pedido:', e); });

      } else if (coleccion === 'comandas') {
        module.databases.getDocument(module.databaseId, module.COLECCIONES.comandas, payload.$id)
          .then(function(doc) {
            var comanda = Object.assign({}, doc);
            comanda.id = doc.$id;
            comanda.items = typeof comanda.items === 'string' ? JSON.parse(comanda.items) : comanda.items;
            delete comanda.$id;
            delete comanda.$databaseId;
            delete comanda.$collectionId;
            delete comanda.$createdAt;
            delete comanda.$updatedAt;
            delete comanda.$permissions;

            var idx = window.DB.comandas.findIndex(function(c) { return c.id === comanda.id; });
            if (idx >= 0) {
              window.DB.comandas[idx] = comanda;
            } else {
              window.DB.comandas.push(comanda);
            }
            window.DB.saveComandas();
            if (typeof Store !== 'undefined') {
              Store.dispatch({ type: 'COMANDA_AGREGADA', payload: comanda });
            }
            EventBus.emit('comanda:enviada', comanda);
          })
          .catch(function(e) { Logger.warn('[Realtime] Error al obtener comanda:', e); });

      } else if (coleccion === 'mesas') {
        module.databases.getDocument(module.databaseId, module.COLECCIONES.mesas, payload.$id)
          .then(function(doc) {
            var mesa = Object.assign({}, doc);
            mesa.id = doc.$id;
            delete mesa.$id;
            delete mesa.$databaseId;
            delete mesa.$collectionId;
            delete mesa.$createdAt;
            delete mesa.$updatedAt;
            delete mesa.$permissions;
            mesa = window.DB._normalizarMesa(mesa);

            var idx = window.DB.mesas.findIndex(function(m) { return m.numero === mesa.numero; });
            if (idx >= 0) {
              window.DB.mesas[idx] = mesa;
            } else {
              window.DB.mesas.push(mesa);
            }
            window.DB.saveMesas();
            if (typeof Store !== 'undefined') {
              Store.dispatch({ type: 'MESAS_INICIALIZAR', payload: window.DB.mesas });
            }
            EventBus.emit('mesa:actualizada', { mesa: mesa.numero, estado: mesa.estado });
          })
          .catch(function(e) { Logger.warn('[Realtime] Error al obtener mesa:', e); });
      }
    });
  };

  return module;
})();

window.DBAppwrite = DBAppwrite;