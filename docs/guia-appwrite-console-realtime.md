# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-realtime.md
# Versión: 1.1.0
# Propósito: Guía resumen de Appwrite Realtime para equipos Core.
# Cambios relevantes: Filtro por espacioId, ciclo de vida de
#                     suscripciones (desconectar/reconfigurar),
#                     ejemplos reales del proyecto.

---

# Guía de Appwrite Realtime

## 1. Introducción

Appwrite Realtime permite recibir actualizaciones en tiempo real mediante WebSockets, sin necesidad de hacer polling HTTP. Es ideal para sincronizar mesas, comandas, pedidos y cualquier colección de la base de datos.

## 2. Conceptos básicos

- **Realtime service:** se usa la clase `Realtime` del SDK.
- **Channels:** definen qué recursos escuchar. Se construyen con la clase `Channel`.
- **Eventos:** cada mensaje incluye un arreglo `events` con los tipos de evento (create, update, delete).
- **Payload:** contiene la información del recurso afectado.
- **Permisos:** las suscripciones respetan el sistema de permisos de Appwrite. Solo se reciben eventos de recursos a los que el usuario tiene acceso.

## 3. Autenticación y ciclo de vida

- Realtime autentica usando la sesión actual del usuario.
- Si el usuario inicia sesión **después** de crear la suscripción, la suscripción no recibirá eventos del nuevo usuario.
- Si cambia la sesión (logout/login), se debe **desconectar Realtime y volver a suscribirse**.
- Las suscripciones atadas a una sesión expirada dejan de recibir actualizaciones.

En nuestro código, este ciclo lo maneja `DBAppwrite` con dos métodos:

- `desconectarRealtime()`: cierra todas las suscripciones y el WebSocket.
- `reconfigurarRealtime()`: desconecta y vuelve a suscribir con el espacio activo actual.

## 4. Canales disponibles

Los canales más relevantes para el ecosistema:

| Canal | Helper | Descripción |
|-------|--------|-------------|
| `tablesdb.<DB_ID>.tables.<TABLE_ID>.rows` | `Channel.tablesdb('<DB_ID>').table('<TABLE_ID>').row()` | Eventos de creación/actualización/eliminación de cualquier fila de una tabla |
| `tablesdb.<DB_ID>.tables.<TABLE_ID>.rows.<ROW_ID>` | `Channel.tablesdb('<DB_ID>').table('<TABLE_ID>').row('<ROW_ID>')` | Eventos de una fila específica |
| `files` | `Channel.files()` | Eventos de archivos en Storage |
| `teams.<ID>` | `Channel.team('<TEAM_ID>')` | Eventos de un equipo |
| `memberships` | `Channel.memberships()` | Eventos de membresías |
| `presences` | `Channel.presences()` | Eventos de presencia de usuarios |

También se pueden agregar filtros de eventos al canal:

    Channel.tablesdb('<DB_ID>').table('<TABLE_ID>').row().create()
    Channel.tablesdb('<DB_ID>').table('<TABLE_ID>').row().update()
    Channel.tablesdb('<DB_ID>').table('<TABLE_ID>').row().delete()

## 5. Suscripción básica

    import { Client, Realtime, Channel } from "appwrite";

    const client = new Client()
      .setEndpoint('https://tor.cloud.appwrite.io/v1')
      .setProject('6a025322001f24c57d1d');

    const realtime = new Realtime(client);

    const subscription = await realtime.subscribe(
      Channel.tablesdb('6a0275cb0022ebf7d30d').table('laTaberna_Mesas').row(),
      response => {
        if (response.events.some(e => e.endsWith('.create'))) {
          console.log('Nueva mesa:', response.payload);
        }
      }
    );

## 6. Suscripción con queries (filtrado server-side)

Se pueden pasar `queries` al suscribirse para filtrar los eventos. Esto reduce tráfico y mejora seguridad, evitando recibir datos de filas que no corresponden.

    import { Query } from "appwrite";

    const espacioId = 'PubPrueba';

    const subscription = await realtime.subscribe(
      Channel.tablesdb('6a0275cb0022ebf7d30d').table('laTaberna_Mesas').row(),
      response => {
        console.log('Mesa actualizada en PubPrueba:', response.payload);
      },
      [Query.equal('espacioId', espacioId)]
    );

**Queries soportados:** `equal`, `notEqual`, `greaterThan`, `greaterThanEqual`, `lessThan`, `lessThanEqual`, `isNull`, `isNotNull`, `and`, `or`.

### 6.1 Aplicación en nuestro código

`DBAppwrite` v1.13.0 o superior filtra automáticamente por `espacioId` en todas las suscripciones de colecciones de negocio. El filtro se obtiene de `Auth.obtenerLocalActivo().id`.

Las colecciones globales (`global_perfiles`, `global_puntos`, `global_eventos`, `global_espacios`) **no aplican filtro** porque no tienen columna `espacioId`.

## 7. Manejo del ciclo de vida

### 7.1 Actualizar canales o queries

Se pueden reemplazar canales/queries sin recrear el WebSocket:

    await subscription.update({
      channels: [Channel.tablesdb('6a0275cb0022ebf7d30d').table('laTaberna_Pedidos').row()]
    });

### 7.2 Desuscribir

    await subscription.unsubscribe();

### 7.3 Desconectar todo

    await realtime.disconnect();

### 7.4 Métodos oficiales en DBAppwrite

Para el ciclo de vida del proyecto, usar siempre los métodos de `DBAppwrite`:

    await DBAppwrite.desconectarRealtime();
    // Cierra todas las suscripciones y el WebSocket.

    await DBAppwrite.reconfigurarRealtime();
    // Desconecta y vuelve a suscribir con el espacio activo actual.

No llamar a `realtime.disconnect()` directamente desde otros módulos, salvo casos de diagnóstico aislados. La capa segura es `DBAppwrite`.

### 7.5 Cuándo desconectar y reconectar

| Situación | Acción |
|-----------|--------|
| Inicio de sesión | `reconfigurarRealtime()` |
| Cierre de sesión | `desconectarRealtime()` |
| Cambio de espacio activo (`Auth.cambiarLocal`) | `reconfigurarRealtime()` |
| Reconfiguración manual por error de permisos | `reconfigurarRealtime()` |

En `auth.js` v2.5.1 o superior estos ciclos están integrados. No se necesita llamarlos manualmente.

### 7.6 Qué pasa si no se reconecta

Si el usuario cambia de espacio y no se reconfigura Realtime:

- Las suscripciones siguen apuntando al espacio anterior.
- El filtro por `espacioId` queda desactualizado.
- Los eventos llegan con datos del espacio viejo, generando confusión o errores en la UI.

Por eso es crítico reconfigurar tras cada cambio de contexto.

## 8. Payload de respuesta

Cada mensaje incluye:

| Campo | Descripción |
|-------|-------------|
| `events` | Arreglo de eventos (ej: `tablesdb.*.tables.*.rows.*.update`) |
| `channels` | Canales que pueden recibir el mensaje |
| `timestamp` | Fecha/hora en UTC |
| `payload` | Datos de la fila afectada (equivale al modelo de respuesta) |

Ejemplo:

    {
      "events": ["tablesdb.6a0275cb0022ebf7d30d.tables.laTaberna_Mesas.rows.PubPrueba_mesa_1.update"],
      "channels": ["tablesdb.6a0275cb0022ebf7d30d.tables.laTaberna_Mesas.rows"],
      "timestamp": "2026-09-08T18:30:04.051+00:00",
      "payload": {
        "$id": "PubPrueba_mesa_1",
        "numero": "1",
        "estado": "ocupada",
        "espacioId": "PubPrueba"
      }
    }

## 9. Presences

La API de Presences permite rastrear usuarios activos y sus estados en tiempo real.

### 9.1 Concepto

Una presencia es un registro temporal asociado a un usuario, con:

- `status`: texto libre (ej: `online`, `away`, `editing`)
- `metadata`: JSON con contexto adicional
- `expiresAt`: tiempo de expiración automática

### 9.2 Métodos principales

| Método | Descripción |
|--------|-------------|
| `presences.upsert()` | Crea o actualiza una presencia |
| `presences.get()` | Obtiene una presencia por ID |
| `presences.list()` | Lista presencias activas |
| `presences.update()` | Actualiza campos de una presencia |
| `presences.delete()` | Elimina una presencia |

### 9.3 Suscripción a presences

    const presencesSub = await realtime.subscribe(
      Channel.presences(),
      response => {
        if (response.events.includes('presences.*.delete')) {
          console.log('Usuario salió:', response.payload);
        } else if (response.events.includes('presences.*.upsert')) {
          console.log('Usuario activo:', response.payload);
        }
      }
    );

### 9.4 Casos de uso en Elisekai

- Indicadores de meseros/cocina activos por local.
- Eventos en vivo: ver cuántos jugadores están participando.
- Concursos: mostrar asistentes conectados en tiempo real.
- Colaboración en MiRefugio: saber quién está viendo un espacio.

Presences está disponible pero no implementado en el ecosistema. Se activará cuando se necesite.

## 10. Estado actual del código

Implementado en `db-appwrite.js` v1.13.0 o superior:

- Filtro por `espacioId` en suscripciones de colecciones de negocio.
- `desconectarRealtime()` y `reconfigurarRealtime()` como métodos públicos.
- Integración con `auth.js` para reconectar en login, logout y cambio de espacio.

Pendiente de implementar:

- Uso de Presences para eventos y concursos.
- Evaluación de `subscription.update()` para cambios de canal sin reconectar.

## 11. Buenas prácticas

1. No llamar a `realtime.subscribe` directamente desde las vistas. Usar `DBAppwrite`.
2. Guardar la función de limpieza que devuelve `EventBus.on` cuando se consume el evento genérico.
3. Si se reconfigura Realtime, esperar a que termine (`await`) antes de asumir que los nuevos eventos llegan.
4. No suscribirse a colecciones sin filtro de espacio si la tabla es de negocio.
5. No suscribirse a colecciones globales con filtro `espacioId`; esas tablas no tienen la columna.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*
*Versión 1.1.0 — 2026-09-16*