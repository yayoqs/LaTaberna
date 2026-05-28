/* ================================================================
   Raíz — MÓDULO: db-appwrite.js (v2.6)
   Propósito: Emite 'comanda:enviada' al recibir eventos Realtime
              de comandas, para que el KDS se actualice inmediatamente.
   ================================================================ */
var DBAppwrite = (function() {
  var module = {};

  module.client = null;
  module.databases = null;
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

  var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycby8Dz_4r_aC1ocUNliCzQMnVAsIbmN4WbKdCG2n1hPOBVQ00rUIu3y6iTG_zFAfcazLzQ/exec';

  module.init = async function() {
    if (typeof window.Appwrite === 'undefined') {
      Logger.warn('[Appwrite] SDK no cargado.');
      module.habilitado = false;
      return false;
    }
    var habilitado = localStorage.getItem('appwrite_habilitado') === 'true';
    if (!habilitado) {
      module.habilitado = false;
      return false;
    }
    var endpoint = localStorage.getItem('appwrite_endpoint') || 'https://tor.cloud.appwrite.io/v1';
    var projectId = localStorage.getItem('appwrite_project_id') || '';
    var apiKey = localStorage.getItem('appwrite_api_key') || '';

    if (!projectId || !apiKey) {
      module.habilitado = false;
      return false;
    }
    try {
      module.client = new Appwrite.Client()
        .setEndpoint(endpoint)
        .setProject(projectId);
      module.databases = new Appwrite.Databases(module.client, apiKey);
      module.habilitado = true;
      Logger.info('[Appwrite] Cliente inicializado correctamente.');
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

  function notificarASheets(coleccion, tipo, doc) {
    if (coleccion !== 'pedidos' && coleccion !== 'comandas' && coleccion !== 'mesas') return;

    fetch(URL_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'syncFromAppwrite',
        coleccion: coleccion,
        tipo: tipo,
        datos: doc
      })
    }).catch(function(e) {
      Logger.warn('[Appwrite] Error al notificar a Sheets:', e);
    });
  }

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
          
          if (payload.payload) {
            notificarASheets(coleccion, tipo, payload.payload);
          }
        });
      });
      Logger.info('[Appwrite] Suscripciones Realtime activas (con notificación a Sheets).');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  module.iniciarRealtime = function() {
    if (!module.habilitado) return;
    module.suscribirRealtime(function(coleccion, tipo, payload) {
      if (coleccion === 'pedidos') {
        module.listar('pedidos').then(function(pedidos) {
          if (pedidos.length) {
            window.DB.pedidos = pedidos.map(function(p) {
              p.items = typeof p.items === 'string' ? p.items : JSON.stringify(p.items);
              return p;
            });
            window.DB.savePedidos();
            if (typeof Store !== 'undefined') Store.dispatch({ type: 'PEDIDOS_INICIALIZAR', payload: window.DB.pedidos });
            EventBus.emit('sincronizacion:completada');
          }
        }).catch(function(e) { Logger.warn('[Appwrite Realtime] Error al listar pedidos:', e); });
      } else if (coleccion === 'comandas') {
        module.listar('comandas').then(function(comandas) {
          if (comandas.length) {
            window.DB.comandas = comandas.map(function(c) {
              c.items = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
              return c;
            });
            window.DB.saveComandas();
            // Despachar acción al Store y emitir evento para el KDS
            if (typeof Store !== 'undefined') {
              comandas.forEach(function(c) {
                Store.dispatch({ type: 'COMANDA_AGREGADA', payload: c });
              });
            }
            EventBus.emit('comandas:guardadas', window.DB.comandas);
            // Emitir 'comanda:enviada' para cada comanda nueva (tipo 'create')
            if (tipo === 'create') {
              var nuevaComanda = comandas.find(function(c) { return c.id === payload.$id; });
              if (nuevaComanda) {
                EventBus.emit('comanda:enviada', nuevaComanda);
              }
            }
          }
        }).catch(function(e) { Logger.warn('[Appwrite Realtime] Error al listar comandas:', e); });
      } else if (coleccion === 'mesas') {
        module.listar('mesas').then(function(mesas) {
          if (mesas.length) {
            window.DB.mesas = mesas.map(function(m) { return window.DB._normalizarMesa(m); });
            window.DB.saveMesas();
            if (typeof Store !== 'undefined') Store.dispatch({ type: 'MESAS_INICIALIZAR', payload: window.DB.mesas });
            EventBus.emit('mesas:guardadas', window.DB.mesas);
          }
        }).catch(function(e) { Logger.warn('[Appwrite Realtime] Error al listar mesas:', e); });
      }
    });
  };

  return module;
})();

window.DBAppwrite = DBAppwrite;