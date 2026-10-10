# ARQUITECTURA-VARIANTES.md — Sistema de Variantes y Modificadores

**Versión:** 1.3.0
**Fecha:** 8 de octubre de 2026
**Propósito:** Especificación canónica del sistema de variantes
(modificadores) del ecosistema Elisekai. Documento vinculante para
todas las células que interactúen con productos vendibles.
**Mantenedor:** Coordinador de Integración.

---

## 0. Cambios en v1.3.0 respecto a v1.2.0

- A.63: se agrega la sección 14 "Deudas registradas para
  Fase 2" con la propuesta del agregado `Receta`.
- A.61: se anota que el chequeo de ciclos en `_resolverInsumos`
  ya está resuelto (no es deuda pendiente).

## 0.1 Cambios en v1.2.0 respecto a v1.1.0

- Unicidad de IDs de opción por espacio, no global (O1).
  Resuelve conflicto con multi-tenant detectado por Célula D.
- Documentado el borrado lógico de opciones (O4).
- Invariantes de `tipo` y `min_seleccion` / `max_seleccion` (O7).
- Validación de unidades de `insumos_delta` corre al crear la
  opción y al asignarla a un producto (O3).
- Evento `inventario:descuento_incompleto` a registrar en
  EVENTOS.md por Célula A (O5).
- `kds_colapso_variantes` ubicado en nueva sección Catálogo de
  Configuración (O8).
- Anotado O6: unificación futura de nomenclatura snake/camel.
- Rename `laTaberna_Menus` → `laTaberna_Cartas` confirmado por
  Célula D, pero diferido hasta cerrar las misiones actuales. No
  bloquea variantes.
- Sección 3.4 y 7.6 ajustadas con la ubicación de la
  configuración.

---

## 1. Propósito y alcance

Este documento define el modelo de variantes que reemplaza la
práctica actual de crear un producto independiente por cada
combinación de sabor, tamaño o extra. Adopta el estándar de POS
modernos (Toast, Square, Clover) adaptado a operación de bar y
restaurante.

Aplica a:

- laTaberna (pub/restaurante).
- Cualquier app del ecosistema que ofrezca productos vendibles
  con variantes configurables (El Retail, La Vitrina, etc.).

No aplica a:

- Productos vendibles sin variantes.
- Insumos vendibles (modelo distinto, ver COLECCIONES.md).

---

## 2. Conceptos clave

### 2.1 Producto padre

Fila en laTaberna_Productos que representa al producto vendible
en su forma base. Tiene un precio base, una receta base y, si
aplica, una lista de variantes asociadas.

    Ejemplo: "Michelada" — precio base $5000, receta base con
    cerveza, limón, sal.

### 2.2 Variante (grupo de opciones)

Entidad reutilizable que agrupa opciones coherentes. Una variante
puede estar asociada a varios productos del mismo espacio.

    Ejemplo: variante "Sabor Michelada" con opciones Clásica,
    Cubana, Mixta, Diabla.

### 2.3 Opción

Elemento seleccionable dentro de una variante. Puede tener un
precio delta, sumar o quitar insumos, añadir u ocultar pasos, y
declarar reglas de dependencia entre opciones.

    Ejemplo: opción "Cubana" (+$500), suma jugo de tomate, añade
    paso "Incorporar jugo de tomate y salsa inglesa".

### 2.4 Tres niveles de impacto

Toda opción puede afectar al producto en tres dimensiones
independientes. Una opción puede activar uno, dos o los tres
niveles simultáneamente.

**Nivel 1 — Registro.**

    La opción solo se muestra al cliente y aparece en reportes.
    No altera insumos, ni pasos, ni precio.

    Ejemplo: "Sabor Clásica" — el barman sabe que es la versión
    estándar, pero no cambia nada en la preparación.

**Nivel 2 — Insumos.**

    La opción suma o quita insumos de la receta base del producto.
    Afecta el descuento de stock y los costos.

    Ejemplo: "Cubana" suma jugo de tomate. "Sin sal" quita sal.

**Nivel 3 — Preparación.**

    La opción añade, sustituye u oculta pasos de la receta base.
    Afecta lo que el KDS muestra al cocinero o barman.

    Ejemplo: "Diabla" añade paso "Incorporar salsa picante y
    mezclar". "Sin tomate" oculta el paso "Agregar tomate" en un
    completo.

---

## 3. Modelo de datos

### 3.1 Colección nueva: laTaberna_Variantes

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:-----------:|----------|---------|
| nombre | varchar | Sí | 150 | — |
| descripcion | varchar | No | 500 | — |
| tipo | enum | Sí | `unica`, `multiple` | `unica` |
| requerido | boolean | Sí | Si es obligatorio elegir | `false` |
| min_seleccion | integer | Sí | Mínimo de opciones | `0` |
| max_seleccion | integer | Sí | Máximo de opciones | `1` |
| opciones | varchar | Sí | 10000 — JSON array | `[]` |
| espacioId | varchar | No | 100 | — |
| activo | boolean | Sí | — | `true` |
| orden | integer | No | Orden de aparición | `0` |

Índices:

- `index_espacioId` (Key)
- `index_activo` (Key)

Row Security: activado. Permisos de tabla solo para
`label:master`. Los permisos de fila se generan desde
`DBAppwrite.crear` con `read("team:espacio")`,
`update("team:espacio/admin")`,
`update("team:espacio/owner")`,
`delete("team:espacio/admin")`,
`delete("team:espacio/owner")`.

**Invariantes de tipo y selección (validación al guardar):**

- Si `tipo = 'unica'`: `max_seleccion = 1`.
- Si `tipo = 'unica'` y `requerido = true`: `min_seleccion = 1`.
- Si `tipo = 'unica'` y `requerido = false`: `min_seleccion = 0`.
- Si `tipo = 'multiple'`: `min_seleccion >= 0`,
  `max_seleccion >= min_seleccion`.
- Si `requerido = false`: `min_seleccion = 0`.

La UI de D valida estas invariantes antes de persistir. Un intento
de guardar un estado inconsistente muestra error explícito.

### 3.2 Estructura del campo `opciones`

Array JSON. Cada elemento:

    {
      "id": "sabor_cubana",
      "nombre": "Cubana",
      "descripcion": "Jugo de tomate y salsa inglesa",
      "precio_delta": 500,
      "activo": true,
      "alergenos": [],
      "requiere": [],
      "excluye": ["sabor_clasica"],
      "insumos_delta": [
        {
          "insumoId": "ins_tomate",
          "cantidad": 0.5,
          "accion": "sumar"
        }
      ],
      "pasos_delta": [
        {
          "accion": "sumar",
          "texto": "Incorporar jugo de tomate y salsa inglesa",
          "posicion": "fin"
        }
      ]
    }

**Campos obligatorios por opción:**

- `id`: string único dentro del mismo `espacioId`.
- `nombre`: string.
- `precio_delta`: integer (puede ser negativo).
- `activo`: boolean.

**Campos opcionales por opción:**

- `descripcion`: subtexto visible al cliente y al mesero.
- `alergenos`: array de strings (enum cerrado, ver 8.2).
- `requiere`: array de ids de otras opciones del mismo espacio.
- `excluye`: array de ids de otras opciones del mismo espacio.
- `insumos_delta`: array de ajustes a la receta base.
- `pasos_delta`: array de ajustes a los pasos.

**Borrado lógico de opciones (O4):**

Una opción no se elimina del array; se marca con `activo: false`.
Las opciones inactivas:

- No aparecen en la UI de selección del mesero ni del cliente.
- Se mantienen en items ya guardados (snapshot intencional).
- Se muestran al admin en el editor con marca visual (gris).
- El admin puede reactivarlas en cualquier momento.

Los `id` de opciones inactivas siguen reservados. No se permite
reutilizarlos para una nueva opción, evitando ambigüedad en
snapshots históricos.

### 3.2.1 Reglas de `pasos_delta`

Cada elemento del array:

    {
      "accion": "sumar" | "ocultar" | "sustituir",
      "texto": "texto del paso",
      "pasoRef": "id o índice del paso base",
      "posicion": "inicio" | "fin" | "despues_de"
    }

**Acciones:**

- `sumar`: añade un paso. Requiere `texto` y `posicion`.
- `ocultar`: oculta un paso base. Requiere `pasoRef`.
- `sustituir`: reemplaza un paso base por otro. Requiere
  `pasoRef` y `texto`. **Fase 2.**

**Posicionamiento del paso sumado:**

- `inicio`: antes de todos los pasos base.
- `fin`: después de todos los pasos base. **Default.**
- `despues_de`: después de un paso específico. Requiere
  `pasoRef`.

Sin `posicion`, se asume `fin`.

### 3.2.2 Reglas de `insumos_delta`

Cada elemento del array:

    {
      "insumoId": "ins_tomate",
      "cantidad": 0.5,
      "accion": "sumar" | "quitar" | "multiplicar" | "sustituir",
      "factor": 1.5,
      "aplica_a": ["ins_x", "ins_y"],
      "insumoId_original": "ins_leche_vaca",
      "insumoId_sustituto": "ins_leche_almendras"
    }

**Acciones:**

- `sumar`: suma `cantidad` al insumo base. Requiere `insumoId` y
  `cantidad`.
- `quitar`: resta `cantidad` al insumo base. Requiere `insumoId`
  y `cantidad`. Si la resta deja la cantidad en 0 o negativa, ese
  insumo no se descuenta.
- `multiplicar`: multiplica por `factor` los insumos indicados en
  `aplica_a`. Si `aplica_a` está vacío o ausente, aplica a todos
  los insumos de la receta base. **Fase 2.**
- `sustituir`: reemplaza `insumoId_original` por
  `insumoId_sustituto`. **Fase 2.**

**Regla de unidades:** el delta debe declarar la misma unidad que
el insumo base. La validación corre en dos momentos:

1. **Al crear la opción en el catálogo maestro:** la UI verifica
   que las unidades coincidan con el insumo base referenciado.
2. **Al asignar la variante a un producto:** si el insumo base
   cambió de unidad después de crear la opción, la UI muestra
   advertencia al admin y le pide confirmar o corregir el delta.
   No se bloquea el guardado, pero la advertencia queda
   registrada.

Sin conversión silenciosa de unidades. Si en el futuro se
requiere conversión explícita, se maneja con un factor declarado
en el delta.

**Limitación conocida Fase 1:** un delta no puede depender del
contexto de otra opción. "Grande duplica proteína pero no
guarnición" debe escribirse como múltiples deltas individuales.
La acción `multiplicar` de Fase 2 permitirá resolverlo con
granularidad.

### 3.2.3 Unicidad de IDs de opción

Los `id` de opción son únicos **dentro del mismo `espacioId`**.

**Motivo:** la colección `laTaberna_Variantes` es multi-tenant
(campo `espacioId`). Cada espacio (LaTaberna, PubPrueba,
El Retail, La Vitrina) mantiene su propio catálogo. Imponer
unicidad global impediría que dos espacios definieran
independientemente una opción `sin_sal` con semántica distinta.

**Alcance de la unicidad:** dentro de un mismo espacio, todas
las opciones de todas las variantes comparten el espacio de
nombres. Si dos variantes del mismo espacio quieren una opción
conceptualmente similar, deben compartir el mismo `id`.

**Reglas `requiere` y `excluye`:** solo pueden referenciar
opciones del mismo `espacioId`. La UI de D valida esto al
guardar.

**Reserva de ids:** los `id` de opciones inactivas siguen
reservados. No se permite reutilizarlos en una opción nueva del
mismo espacio.

**Futuro:** si el ecosistema requiere compartir un catálogo de
variantes entre espacios, se evalúa como caso específico con
prefijos explícitos (`{espacioId}_{opcionId}`). No entra en
Fase 1.

### 3.3 Ajustes a laTaberna_Productos

Agregar columna:

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:-----------:|----------|---------|
| variantes_ids | varchar | No | 2000 — JSON array de strings (Fase 1) | `[]` |

El orden del array define el orden de aparición de las variantes
en la UI.

**Fase 2:** la columna se migra a `variantes_asignadas` con
estructura extendida:

    [
      {
        "varianteId": "sabor_michelada",
        "orden": 1,
        "overrides": {
          "opciones": [
            {
              "id": "sabor_cubana",
              "insumos_delta": [ ... ],
              "pasos_delta": [ ... ]
            }
          ]
        }
      }
    ]

Migración trivial: `["a","b"]` se convierte en
`[{"varianteId":"a","orden":0},{"varianteId":"b","orden":1}]`.
Compatibilidad hacia atrás: si el campo es array de strings, se
trata como lista de ids sin overrides.

### 3.4 Ajustes a laTaberna_Configuracion

Nueva clave permitida, ubicada en la sección **Catálogo** de la
vista de Configuración:

- `kds_colapso_variantes`: integer, default 3. Cantidad mínima
  de variantes seleccionadas con solo impacto estético (nivel
  registro puro) para que el KDS las colapse detrás de un botón
  "Ver +N opciones".

D expone esta clave en la nueva sección Catálogo. La sección
agrupará futuras claves del catálogo (variantes, categorías,
etc.). B2 lee la clave al pintar el ticket.

---

## 4. Autoría en dos niveles

### 4.1 Catálogo maestro

**Dueño:** Célula D (Administración).

Admin crea y mantiene el catálogo de variantes reutilizables
("Sabor Michelada", "Tamaños Cóctel", "Extras Barra"). Define
opciones base, precios delta, insumos delta, pasos delta,
alergenos y reglas `requiere` / `excluye`.

**Ubicación UI:** Diseñador de Cartas (Célula D).

**Validaciones en la UI:**

- ID único dentro del `espacioId`.
- Unidades de `insumos_delta` coinciden con insumo base al crear
  la opción y al asignarla a un producto.
- `pasoRef` apunta a paso existente en la receta base al asignar
  al producto.
- `requiere` y `excluye` referencian ids existentes en el mismo
  `espacioId`.
- Invariantes de `tipo` y `min/max_seleccion`.

### 4.2 Asignación a productos

**Dueño:** Célula D (Administración).

Admin asigna variantes a productos desde el Diseñador de Cartas.
Define qué variantes aplican a cada producto y en qué orden.

**Vista de B2:** B2 puede ver la asignación desde la vista de
Recetas, pero no editarla. Si un chef necesita cambiar algo,
solicita al admin. Esto respeta la separación: admin arma la
carta, chef arma recetas.

### 4.3 Override de insumos y pasos por producto

**Fase 2.**

Cuando una variante se aplica a varios productos con insumos
distintos, el admin podrá sobreescribir `insumos_delta` y
`pasos_delta` a nivel de asignación (producto × variante).

Ejemplo: "Cubana" aplica a Michelada (suma jugo de tomate) y a
Bloody Mary (suma jugo de tomate y vodka). El override permite
que la misma variante tenga impacto distinto por producto sin
duplicar la variante.

En Fase 1, `producto.variantes_ids` es un array simple de ids.

---

## 5. Item del pedido

Cuando un producto con variantes se agrega a un pedido, el item
resultante debe capturar la selección completa. Estructura:

    {
      "tipo": "producto",
      "prodId": "prod_michelada",
      "nombre": "Michelada",
      "precio_base": 5000,
      "opciones": [
        {
          "varianteId": "sabor_michelada",
          "varianteNombre": "Sabor",
          "opcionId": "sabor_cubana",
          "opcionNombre": "Cubana",
          "precio_delta": 500,
          "alergenos": [],
          "insumos_delta": [ ... ],
          "pasos_delta": [ ... ]
        },
        {
          "varianteId": "tamano_coctel",
          "varianteNombre": "Tamaño",
          "opcionId": "tamano_grande",
          "opcionNombre": "Grande",
          "precio_delta": 1500,
          "alergenos": [],
          "insumos_delta": [ ... ],
          "pasos_delta": [ ... ]
        }
      ],
      "alergias_manuales": [],
      "precio_unitario": 7000,
      "precio_total": 7000,
      "qty": 1,
      "obs": ""
    }

**Notas:**

- `precio_unitario` = `precio_base` + suma de `precio_delta`.
- Los datos de la opción se copian al item en el momento de
  agregar (snapshot). Si el admin cambia el precio delta después,
  el item ya guardado no se modifica.
- `alergias_manuales` es un campo **distinto** de `alergenos`.
  Contiene alergias que el mesero marca directamente en el item
  cuando el cliente le informa algo que no viene de ninguna
  variante.
- El item mantiene compatibilidad con el modelo anterior: si no
  hay `opciones`, `tipo='producto'` y `precio_unitario` =
  `precio_base`.

---

## 6. Descuento de stock

Al enviar la comanda, el sistema debe aplicar el descuento
considerando la receta base y las variantes seleccionadas.

### 6.1 Modo Fase 1 — Best-effort con logging

**Paso 1 — Descontar receta base.**

Resolver insumos de la receta del producto, como hoy. Esto
incluye sub-recetas anidadas.

**Paso 2 — Aplicar insumos_delta de cada opción seleccionada.**

Para cada `insumo_delta`:

- `sumar`: agregar la cantidad a la lista de insumos a descontar.
- `quitar`: restar la cantidad de la lista. Si la resta deja la
  cantidad en 0 o negativa, ese insumo no se descuenta.

Las acciones `multiplicar` y `sustituir` se ignoran en Fase 1 con
warning en Logger.

**Paso 3 — Límites de seguridad.**

Si el descuento resultante es negativo, se recorta a 0. Nunca se
descuenta stock negativo.

**Paso 4 — Aplicación y manejo de fallos.**

Las operaciones atómicas de Appwrite se ejecutan secuencialmente
para cada insumo. Si una operación falla:

- Se registra en Logger con nivel ERROR: insumoId, cantidad
  esperada, colección, rowId.
- Se incrementa un contador interno de fallos del envío.
- Se continúa con el siguiente insumo.
- Al final del envío, si hubo fallos, se emite
  `inventario:descuento_incompleto` con el resumen
  `{ insumosFallidos, insumosOk, total }`.

**Rollback manual:**

Si el descuento falla antes de crear las comandas, se revierten
los cambios aplicados usando `incrementarCampo` sobre los insumos
modificados. Si el rollback también falla, se registra en Logger
con nivel ERROR y se emite `inventario:rollback_fallido`.

### 6.2 Modo Fase 2 — Transacciones

Se migra a `crearTransaccion` de DBAppwrite. Todas las
operaciones de descuento se agrupan en una sola transacción. Si
alguna falla, Appwrite hace rollback automático.

**Motivo de la secuencia:** las transacciones de Appwrite tienen
límite de operaciones (100 en plan free, 1000+ en planes pagos).
Consolidar primero el flujo base antes de invertir en
transacciones.

### 6.3 Precio vs costo

El `precio_delta` afecta al cliente. Los `insumos_delta` afectan
al costo interno. Son sistemas independientes.

El admin que escribe `+$500` en "Cubana" no obtiene
automáticamente el costo real del jugo de tomate. Reportes de
venta (Célula B3) y reportes de costeo (Célula D) son sistemas
separados. Es responsabilidad del admin mantener coherencia entre
ambos si le interesa el margen real.

---

## 7. KDS — Visualización

### 7.1 Estructura del ticket

El ticket del KDS muestra **solo los badges resumidos**. No
muestra la lista de pasos completa. Los pasos combinados se ven
en el **modal de toque largo** sobre el item.

Cada item con variantes se muestra así:

    Michelada                     [$7000]
    ⊕ Sabor:    Cubana
    ⊕ Tamaño:   Grande
    ⊕ Extras:   Escarchado

### 7.2 Iconografía

| Icono | Significado | Color |
|-------|-------------|-------|
| ⊕ +insumo | Suma insumo | Ámbar |
| ⊖ -insumo | Quita insumo | Ámbar oscuro |
| ⚙ +paso | Añade paso de preparación | Ámbar |
| ⚠ alergia | Contiene alérgeno | Rojo |
| ⊘ sin | Modificador operativo (Fase 3) | Gris |

### 7.3 Prioridad visual cuando coinciden tipos

- **Rojo** (alergia) siempre visible. Nunca se oculta ni se
  colapsa.
- **Ámbar** (insumo o paso) al lado del rojo si coinciden.
- **Gris** (solo registro) se colapsa tras "Ver +N" si la
  cantidad supera `kds_colapso_variantes`.

Ejemplo de item con alergia y paso extra:

    Michelada                     [$7000]
    ⚠ Sabor:    Cubana
    ⚙ Tamaño:   Grande
    ⊕ Extras:   Escarchado

### 7.4 Accesibilidad

El color **nunca** es el único indicador. Siempre se muestra
texto abreviado (`+insumo`, `-insumo`, `+paso`, `alergia`)
además del color. Requisito WCAG AA.

### 7.5 Pasos combinados (modal de toque largo)

El modal muestra los pasos resultantes de:

    receta base
    + pasos_delta con accion='sumar' insertados en su posicion
    - pasos_delta con accion='ocultar'
    ~ pasos_delta con accion='sustituir' (Fase 2)

Los pasos añadidos por variante se marcan con borde izquierdo
ámbar y texto de acento.

Ejemplo:

    1. Llenar vaso con hielo
    2. Agregar cerveza
    ▎3. Incorporar jugo de tomate y salsa inglesa (Cubana)
    4. Agregar limón y sal
    5. Servir

### 7.6 Colapso de opciones estéticas

Si un item trae más de `kds_colapso_variantes` opciones que solo
tienen impacto de registro (sin `insumos_delta` ni `pasos_delta`
ni `alergenos`), el KDS las colapsa tras un botón "Ver +N
opciones". El valor por defecto es 3, configurable en
`laTaberna_Configuracion` sección Catálogo.

### 7.7 Items sin variantes

Se muestran igual que hoy. Sin cambios.

---

## 8. Casos borde contemplados

### 8.1 Reglas requiere / excluye

Las opciones pueden declarar dependencias entre sí. La UI debe
respetarlas y ofrecer feedback claro.

Ejemplos:

- "Cubana" requiere que el tamaño sea "Normal" o "Grande". Se
  declara en la opción Cubana con
  `requiere: ["tamano_normal", "tamano_grande"]`.
- "Sin sal" excluye "Escarchado". Se declara en ambas opciones
  con `excluye`.

La UI de B1 y C deshabilita visualmente las opciones excluidas y
marca las requeridas. La validación se ejecuta antes de agregar
el item al pedido.

Las referencias solo aplican al mismo `espacioId`. La UI valida
esto al guardar.

### 8.2 Alergenos

**Enum cerrado del ecosistema:**

- `mani`
- `gluten`
- `lactosa`
- `mariscos`
- `huevo`
- `soya`
- `frutos_secos`
- `pescado`
- `otro`

**Dos campos distintos que no deben mezclarse:**

- `alergenos` (plural): array en la opción y en el producto base.
  Viene del catálogo.
- `alergias_manuales` (array): campo **del item del pedido**. El
  mesero lo llena cuando el cliente le informa una alergia que no
  viene de ninguna variante.

**Comportamiento:**

- El KDS combina ambos para el resaltado rojo.
- El campo `alergias_manuales` se persiste en el pedido y viaja
  con el item.
- B1 y C nunca deben mezclar los conceptos. Son dos controles
  separados en la UI.

Si un local necesita un alérgeno específico que no está en el
enum, se extiende el enum a nivel ecosistema (Célula A). No se
permite texto libre por riesgo de inconsistencia.

### 8.3 Destino override

**Fase 2.**

Algunas opciones podrían cambiar el destino del item (ej.
"hamburguesa vegana" va a cocina distinta). Se declara a nivel
opción con `destino_override`.

### 8.4 Tiempo extra de preparación

**Fase 2.**

Opciones con `tiempo_extra` (en minutos). Afecta el tiempo
estimado del KDS y su clasificación de urgencia.

### 8.5 Stock propio de opciones

**Fase 2.**

Opciones como "Escarchado" pueden consumir un insumo con stock
limitado. La UI deshabilita la opción si no hay stock. Se declara
a nivel opción con `consume_stock: true` y los `insumos_delta`
correspondientes.

### 8.6 Modificador operativo global

**Fase 3.**

Reglas operativas durante un turno ("sin hielo por falta en
barra"). No es variante por producto. Se evaluará como mecanismo
separado. Se identifica visualmente con `⊘ sin`.

### 8.7 Reapertura de item con variantes

**Fase 1:** no permitido.

Si el mesero ya envió una comanda y necesita cambiar las opciones
de un item, debe **eliminarlo** y **agregarlo de nuevo**. La
eliminación revierte el descuento aplicado. El nuevo agregado
aplica el descuento nuevo.

**Fase 2:** se evalúa si conviene implementar reapertura formal
con botón "Actualizar insumos" que revierta y reaplique.

Motivo de la secuencia: la reapertura requiere revertir
descuentos y re-aplicar, con notificación al KDS. Complejidad que
no vale la pena en Fase 1. Es el mismo criterio que aplican
Square y Toast.

### 8.8 Unidades en insumos_delta

El delta debe declarar la misma unidad que el insumo base. La
validación corre:

- Al crear la opción en el catálogo maestro.
- Al asignar la variante a un producto, con advertencia si el
  insumo base cambió de unidad después.

Sin conversión automática silenciosa.

### 8.9 Orden de variantes en la UI

`variantes_ids` define el orden. En Fase 1, el admin lo define
escribiendo el array en el Diseñador de Cartas. En Fase 2, se
implementa UI de drag-and-drop.

### 8.10 Desactivar variante en producto específico

**Fase 2.**

Si el admin quiere que un producto no ofrezca ciertas opciones
de una variante asignada (sin quitar la variante completa), se
declara con `opciones_deshabilitadas: []` a nivel asignación.
Diferido a Fase 2.

---

## 9. Alcance por fases

### 9.1 Fase 1 — Base funcional completa

**Incluido:**

- Colección `laTaberna_Variantes`.
- Campo `variantes_ids` en `laTaberna_Productos` (array de
  strings).
- Tres niveles de impacto (registro, insumos, preparación) con
  `sumar` y `quitar`/`ocultar`.
- Autoría en dos niveles: catálogo maestro (D) y asignación (D).
  B2 ve, no edita.
- Item del pedido con opciones snapshot.
- Campo `alergias_manuales` en el item.
- Descuento de stock best-effort con logging y contador de
  fallos.
- KDS con badges resumidos y modal de pasos completos.
- Reglas `requiere` / `excluye`.
- Alergenos en opciones y producto.
- Configuración `kds_colapso_variantes` en sección Catálogo.
- Iconografía y accesibilidad WCAG AA.
- Borrado lógico de opciones.
- Invariantes de `tipo` y `min/max_seleccion`.
- Unicidad de IDs por espacio.
- Sin override por producto.
- Sin reapertura formal.
- Sin `multiplicar` ni `sustituir` (esquema los acepta, motor
  los ignora con warning).

### 9.2 Fase 2 — Extensión

**Incluido:**

- `multiplicar` y `sustituir` en `insumos_delta`.
- `sustituir` en `pasos_delta`.
- Override de insumos y pasos por producto
  (`variantes_asignadas`).
- Transacciones para descuento atómico.
- Reapertura formal de item con variantes.
- `destino_override`.
- `tiempo_extra` de preparación.
- Stock propio de opciones.
- UI de reordenamiento de variantes con drag-and-drop.
- `opciones_deshabilitadas` por producto.
- Rename `laTaberna_Menus` → `laTaberna_Cartas` (diferido desde
  decisión previa).

### 9.3 Fase 3 — Refinamiento

**Incluido:**

- Modificador operativo global.
- Reportes B3 desglosados por opción.
- Analítica de combinaciones más pedidas.
- Cualquier caso borde que aparezca en uso real.

### 9.4 Fase transversal — Unificación de nomenclatura

Anotado O6: existe convivencia de `snake_case` (columnas de
Appwrite) y `camelCase` (campos de objetos JS). El proyecto
adopta el estándar actual por convención técnica. Se evaluará una
unificación hacia `camelCase` en una fase transversal posterior,
con auditoría completa de esquema y código.

---

## 10. Impacto por célula

### 10.1 Célula A (Core) — Fase 1

- Crear colección `laTaberna_Variantes` en Appwrite Console.
- Agregar columna `variantes_ids` a `laTaberna_Productos`.
- Implementar `_normalizarVariante`.
- Extender `_normalizarProducto` para respetar `variantes_ids`.
- Extender `consumirInsumosDeProducto` para aplicar
  `insumos_delta` con `sumar` y `quitar`.
- Implementar contador de fallos y evento
  `inventario:descuento_incompleto`.
- Registrar `inventario:descuento_incompleto` en
  `docs/EVENTOS.md`.
- Documentar en `docs/COLECCIONES.md`.

### 10.2 Célula D (Administración) — Fase 1

- Editor de variantes (catálogo maestro):
  - Crear, editar, desactivar variantes (borrado lógico).
  - Gestionar opciones con precios, insumos, pasos, alergenos
    y reglas.
  - Validar unicidad de IDs por espacio.
  - Validar unidades de `insumos_delta` al crear y al asignar.
  - Validar invariantes de `tipo` y `min/max_seleccion`.
- Asignación de variantes a productos desde el Diseñador de
  Cartas. Dos opciones a decidir por D:
  - Modo Variantes (tabla producto × variante con edición
    inline del orden).
  - O panel lateral por ficha seleccionada.
- Exponer `kds_colapso_variantes` en la nueva sección Catálogo
  de Configuración.
- UI de reordenamiento simple (sin drag-and-drop en Fase 1).

### 10.3 Célula B1 (Mesero) — Fase 1

- Carta del mesero muestra productos con variantes.
- Modal de selección de opciones al tocar producto con variantes:
  - Subtexto de ingredientes.
  - Validación de reglas `requiere` / `excluye`.
  - Cálculo del `precio_unitario` en tiempo real.
- Control separado para `alergias_manuales`.
- Item del pedido con estructura de `opciones`.

### 10.4 Célula B2 (Cocina y Barra) — Fase 1

- KDS con badges resumidos por item.
- Iconografía según 7.2.
- Modal de toque largo con pasos combinados.
- Lectura de `kds_colapso_variantes`.

### 10.5 Célula B3 (Caja) — Fase 1

- Ticket muestra opciones bajo el nombre del producto.
- Reportes agrupados por producto base en Fase 1.
- Desglose por opción en Fase 3.

### 10.6 Célula C (Cliente) — Fase 1

- Menú digital muestra productos con variantes.
- Modal de selección con subtexto.
- Mismo flujo que B1 adaptado al cliente.
- Control separado para alergias del cliente.

### 10.7 Célula E (Infraestructura) — Fase 1

- Reducer para `variantes` en Store.
- Ajustes al reducer de pedidos para aceptar `opciones` en
  items.
- Ajustes al reducer para el campo `alergias_manuales`.

---

## 11. Decisiones registradas

- Modelo POS moderno con producto padre + variantes
  reutilizables.
- Nombre de la colección: `laTaberna_Variantes`.
- Reutilización: sí, catálogo compartido dentro del mismo
  espacio.
- Unicidad de IDs de opción: **por espacio**, no global.
- Autoría: dos niveles (D catálogo, D asignación). B2 ve, no
  edita.
- Los tres niveles de impacto entran en Fase 1.
- Override por producto: Fase 2.
- `multiplicar` y `sustituir` en insumos: Fase 2 (esquema
  aceptado desde Fase 1).
- `sustituir` en pasos: Fase 2 (esquema aceptado desde Fase 1).
- Atomicidad: best-effort con logging en Fase 1, transacciones
  en Fase 2.
- Reapertura de item: no permitida en Fase 1, evaluar en Fase 2.
- `variantes_ids` array de strings en Fase 1, estructura
  extendida en Fase 2.
- Prioridad visual KDS: rojo > ámbar > gris.
- Accesibilidad: texto abreviado + color, nunca solo color.
- IDs únicos por espacio.
- `alergias_manuales` como campo distinto de `alergenos`.
- Configuración `kds_colapso_variantes` en sección Catálogo de
  Configuración.
- Unidades de `insumos_delta` deben coincidir con receta base.
- `precio_delta` ≠ costo. Sistemas separados.
- Ticket KDS muestra solo badges. Pasos completos en modal.
- Posicionamiento de pasos con `inicio` / `fin` / `despues_de`.
- Borrado lógico de opciones. No se eliminan físicamente.
- Invariantes de `tipo` y `min/max_seleccion` validadas al
  guardar.
- Rename `laTaberna_Menus` → `laTaberna_Cartas` diferido hasta
  cerrar misiones actuales, no bloquea variantes.
- Nomenclatura snake/camel: se mantiene por ahora, unificación
  en fase transversal posterior.

---

## 12. Glosario

- **Producto padre:** fila base del producto vendible.
- **Variante:** grupo reutilizable de opciones.
- **Opción:** elemento seleccionable dentro de una variante.
- **Snapshot:** copia del estado de una opción al momento de
  agregarla al pedido. Los cambios posteriores al catálogo no
  afectan al item ya guardado.
- **Borrado lógico:** marcar `activo: false` en lugar de
  eliminar. Reserva el id.
- **insumos_delta:** ajustes a la receta base por variante.
- **pasos_delta:** ajustes a los pasos de preparación por
  variante.
- **alergenos:** campo de la opción o producto.
- **alergias_manuales:** campo del item, distinto de los
  anteriores.
- **kds_colapso_variantes:** configuración de colapso visual.
- **best-effort:** modo de descuento sin transacciones, con
  logging detallado.
- **espacioId:** identificador del espacio (LaTaberna, PubPrueba,
  etc.) que delimita el catálogo y la unicidad de IDs.

---

## 13. Referencias

- `docs/COLECCIONES.md` — esquema de la base de datos.
- `docs/EVENTOS.md` — eventos del sistema.
- `docs/EstadoAppwrite.md` — configuración real de Appwrite
  Console.
- `docs/GUIA-APPWRITE-CONSOLE-IV.md` — manual de operación de la
  consola.
- `docs/PROPIEDAD.md` — mapa de propiedad de archivos.

---

## 14. Deudas registradas para Fase 2

Esta sección lista las decisiones diferidas que impactan al
sistema de variantes o a sus cimientos. No bloquean la Fase 1.
Se agendarán cuando cierren las misiones actuales.

### 14.1 Agregado `Receta` como objeto de dominio

**Estado:** diferido a Fase 2. Acordado con Coordinación
(2026-10-08).

**Contexto:** hoy las recetas viven como objetos planos. Se
normalizan en `db-inventario._normalizarReceta` y se usan en
`_resolverInsumos`, `_procesarRecetas`, `guardarReceta`,
Célula B2 (recetario) y Célula D (editor). No existe un agregado
de dominio análogo a `PedidoAgregado`, `Delivery`, `Cantidad`,
`Dinero`, `Ingrediente` o `Resultado`.

**Propuesta:** crear `js/dominio/receta.js` como agregado con:

- `Receta.expandirInsumos(cantidad, cacheRecetas,
  cacheInsumos)`: devuelve la lista plana de insumos base
  necesarios para producir `cantidad` unidades, resolviendo
  sub-recetas recursivamente.
- `Receta.costoTotal(cacheInsumos)`: costo de producir una
  unidad, sumando insumos × costo unitario.
- `Receta.esSubrecetaDeOtra(otra, cacheRecetas)`: detecta ciclos
  directos o transitivos.
- Validación de invariantes en constructor (productoId
  obligatorio, ingredientes array, cada ingrediente con tipo
  válido, cantidad > 0, es_intermedio coherente con nivel).
- `Receta.toJSON()` para serialización consistente.

**Beneficios:**

- Coherencia arquitectónica (es el único agregado del dominio
  que falta).
- Validación de ciclos (aunque ya se mitigó el riesgo con el
  chequeo puntual en `_resolverInsumos` de A.61).
- Método de costo reutilizable por B2 y D.

**Costos:**

- Refactor grande: toca `db-inventario.js`, `enviar-comanda.js`,
  `inventario-service.js` y todo el flujo de comanda.
- Impacto directo en Célula B2 (recetario) y Célula D (editor
  de recetas).
- Requiere test dedicado y coordinación con B2 y D desde el
  diseño.

**Mitigación mínima ya aplicada:** A.61 resolvió el bug de
recursión infinita en `_resolverInsumos` mediante detección de
ciclos con un Set por rama. Esto reduce la urgencia del agregado,
pero no elimina su valor arquitectónico.

### 14.2 Otras deudas relacionadas

- **Unificación de nomenclatura snake/camel (O6).** Fase
  transversal posterior. Auditoría completa de esquema y
  código.
- **Override por producto (`variantes_asignadas`).** Ya previsto
  en §9.2.
- **`multiplicar` y `sustituir` en `insumos_delta`.** Ya
  previsto en §9.2.
- **`sustituir` en `pasos_delta`.** Ya previsto en §9.2.
- **Reapertura formal de item con variantes.** Ya previsto en
  §9.2.
- **Transacciones para descuento atómico.** Ya previsto en
  §9.2.

### 14.3 Notas de mantenimiento

Cualquier deuda nueva detectada durante el desarrollo de
variantes o sus cimientos se agrega a esta sección antes de
cerrar el paquete correspondiente. Se documenta el estado
(diferido / en curso / resuelto) y el acuerdo con Coordinación.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 1.3.0 — 8 de octubre de 2026*