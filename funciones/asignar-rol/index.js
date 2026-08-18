import { Client, Users, TablesDB, Query } from 'node-appwrite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function parsearRoles(staff) {
  try {
    if (typeof staff.roles === 'string') return JSON.parse(staff.roles || '[]');
    return staff.roles || [];
  } catch {
    return [];
  }
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return res.send('', 204, CORS);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(client);
  const tablesDB = new TablesDB(client);
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  try {
    const payload = req.bodyJson || (req.body ? JSON.parse(req.body) : {});
    const { token, userId, espacioId, roles } = payload;

    // ── Modo vinculación por token ──
    if (token) {
      if (!userId) {
        return res.json({ exito: false, error: 'Falta userId para vincular.' }, 400, CORS);
      }

      const respuesta = await tablesDB.listRows({
        databaseId,
        tableId: 'laTaberna_Staff',
        queries: [Query.equal('tokenVinculacion', token)]
      });

      if (!respuesta.rows || respuesta.rows.length === 0) {
        return res.json({ exito: false, error: 'Token inválido o ya utilizado.' }, 404, CORS);
      }

      const staff = respuesta.rows[0];
      const rolesArray = parsearRoles(staff);
      const rolPrincipal = staff.rolPrincipal || rolesArray[0] || 'mesero';

      await tablesDB.updateRow({
        databaseId,
        tableId: 'laTaberna_Staff',
        rowId: staff.$id,
        data: {
          usuarioId: userId,
          tokenVinculacion: ''
        }
      });

      await users.updateLabels(userId, rolesArray);

      log(`Token canjeado para ${userId} con roles: ${rolesArray.join(', ')}`);

      return res.json({
        exito: true,
        staff: {
          id: staff.$id,
          usuarioId: userId,
          espacioId: staff.espacioId,
          roles: rolesArray,
          rolPrincipal,
          tokenVinculacion: ''
        }
      }, 200, CORS);
    }

    // ── Modo asignación normal de roles ──
    if (!userId || !roles) {
      return res.json({ success: false, error: 'Faltan userId o roles.' }, 400, CORS);
    }

    const rolesArray = Array.isArray(roles) ? roles : [roles];
    await users.updateLabels(userId, rolesArray);

    log(`Labels [${rolesArray.join(', ')}] asignados a ${userId}`);

    return res.json({ success: true }, 200, CORS);

  } catch (err) {
    error(`Error en asignar-rol: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500, CORS);
  }
};