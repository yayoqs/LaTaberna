/* ================================================================
   Elisekai - Ecosistema — FUNCIÓN SERVERLESS
   Archivo: asignar-rol/index.js
   Versión: 1.9.1
   Propósito: Sincronizar roles globales y membresías de Teams.
              Para apps operativas usa Teams.
              Para apps personales solo actualiza labels.
              Usa "jugador" como rol base global.
              v1.9.1: A.74: se agrega 'movimientos' a
                      COLECCIONES_NEGOCIO y a MATRIZ_PERMISOS.
                      La colección laTaberna_Movimientos es un log
                      append-only con permisos de fila update/delete
                      solo admin. Alineado con js/db-appwrite.js
                      v1.20.0.
              v1.9.0: A.65: rama restringida para jugadores sin Team.
                      Pueden crear filas de tipo precarga en
                      laTaberna_Pedidos con origen=cliente y
                      estado=precarga, siempre que el espacioId del
                      payload pertenezca a una app lataberna activa.
                      Rate limit diferenciado a 5/min. El resto de
                      operaciones del jugador sigue bloqueado con 403.
              v1.8.5: A.44: rename laTaberna_Menus → laTaberna_Cartas.
                      Se reemplaza 'menus' por 'cartas' en
                      COLECCIONES_NEGOCIO y en MATRIZ_PERMISOS.
                      Alineado con js/db-appwrite.js v1.18.0.
              v1.8.4: A.41: se agrega 'variantes' a COLECCIONES_NEGOCIO
                      y a MATRIZ_PERMISOS. Alineado con js/db-appwrite.js
                      v1.17.0. Permite creación segura de variantes.
              v1.8.3: A.12: matriz declarativa de permisos de fila.
                      owner añadido siempre en update/delete. Alineado
                      con js/db-appwrite.js v1.15.0.
              v1.8.2: Rate limit diferenciado por acción.
                      Creación de filas: 60/min (operación frecuente).
                      Asignación de roles: 10/min (operación sensible).
   ================================================================ */

import { Client, Users, Teams, TablesDB, Query, ID, Permission, Role, Account } from 'node-appwrite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-appwrite-user-jwt, Origin'
};

const APPS_CON_TEAMS = ['lataberna', 'elretail'];

const COLECCIONES_NEGOCIO = [
  'productos', 'pedidos', 'mesas', 'comandas', 'insumos', 'recetas',
  'staff', 'configuracion', 'eventos_en_vivo', 'cartas', 'proveedores',
  'entradas', 'comensales', 'avisos', 'variantes', 'movimientos'
];

const ORIGENES_PERMITIDOS = [
  'https://lataberna.281093.xyz',
  'https://mirefugio.281093.xyz',
  'https://lavitrina.281093.xyz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8158'
];

const JERARQUIA = {
  master: ['owner'],
  owner: ['admin', 'chef', 'cocinaAyudante', 'barman', 'barraAyudante', 'mesero', 'caja', 'repartidor', 'artista'],
  admin: ['chef', 'cocinaAyudante', 'barman', 'barraAyudante', 'mesero', 'caja', 'repartidor', 'artista']
};

// ── MATRIZ DE PERMISOS DE FILA (v1, 2026-09-12) ────────────
// Fuente de verdad: Coordinación de Integración, Fase 2 A.12.
// Debe coincidir con `MATRIZ_PERMISOS` en js/db-appwrite.js.
// `owner` se agrega siempre en update y delete.
// v1.8.4: se agrega 'variantes' (A.41).
// v1.8.5: rename 'menus' → 'cartas' (A.44).
// v1.9.1: se agrega 'movimientos' (A.74).
const MATRIZ_PERMISOS = {
  mesas:           { update: ['admin', 'mesero'],         delete: ['admin'] },
  comandas:        { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
  pedidos:         { update: ['admin', 'mesero', 'caja'], delete: ['admin'] },
  productos:       { update: ['admin'],                   delete: ['admin'] },
  insumos:         { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
  recetas:         { update: ['admin', 'chef', 'barman'], delete: ['admin'] },
  proveedores:     { update: ['admin'],                   delete: ['admin'] },
  entradas:        { update: ['admin'],                   delete: ['admin'] },
  cartas:          { update: ['admin'],                   delete: ['admin'] },
  eventos_en_vivo: { update: ['admin', 'artista'],        delete: ['admin'] },
  staff:           { update: ['admin'],                   delete: ['admin'] },
  configuracion:   { update: [],                          delete: [] },
  comensales:      { update: ['admin', 'mesero'],         delete: ['admin'] },
  avisos:          { update: ['admin', 'mesero'],         delete: ['admin'] },
  variantes:       { update: ['admin'],                   delete: ['admin'] },
  movimientos:     { update: ['admin'],                   delete: ['admin'] }
};

// Límites de rate limit por tipo de acción
const LIMITES = {
  crear: { maxIntentos: 60, ventanaMs: 60000 },
  roles: { maxIntentos: 10, ventanaMs: 60000 },
  vinculacion: { maxIntentos: 5, ventanaMs: 60000 },
  // A.65: rate limit específico para jugadores sin Team creando
  // precargas de cliente. Más estricto que el de staff.
  crear_jugador: { maxIntentos: 5, ventanaMs: 60000 }
};

function parsearRoles(staff) {
  try {
    if (typeof staff.roles === 'string') return JSON.parse(staff.roles || '[]');
    return staff.roles || [];
  } catch { return []; }
}

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

function hashSimple(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

async function verificarLimite(tablesDB, databaseId, clave, maxIntentos = 10, ventanaMs = 60000) {
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

async function obtenerAppDelEspacio(tablesDB, databaseId, espacioId) {
  try {
    const espacio = await tablesDB.getRow({
      databaseId,
      tableId: 'global_Espacios',
      rowId: espacioId
    });
    return espacio?.app || null;
  } catch { return null; }
}

/**
 * A.65: valida que un espacioId pertenezca a un espacio activo de
 * la app lataberna. Se usa en la rama restringida para jugadores.
 * Devuelve el objeto espacio si es válido, null en caso contrario.
 */
async function _validarEspacioLataberna(tablesDB, databaseId, espacioId) {
  try {
    const espacio = await tablesDB.getRow({
      databaseId,
      tableId: 'global_Espacios',
      rowId: espacioId
    });
    if (!espacio) return null;
    if (espacio.app !== 'lataberna') return null;
    if (espacio.activo !== true) return null;
    return espacio;
  } catch {
    return null;
  }
}

/**
 * A.65: determina si un usuario tiene SOLO el label jugador y no
 * pertenece a ningún Team. Se usa para decidir qué rama restringida
 * aplicar.
 */
async function _esJugadorSinTeam(account, teams, userId) {
  try {
    const user = await account.get();
    const labels = user.labels || [];
    if (labels.includes('master')) return false;
    if (labels.includes('owner') || labels.includes('admin')) return false;

    // Verificar si el usuario está en algún Team
    const equipos = await teams.list();
    const teamsLista = equipos.teams || [];
    for (const team of teamsLista) {
      const membresias = await teams.listMemberships({ teamId: team.$id });
      const esMiembro = (membresias.memberships || []).some(m => m.userId === userId);
      if (esMiembro) return false;
    }
    return true;
  } catch {
    // En caso de error, asumimos que NO es jugador sin Team para
    // evitar abrir la rama restringida por accidente.
    return false;
  }
}

/**
 * A.65: valida estrictamente el payload de creación de precarga por
 * parte de un jugador sin Team. Solo permite:
 *   · accion === 'crear'
 *   · coleccion === 'pedidos'
 *   · datos.origen === 'cliente'
 *   · datos.estado === 'precarga'
 *   · datos.espacioId válido en global_Espacios con app lataberna
 *     y activo true
 */
function _validarPayloadPrecargaJugador(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valido: false, motivo: 'Payload inválido.' };
  }
  if (payload.accion !== 'crear') {
    return { valido: false, motivo: 'Jugador solo puede ejecutar acción crear.' };
  }
  if (payload.coleccion !== 'pedidos') {
    return { valido: false, motivo: 'Jugador solo puede crear pedidos.' };
  }
  const datos = payload.datos;
  if (!datos || typeof datos !== 'object') {
    return { valido: false, motivo: 'Datos de pedido requeridos.' };
  }
  if (datos.origen !== 'cliente') {
    return { valido: false, motivo: 'Jugador solo puede crear pedidos con origen cliente.' };
  }
  if (datos.estado !== 'precarga') {
    return { valido: false, motivo: 'Jugador solo puede crear pedidos en estado precarga.' };
  }
  if (!datos.espacioId || typeof datos.espacioId !== 'string') {
    return { valido: false, motivo: 'espacioId es obligatorio.' };
  }
  return { valido: true };
}

async function sincronizarMembresia({ teams, teamId, userId, roles }) {
  try {
    const listado = await teams.listMemberships({ teamId });
    const membresia = (listado.memberships || []).find(m => m.userId === userId);
    if (membresia) {
      await teams.updateMembership({ teamId, membershipId: membresia.$id, roles });
    } else {
      await teams.createMembership({ teamId, roles, userId });
    }
  } catch (e) {
    console.error(`No se pudo sincronizar membresía de ${teamId}: ${e.message}`);
  }
}

function generarPermisosFila(coleccion, espacioId) {
  if (!espacioId) return [];

  const permisos = [Permission.read(Role.team(espacioId))];

  const reglas = MATRIZ_PERMISOS[coleccion] || { update: ['admin'], delete: ['admin'] };

  const rolesUpdate = new Set([...reglas.update, 'owner']);
  const rolesDelete = new Set([...reglas.delete, 'owner']);

  rolesUpdate.forEach(rol => {
    permisos.push(Permission.update(Role.team(espacioId, rol)));
  });

  rolesDelete.forEach(rol => {
    permisos.push(Permission.delete(Role.team(espacioId, rol)));
  });

  return permisos;
}

function puedeAsignar(rolLlamador, rolObjetivo) {
  if (rolLlamador === 'master') return rolObjetivo === 'owner';
  const permitidos = JERARQUIA[rolLlamador] || [];
  return permitidos.includes(rolObjetivo);
}

async function obtenerRolesLlamador(account, teams, espacioId) {
  try {
    const user = await account.get();
    const labels = user.labels || [];
    if (labels.includes('master')) return ['master'];
    if (espacioId) {
      const membresias = await teams.listMemberships({ teamId: espacioId });
      const membresia = (membresias.memberships || []).find(m => m.userId === user.$id);
      return membresia ? membresia.roles : ['jugador'];
    }
    return labels;
  } catch { return ['jugador']; }
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') return res.text('', 204, CORS);

  const origen = validarOrigen(req);
  if (!origen.permitido) return res.json({ success: false, error: origen.motivo }, 403, CORS);

  const jwt = req.headers['x-appwrite-user-jwt'];
  if (!jwt) return res.json({ success: false, error: 'No autenticado.' }, 401, CORS);

  const clientAdmin = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const clientSesion = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setJWT(jwt);

  const account = new Account(clientSesion);
  const users = new Users(clientAdmin);
  const teams = new Teams(clientAdmin);
  const tablesDB = new TablesDB(clientAdmin);
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  try {
    const usuarioAutenticado = await account.get();
    const userId = usuarioAutenticado.$id;

    let payload = {};
    if (req.bodyJson) payload = req.bodyJson;
    else if (req.bodyText) { try { payload = JSON.parse(req.bodyText); } catch { payload = {}; } }

    // ── A.65: rama restringida para jugador sin Team ──
    // Antes de aplicar la lógica normal, verificamos si el usuario
    // es un jugador sin Team. Si lo es, aplicamos validaciones
    // estrictas y solo permitimos crear precargas de cliente.
    const esJugadorSinTeam = await _esJugadorSinTeam(account, teams, userId);

    if (esJugadorSinTeam) {
      // Rate limit más estricto para jugadores
      const permitidoJugador = await verificarLimite(
        tablesDB,
        databaseId,
        `asignar-rol:crear_jugador:${userId}`,
        LIMITES.crear_jugador.maxIntentos,
        LIMITES.crear_jugador.ventanaMs
      );
      if (!permitidoJugador) {
        log(`Jugador ${userId}: rate limit excedido.`);
        return res.json({
          exito: false,
          error: 'Demasiadas solicitudes. Intenta más tarde.'
        }, 429, CORS);
      }

      // Validar payload estrictamente
      const validacion = _validarPayloadPrecargaJugador(payload);
      if (!validacion.valido) {
        log(`Jugador ${userId}: intento bloqueado (${validacion.motivo}).`);
        return res.json({ exito: false, error: validacion.motivo }, 403, CORS);
      }

      // Validar que el espacioId pertenezca a un espacio lataberna activo
      const espacioValido = await _validarEspacioLataberna(
        tablesDB,
        databaseId,
        payload.datos.espacioId
      );
      if (!espacioValido) {
        log(`Jugador ${userId}: espacioId inválido o inactivo (${payload.datos.espacioId}).`);
        return res.json({
          exito: false,
          error: 'Espacio inválido, inactivo o no pertenece a la app.'
        }, 403, CORS);
      }

      // Los permisos de fila y el espacioId vienen del payload.
      // No se fuerza el espacio activo del cliente.
      const permisos = generarPermisosFila('pedidos', payload.datos.espacioId);
      const idFinal = payload.rowId || ID.unique();

      // Forzar que el usuarioId sea el del JWT, nunca del payload
      const datosFinales = Object.assign({}, payload.datos);
      datosFinales.id_usuario = userId;

      const filaCreada = await tablesDB.createRow({
        databaseId,
        tableId: 'laTaberna_Pedidos',
        rowId: idFinal,
        data: datosFinales,
        permissions: permisos
      });

      log(`Precarga creada por jugador ${userId} en espacio ${payload.datos.espacioId} · pedidoId ${filaCreada.$id}.`);
      return res.json({ exito: true, row: filaCreada }, 201, CORS);
    }

    // ── Flujo normal de la función (staff, master, owner, admin) ──

    // Determinar tipo de operación para aplicar límite adecuado
    let tipoOperacion = 'roles';
    if (payload.accion === 'crear') tipoOperacion = 'crear';
    else if (payload.token) tipoOperacion = 'vinculacion';

    const limites = LIMITES[tipoOperacion];
    const permitido = await verificarLimite(
      tablesDB,
      databaseId,
      `asignar-rol:${tipoOperacion}:${userId}`,
      limites.maxIntentos,
      limites.ventanaMs
    );
    if (!permitido) {
      return res.json({
        success: false,
        error: 'Demasiadas solicitudes. Intenta más tarde.'
      }, 429, CORS);
    }

    // ── Acción crear ──
    if (payload.accion === 'crear') {
      const { coleccion, datos, rowId } = payload;
      if (!coleccion || !COLECCIONES_NEGOCIO.includes(coleccion)) {
        return res.json({ exito: false, error: 'Colección inválida.' }, 400, CORS);
      }
      if (!datos || typeof datos !== 'object') {
        return res.json({ exito: false, error: 'Datos de fila requeridos.' }, 400, CORS);
      }
      const espacioId = datos.espacioId;
      if (!espacioId) return res.json({ exito: false, error: 'espacioId es obligatorio.' }, 400, CORS);

      const app = await obtenerAppDelEspacio(tablesDB, databaseId, espacioId);
      if (app && APPS_CON_TEAMS.includes(app)) {
        try {
          const membresias = await teams.listMemberships({ teamId: espacioId });
          const esMiembro = (membresias.memberships || []).some(m => m.userId === userId);
          if (!esMiembro) return res.json({ exito: false, error: 'No tienes permisos para crear en este espacio.' }, 403, CORS);
        } catch (e) {
          return res.json({ exito: false, error: 'No se pudo verificar membresía.' }, 500, CORS);
        }
      }

      const permisos = generarPermisosFila(coleccion, espacioId);
      const idFinal = rowId || ID.unique();
      const filaCreada = await tablesDB.createRow({
        databaseId,
        tableId: `laTaberna_${coleccion.charAt(0).toUpperCase() + coleccion.slice(1)}`,
        rowId: idFinal,
        data: datos,
        permissions: permisos
      });

      log(`Fila creada en ${coleccion} con ID ${filaCreada.$id} por ${userId}`);
      return res.json({ exito: true, row: filaCreada }, 201, CORS);
    }

    // ── Flujo con token de vinculación ──
    const { token, espacioId, roles } = payload;

    if (token) {
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
      const rolPrincipal = staff.rolPrincipal || rolesArray[0] || 'jugador';

      await tablesDB.updateRow({
        databaseId,
        tableId: 'laTaberna_Staff',
        rowId: staff.$id,
        data: { usuarioId: userId, tokenVinculacion: '' }
      });

      const labels = rolesArray.includes('jugador') ? rolesArray : ['jugador', ...rolesArray];
      await users.updateLabels(userId, labels);

      const app = await obtenerAppDelEspacio(tablesDB, databaseId, staff.espacioId);
      if (app && APPS_CON_TEAMS.includes(app) && staff.espacioId) {
        await sincronizarMembresia({ teams, teamId: staff.espacioId, userId, roles: rolesArray });
      }

      return res.json({
        exito: true,
        staff: { id: staff.$id, usuarioId: userId, espacioId: staff.espacioId, roles: rolesArray, rolPrincipal, tokenVinculacion: '' }
      }, 200, CORS);
    }

    // ── Flujo normal de asignación de roles ──
    const targetUserId = payload.userId;
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    if (!targetUserId || rolesArray.length === 0) {
      return res.json({ success: false, error: 'Faltan userId o roles.' }, 400, CORS);
    }

    const rolesLlamador = await obtenerRolesLlamador(account, teams, espacioId);
    for (const rol of rolesArray) {
      const puede = rolesLlamador.some(rolLlamador => puedeAsignar(rolLlamador, rol));
      if (!puede) {
        return res.json({ success: false, error: `No tienes permisos para asignar el rol ${rol}.` }, 403, CORS);
      }
    }

    const labels = rolesArray.includes('jugador') ? rolesArray : ['jugador', ...rolesArray];
    await users.updateLabels(targetUserId, labels);

    if (espacioId) {
      const app = await obtenerAppDelEspacio(tablesDB, databaseId, espacioId);
      if (app && APPS_CON_TEAMS.includes(app)) {
        await sincronizarMembresia({ teams, teamId: espacioId, userId: targetUserId, roles: rolesArray });
      }
    }

    return res.json({ success: true }, 200, CORS);

  } catch (err) {
    error(`Error en asignar-rol: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500, CORS);
  }
};