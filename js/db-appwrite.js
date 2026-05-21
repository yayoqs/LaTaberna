/* ================================================================
   Raíz — MÓDULO: db-appwrite.js (v2.3)
   Propósito: Cliente de Appwrite. Al recibir un evento Realtime
              (cambio en pedidos o comandas), además de actualizar
              el Store, envía una notificación a Google Apps Script
              para que actualice Sheets.
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

  // URL del Google Apps Script (debe coincidir con la última implementación)
  var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbw2hRaJTCPx6WM0MK2g7dCgrbIUd3CavINAxFWoRjy-tytyIUh9t1THI1RjEngPCoUY/exec';

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
      var response = await module.databases.createDocument(
        module.databaseId,
        module.COLECCIONES[coleccion],
        id,
        datos
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

  /**
   * Notifica al Google Apps Script sobre un cambio en Appwrite
   * para que actualice Sheets inmediatamente.
   */
  function notificarASheets(coleccion, tipo, doc) {
    if (coleccion !== 'pedidos' && coleccion !== 'comandas' && coleccion !== 'mesas') return; // Solo colecciones que sincronizamos con Sheets

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
      'databases.' + module.databaseId + '.collections.' + module.COLECCIONES.comandas + '.documents'
    ];
    try {
      var realtime = new Appwrite.Realtime(module.client);
      canales.forEach(function(canal) {
        realtime.subscribe(canal, function(payload) {
          var coleccion = canal.indexOf('Pedidos') !== -1 ? 'pedidos' : 'comandas';
          var tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          // Notificar a los callbacks internos
          _realtimeCallbacks.forEach(function(cb) { cb(coleccion, tipo, payload.payload); });
          
          // Notificar a Google Sheets para actualización inmediata
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
    module.suscribirRealtime(function(coleccion, tipo) {
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
            comandas.forEach(function(c) { if (typeof Store !== 'undefined') Store.dispatch({ type: 'COMANDA_AGREGADA', payload: c }); });
            EventBus.emit('comandas:guardadas', window.DB.comandas);
          }
        }).catch(function(e) { Logger.warn('[Appwrite Realtime] Error al listar comandas:', e); });
      }
    });
  };

  return module;
})();

window.DBAppwrite = DBAppwrite;