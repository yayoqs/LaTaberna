import { Client, Users, TablesDB, Query } from 'node-appwrite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const LIMITE_REGISTROS = 5;
const VENTANA_MS = 60000;

const registros = new Map();

function obtenerIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-appwrite-client-ip']
    || 'desconocida';
}

function validarNombreUsuario(nombre) {
  if (!nombre || typeof nombre !== 'string') return false;
  const limpio = nombre.trim();
  if (limpio.length < 3 || limpio.length > 30) return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(limpio)) return false;
  if (/^[._-]/.test(limpio)) return false;
  return true;
}

function validarPassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
}

function generarIdValido(prefijo = 'usr_') {
  const base = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const id = prefijo + base;
  return id.substring(0, 36);
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return res.send('', 204, CORS);
  }

  try {
    const payload = req.bodyJson || (req.body ? JSON.parse(req.body) : {});
    const { nombreUsuario, password } = payload;

    if (!validarNombreUsuario(nombreUsuario)) {
      return res.json({
        exito: false,
        error: 'El nombre de usuario debe tener entre 3 y 30 caracteres, solo letras, números, punto, guion y guion bajo. No puede comenzar con símbolo.'
      }, 400, CORS);
    }

    if (!validarPassword(password)) {
      return res.json({
        exito: false,
        error: 'La contraseña debe tener entre 8 y 128 caracteres.'
      }, 400, CORS);
    }

    const ip = obtenerIp(req);
    const ahora = Date.now();
    const lista = (registros.get(ip) || []).filter(ts => ahora - ts < VENTANA_MS);
    if (lista.length >= LIMITE_REGISTROS) {
      return res.json({
        exito: false,
        error: 'Demasiados intentos de registro. Intenta más tarde.'
      }, 429, CORS);
    }
    lista.push(ahora);
    registros.set(ip, lista);

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);
    const tablesDB = new TablesDB(client);

    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const tableId = 'global_Perfiles';

    // Verificar duplicado usando la nueva API de TablesDB
    try {
      const respuesta = await tablesDB.listRows({
        databaseId,
        tableId,
        queries: [Query.equal('nombreUsuario', nombreUsuario)]
      });
      if (respuesta.rows && respuesta.rows.length > 0) {
        return res.json({ exito: false, error: 'El nombre de usuario ya está en uso.' }, 409, CORS);
      }
    } catch (e) {
      error(`Error al verificar duplicado: ${e.message}`);
    }

    const userId = generarIdValido();
    const email = `${nombreUsuario.toLowerCase()}@elisekai.com`;

    // Crear usuario en Appwrite Auth
    try {
      await users.create({
        userId,
        email,
        password,
        phone: null
      });
    } catch (e) {
      error(`Error al crear usuario Appwrite: ${e.message}`);
      return res.json({ exito: false, error: 'No se pudo crear la cuenta. Intenta con otro usuario.' }, 400, CORS);
    }

    // Crear perfil global usando la nueva API de TablesDB
    try {
      await tablesDB.createRow({
        databaseId,
        tableId,
        rowId: userId,
        data: {
          usuarioId: userId,
          nombreUsuario,
          nombre: nombreUsuario,
          avatar: '',
          nivel: 1,
          xp: 0,
          insignias: '[]',
          racha: 0,
          titulos: '[]',
          fechaRegistro: new Date().toISOString(),
          bio: '',
          ultimaActividad: new Date().toISOString()
        }
      });
    } catch (e) {
      error(`Error al crear perfil global: ${e.message}`);
      try { await users.delete(userId); } catch {}
      return res.json({ exito: false, error: 'No se pudo completar el registro. Intenta nuevamente.' }, 500, CORS);
    }

    // Asignar label cliente para que Appwrite reconozca los permisos
    try {
      await users.updateLabels(userId, ['cliente']);
      log(`Label "cliente" asignado a ${nombreUsuario}`);
    } catch (e) {
      error(`Error al asignar label: ${e.message}`);
    }

    log(`Usuario registrado: ${nombreUsuario} (${userId}) desde ${ip}`);
    return res.json({ exito: true, usuarioId: userId }, 201, CORS);

  } catch (err) {
    error(`Error general en registrar-usuario: ${err.message}`);
    return res.json({ exito: false, error: 'Error interno del servidor.' }, 500, CORS);
  }
};