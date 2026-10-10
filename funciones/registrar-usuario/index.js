/* ================================================================
   Elisekai - Ecosistema — FUNCIÓN SERVERLESS
   Archivo: registrar-usuario/index.js
   Versión: 1.5.2
   Propósito: Registrar cuenta del ecosistema.
              Crea usuario en Appwrite Auth, perfil global y
              espacio personal de MiRefugio en global_Espacios.
              Asigna label "jugador".
              v1.5.2: El rowId del rate limit ahora usa un hash corto
                      para evitar caracteres inválidos y límite de
                      longitud. Corrige bloqueo permanente.
   ================================================================ */

import { Client, Users, TablesDB, Query, ID } from 'node-appwrite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Origin'
};

const LIMITE_REGISTROS = 5;
const VENTANA_MS = 60000;

const ORIGENES_PERMITIDOS = [
  'https://lataberna.281093.xyz',
  'https://mirefugio.281093.xyz',
  'https://lavitrina.281093.xyz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8158'
];

function validarOrigen(req) {
  const origin = req.headers['origin'];
  const proyecto = req.headers['x-appwrite-project'];
  if (proyecto && proyecto !== process.env.APPWRITE_PROJECT_ID) {
    return { permitido: false, motivo: 'Proyecto no autorizado.' };
  }
  if (!origin) return { permitido: true };
  if (ORIGENES_PERMITIDOS.includes(origin)) return { permitido: true };
  return { permitido: false, motivo: 'Origen no autorizado.' };
}

/**
 * Hash corto y determinista para generar rowIds válidos.
 */
function hashSimple(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Rate limit con contador atómico estricto.
 * Cada ventana temporal tiene su propia fila en global_Limites.
 * El contador se incrementa atómicamente con incrementRowColumn.
 * Bloquea cuando contador >= maxIntentos.
 */
async function verificarLimite(tablesDB, databaseId, clave, maxIntentos, ventanaMs) {
  const ahora = Date.now();
  const ventana = Math.floor(ahora / ventanaMs);
  const rowId = `lim_${hashSimple(clave)}_${ventana}`;

  try {
    const resultado = await tablesDB.incrementRowColumn({
      databaseId,
      tableId: 'global_Limites',
      rowId,
      column: 'contador',
      value: 1
    });

    const contadorActual = Number(resultado.contador) || 0;
    if (contadorActual >= maxIntentos) {
      return false;
    }
    return true;
  } catch (e) {
    if (e.code === 404 || (e.message && e.message.includes('not found'))) {
      try {
        await tablesDB.createRow({
          databaseId,
          tableId: 'global_Limites',
          rowId,
          data: {
            clave,
            contador: 1,
            marcaTiempo: new Date(ahora).toISOString()
          }
        });
        return 1 < maxIntentos;
      } catch (e2) {
        if (e2.code === 409) {
          try {
            const res2 = await tablesDB.incrementRowColumn({
              databaseId,
              tableId: 'global_Limites',
              rowId,
              column: 'contador',
              value: 1
            });
            const contadorActual2 = Number(res2.contador) || 0;
            return contadorActual2 < maxIntentos;
          } catch {
            return false;
          }
        }
        return false;
      }
    }
    console.error(`Error al verificar límite: ${e.message}`);
    return false;
  }
}

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
  return (prefijo + base).substring(0, 36);
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') return res.text('', 204, CORS);

  const origen = validarOrigen(req);
  if (!origen.permitido) return res.json({ exito: false, error: origen.motivo }, 403, CORS);

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(client);
  const tablesDB = new TablesDB(client);
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  try {
    let payload = {};
    if (req.bodyJson) payload = req.bodyJson;
    else if (req.bodyText) { try { payload = JSON.parse(req.bodyText); } catch { payload = {}; } }

    const { nombreUsuario, password } = payload;

    if (!validarNombreUsuario(nombreUsuario)) {
      return res.json({
        exito: false,
        error: 'El nombre de usuario debe tener entre 3 y 30 caracteres, solo letras, números, punto, guion y guion bajo. No puede comenzar con símbolo.'
      }, 400, CORS);
    }

    if (!validarPassword(password)) {
      return res.json({ exito: false, error: 'La contraseña debe tener entre 8 y 128 caracteres.' }, 400, CORS);
    }

    const ip = obtenerIp(req);
    const permitido = await verificarLimite(tablesDB, databaseId, `registro:${ip}`, LIMITE_REGISTROS, VENTANA_MS);
    if (!permitido) {
      return res.json({ exito: false, error: 'Demasiados intentos de registro. Intenta más tarde.' }, 429, CORS);
    }

    try {
      const respuesta = await tablesDB.listRows({
        databaseId,
        tableId: 'global_Perfiles',
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

    try {
      await users.create({ userId, email, password, phone: null });
    } catch (e) {
      error(`Error al crear usuario Appwrite: ${e.message}`);
      return res.json({ exito: false, error: 'No se pudo crear la cuenta. Intenta con otro usuario.' }, 400, CORS);
    }

    try {
      await tablesDB.createRow({
        databaseId,
        tableId: 'global_Perfiles',
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

    try {
      const espacioId = `mirefugio_${userId}`;
      await tablesDB.createRow({
        databaseId,
        tableId: 'global_Espacios',
        rowId: espacioId,
        data: {
          nombre: `Mi Refugio de ${nombreUsuario}`,
          app: 'mirefugio',
          tipo: 'hogar',
          adminAsignado: userId,
          activo: true
        }
      });
      log(`Espacio personal MiRefugio creado: ${espacioId}`);
    } catch (e) {
      error(`Error al crear espacio personal MiRefugio: ${e.message}`);
    }

    try {
      await users.updateLabels(userId, ['jugador']);
      log(`Label "jugador" asignado a ${nombreUsuario}`);
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