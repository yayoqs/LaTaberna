/* ================================================================
   Raíz — MÓDULO: db-appwrite.js (v1.1)
   Propósito: Cliente de Appwrite para sincronización en tiempo real.
              Colecciones con primera letra mayúscula.
              databaseId: "LaTaberna-main"
   ================================================================ */
var DBAppwrite = (function() {
  var module = {};

  module.client = null;
  module.databases = null;
  module.databaseId = 'LaTaberna-main';  // ← Corregido
  module.habilitado = false;

  // Colecciones con primera letra mayúscula
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

  /**
   * Inicializa el cliente de Appwrite con credenciales guardadas en localStorage.
   * @returns {Promise<boolean>} true si se conectó correctamente
   */
  module.init = async function() {
    var habilitado = localStorage.getItem('appwrite_habilitado') === 'true';
    if (!habilitado) {
      Logger.info('[Appwrite] Desactivado por configuración. Usando Google Sheets.');
      module.habilitado = false;
      return false;
    }

    var endpoint = localStorage.getItem('appwrite_endpoint') || 'https://tor.cloud.appwrite.io/v1';
    var projectId = localStorage.getItem('appwrite_project_id') || '';
    var apiKey = localStorage.getItem('appwrite_api_key') || '';

    if (!projectId || !apiKey) {
      Logger.warn('[Appwrite] Sin credenciales completas. Usando Google Sheets.');
      module.habilitado = false;
      return false;
    }

    try {
      module.client = new Appwrite.Client();
      module.client
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

      module.databases = new Appwrite.Databases(module.client);
      module.habilitado = true;
      Logger.info('[Appwrite] Cliente inicializado correctamente.');
      return true;
    } catch (e) {
      Logger.error('[Appwrite] Error al inicializar:', e);
      module.habilitado = false;
      return false;
    }
  };

  /**
   * Obtiene todos los documentos de una colección.
   * @param {string} coleccion - nombre interno (minúsculas)
   * @returns {Promise<Array>} array de documentos planos
   */
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

  /**
   * Crea un documento en una colección.
   * @param {string} coleccion
   * @param {object} datos
   * @returns {Promise<object|null>}
   */
  module.crear = async function(coleccion, datos) {
    if (!module.habilitado || !module.databases) return null;
    try {
      var id = datos.id || 'unique()';
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
      Logger.error('[Appwrite] Error al crear en ' + coleccion + ':', e);
      return null;
    }
  };

  /**
   * Actualiza un documento existente.
   * @param {string} coleccion
   * @param {string} id
   * @param {object} cambios
   * @returns {Promise<object|null>}
   */
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
      Logger.error('[Appwrite] Error al actualizar ' + coleccion + ':', e);
      return null;
    }
  };

  /**
   * Elimina un documento.
   * @param {string} coleccion
   * @param {string} id
   * @returns {Promise<boolean>}
   */
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

  // ── REALTIME ─────────────────────────────────────────────────
  var _realtimeCallbacks = [];

  /**
   * Se suscribe a cambios en tiempo real de las colecciones relevantes.
   * @param {function} onCambio - función que se llama con { coleccion, tipo, datos }
   */
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
          Logger.debug('[Appwrite Realtime] Evento recibido:', payload.events, payload.payload);
          var coleccion = '';
          if (canal.indexOf('Pedidos') !== -1) coleccion = 'pedidos';
          else if (canal.indexOf('Comandas') !== -1) coleccion = 'comandas';

          var tipo = 'update';
          if (payload.events.includes('create')) tipo = 'create';
          else if (payload.events.includes('delete')) tipo = 'delete';

          _realtimeCallbacks.forEach(function(cb) {
            cb(coleccion, tipo, payload.payload);
          });
        });
      });

      Logger.info('[Appwrite] Suscripciones Realtime activas.');
    } catch (e) {
      Logger.warn('[Appwrite] No se pudo activar Realtime:', e.message);
    }
  };

  return module;
})();

window.DBAppwrite = DBAppwrite;