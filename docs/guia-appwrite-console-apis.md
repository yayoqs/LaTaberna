# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-apis.md
# Versión: 1.1.0
# Propósito: Guía resumen de Appwrite APIs (REST, GraphQL, Events, Webhooks, Response codes) para equipos Core.
# Cambios relevantes: Creación inicial basada en documentación oficial actualizada.
#                     v1.1.0: se agrega catálogo resumido de eventos propios
#                     y referencia cruzada a EVENTOS.md.

---

# Guía de Appwrite Console IV — APIs y Eventos

## 1. Introducción

Appwrite expone todos sus servicios mediante tres protocolos:

- REST: HTTP clásico, sin SDK.
- GraphQL: consultas y mutaciones flexibles.
- Realtime: actualizaciones en vivo por WebSockets.

Además, los cambios en recursos disparan eventos que pueden ser consumidos por Realtime o Webhooks.

## 2. Eventos

Los eventos se emiten cuando ocurre un cambio en el proyecto (crear, actualizar, eliminar, upsert). Se pueden escuchar por Realtime o Webhooks.

### 2.1 Nomenclatura

Desde Console IV, los eventos de bases de datos usan el prefijo `tablesdb.*` en lugar de `databases.*`.
Ejemplo de evento al crear una fila:

    tablesdb.<DB_ID>.tables.<TABLE_ID>.rows.<ROW_ID>.create

Se pueden usar wildcards (`*`) para suscribirse a grupos de eventos.

### 2.2 Multiplicidad de eventos

Una sola operación genera múltiples eventos (específicos y con wildcards). Por ejemplo, crear una fila produce eventos como:

    tablesdb.default.tables.movies.rows.lion-king.create
    tablesdb.*.tables.*.rows.*.create
    tablesdb.default.tables.*.rows.lion-king.create
    ...

Al filtrar en Realtime o Webhooks, se debe elegir el nivel de especificidad adecuado.

### 2.3 Eventos propios del ecosistema

El ecosistema Elisekai define eventos de dominio que viajan por `EventBus` y no necesariamente por Realtime de Appwrite. El catálogo canónico está en `docs/EVENTOS.md`. Los eventos más relevantes:

- Núcleo: `db:inicializada`, `vista:cambiada`, `state:cambiado`.
- Mesa: `mesa:actualizada`, `mesa:liberada`, `mesas:guardadas`.
- Pedido y comanda: `pedido:creado`, `pedido:cerrado`, `comanda:enviada`, `comanda:completada`.
- Inventario: `inventario:actualizado`, `inventario:stock_bajo`, `inventario:descuento_incompleto`.
- Turno: `turno:iniciado`, `turno:cerrado`, `audit:actualizado`.
- Autenticación: `jugador:cuenta_creada`, `auth:staff_vinculado`.
- Variantes: `variantes:actualizadas`.
- Productos con variantes: `producto:con_variantes`, `producto:agregado_a_comanda`.

Ejemplo de emisión de un evento de descuento incompleto:

    EventBus.emit('inventario:descuento_incompleto', {
      pedidoId: mesa.pedidoId,
      insumosFallidos: [
        { insumoId: 'ins_xxx', cantidad: 5, error: 'Network error' }
      ],
      insumosOk: [
        { insumoId: 'ins_yyy', cantidad: 3 }
      ],
      total: 1
    });

Este evento se emite cuando el descuento de stock de una comanda queda parcialmente aplicado por fallos individuales. No bloquea el envío de la comanda. Ver `EVENTOS.md` sección 4.1 para el detalle.

## 3. REST API

### 3.1 Autenticación

- Cliente: sesión de usuario (cookies).
- Servidor: API key en header `X-Appwrite-Key`.
- JWT: header `X-Appwrite-JWT` para actuar en nombre de un usuario.
- Impersonación: headers `X-Appwrite-Impersonate-User-*` para usuarios con permisos de impersonación.

### 3.2 Headers comunes

| Header | Descripción |
|--------|-------------|
| `X-Appwrite-Project` | ID del proyecto (requerido) |
| `Content-Type: application/json` | Tipo de contenido (requerido) |
| `X-Appwrite-Key` | API key (solo servidor) |
| `X-Appwrite-JWT` | Token JWT |
| `X-Appwrite-Response-Format` | Versión de formato para compatibilidad |

### 3.3 Permisos en REST

Los permisos se envían como strings en el payload o headers. Por ejemplo:

    read("user:627a958ded6424a98a9f")
    update("team:LaTaberna/admin")

### 3.4 Consultas (queries)

Las queries se pasan como JSON escapado en el parámetro `queries[]`. Ejemplo:

    {"method":"equal","column":"name","values":["John"]}

Se pueden anidar con `and` y `or`.

### 3.5 SDK Web vs REST directo

El frontend del ecosistema usa el SDK Web de Appwrite con la clase `TablesDB`. No se hacen llamadas REST crudas desde la aplicación. La excepción son las invocaciones a funciones serverless (`registrar-usuario`, `asignar-rol`), que se realizan por `fetch` con JWT.

Para diagnóstico sí se puede usar REST directo desde la terminal o `curl`, pero nunca en producción.

## 4. GraphQL API

### 4.1 Endpoint

    /v1/graphql

### 4.2 Características

- Selection sets: permiten elegir solo los campos necesarios, reduciendo tráfico.
- Query batching: se pueden enviar múltiples queries o mutaciones en una sola petición.

### 4.3 Autenticación

Se usan las mismas sesiones de Appwrite. Las mutaciones `accountCreate`, `accountCreateEmailPasswordSession`, etc., permiten autenticar.

### 4.4 Cuándo usar GraphQL

No es necesario para el flujo actual. REST y SDKs son suficientes. Evaluar si se necesita optimizar ancho de banda en el futuro.

## 5. Webhooks

Permiten enviar eventos a un endpoint HTTP propio.

### 5.1 Configuración

1. Ir a Settings > Webhooks en Appwrite Console.
2. Crear webhook con URL, eventos, verificación TLS y credenciales opcionales.
3. Guardar el `secret` generado (solo se muestra una vez).

### 5.2 Verificación de firma

Cada webhook incluye el header `X-Appwrite-Webhook-Signature` con un HMAC-SHA1.

Para verificar:

1. Concatenar URL del webhook + cuerpo de la petición.
2. Calcular HMAC-SHA1 con el `secret` como clave.
3. Codificar en Base64 y comparar con el header.

Es obligatorio verificar la firma para evitar peticiones falsas.

### 5.3 Posibles usos en Elisekai

- Auditoría de eventos importantes (cierres de turno, cambios de permisos).
- Notificaciones a otros sistemas.
- Sincronización con Google Sheets (ya usamos DBShim, pero webhooks podrían reemplazarlo).

## 6. Response codes y error types

Appwrite usa códigos HTTP estándar. Además, cada error incluye `type`, `code` y `message` en JSON.

### 6.1 Códigos comunes

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (borrado exitoso) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### 6.2 Tipos de error relevantes

| Tipo | Descripción |
|------|-------------|
| `user_invalid_credentials` | Credenciales inválidas |
| `user_blocked` | Usuario bloqueado |
| `user_more_factors_required` | MFA requerido antes de continuar |
| `general_rate_limit_exceeded` | Límite de peticiones excedido |
| `row_not_found` | Fila no encontrada |
| `row_update_conflict` | Conflicto de versión (fila modificada por otro) |
| `table_not_found` | Tabla no encontrada |
| `database_not_found` | Base de datos no encontrada |

### 6.3 Códigos propios del ecosistema

Algunos flujos internos devuelven códigos simbólicos adicionales:

- `STOCK_INSUFICIENTE`: emitido por `enviarComanda` cuando el motor de stock detecta faltantes y `bloquearStockInsuficiente` está activo. El error lleva un campo `faltantes` con el detalle.
- `CHALLENGE_REQUIRED`: emitido por funciones serverless cuando se requiere verificación adicional (futuro, MFA).

### 6.4 Buenas prácticas

- No mostrar errores crudos al usuario; mapear `type` a mensajes amigables.
- Reintentar errores transitorios (429, 503) con backoff.
- Registrar errores completos en consola para depuración.

## 7. Release policy

- La API actual es `/v1`.
- Appwrite mantiene 3 versiones de API con soporte estándar y 10 años de soporte de seguridad.
- Los SDKs siguen semver y mantienen compatibilidad.

No requiere acción por parte de los equipos, pero es bueno saber que las actualizaciones no romperán la integración sin aviso.

## 8. Nota final

Esta guía es un resumen operativo. Si algún equipo necesita profundizar en REST, GraphQL, Webhooks o eventos específicos, puede solicitar el documento oficial al Coordinador de Integración.

Para temas específicos, consultar las guías hermanas:

- `guia-appwrite-console-databases.md`: operación de TablesDB.
- `guia-appwrite-console-security.md`: permisos, rate limits, CORS.
- `guia-appwrite-console-realtime.md`: suscripciones y ciclo de vida.
- `guia-appwrite-console-auth.md`: autenticación y JWT.
- `guia-appwrite-console-functions.md`: funciones serverless.
- `docs/EVENTOS.md`: catálogo canónico de eventos del ecosistema.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*