import { Client, Users, TablesDB, Query } from 'node-appwrite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return res.send('', 204, CORS);
  }

  try {
    const payload = req.bodyJson || (req.body ? JSON.parse(req.body) : {});
    const { token } = payload;

    if (!token) {
      return res.json({ exito: false, error: 'Token requerido' }, 400, CORS);
    }

    // Appwrite inyecta el usuario autenticado en este header cuando la
    // función se ejecuta con acceso de usuario.
    const usuarioId = req.headers['x-appwrite-user-id'] || payload.usuarioId;

    if (!usuarioId) {
      return res.json({ exito: false, error: 'No se pudo identificar al usuario autenticado' }, 401, CORS);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);
    const tablesDB = new TablesDB(client);

    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const tableId = 'laTaberna_Staff';

    // Buscar staff por token
    const listado = await tablesDB.listRows({
      databaseId,
      tableId,
      queries: [Query.equal('tokenVinculacion', token)]
    });

    const fila = listado.rows && listado.rows[0];
    if (!fila) {
      return res.json({ exito: false, error: 'Token inválido o ya utilizado' }, 404, CORS);
    }

    const staffId = fila.$id || fila._id;

    // Si ya está vinculado a otro usuario, rechazar
    if (fila.usuarioId && fila.usuarioId !== usuarioId) {
      return res.json({ exito: false, error: 'El token ya fue canjeado por otra cuenta' }, 409, CORS);
    }

    // Si ya estaba vinculado al mismo usuario, retornar éxito
    if (fila.usuarioId === usuarioId) {
      return res.json({ exito: true, staff: fila }, 200, CORS);
    }

    const roles = Array.isArray(fila.roles)
      ? fila.roles
      : (() => { try { return JSON.parse(fila.roles || '[]'); } catch { return []; } })();

    // Actualizar el staff con permisos de servidor
    await tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: staffId,
      data: {
        usuarioId,
        tokenVinculacion: ''
      }
    });

    // Sincronizar labels de Appwrite Auth
    try {
      await users.updateLabels(usuarioId, roles);
      log(`Labels [${roles.join(', ')}] asignados al usuario ${usuarioId}`);
    } catch (e) {
      error(`Error al sincronizar labels: ${e.message}`);
    }

    const staffActualizado = await tablesDB.getRow({
      databaseId,
      tableId,
      rowId: staffId
    });

    return res.json({ exito: true, staff: staffActualizado }, 200, CORS);

  } catch (err) {
    error(`Error general en vincular-staff: ${err.message}`);
    return res.json({ exito: false, error: 'Error interno del servidor.' }, 500, CORS);
  }
};