# GUIA-APPWRITE-CONSOLE-IV.md — Manual interno para equipos Core

**Versión:** 1.3.1
**Fecha:** 15 de septiembre de 2026
**Propósito:** Manual práctico para trabajar con Appwrite Console IV y Appwrite Terminal.

---

## Cambios en v1.3.1 respecto a v1.3.0

- A.23: corregida sintaxis de `--elements` en creación de columnas
  enum. La CLI no parsea valores separados por coma; se debe repetir
  el flag por cada valor. Incluye verificación con `--raw`.

## Cambios en v1.3.0 respecto a v1.2.0

- Sección 7 nueva: Comandos de schema (TablesDB). Documenta
  creación, actualización y eliminación de columnas por CLI.
  Incluye ejemplos reales, estados de columna y buenas prácticas.

---

## 1. Resumen

Appwrite Console IV es una reescritura profunda de la consola. Unificó el portal público y la consola de gestión en una sola aplicación. También incorporó herramientas nuevas como Appwrite Terminal y Appwrite Explorer.

Este documento es un manual para que cualquier persona que trabaje en Core pueda operar sin depender de tutoriales viejos.

No incluye información específica del proyecto. Para eso existen `EstadoAppwrite.md` y `COLECCIONES.md`.

---

## 2. Qué cambió en Console IV

### 2.1 Rutas

- Se eliminó el prefijo `/console`.
- Las rutas ahora son directas, por ejemplo `/projects/<PROJECT_ID>`.
- Las URLs antiguas redirigen automáticamente.

### 2.2 Documentación contextual

- Los documentos oficiales pueden abrirse en un panel lateral.
- Ya no es necesario salir de la pantalla de configuración para consultar una referencia.

### 2.3 Command Center

- Barra de búsqueda global.
- Permite encontrar comandos, recursos y documentación desde un solo lugar.

### 2.4 Appwrite Explorer

- Genera formularios dinámicos desde la especificación OpenAPI del proyecto.
- Permite disparar llamadas HTTP reales contra el backend desde la interfaz.
- Útil para pruebas exploratorias, no reemplaza los tests.

### 2.5 Dominios y DNS

- La consola permite gestionar dominios directamente.
- Incluye generación y renovación automática de certificados TLS.
- Hay plantillas de registros MX/SPF para proveedores externos.

### 2.6 Seguridad de credenciales

- El sistema bloquea que una API key o JWT emita credenciales del mismo tipo.
- Esto reduce el impacto de una posible fuga de tokens.

---

## 3. Appwrite Terminal

La terminal integrada es una de las herramientas más útiles de Console IV.

### Ventajas

- No requiere instalar CLI local.
- Usa automáticamente la sesión y el contexto del proyecto activo.
- Permite diagnosticar y configurar sin salir del navegador.
- Reduce la dependencia de scripts externos.

### Limitaciones

- Algunos comandos fallan por diferencias entre versiones.
- La terminología puede no coincidir con la consola web.
- Algunas operaciones destructivas pueden requerir la consola web.
- No es un shell: no interpreta saltos de línea con `\`. Cada comando va en una sola línea.

---

## 4. Terminología

Existe una diferencia entre lo que muestra la consola y lo que usa la CLI.

| Consola | CLI | Nota |
|---------|-----|------|
| Table | collection | La CLI usa `list-collections` |
| Row | document | La CLI usa `list-documents` |
| Column | attribute | La CLI usa `list-attributes` |
| Database | database | El comando `databases list` se mantiene |

Esta diferencia es normal. Los identificadores de recursos no cambian.

---

## 5. Sintaxis de comandos

La CLI actual usa flags, no argumentos posicionales.

### Forma correcta

    appwrite <servicio> <accion> --parametro valor

### Forma incorrecta

    appwrite <servicio> <accion> valor

Ante la duda:

    appwrite <servicio> <accion> --help

### Regla de una sola línea

La Appwrite Terminal no es un shell. No interpreta `\` para continuar una línea, ni `;` para separar comandos. Cada comando debe ir completo en una sola línea:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false

---

## 6. Comandos básicos

### 6.1 Contexto

    appwrite whoami

Muestra usuario y endpoint actual.

### 6.2 Bases de datos

    appwrite databases list

    appwrite databases get --database-id <DATABASE_ID>

### 6.3 Colecciones

    appwrite databases list-collections --database-id <DATABASE_ID>

    appwrite databases get-collection --database-id <DATABASE_ID> --collection-id <COLLECTION_ID>

Para ver permisos reales:

    appwrite databases get-collection --database-id <DATABASE_ID> --collection-id <COLLECTION_ID> --raw

### 6.4 Documentos

    appwrite databases list-documents --database-id <DATABASE_ID> --collection-id <COLLECTION_ID>

    appwrite databases get-document --database-id <DATABASE_ID> --collection-id <COLLECTION_ID> --document-id <DOCUMENT_ID>

### 6.5 Usuarios

    appwrite users list

    appwrite users get --user-id <USER_ID>

### 6.6 Teams

    appwrite teams list

    appwrite teams get --team-id <TEAM_ID>

### 6.7 Funciones

    appwrite functions list

    appwrite functions get --function-id <FUNCTION_ID>

---

## 7. Comandos de schema (TablesDB)

La CLI de Appwrite permite modificar el schema de una tabla directamente. Los comandos usan el prefijo `tablesdb` (API nueva) y aceptan exclusivamente flags, no argumentos posicionales.

### 7.1 Sintaxis base

Cada comando debe ir en una sola línea. La Appwrite Terminal no es un shell: no interpreta `\` para continuar línea.

Incorrecto (no funciona en la terminal):

    appwrite tablesdb create-boolean-column \
      --database-id <ID> \
      --table-id <ID>

Correcto (una sola línea):

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false

### 7.2 Listar columnas

    appwrite tablesdb list-columns --database-id <DATABASE_ID> --table-id <TABLE_ID>

Para ver los detalles reales (permisos, tipos, defaults):

    appwrite tablesdb get-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <COLUMN_KEY> --raw

### 7.3 Agregar columnas

Los comandos de creación no soportan el flag `--default`. Appwrite asigna el default por tipo:

- Boolean → `false`
- Integer → `0`
- Double → `0`
- Enum → primer elemento
- Varchar/Text → `null`

Boolean:

    appwrite tablesdb create-boolean-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required false

Integer:

    appwrite tablesdb create-integer-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required false

Double (float):

    appwrite tablesdb create-float-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required false

Varchar (string corto):

    appwrite tablesdb create-varchar-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --size 255 --required false

Text:

    appwrite tablesdb create-text-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required false

Enum:

    appwrite tablesdb create-enum-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --elements valor1 --elements valor2 --elements valor3 --required false

Datetime:

    appwrite tablesdb create-datetime-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required false

### 7.3.1 Nota importante sobre --elements

La CLI no parsea valores separados por coma en `--elements`. Tampoco interpreta correctamente strings con formato JSON array.

Incorrecto (queda como un único elemento literal "valor1,valor2"):

    appwrite tablesdb create-enum-column ... --elements valor1,valor2,valor3

Correcto (repetir el flag por cada valor):

    appwrite tablesdb create-enum-column ... --elements valor1 --elements valor2 --elements valor3

Verificar el resultado con:

    appwrite tablesdb get-column --database-id <ID> --table-id <ID> --key <KEY> --raw

El campo `elements` debe mostrar un array con strings separados:

    ['a', 'b', 'c']

Si aparece `['a,b,c']` o `['["a","b"]']`, la columna quedó mal formada y hay que borrarla y recrearla con la sintaxis correcta.

### 7.4 Eliminar columnas

Operación destructiva. Elimina los datos de esa columna en todas las filas. Requiere confirmación previa del Coordinador.

    appwrite tablesdb delete-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <COLUMN_KEY>

El comando responde silenciosamente cuando tiene éxito. Verificar con `list-columns` después.

### 7.5 Actualizar columnas

Cambiar tamaño de varchar:

    appwrite tablesdb update-varchar-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --size 500 --required false

Marcar como requerida:

    appwrite tablesdb update-boolean-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <KEY> --required true

### 7.6 Estados de columna

Toda columna pasa por dos estados:

| Estado | Descripción |
|--------|-------------|
| `processing` | Appwrite está aplicando el cambio en background. |
| `available` | La columna está lista para usarse en queries, escrituras y Realtime. |

Regla importante: no se puede escribir en la tabla mientras alguna de sus columnas esté en estado `processing`. Antes de continuar con el siguiente comando, verificar con `list-columns` que la columna anterior esté `available`.

### 7.7 Ejemplo completo: agregar insumo vendible a laTaberna_Insumos

Secuencia real aplicada el 2026-09-14:

    appwrite tablesdb create-boolean-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Insumos --key vendible --required false

    appwrite tablesdb create-integer-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Insumos --key precio_venta --required false

    appwrite tablesdb create-enum-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Insumos --key destino --elements cocina --elements barra --elements ambos --required false

Verificar:

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Insumos

### 7.8 Ejemplo completo: eliminar campo deprecado

    appwrite tablesdb delete-column --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Productos --key insumoId

Verificar:

    appwrite tablesdb list-columns --database-id 6a0275cb0022ebf7d30d --table-id laTaberna_Productos

### 7.9 Buenas prácticas

1. Ejecutar un solo comando a la vez.
2. Verificar el estado `available` antes de continuar.
3. Actualizar `COLECCIONES.md` después de cada cambio de schema.
4. Coordinar con el Coordinador antes de eliminar columnas.
5. No confiar en el default automático sin documentarlo en `COLECCIONES.md`.
6. Para columnas enum, repetir el flag `--elements` por cada valor.
7. Verificar el resultado con `--raw` antes de declarar la columna lista.

### 7.10 Diferencias con la consola web

| Aspecto | Consola web | CLI |
|---------|-------------|-----|
| Aplicar cambios | Inmediato | Comando + espera `available` |
| Ver defaults | Visible | Solo en `--raw` o `list-columns` |
| Confirmar destructivo | Modal | Sin confirmación (ejecuta directo) |
| Defaults personalizados | Sí, en formulario | No, salvo tipos que los soporten |
| Elementos de enum | Lista visual | Repetir flag `--elements` |

La CLI es más rápida para cambios repetitivos. La consola es preferible para operaciones destructivas (eliminar tabla, cambiar tipos) porque muestra confirmación.

---

## 8. Errores comunes

### 8.1 `list-tables` no existe

Incorrecto:

    appwrite databases list-tables

Correcto:

    appwrite databases list-collections --database-id <DATABASE_ID>

### 8.2 Argumentos posicionales no funcionan

Incorrecto:

    appwrite databases list-collections <DATABASE_ID>

Correcto:

    appwrite databases list-collections --database-id <DATABASE_ID>

### 8.3 Flag `--default` no soportado en creación de columnas

Incorrecto:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false --default false

Correcto:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required false

Appwrite asigna el default por tipo automáticamente.

### 8.4 Error `database_not_found` al eliminar colecciones

Si `delete-collection` devuelve `database_not_found` aunque la base y la colección existan:

- No insistir por CLI.
- Usar la consola web para eliminar.

### 8.5 Error `unknown command "\"` al pegar comandos multilínea

La Appwrite Terminal no acepta continuaciones con `\`. Pegar el comando en una sola línea.

### 8.6 Columna enum mal formada por separador de coma

Si al crear una columna enum se usa `--elements a,b,c`, la CLI la interpreta como un único elemento `"a,b,c"`. Verificar con `get-column --raw` y, si es necesario, borrar y recrear con `--elements` repetido.

---

## 9. Rotación de API keys

Cuando una API key se expone por error, se debe rotar de inmediato.

Procedimiento seguro:

1. Crear una API key nueva con los scopes mínimos para la función o servicio.
2. Actualizar la variable de entorno correspondiente.
3. Verificar que la función o servicio siga operando.
4. Eliminar la API key antigua.
5. Confirmar que no quede referencia a la key anterior.

Importante:

- No compartir API keys por chat ni documentos.
- Usar nombres descriptivos para las keys.
- Revisar los scopes antes de crearlas.

---

## 10. Lecciones aprendidas

### 10.1 Colecciones de configuración y Row Security

Cuando una colección almacena datos por espacio y además tiene `documentSecurity: false`, los permisos de tabla se aplican a todas las filas por igual. Eso puede causar fugas entre espacios.

Solución correcta:

- Activar Row Security.
- No otorgar permisos de lectura/escritura por equipo a nivel de tabla.
- Dejar solo permisos de `master` a nivel de tabla.
- Generar permisos de fila por espacio desde `DBAppwrite.crear`.

Ejemplo para `laTaberna_Configuracion`:

    create("label:master")
    read("label:master")
    update("label:master")
    delete("label:master")

Los dueños de local obtienen acceso mediante permisos de fila generados al crear el documento.

### 10.2 La terminal no es un shell

Al pegar comandos multilínea con `\` la CLI responde `unknown command "\"`. Cada comando va completo en una línea. Esta diferencia es importante para scripts automatizados.

### 10.3 Estados de columna no son instantáneos

Tras crear o modificar una columna, su estado pasa por `processing`. Si se intenta escribir en la tabla antes de que todas las columnas estén `available`, la operación falla. Verificar siempre antes de avanzar.

### 10.4 Separadores de coma en --elements

La CLI no parsea valores separados por coma en `--elements`. Un enum creado con `--elements a,b,c` queda con un único elemento `"a,b,c"`. Repetir el flag por cada valor.

---

## 11. Reglas internas para usar Appwrite Terminal

1. Ejecutar un solo comando a la vez.
2. Usar `--help` antes de asumir nombres.
3. Usar `--raw` para ver permisos reales.
4. No compartir API keys por chat ni documentos.
5. No ejecutar comandos destructivos sin confirmación.
6. Si un comando falla, detenerse y analizar.
7. Registrar en documentación cualquier comportamiento nuevo.
8. Verificar el estado `available` de cada columna antes de avanzar.
9. Cada comando en una sola línea. La terminal no es un shell.
10. Para enum, repetir `--elements` por cada valor.

---

## 12. Recomendaciones para equipos Core

### Antes de trabajar

1. Leer `GUIA-APPWRITE-CONSOLE-IV.md`.
2. Leer `EstadoAppwrite.md`.
3. Leer `COLECCIONES.md`.
4. Verificar el estado real con Appwrite Terminal.
5. No modificar la consola sin registrar el cambio.

### Durante el trabajo

- Preferir la terminal para diagnóstico.
- Usar la consola web para acciones visuales o que fallen por CLI.
- Mantener separados los cambios de estructura y los de datos.
- Ejecutar comandos de schema uno por uno.
- Esperar `available` antes de continuar con el siguiente cambio.

### Después del trabajo

- Actualizar los documentos afectados.
- Ejecutar tests correspondientes.
- Informar al Coordinador si el cambio afecta a otras células.

---

## 13. Documentos relacionados

- `GUIA-APPWRITE-CONSOLE-IV.md`: este manual.
- `EstadoAppwrite.md`: configuración actual del proyecto.
- `COLECCIONES.md`: tablas, columnas e índices.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*