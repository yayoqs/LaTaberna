# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-security.md
# Versión: 1.1.0
# Propósito: Guía resumen de Appwrite Console IV - Seguridad para equipos Core.
# Cambios relevantes: Agregada sección 9 sobre rate limiting atómico con
#                     global_Limites. Agregada sección 10 con la matriz v1
#                     de permisos de fila. Ampliada la sección de JWT.

---

# Guía de Appwrite Console IV — Seguridad

## 1. Introducción

Appwrite proporciona múltiples capas de seguridad para proteger proyectos, usuarios y datos. Esta guía resume los conceptos y medidas más relevantes para el ecosistema Elisekai.

## 2. Medidas de seguridad generales

- **Cumplimiento:** Appwrite es compatible con GDPR, CCPA, HIPAA, SOC 2 y PCI (este último mediante Stripe para pagos).  
- **HTTPS/TLS:** Todos los endpoints usan HTTPS. Appwrite genera certificados TLS para dominios personalizados y de funciones.  
- **Cifrado:**  
  - Archivos en Storage: cifrado AES-128 GCM para archivos menores de 20 MB (activar en bucket).  
  - Columnas de Databases: cifrado de columnas de texto solo en planes Pro o superiores. No disponible en plan Free.  
- **Protección contra abusos:** Rate limits, CORS y protección DDoS en Cloud.

## 3. Permisos

### 3.1 Concepto

Appwrite usa un sistema de permisos para controlar quién puede leer, crear, actualizar o eliminar recursos (bases de datos, tablas, filas, buckets, archivos). Por defecto, **nadie tiene acceso** a menos que se otorgue explícitamente.

### 3.2 Niveles

- **Table level (nivel de tabla):** aplica a todas las filas de la tabla.  
- **Row level (nivel de fila):** aplica a filas individuales si **Row Security** está activado.

Un usuario necesita acceso en **al menos un nivel** para interactuar con una fila; no es necesario tener ambos.

### 3.3 Permisos disponibles

| Permiso | Descripción |
|---------|-------------|
| `Permission.read()` | Leer un recurso |
| `Permission.create()` | Crear nuevos recursos (no aplica a filas o archivos) |
| `Permission.update()` | Modificar un recurso |
| `Permission.delete()` | Eliminar un recurso |
| `Permission.write()` | Alias para crear+actualizar+eliminar en tablas/buckets, o actualizar+eliminar en filas/archivos |

### 3.4 Roles disponibles

| Rol | Descripción |
|-----|-------------|
| `Role.any()` | Cualquier persona, incluso sin sesión |
| `Role.guests()` | Solo invitados sin sesión |
| `Role.users([estado])` | Usuarios autenticados o anónimos |
| `Role.user(id, [estado])` | Usuario específico por ID |
| `Role.team(teamId)` | Cualquier miembro de un equipo |
| `Role.team(teamId, rol)` | Miembros del equipo con un rol específico |
| `Role.member(membershipId)` | Miembro específico de un equipo |
| `Role.label(label)` | Cuentas con una etiqueta específica |

### 3.5 Recomendación para Elisekai

- Usar **Row Security** en tablas de negocio (`laTaberna_*`).  
- A nivel de tabla, otorgar **solo CREATE** a los roles/equipos necesarios.  
- Los permisos de fila se generan al crear cada fila mediante `DBAppwrite.crear` o la función serverless.  
- Para permisos globales de master, usar `Role.label('master')`.  
- No otorgar READ/UPDATE/DELETE global por tabla.

## 4. Rate limits

Algunos endpoints de Appwrite tienen límites de peticiones por hora para Client SDKs. Los límites se indican en headers:

    X-RateLimit-Limit: 60
    X-RateLimit-Remaining: 56
    X-RateLimit-Reset: 1372700873

Si se excede, se recibe un error `429 Too Many Requests`.

### 4.1 Buenas prácticas

- Implementar reintentos con backoff cuando se reciba 429.  
- Usar caché cuando sea posible (por ejemplo, `ttl` en listados).  
- Evitar polling agresivo; preferir Realtime o webhooks.

## 5. CORS

Appwrite rechaza peticiones desde dominios no registrados como plataformas en el proyecto.

### 5.1 Acción requerida

Verificar que los dominios de las aplicaciones del ecosistema estén agregados en **Overview > Platforms > Add platform**.

## 6. Dev keys (obsoleto)

Las dev keys permitían evadir rate limits en desarrollo. **Serán deprecadas en septiembre de 2026.** No se recomienda su uso; en su lugar, se puede usar Realtime y caché para minimizar llamadas.

## 7. Cifrado

- **Storage:** se puede activar cifrado en cada bucket para archivos menores de 20 MB.  
- **Databases:** el cifrado de columnas de texto está disponible solo en planes Pro+. No aplica en Free.

## 8. Auditoría (audit logs)

Appwrite ofrece registros de auditoría en la pestaña **Activity** de cada producto.

- En plan Free, los logs se retienen solo **1 hora**.  
- En plan Pro, 7 días.  
- Para retención más prolongada, es necesario implementar una solución propia.

### 8.1 Recomendación para Elisekai

Considerar crear una colección `laTaberna_Auditoria` con Row Security para registrar eventos importantes de negocio (cierres de turno, cambios de permisos, etc.).

## 9. Rate limiting atómico con `global_Limites`

Appwrite Cloud no ofrece rate limiting a nivel de aplicación (solo a nivel de endpoint mediante headers). Para proteger funciones serverless y operaciones sensibles, Core implementa un rate limiting propio usando una colección dedicada.

### 9.1 Colección `global_Limites`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `clave` | varchar | Sí | 255 | — |
| `marcaTiempo` | datetime | Sí | — | — |
| `contador` | integer | No | — | `0` |

Índices:

- `index_clave` (Key)
- `index_marcaTiempo` (Key)

**Permisos:** solo `label:master`. No otorgar acceso a `users`. Uso exclusivo de funciones serverless.

### 9.2 Diseño atómico

El rate limiting usa `incrementRowColumn` para incrementar el contador de manera atómica y evitar condiciones de carrera.

Cada ventana temporal tiene su propia fila:

    rowId = "lim_<hash>_<ventana>"

Donde:

- `<hash>` es un hash corto y determinista de la clave (por ejemplo `registro:190.0.0.1`).
- `<ventana>` es `Math.floor(Date.now() / ventanaMs)`.

Algoritmo:

1. Intentar `incrementRowColumn` sobre la fila.
2. Si la fila no existe, crearla con `contador: 1`.
3. Si el contador resultante es `>= maxIntentos`, rechazar con `429`.
4. Si la fila ya existía, `incrementRowColumn` devuelve el nuevo contador y se evalúa el límite.

**Ventaja frente a `listRows`:** evita el problema de consistencia eventual. El contador es atómico en el servidor.

### 9.3 Límites por acción en `asignar-rol`

| Acción | Clave | Máximo | Ventana |
|--------|-------|--------|---------|
| `crear` | `asignar-rol:crear:<userId>` | 60 | 60s |
| `roles` (asignación normal) | `asignar-rol:roles:<userId>` | 10 | 60s |
| `vinculacion` (canje de token) | `asignar-rol:vinculacion:<userId>` | 5 | 60s |

**Motivo:** la creación de filas es una operación frecuente y no sensible por sí misma (validada por membresía del team). La asignación de roles es sensible y debe ser lenta por diseño. El canje de token es aún más restrictivo.

### 9.4 Límites en `registrar-usuario`

| Clave | Máximo | Ventana |
|-------|--------|---------|
| `registro:<ip>` | 5 | 60s |

**Nota:** por IP, no por usuario. Suficiente para uso normal. Los usuarios con IP compartida (CGNAT, oficina) podrían verse afectados si varios se registran en el mismo minuto; poco probable en operación real.

### 9.5 Comportamiento del contador

- La ventana se identifica por `Math.floor(Date.now() / ventanaMs)`.
- Cada ventana tiene su propia fila; los contadores no se acumulan entre ventanas.
- Las filas antiguas se pueden limpiar mediante un cron externo o un script manual. No es urgente: crecen lento.

## 10. Matriz v1 de permisos de fila

Cada fila creada por `DBAppwrite.crear` o por la función serverless `asignar-rol` (`accion: 'crear'`) recibe permisos de fila según la colección. Esta matriz es la fuente de verdad y debe estar replicada en `js/db-appwrite.js` (constante `MATRIZ_PERMISOS`) y en `asignar-rol/index.js` (constante `MATRIZ_PERMISOS`).

### 10.1 Matriz

| Colección | read | update | delete |
|-----------|------|--------|--------|
| `mesas` | `team:espacio` | `admin`, `mesero`, `owner` | `admin`, `owner` |
| `comandas` | `team:espacio` | `admin`, `chef`, `barman`, `owner` | `admin`, `owner` |
| `pedidos` | `team:espacio` | `admin`, `mesero`, `caja`, `owner` | `admin`, `owner` |
| `productos` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |
| `insumos` | `team:espacio` | `admin`, `chef`, `barman`, `owner` | `admin`, `owner` |
| `recetas` | `team:espacio` | `admin`, `chef`, `barman`, `owner` | `admin`, `owner` |
| `proveedores` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |
| `entradas` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |
| `cartas` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |
| `eventos_en_vivo` | `team:espacio` | `admin`, `artista`, `owner` | `admin`, `owner` |
| `staff` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |
| `configuracion` | `team:espacio` | `owner` | `owner` |
| `comensales` | `team:espacio` | `admin`, `mesero`, `owner` | `admin`, `owner` |
| `avisos` | `team:espacio` | `admin`, `mesero`, `owner` | `admin`, `owner` |
| `variantes` | `team:espacio` | `admin`, `owner` | `admin`, `owner` |

### 10.2 Notas

- El rol `owner` se agrega siempre a update y delete, en toda colección.
- `read` siempre es a nivel de team (todo el equipo del espacio puede leer).
- `configuracion` es la única que excluye a admin del update/delete; solo owner.
- `pedidos` incluye `caja` en update (cobro).
- `eventos_en_vivo` incluye `artista` en update.
- Las colecciones globales (`global_*`) no aplican esta matriz: se rigen por permisos de tabla.

### 10.3 Coordinación entre frontend y backend

La matriz debe vivir idéntica en dos lugares:

- `js/db-appwrite.js` → para escrituras directas de respaldo (rara vez se usa hoy porque la creación va por función).
- `funciones/asignar-rol/index.js` → para la creación real vía serverless.

Cualquier cambio requiere modificar **ambos archivos** y actualizar esta guía. Coordinar con Core.

## 11. JWT en llamadas a funciones serverless

Las funciones serverless sensibles (`asignar-rol`) exigen un JWT de sesión para autenticar al usuario y validar membresía.

### 11.1 Obtención del JWT en el frontend

`Auth.obtenerJWT()` genera y cachea un JWT con TTL del 80% del valor real. Appwrite emite JWT con 15 minutos por defecto, así que el cache dura 12 minutos.

    const jwt = await Auth.obtenerJWT();
    if (!jwt) {
      // no se pudo obtener credencial
    }

El cache se limpia en `Auth.limpiarJWTCache()`, llamado automáticamente en `cerrarSesion`.

### 11.2 Uso en llamadas HTTP

Las llamadas a funciones serverless desde el frontend deben incluir el header:

    x-appwrite-user-jwt: <JWT>

Ejemplo:

    const jwt = await Auth.obtenerJWT();
    fetch(URL_FUNCION_ASIGNAR_ROL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-appwrite-user-jwt': jwt
      },
      body: JSON.stringify(payload)
    });

### 11.3 Validación en la función serverless

La función usa el JWT para obtener el usuario autenticado:

    const clientSesion = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setJWT(jwt);
    const account = new Account(clientSesion);
    const usuario = await account.get();

El `userId` obtenido desde el JWT es el único confiable. No se acepta `x-appwrite-user-id` como sustituto.

### 11.4 Cuándo se exige JWT

Todas las invocaciones de `asignar-rol` desde el frontend. Si el JWT falta o es inválido, la función responde con 401.

## 12. Permisos de fila y problema del `espacioId` ajeno

Incluso con Row Security, si un usuario tiene CREATE a nivel de tabla, puede crear una fila con un `espacioId` que no le pertenece usando directamente el SDK.

La mitigación completa requiere:

- Validar en servidor (función serverless con API key y JWT).
- Restringir los permisos de tabla a solo `label:master`.

**Estado actual (2026-09-16):** la creación de filas de negocio pasa por la función serverless `asignar-rol`. Los permisos de tabla ya no otorgan CREATE a teams. La única vía legítima es la función, que valida membresía del team antes de crear.

**Recomendación:** no confiar en el frontend para seguridad. Cualquier lógica crítica debe validarse en servidor.

## 13. Cifrado en tránsito

Todo el tráfico hacia Appwrite Cloud usa HTTPS. No se debe usar HTTP. Para dominios personalizados, Appwrite genera certificados TLS automáticamente.

## 14. Medidas organizacionales

Los roles de consola (Owner, Developer, Editor, Analyst, Billing) se asignan a miembros del equipo de Appwrite Console, no a usuarios finales de la aplicación. No confundir con los roles internos de la app.

## 15. Endurecimiento de funciones serverless

### 15.1 Validación de origen

Las funciones `registrar-usuario` y `asignar-rol` validan:

- `Origin` de la petición contra una lista blanca de dominios.
- `X-Appwrite-Project` contra el projectId esperado.

Orígenes permitidos actualmente (producción + desarrollo):

    https://lataberna.281093.xyz
    https://mirefugio.281093.xyz
    https://lavitrina.281093.xyz
    http://localhost:3000
    http://127.0.0.1:3000
    http://localhost:8158

Si el origen no está en la lista, la función responde 403.

**Nota:** la validación de `Origin` es una capa cosmética que filtra bots casuales. No detiene ataques deliberados (se puede falsificar el header). La protección real es el JWT + rate limit + jerarquía de roles + validación de membresía.

### 15.2 Rate limiting persistente

Ambas funciones usan `global_Limites` con contador atómico. Ver sección 9.

### 15.3 Jerarquía de roles

`asignar-rol` valida que el llamador tenga permiso para asignar cada rol objetivo:

| Rol llamador | Puede asignar |
|--------------|----------------|
| `master` | `owner` |
| `owner` | `admin`, staff operativos |
| `admin` | staff operativos |
| `jugador` | ninguno |

Un intento de escalamiento de privilegios (por ejemplo, un jugador intentando asignarse `admin`) responde 403.

## 16. Nota final

Esta guía es un resumen operativo. Si algún equipo necesita profundizar en un tema específico (permisos avanzados, rate limits, cifrado, etc.), puede solicitar el documento oficial al Coordinador de Integración, quien lo derivará a Core.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*