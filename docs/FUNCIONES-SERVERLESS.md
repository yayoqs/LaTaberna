# ⚡ Funciones Serverless de La Taberna

**Versión:** 2.0.0
**Fecha:** 16 de septiembre de 2026
**Propósito:** Documentar las funciones desplegadas en Appwrite y sus contratos.

---

## Cambios en v2.0.0 respecto a v1.3.0

- Reescritura mayor tras el endurecimiento de seguridad.
- `registrar-usuario` pasa a v1.5.2 con rate limit atómico.
- `asignar-rol` pasa a v1.8.5 con JWT, jerarquía de roles y
  rate limit por acción. Se agrega 'variantes' y 'cartas' a
  `COLECCIONES_NEGOCIO` y `MATRIZ_PERMISOS`.
- Se reemplaza `global_RateLimits` (deprecada) por `global_Limites`
  con contador atómico.
- Se documenta el modo de creación segura de filas de negocio.

---

## 1. `registrar-usuario`

**URL:** `https://6a81573b000d2f0660d5.tor.appwrite.run`
**ID:** `6a815739002527b8a292`
**Versión actual:** `1.5.2`

**Propósito:** Registro seguro de cuentas del ecosistema. Crea el
usuario en Appwrite Auth, el perfil global, el espacio personal
de MiRefugio y asigna el label `jugador`.

### 1.1 Entrada

    {
      "nombreUsuario": "string",
      "password": "string"
    }

### 1.2 Salida exitosa

    {
      "exito": true,
      "usuarioId": "string"
    }

### 1.3 Salidas de error

    {
      "exito": false,
      "error": "string"
    }

Códigos HTTP:

- 201: éxito.
- 400: validación de datos.
- 403: origen o proyecto no autorizado.
- 409: nombre de usuario ya en uso.
- 429: rate limit excedido.
- 500: error interno.

### 1.4 Validaciones

- `nombreUsuario`: entre 3 y 30 caracteres, solo letras, números,
  punto, guion y guion bajo. No puede comenzar con símbolo.
- `password`: entre 8 y 128 caracteres.
- Rate limit: 5 intentos por minuto por IP.

### 1.5 Endurecimiento

- Validación de `Origin` contra lista blanca (dominios de
  producción + localhost de desarrollo).
- Validación de `X-Appwrite-Project`.
- Rate limit persistente usando `global_Limites` con contador
  atómico (`incrementRowColumn`).

### 1.6 Comportamiento

1. Valida origen y proyecto.
2. Valida nombre y contraseña.
3. Verifica rate limit por IP en `global_Limites`.
4. Verifica duplicado en `global_Perfiles`.
5. Crea usuario en Appwrite Auth con email
   `nombre@elisekai.com`.
6. Crea perfil global en `global_Perfiles`.
7. Crea espacio personal `mirefugio_<userId>` en `global_Espacios`.
8. Asigna label `jugador`.

### 1.7 Scopes de la API key

- `users.write`
- `users.read`
- `tables.write`
- `tables.read`

---

## 2. `asignar-rol`

**URL:** `https://6a6b3c8a003b634646cc.tor.appwrite.run`
**ID:** `6a6b3c88003ac4854d00`
**Versión actual:** `1.8.5`

**Propósito:** Sincronizar labels de Appwrite Auth y membresías de
Teams para un usuario. Soporta canje de tokens de vinculación.
También soporta la acción `crear` para creación segura de filas de
negocio.

### 2.1 Autenticación

- **Requiere JWT de sesión** en el header
  `x-appwrite-user-jwt`. Las peticiones sin JWT son rechazadas
  con 401.
- El usuario autenticado se obtiene con `Account(clientSesion).get()`.
- El `execute access` de la función está restringido a usuarios
  autenticados.

### 2.2 Acción `crear`

Crea una fila de negocio forzando el `espacioId` y validando
membresía al team correspondiente.

    {
      "accion": "crear",
      "coleccion": "mesas | productos | pedidos | ...",
      "datos": { ... },
      "rowId": "string (opcional)"
    }

Respuesta exitosa:

    {
      "exito": true,
      "row": { ...fila creada... }
    }

Validaciones:

- La colección debe estar en la lista blanca de colecciones de
  negocio (`COLECCIONES_NEGOCIO`).
- El usuario autenticado debe ser miembro del team del `espacioId`
  (si la app usa Teams).
- Los permisos de fila se generan automáticamente según la matriz.

### 2.3 Flujo normal de asignación de roles

    {
      "userId": "string",
      "espacioId": "string",
      "roles": ["string"]
    }

Validaciones:

- Se verifica la jerarquía de roles antes de asignar.
  - `master` puede asignar `owner`.
  - `owner` puede asignar `admin` y staff operativos.
  - `admin` puede asignar staff operativos.
- Solo el rol correspondiente al llamador permite asignar.

Respuesta exitosa:

    {
      "success": true
    }

### 2.4 Flujo de vinculación con token

    {
      "token": "string"
    }

Canjea un token de vinculación de staff, asigna labels y
sincroniza membresía del team correspondiente.

### 2.5 Rate limiting por acción

El rate limit usa `global_Limites` con contador atómico
(`incrementRowColumn`). Los límites son:

| Acción | Límite | Ventana |
|--------|--------|---------|
| `crear` | 60 por usuario | 60 s |
| `roles` (asignación) | 10 por usuario | 60 s |
| `vinculacion` (token) | 5 por usuario | 60 s |

Razón de la diferenciación: la creación de filas es una operación
frecuente (una comanda puede generar varias filas); la asignación
de roles es sensible y debe ser lenta por diseño.

### 2.6 Matriz de permisos de fila (v1)

Debe coincidir con `MATRIZ_PERMISOS` en `js/db-appwrite.js`.

| Colección | update | delete |
|-----------|--------|--------|
| `mesas` | admin, mesero, owner | admin, owner |
| `comandas` | admin, chef, barman, owner | admin, owner |
| `pedidos` | admin, mesero, caja, owner | admin, owner |
| `productos` | admin, owner | admin, owner |
| `insumos` | admin, chef, barman, owner | admin, owner |
| `recetas` | admin, chef, barman, owner | admin, owner |
| `proveedores` | admin, owner | admin, owner |
| `entradas` | admin, owner | admin, owner |
| `cartas` | admin, owner | admin, owner |
| `eventos_en_vivo` | admin, artista, owner | admin, owner |
| `staff` | admin, owner | admin, owner |
| `configuracion` | owner | owner |
| `comensales` | admin, mesero, owner | admin, owner |
| `avisos` | admin, mesero, owner | admin, owner |
| `variantes` | admin, owner | admin, owner |

`read` siempre incluye al team del espacio.

### 2.7 Scopes de la API key

- `users.write`
- `users.read`
- `teams.write`
- `teams.read`
- `tables.write`
- `tables.read`

---

## 3. Variables de entorno requeridas

Ambas funciones requieren:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID` (`6a0275cb0022ebf7d30d`)

---

## 4. Colección `global_Limites`

Usada para rate limiting persistente. Columnas:

| Columna | Tipo | Obligatorio | Detalles |
|---------|------|:----------:|----------|
| `clave` | varchar | Sí | 255 |
| `marcaTiempo` | datetime | Sí | — |
| `contador` | integer | No | Default 0 |

Índices:

- `index_clave` (Key)
- `index_marcaTiempo` (Key)

El `contador` se incrementa atómicamente con
`incrementRowColumn`. El `rowId` de cada fila de rate limit sigue
el patrón `lim_<hash>_<ventana>`.

---

## 5. Flujo de despliegue

1. Desplegar la función desde Git (recomendado) o manualmente.
2. Verificar que las variables de entorno estén configuradas.
3. Verificar `execute access`:
   - `registrar-usuario`: público (dominio o `Role.any`).
   - `asignar-rol`: solo `Role.users()`.
4. Verificar scopes mínimos de la API key.
5. Ejecutar los tests correspondientes.

---

## 6. Debugging

- Logs de la función: **Functions > asignar-rol > Executions**.
- Filtros útiles: `status=failed`, `responseStatusCode=401`.
- Para diagnosticar errores de creación segura: subir
  `Logger.setLevel('DEBUG')` en el frontend y revisar la
  consola del navegador. `_crearFilaSegura` registra un
  `Logger.error` con detalles del fallo.

---

## 7. Notas sobre variantes

Las variantes son una extensión del catálogo (`laTaberna_Variantes`)
que no involucra nuevas funciones serverless. El motor de descuento
(`consumirInsumosDeProducto`) aplica `insumos_delta` en modo
best-effort. Los fallos individuales se emiten por el evento
`inventario:descuento_incompleto` (ver `docs/EVENTOS.md`).

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*