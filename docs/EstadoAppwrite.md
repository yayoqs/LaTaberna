# EstadoAppwrite.md — Configuración de Consola y Aislamiento

**Versión:** 2.9.1
**Fecha:** 9 de octubre de 2026
**Propósito:** Reflejar la configuración real de Appwrite Console para el ecosistema Elisekai.

---

## Cambios en v2.9.1 respecto a v2.9.0

- A.75: se corrige la doc de movimientos (§7.1 y §8.16).
  Decisión de Coordinación (2026-10-09 20:00 UTC): owner
  siempre puede update/delete en cualquier colección donde
  admin lo pueda, por jerarquía (master > owner > admin).
  El principio de log append-only se mantiene como regla
  operativa, no como excepción de rol. La doc se alinea con
  el comportamiento real del código. Sin cambios en
  db-appwrite.js ni en asignar-rol/index.js.

## Cambios en v2.9.0 respecto a v2.8.0

- A.74: se agrega la tabla `laTaberna_Movimientos` con 11
  columnas y 4 índices. Row Security activado. Permisos de fila
  update/delete solo admin.
- A.74: se agrega `movimientos` a la matriz declarativa §7.1.
- A.71: se documenta que `db.js` usa el SDK oficial para
  invocar `asignar-rol` (sin `fetch` directo).
- Actualización de versión de `asignar-rol` a v1.9.1.

## Cambios en v2.8.0 respecto a v2.7.0

- A.43: se agrega la columna `alergenos` a `laTaberna_Productos`.
- A.44: rename `laTaberna_Menus` → `laTaberna_Cartas`. La
  colección física fue recreada con el mismo esquema. La clave
  `cartas` reemplaza a `menus` en la matriz de permisos.
- Actualización de versión de `asignar-rol` a v1.8.5.
- Se agrega nota histórica del rename en §17.
- Se actualiza la matriz declarativa §7.1 con `cartas` y
  `variantes`.

## Cambios en v2.7.0 respecto a v2.6.0

- A.32/A.33: se agrega la tabla `laTaberna_Variantes` y la
  columna `variantes_ids` en `laTaberna_Productos`.
- A.22: el wrapper `_crearFilaSegura` registra errores detallados
  en `Logger.error` cuando falla la creación segura.
- A.29: aclaración sobre el comportamiento del default declarativo
  de Appwrite (aplica a filas existentes, no a inserciones nuevas).
- A.12: matriz declarativa de permisos de fila v1 con `owner` en
  update/delete.

## Cambios en v2.6.0 respecto a v2.5.0

- Se agrega la colección `global_Limites` para rate limiting
  persistente con contador atómico.
- Se documentan las versiones actuales de las funciones serverless.
- Se agrega `runtimeSpecification` del endpoint `tor.cloud.appwrite.io`.

---

## 1. Aplicaciones del ecosistema

| App ID | Nombre | Subdominio | Estado | Teams por espacio |
|--------|--------|------------|--------|-------------------|
| `lataberna` | La Taberna | lataberna.281093.xyz | Activa | Sí |
| `mirefugio` | Mi Refugio | mirefugio.281093.xyz | Activa | No |
| `lavitrina` | La Vitrina | lavitrina.281093.xyz | En definición | No |
| `eltaller` | El Taller | eltaller.281093.xyz | Pendiente | No |
| `elretail` | El Retail | elretail.281093.xyz | Pendiente | Sí (futuro) |
| `misbestias` | Mis Bestias | misbestias.281093.xyz | Pendiente | Pendiente |
| `laforja` | La Forja | laforja.281093.xyz* | Nombre provisional | Pendiente |
| `losmuebles` | Los Muebles | losmuebles.281093.xyz* | Nombre provisional | Pendiente |
| `realimenta` | Realimenta | realimenta.281093.xyz | Pendiente | Pendiente |

*Nombres podrían cambiar.*

---

## 2. Roles globales

| Rol | Nivel | Función |
|-----|-------|---------|
| `master` | Plataforma | Control total. No pertenece a un espacio fijo. |
| `jugador` | Ecosistema | Rol base de toda cuenta. En LaTaberna actúa como cliente cuando no pertenece a un Team. |
| `owner` | Espacio | Dueño o responsable principal del espacio. |
| `admin` | Espacio | Administra operación y personal. |
| `chef` | Staff | Cocina. |
| `cocinaAyudante` | Staff | Ayudante de cocina. |
| `barman` | Staff | Barra. |
| `barraAyudante` | Staff | Ayudante de barra. |
| `mesero` | Staff | Salón. |
| `caja` | Staff | Caja. |
| `repartidor` | Staff | Delivery. |
| `artista` | Staff / La Vitrina | Eventos o perfil artístico. |

---

## 3. Jerarquía de asignación

| Rol | Puede asignar |
|-----|----------------|
| `master` | `owner` |
| `owner` | `admin`, staff operativos |
| `admin` | staff operativos |

`jugador` no asigna roles.

**Jerarquía operativa de permisos:** `master > owner > admin > staff`.
Cualquier colección donde `admin` tenga update/delete tiene
por definición también `owner`. Es consecuencia directa de la
jerarquía: owner asigna admins y puede revertir sus actos.

---

## 4. Teams por espacio

Cada espacio operativo con lógica compartida usa un Team de Appwrite.
Los espacios personales no usan Team.

### Teams actuales

| teamId | Nombre visible | Owner | Tipo |
|--------|----------------|-------|------|
| `LaTaberna` | La Taberna | `edquilodrans` | Pub |
| `PubPrueba` | PubPrueba | `jefePub` | Pub |

### Roles internos de Teams

- `owner`
- `admin`
- `chef`
- `cocinaAyudante`
- `barman`
- `barraAyudante`
- `mesero`
- `caja`
- `repartidor`
- `artista`

La creación de roles internos se realiza a través de las membresías.
Se recomienda asignar todos los roles al owner para que Appwrite los reconozca.

---

## 5. Espacios globales

`global_Espacios` es el registro canónico de espacios del ecosistema.

### Columnas

| Columna | Tipo | Obligatorio | Detalles |
|---------|------|:----------:|----------|
| `nombre` | varchar | Sí | Nombre visible |
| `tipo` | enum | No | Subtipo dentro de la app |
| `databaseId` | varchar | No | ID de la base de datos |
| `adminAsignado` | varchar | No | `userId` real de Appwrite |
| `direccion` | varchar | No | Dirección |
| `ciudad` | varchar | No | Ciudad |
| `pais` | varchar | No | País |
| `activo` | boolean | Sí | true/false |
| `app` | varchar | Sí | ID de la app |

> El identificador del espacio es el `$id` de la fila.
> No existe columna `espacioId`.

### Valores de `tipo`

- `pub`
- `restaurant`
- `eventos`
- `hogar`
- `tienda`
- `veterinario`
- `hotel`
- `taller`
- `vitrina`
- `otro`

### Valores de `app`

- `lataberna`
- `mirefugio`
- `lavitrina`
- `eltaller`
- `elretail`
- `misbestias`
- `laforja`
- `losmuebles`
- `realimenta`

---

## 6. Permisos de `global_Espacios`

| Rol | Permisos |
|-----|----------|
| `users` | READ |
| `label:master` | READ, CREATE, UPDATE, DELETE |

No se otorga CREATE, UPDATE ni DELETE a usuarios regulares.

> Nota: `documentSecurity` permanece `false`.
> Se evaluará activar Row Security en una próxima iteración para
> restringir la lectura por tipo de app o membresía.

---

## 7. Row Security y permisos de tablas de negocio

Row Security está activado en todas las tablas `laTaberna_*`,
incluyendo `laTaberna_Configuracion`, `laTaberna_Cartas`,
`laTaberna_Variantes` y `laTaberna_Movimientos`.

Ninguna tabla de negocio otorga CREATE a los teams a nivel de
tabla. Los únicos permisos a nivel de tabla son para
`label:master`:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

Los permisos de lectura, actualización y eliminación para dueños
de local y staff se generan por fila mediante la función
serverless `asignar-rol` (acción `crear`) o `DBAppwrite.crear`.

Ejemplo de permisos de fila generados para `mesas`:

    read("team:PubPrueba")
    update("team:PubPrueba/admin")
    update("team:PubPrueba/mesero")
    update("team:PubPrueba/owner")
    delete("team:PubPrueba/admin")
    delete("team:PubPrueba/owner")

### 7.1 Matriz declarativa (v1)

Definida en `MATRIZ_PERMISOS` en `js/db-appwrite.js` y
`generarPermisosFila` en `asignar-rol/index.js`. Deben coincidir
exactamente. `owner` se añade siempre en update y delete, sin
excepción, por jerarquía de roles.

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
| `movimientos` | admin, owner | admin, owner |

---

## 8. Permisos por tabla

A continuación se documenta la configuración actual. Todas las
tablas de negocio tienen `documentSecurity: true`.

### 8.1 `laTaberna_Productos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

Columnas relevantes para permisos:

- `variantes_ids` (varchar 2000, opcional). JSON array de strings
  con los IDs de variantes asignadas al producto (A.33).
- `alergenos` (varchar 500, opcional). JSON array de strings con
  los alérgenos propios del producto base (A.43). Los valores
  válidos están definidos en `js/dominio/alergenos.js`.

### 8.2 `laTaberna_Pedidos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.3 `laTaberna_Mesas`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.4 `laTaberna_Comandas`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.5 `laTaberna_Insumos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.6 `laTaberna_Recetas`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.7 `laTaberna_Staff`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

`laTaberna_Staff` es solo para datos de RRHH.
No se usa para autenticación.

### 8.8 `laTaberna_Configuracion`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

Los permisos de lectura, actualización y eliminación para dueños
de local se otorgan únicamente a nivel de fila mediante `owner`.

### 8.9 `laTaberna_Eventos_en_vivo`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.10 `laTaberna_Cartas`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

> Colección renombrada desde `laTaberna_Menus` en A.44
> (2026-09-16). El rename físico en Console se hizo recreando la
> tabla con el mismo esquema, dado que Appwrite no permite cambiar
> el `tableId` de una tabla existente.

### 8.11 `laTaberna_Proveedores`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.12 `laTaberna_Entradas`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.13 `laTaberna_Comensales`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.14 `laTaberna_Avisos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

> La fila con `$id` `6aa60564001b64264e04` (espacioId
> `lataberna` en minúsculas) fue eliminada por huérfana en A.47.

### 8.15 `laTaberna_Variantes`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

### 8.16 `laTaberna_Movimientos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

**Row Security activado.** Permisos de fila generados por la
función serverless:

- `read("team:espacio")`
- `update("team:espacio/admin")`
- `update("team:espacio/owner")`
- `delete("team:espacio/admin")`
- `delete("team:espacio/owner")`

Movimientos sigue el patrón general de la matriz §7.1. Owner
está incluido en update y delete por jerarquía de roles
(master > owner > admin).

**Regla operativa (no de permisos):** los movimientos son un
log append-only. No se editan ni se borran en operación
normal. Cualquier intervención excepcional sobre el log
(ajuste de un error, corrección de una referencia) queda a
cargo de `admin` o `owner`, y debe registrarse como una
operación extraordinaria con trazabilidad.

---

## 9. Permisos de tablas globales

### 9.1 `global_Perfiles`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")
    read("users")

`documentSecurity: false`

> Nota: se recomienda activar Row Security en el corto plazo para
> limitar la lectura solo al propio perfil o perfiles públicos.

### 9.2 `global_Puntos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")
    read("users")

`documentSecurity: false`

> Nota: puntos (KYU) son saldos sensibles. Debe restringirse la
> lectura y escritura mediante Row Security y funciones serverless.

### 9.3 `global_Eventos`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")
    read("users")

`documentSecurity: false`

### 9.4 `global_Espacios`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")
    read("users")

`documentSecurity: false`

### 9.5 `global_Limites`

Permisos de tabla:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

`documentSecurity: false`

> Uso exclusivo de las funciones serverless para rate limiting.
> No debe otorgarse lectura a `users`.

---

## 10. Funciones serverless

| Nombre | ID | Versión | URL |
|--------|----|---------|-----|
| `registrar-usuario` | `6a815739002527b8a292` | 1.5.2 | `https://6a81573b000d2f0660d5.tor.appwrite.run` |
| `asignar-rol` | `6a6b3c88003ac4854d00` | 1.9.1 | `https://6a6b3c8a003b634646cc.tor.appwrite.run` |

### `registrar-usuario`

- Crea cuenta en Appwrite Auth.
- Crea perfil global en `global_Perfiles`.
- Crea espacio personal de MiRefugio en `global_Espacios`.
- Asigna label `jugador`.
- No crea Teams ni staff.
- Valida `Origin` y `X-Appwrite-Project`.
- Rate limit persistente en `global_Limites` (5 por minuto por IP).

### `asignar-rol`

- Exige JWT de sesión (`x-appwrite-user-jwt`).
- Actualiza labels globales.
- Sincroniza membresía de Teams si la app los usa.
- Garantiza que el label `jugador` esté siempre presente.
- Soporta canje de token de vinculación.
- Soporta acción `crear` para creación segura de filas de
  negocio.
- Valida jerarquía de roles antes de asignar.
- Valida `Origin` y `X-Appwrite-Project`.
- Rate limit persistente en `global_Limites` con límites
  diferenciados por acción (60/10/5 por minuto).
- **A.65:** rama restringida para jugadores sin Team. Solo
  pueden crear pedidos en estado precarga con origen cliente.
- **A.74:** `COLECCIONES_NEGOCIO` incluye `movimientos`.

`COLECCIONES_NEGOCIO` incluye: `productos`, `pedidos`, `mesas`,
`comandas`, `insumos`, `recetas`, `staff`, `configuracion`,
`eventos_en_vivo`, `cartas`, `proveedores`, `entradas`,
`comensales`, `avisos`, `variantes`, `movimientos`.


Apps con Teams reconocidas actualmente:

- `lataberna`
- `elretail`

---

## 11. Login común

El login no usa `laTaberna_Staff`.

Pasos:

1. Autentica con Appwrite Account usando `nombreUsuario@elisekai.com`.
2. Obtiene `usuarioId` real.
3. Lista Teams del usuario.
4. Lista espacios personales por `adminAsignado`.
5. Si es `master`, lista todos los espacios.
6. Filtra por app actual según espacio activo o subdominio.
7. Define espacio activo y roles.

El rol base global es `jugador`.

---

## 12. Registro y MiRefugio

Al registrar un usuario, se crea automáticamente su espacio personal.

Ejemplo:

    $id: mirefugio_<usuarioId>
    nombre: Mi Refugio de <nombreUsuario>
    app: mirefugio
    tipo: hogar
    adminAsignado: <usuarioId>
    activo: true

El label asignado es `jugador`.

---

## 13. Realtime

Realtime está operativo.

`DBAppwrite` usa canales `tablesdb` y `Channel` helper.
Los eventos se emiten por EventBus según la colección.

Realtime filtra por `espacioId` y soporta `desconectarRealtime()`
y `reconfigurarRealtime()` para el ciclo de vida de sesión.

La colección `laTaberna_Variantes` también está cubierta por
Realtime. Emite `variantes:actualizada` (singular) por la clave
`variantes` en `COLECCIONES`.

---

## 14. Appwrite Terminal

La consola incluye Appwrite Terminal con comandos CLI.

### Comandos útiles de diagnóstico

    appwrite whoami

    appwrite databases list

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes

    appwrite tablesdb list-indexes --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes

    appwrite tablesdb get-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key tipo --raw

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Cartas

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Movimientos

    appwrite teams list

    appwrite users list

    appwrite functions list

Ver `GUIA-APPWRITE-CONSOLE-IV.md` para sintaxis completa y
comandos de modificación de schema.

---

## 15. Estado actual de cuentas

| Usuario | ID | Rol principal | Espacios |
|---------|----|----------------|----------|
| `master` | `Master` | `master` | Acceso global |
| `edquilodrans` | `edquilodrans` | `owner` | `LaTaberna` |
| `jefePub` | `jefePub` | `owner` | `PubPrueba` |

---

## 16. Seguridad y aislamiento

Validaciones realizadas con test de seguridad:

- `jefePub` no puede ver, modificar ni eliminar datos de `LaTaberna`.
- `edquilodrans` no puede ver, modificar ni eliminar datos de `PubPrueba`.
- `DBAppwrite.crear` fuerza el `espacioId` del espacio activo.
- `DBAppwrite.crear` usa creación segura mediante función serverless.
- `baseDeDatos.createRow` directo está bloqueado para teams en
  tablas de negocio.
- Row Security y permisos de tabla evitan fugas entre espacios.
- La función `asignar-rol` exige JWT y valida jerarquía de roles.
- Las funciones serverless validan `Origin` y `X-Appwrite-Project`.
- Rate limiting persistente en `global_Limites`.
- Las filas de `laTaberna_Movimientos` incluyen `owner` en
  update/delete por jerarquía de roles. Verificado por
  `test-A-seguridad.html` §9.

---

## 17. Notas operativas

### 17.1 Comportamiento del default declarativo

El default declarativo de una columna en Appwrite aplica a filas
existentes al momento de agregar la columna. En inserciones
nuevas, un campo opcional no especificado se almacena como
`null`. Para tener un default funcional, la capa que crea la fila
debe enviar el valor explícito.

### 17.2 Logging de creación segura

`DBAppwrite._crearFilaSegura` registra `Logger.error` con
detalles cuando falla la creación segura o la respuesta no es
parseable. Incluye colección, rowId y mensaje de error devuelto
por la función serverless. Beneficia el diagnóstico de cualquier
célula.

### 17.3 ID de configuración por espacio

El `$id` de las filas de `laTaberna_Configuracion` sigue el
patrón `{espacioId}_global`. Documentos legacy con `$id='global'`
siguen accesibles por filtro de espacio.

### 17.4 Sistema de variantes

La tabla `laTaberna_Variantes` implementa el sistema de variantes
documentado en `ARQUITECTURA-VARIANTES.md`. Los `id` de opción
son únicos por `espacioId`. Las opciones usan borrado lógico
(`activo: false`).

### 17.5 Rename laTaberna_Menus → laTaberna_Cartas

Ejecutado el 2026-09-16 en A.44. Appwrite no permite cambiar el
`tableId` de una tabla existente, así que el rename se hizo
eliminando la tabla vieja y creando la nueva con el mismo
esquema. La clave `cartas` reemplaza a `menus` en
`COLECCIONES` (`js/db-appwrite.js`) y en `COLECCIONES_NEGOCIO`
(`asignar-rol/index.js`).

### 17.6 Alérgenos en productos

La columna `alergenos` de `laTaberna_Productos` fue agregada en
A.43 (2026-09-16). Los valores válidos están definidos en el
enum cerrado `js/dominio/alergenos.js`, que es la fuente de
verdad única del ecosistema.

### 17.7 Movimientos: log append-only como regla operativa

La colección `laTaberna_Movimientos` (A.74, 2026-10-08) es un
log append-only. La restricción es operativa, no de rol. Owner
conserva la potestad excepcional de intervenir una fila si la
operación lo requiere, por jerarquía (owner > admin). La
restricción funcional de no editar el log en operación normal
sigue vigente.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*