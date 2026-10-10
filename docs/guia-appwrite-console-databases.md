# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-databases.md
# Versión: 1.1.0
# Propósito: Guía resumen de Appwrite Console IV - Databases (TablesDB) para equipos Core.
# Cambios relevantes: Se agrega la sección 13 con comandos CLI de
# schema. Se corrige sintaxis de create-index (--columns en lugar de
# --attributes). Se documenta el comportamiento real del --default y
# los estados processing/available.

---

# Guía de Appwrite Console IV — Databases (TablesDB)

## 1. Introducción

Appwrite Console IV introduce una nueva API de bases de datos
llamada TablesDB, que reemplaza a la antigua API `Databases`. Esta
guía resume los conceptos y métodos esenciales para trabajar con
datos en el ecosistema Elisekai.

### 1.1 Terminología

| Consola (nueva) | CLI / API anterior | Descripción |
|-----------------|--------------------|-------------|
| Table | Collection | Contenedor de filas (rows) |
| Row | Document | Registro individual de datos |
| Column | Attribute | Campo definido en la tabla |

Importante: en el código usamos la nueva API TablesDB con los
términos `table`, `row` y `column`. Los IDs de recursos no cambian.

### 1.2 API oficial

El SDK Web expone la clase `TablesDB`. Los métodos principales son:

- `createRow`, `listRows`, `getRow`, `updateRow`, `deleteRow`
- `upsertRow` (crear o actualizar)
- `incrementRowColumn`, `decrementRowColumn` (operaciones atómicas)
- `createTransaction`, `createOperations`, `updateTransaction`
- `listRows` acepta `queries`, `total`, `ttl`, `transactionId`

---

## 2. Permisos

### 2.1 Niveles de permisos

Appwrite maneja dos niveles:

- Table level (nivel de tabla): aplica a todas las filas.
- Row level (nivel de fila): aplica a filas individuales si Row
  Security está activado.

Regla de oro: un usuario necesita acceso en al menos un nivel
para poder leer/escribir una fila. No es necesario tener ambos.

### 2.2 Row Security

- Por defecto, no se otorgan permisos a nadie.
- Si Row Security está desactivado, los permisos de tabla se
  aplican a todas las filas por igual. Puede causar fugas entre
  espacios.
- Si Row Security está activado, los permisos de fila se generan
  al crear cada fila (mediante `$permissions`).

### 2.3 Recomendaciones para nuestro ecosistema

- Para tablas de negocio (`laTaberna_*`), mantener Row Security
  activado.
- A nivel de tabla, otorgar solo CREATE a los roles/equipos
  correspondientes. No otorgar READ/UPDATE/DELETE global.
- Los permisos READ/UPDATE/DELETE se controlan por fila usando
  `DBAppwrite.crear` (que fuerza `espacioId` y genera
  `$permissions`).

Advertencia: incluso con Row Security, si un usuario tiene CREATE
a nivel de tabla, puede crear una fila con un `espacioId` ajeno
usando el SDK directamente. La validación real debe estar en el
servidor (función serverless). No confiar solo en el frontend.

---

## 3. Operaciones básicas (SDK)

### 3.1 Crear fila (createRow)

    import { Client, ID, TablesDB } from "appwrite";

    const client = new Client()
      .setEndpoint('https://tor.cloud.appwrite.io/v1')
      .setProject('6a025322001f24c57d1d');

    const tablesDB = new TablesDB(client);

    await tablesDB.createRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      rowId: ID.unique(),
      data: {
        numero: '1',
        estado: 'libre',
        espacioId: 'PubPrueba'
      }
    });

Si se proporciona un `rowId` personalizado, debe ser único. Si se
usa `ID.unique()`, Appwrite genera uno automáticamente.

### 3.2 Listar filas (listRows)

    const rows = await tablesDB.listRows({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      queries: [
        Query.equal('espacioId', 'PubPrueba'),
        Query.limit(100)
      ]
    });

Por defecto, `listRows` devuelve 25 filas. Se puede cambiar con
`Query.limit()`.

### 3.3 Obtener una fila (getRow)

    const row = await tablesDB.getRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      rowId: 'PubPrueba_mesa_1'
    });

### 3.4 Actualizar fila (updateRow)

    await tablesDB.updateRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      rowId: 'PubPrueba_mesa_1',
      data: { estado: 'ocupada' }
    });

### 3.5 Eliminar fila (deleteRow)

    await tablesDB.deleteRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      rowId: 'PubPrueba_mesa_1'
    });

### 3.6 Upsert (upsertRow)

Crea si no existe, o actualiza si existe.

    await tablesDB.upsertRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Mesas',
      rowId: 'PubPrueba_mesa_1',
      data: { numero: '1', estado: 'libre', espacioId: 'PubPrueba' }
    });

---

## 4. Consultas (Query)

La clase Query permite construir filtros, orden y paginación. Los
métodos se pasan en el arreglo `queries` de `listRows` o `getRow`.

### 4.1 Operadores de comparación

| Método | Descripción |
|--------|-------------|
| `Query.equal(columna, valor)` | Igual a valor (acepta array para OR) |
| `Query.notEqual(columna, valor)` | Distinto de valor |
| `Query.lessThan(columna, valor)` | Menor que |
| `Query.lessThanEqual(columna, valor)` | Menor o igual |
| `Query.greaterThan(columna, valor)` | Mayor que |
| `Query.greaterThanEqual(columna, valor)` | Mayor o igual |
| `Query.between(columna, inicio, fin)` | Entre dos valores inclusivos |
| `Query.notBetween(columna, inicio, fin)` | Fuera de rango |

Ejemplo:

    Query.equal('categoria', ['platos', 'bebidas']),
    Query.greaterThan('precio', 1000)

### 4.2 Operadores de texto

| Método | Descripción |
|--------|-------------|
| `Query.startsWith(columna, texto)` | Empieza con |
| `Query.endsWith(columna, texto)` | Termina con |
| `Query.contains(columna, texto)` | Contiene (texto y arrays) |
| `Query.notContains(columna, texto)` | No contiene |
| `Query.search(columna, texto)` | Búsqueda full-text |
| `Query.notSearch(columna, texto)` | Negación de búsqueda full-text |

### 4.3 Operadores lógicos

| Método | Descripción |
|--------|-------------|
| `Query.and([...])` | Todas las condiciones |
| `Query.or([...])` | Al menos una condición |

Ejemplo:

    Query.or([
      Query.and([
        Query.equal('categoria', ['platos']),
        Query.lessThan('precio', 2000)
      ]),
      Query.and([
        Query.equal('categoria', ['bebidas']),
        Query.lessThan('precio', 1000)
      ])
    ])

### 4.4 Null checks

| Método | Descripción |
|--------|-------------|
| `Query.isNull(columna)` | Es nulo |
| `Query.isNotNull(columna)` | No es nulo |

### 4.5 Selección de columnas (Query.select)

    Query.select(['nombre', 'precio'])

### 4.6 Geo queries

Para columnas espaciales (`point`, `line`, `polygon`). Incluye
`distanceEqual`, `distanceLessThan`, `intersects`, `overlaps`,
etc. No las usamos actualmente.

---

## 5. Ordenamiento y paginación

### 5.1 Orden (orderAsc, orderDesc)

    Query.orderAsc('nombre'),
    Query.orderDesc('precio')

Se pueden combinar para ordenar por múltiples columnas. Se
recomienda crear índices en las columnas ordenadas.

### 5.2 Orden por secuencia ($sequence)

Todas las filas tienen un campo `$sequence` que incrementa con
cada inserción.

    Query.orderAsc('$sequence')

### 5.3 Paginación offset

    Query.limit(25),
    Query.offset(0),
    Query.offset(25)

Desventajas: lento con tablas grandes, y puede haber
duplicados/omisiones si los datos cambian.

### 5.4 Paginación cursor

    const pagina1 = await tablesDB.listRows({
      databaseId: '...',
      tableId: '...',
      queries: [Query.limit(25)]
    });
    const ultimoId = pagina1.rows[pagina1.rows.length - 1].$id;

    const pagina2 = await tablesDB.listRows({
      databaseId: '...',
      tableId: '...',
      queries: [Query.limit(25), Query.cursorAfter(ultimoId)]
    });

Ventajas: más rápido y consistente en tablas con cambios
frecuentes.

### 5.5 Omitir totales (total: false)

    listRows({ ..., total: false })

### 5.6 Cache de listados (ttl)

    listRows({ ..., ttl: 60 })

Precaución: las escrituras no invalidan el caché. Solo se limpia al
cambiar el esquema o manualmente con `updateTable({ purge: true })`.

---

## 6. Operadores atómicos

Appwrite permite actualizar campos sin leer la fila completa
usando `Operator` dentro de `updateRow`.

### 6.1 Operadores numéricos

- `Operator.increment(valor)`
- `Operator.decrement(valor)`
- `Operator.multiply(factor)`
- `Operator.divide(divisor)`
- `Operator.modulo(valor)`
- `Operator.power(exponente)`

### 6.2 Operadores de arreglos

- `Operator.arrayAppend([...])`
- `Operator.arrayPrepend([...])`
- `Operator.arrayInsert(indice, valor)`
- `Operator.arrayRemove(valor)`
- `Operator.arrayUnique()`
- `Operator.arrayIntersect([...])`
- `Operator.arrayDiff([...])`
- `Operator.arrayFilter(condición, valor)`

### 6.3 Operadores de texto

- `Operator.stringConcat(texto)`
- `Operator.stringReplace(buscar, reemplazo)`

### 6.4 Operadores de fecha

- `Operator.dateAddDays(días)`
- `Operator.dateSubDays(días)`
- `Operator.dateSetNow()`

### 6.5 Operador booleano

- `Operator.toggle()`

### 6.6 Ejemplo

    await tablesDB.updateRow({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Insumos',
      rowId: 'PubPrueba_ins_pan',
      data: {
        stock: Operator.decrement(5),
        etiquetas: Operator.arrayAppend(['bajo_stock'])
      }
    });

---

## 7. Operaciones atómicas numéricas dedicadas

    await tablesDB.incrementRowColumn({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Insumos',
      rowId: 'PubPrueba_ins_pan',
      column: 'stock',
      value: 10,
      max: 1000
    });

    await tablesDB.decrementRowColumn({
      databaseId: '6a0275cb0022ebf7d30d',
      tableId: 'laTaberna_Insumos',
      rowId: 'PubPrueba_ins_pan',
      column: 'stock',
      value: 5,
      min: 0
    });

Aceptan `transactionId` para uso dentro de transacciones.

Uso en el ecosistema: rate limit atómico en `global_Limites` con la
columna `contador`. `incrementRowColumn` devuelve el valor
actualizado, lo que permite verificar el límite sin condición de
carrera.

---

## 8. Relaciones

Tipos: one-to-one, one-to-many, many-to-one, many-to-many.

### 8.1 Carga opt-in

Por defecto, las relaciones no se cargan. Debes usar
`Query.select` para traer los datos relacionados.

    Query.select(['*', 'reviews.*'])
    Query.select(['name', 'reviews.rating'])

### 8.2 Crear filas con relaciones

Nested:

    data: {
      titulo: 'Spiderman',
      reviews: [
        { author: 'Bob', text: 'Great!' }
      ]
    }

Referencia:

    data: {
      titulo: 'Spiderman',
      reviews: ['review_id_1', 'review_id_2']
    }

### 8.3 Eliminación

- `restrict`: impide eliminar si hay relacionados.
- `cascade`: elimina relacionados.
- `set null`: desvincula, conserva relacionados.

### 8.4 Nota para nuestro ecosistema

Usamos `espacioId` como campo manual. No usamos relaciones formales.
Si en el futuro se modelan relaciones, considerar usarlas para
simplificar consultas.

---

## 9. Bulk operations

Las operaciones masivas (`createRows`, `updateRows`, `deleteRows`,
`upsertRows`) solo están disponibles en Server SDKs con API key.

Para operaciones masivas desde frontend, usar funciones
serverless.

---

## 10. Transacciones

### 10.1 Crear transacción

    const tx = await tablesDB.createTransaction();
    const transactionId = tx.$id;

### 10.2 Agregar operaciones

Pasar `transactionId` a cualquier operación de fila.

    await tablesDB.createRow({
      ...,
      transactionId
    });

### 10.3 Operaciones múltiples con createOperations

    await tablesDB.createOperations({
      transactionId,
      operations: [
        {
          action: 'create',
          databaseId: '...',
          tableId: '...',
          rowId: 'id1',
          data: { nombre: 'X' }
        },
        {
          action: 'increment',
          databaseId: '...',
          tableId: '...',
          rowId: 'id2',
          data: { column: 'stock', value: 5 }
        }
      ]
    });

### 10.4 Commit o rollback

    await tablesDB.updateTransaction({
      transactionId,
      commit: true
    });

    await tablesDB.updateTransaction({
      transactionId,
      rollback: true
    });

Límites: Free 100 operaciones, Pro 1,000, Scale 2,500.

Uso en el ecosistema: cierre/cobro de pedido en
`pedido-repository.js` usa transacciones para agrupar la
actualización de pedido y mesa.

---

## 11. Timestamp overrides

Con Server SDK y API key, se pueden establecer `$createdAt` y
`$updatedAt` manualmente.

    data: {
      $createdAt: '2025-08-10T12:34:56.000Z',
      $updatedAt: '2025-08-10T12:34:56.000Z',
      ...otros campos
    }

Útil para migraciones o registros históricos.

---

## 12. Type generation

El CLI puede generar tipos basados en el schema.

    appwrite pull tables
    appwrite types --language ts ./types

No es obligatorio, pero recomendable para equipos con TypeScript.

---

## 13. Comandos de schema (TablesDB CLI)

La CLI de Appwrite permite modificar el schema de una tabla
directamente. Los comandos usan el prefijo `tablesdb` (API nueva)
y aceptan exclusivamente flags, no argumentos posicionales.

### 13.1 Sintaxis base

Cada comando debe ir en una sola línea. La Appwrite Terminal no es
un shell: no interpreta `\` para continuar línea.

Incorrecto:

    appwrite tablesdb create-boolean-column \
      --database-id <ID> \
      --table-id <ID>

Correcto:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false

### 13.2 Listar columnas e índices

    appwrite tablesdb list-columns --database-id <DATABASE_ID> --table-id <TABLE_ID>

    appwrite tablesdb list-indexes --database-id <DATABASE_ID> --table-id <TABLE_ID>

Para ver los detalles reales (permisos, tipos, defaults):

    appwrite tablesdb get-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <COLUMN_KEY> --raw

### 13.3 Crear tabla

    appwrite tablesdb create-table --database-id <DATABASE_ID> --table-id <TABLE_ID> --name <NOMBRE>

Los flags `--permissions` y `--row-security` son opcionales. Por
el escape de comillas en la terminal, se recomienda configurar
estos desde la consola web.

### 13.4 Agregar columnas

Los comandos de creación no soportan el flag `--default`.
Appwrite asigna un default declarativo por tipo, pero ese default
aplica solo a filas existentes al momento de agregar la columna.
En inserciones nuevas, un campo opcional no especificado se
almacena como null.

Para evitar ambigüedad, si el campo necesita un valor por
defecto en nuevas inserciones, se debe enviar explícitamente
desde la capa que crea la fila.

Valores que asigna Appwrite al agregar la columna:

- Boolean → false para filas existentes.
- Integer → 0 para filas existentes.
- Double → 0 para filas existentes.
- Enum → primer elemento para filas existentes.
- Varchar/Text → null para filas existentes.

Boolean:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false

Integer:

    appwrite tablesdb create-integer-column --database-id <ID> --table-id <ID> --key <KEY> --required false

Double (float):

    appwrite tablesdb create-float-column --database-id <ID> --table-id <ID> --key <KEY> --required false

Varchar:

    appwrite tablesdb create-varchar-column --database-id <ID> --table-id <ID> --key <KEY> --size 255 --required false

Text:

    appwrite tablesdb create-text-column --database-id <ID> --table-id <ID> --key <KEY> --required false

Enum:

    appwrite tablesdb create-enum-column --database-id <ID> --table-id <ID> --key <KEY> --elements valor1 --elements valor2 --elements valor3 --required false

Datetime:

    appwrite tablesdb create-datetime-column --database-id <ID> --table-id <ID> --key <KEY> --required false

### 13.5 Nota importante sobre --elements

La CLI no parsea valores separados por coma en `--elements`.
Tampoco interpreta correctamente strings con formato JSON array.

Incorrecto (queda como un único elemento literal "valor1,valor2"):

    appwrite tablesdb create-enum-column ... --elements valor1,valor2,valor3

Correcto (repetir el flag por cada valor):

    appwrite tablesdb create-enum-column ... --elements valor1 --elements valor2 --elements valor3

Verificar el resultado con:

    appwrite tablesdb get-column --database-id <ID> --table-id <ID> --key <KEY> --raw

El campo `elements` debe mostrar un array con strings separados:

    ['a', 'b', 'c']

Si aparece `['a,b,c']` o `['["a","b"]']`, la columna quedó mal
formada y hay que borrarla y recrearla con la sintaxis correcta.

### 13.6 Crear índices

Importante: el flag es `--columns`, no `--attributes`. Aunque la
documentación legacy usa "attributes", la CLI de TablesDB usa
"columns".

Key:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type key --columns <COLUMNA>

Unique:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type unique --columns <COLUMNA>

Fulltext:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type fulltext --columns <COLUMNA>

Índice compuesto (varias columnas):

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type key --columns col1 --columns col2

### 13.7 Eliminar columnas

Operación destructiva. Elimina los datos de esa columna en todas
las filas. Requiere confirmación previa del Coordinador.

    appwrite tablesdb delete-column --database-id <ID> --table-id <ID> --key <COLUMN_KEY>

El comando responde silenciosamente cuando tiene éxito. Verificar
con `list-columns` después.

### 13.8 Actualizar columnas

Cambiar tamaño de varchar:

    appwrite tablesdb update-varchar-column --database-id <ID> --table-id <ID> --key <KEY> --size 500 --required false

Marcar como requerida:

    appwrite tablesdb update-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required true

### 13.9 Estados de columna e índice

Toda columna o índice pasa por dos estados:

| Estado | Descripción |
|--------|-------------|
| `processing` | Appwrite está aplicando el cambio en background. |
| `available` | El recurso está listo para usarse. |

Regla importante: no se puede escribir en la tabla mientras alguna
de sus columnas esté en estado `processing`. Antes de continuar con
el siguiente comando, verificar con `list-columns` que la columna
anterior esté `available`.

Tampoco se pueden crear índices hasta que las columnas que van a
indexar estén `available`.

### 13.10 Ejemplo completo: crear `laTaberna_Variantes`

Secuencia real aplicada el 2026-09-15:

    appwrite tablesdb create-table --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --name laTaberna_Variantes

    appwrite tablesdb create-varchar-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key nombre --size 150 --required true

    appwrite tablesdb create-varchar-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key descripcion --size 500 --required false

    appwrite tablesdb create-enum-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key tipo --elements unica --elements multiple --required true

    appwrite tablesdb create-boolean-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key requerido --required true

    appwrite tablesdb create-integer-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key min_seleccion --required true

    appwrite tablesdb create-integer-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key max_seleccion --required true

    appwrite tablesdb create-varchar-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key opciones --size 10000 --required true

    appwrite tablesdb create-varchar-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key espacioId --size 100 --required false

    appwrite tablesdb create-boolean-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key activo --required true

    appwrite tablesdb create-integer-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key orden --required false

    appwrite tablesdb create-index --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key index_activo --type key --columns activo

    appwrite tablesdb create-index --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes --key index_espacioId --type key --columns espacioId

Verificar:

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes

    appwrite tablesdb list-indexes --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Variantes

### 13.11 Ejemplo completo: eliminar campo deprecado

    appwrite tablesdb delete-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Productos --key insumoId

Verificar:

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Productos

### 13.12 Buenas prácticas

1. Ejecutar un solo comando a la vez.
2. Verificar el estado `available` antes de continuar.
3. Actualizar `COLECCIONES.md` después de cada cambio de schema.
4. Coordinar con el Coordinador antes de eliminar columnas.
5. No confiar en el default declarativo de Appwrite para nuevas
   inserciones. El default solo aplica a filas existentes. Los
   campos opcionales no especificados quedan null.
6. Para columnas enum, repetir el flag `--elements` por cada valor.
7. Verificar el resultado con `--raw` antes de declarar la columna lista.
8. Para índices, usar `--columns`, no `--attributes`.
9. Configurar permisos de tabla y Row Security desde la consola
   web, no por CLI (escape de comillas frágil).

### 13.13 Diferencias con la consola web

| Aspecto | Consola web | CLI |
|---------|-------------|-----|
| Aplicar cambios | Inmediato | Comando + espera available |
| Ver defaults | Visible | Solo en --raw o list-columns |
| Confirmar destructivo | Modal | Sin confirmación (ejecuta directo) |
| Defaults personalizados | Sí, en formulario | No, salvo tipos que los soporten |
| Elementos de enum | Lista visual | Repetir flag --elements |
| Permisos y Row Security | Formulario completo | Escape de comillas complejo |

La CLI es más rápida para cambios repetitivos de columnas e
índices. La consola es preferible para permisos, Row Security y
operaciones destructivas.

---

## 14. Buenas prácticas de seguridad en Elisekai

1. Row Security activado en todas las tablas de negocio.
2. Permisos de tabla mínimos: solo CREATE para equipos/roles
   necesarios.
3. `DBAppwrite.crear` fuerza `espacioId` del local activo y genera
   permisos de fila.
4. No usar directamente `createRow` con `espacioId` manual; siempre
   pasar por la capa segura.
5. Validar permisos en servidor para operaciones sensibles
   (función serverless).
6. Evitar exponer API keys en frontend; solo usar server SDK para
   bulk y operaciones avanzadas.
7. Usar transacciones para cambios que involucren varias tablas y
   requieran consistencia.
8. Usar `incrementRowColumn` para rate limiting atómico en
   `global_Limites`.
9. Configurar permisos y Row Security desde la consola web.

---

## 15. Nota final

Esta guía es un resumen operativo. Si algún equipo necesita
profundizar en un tema específico (permisos avanzados, geo
queries, type generation), puede solicitar el documento oficial
correspondiente al Coordinador de Integración, quien lo derivará
a Core para su envío.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*