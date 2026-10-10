# COLECCIONES.md — Estructura de la Base de Datos "EkyzD"

**Versión:** 4.9.0
**Fecha:** 8 de octubre de 2026
**Base de datos:** `EkyzD` (ID: `6a0275cb0022ebf7d30d`)
**Propósito:** Especificación canónica de tablas, columnas e índices.

> La configuración de permisos, teams y roles se documenta en `EstadoAppwrite.md`.

---

## Cambios en v4.9.0 respecto a v4.8.0

- A.74: se agrega la colección `laTaberna_Movimientos` con 11
  columnas y 4 índices. Log append-only de ajustes y consumos
  de stock. Permisos de fila update/delete solo admin.

## Cambios en v4.8.0 respecto a v4.7.1

- A.72: se agrega la columna `revisadoPor` (varchar 100,
  opcional) a `laTaberna_Pedidos`.

## Cambios en v4.7.1 respecto a v4.7.0

- A.44: rename `laTaberna_Menus` → `laTaberna_Cartas`.
- A.47: se elimina la fila huérfana de `laTaberna_Avisos`.

## Cambios en v4.7.0 respecto a v4.6.0

- A.43: se agrega la columna `alergenos` (varchar 500, opcional)
  a `laTaberna_Productos`.

## Cambios en v4.6.0 respecto a v4.5.3

- A.39: se agrega la colección `laTaberna_Variantes`.
- A.39: se agrega la columna `variantes_ids` a
  `laTaberna_Productos`.

## Cambios en v4.5.3 respecto a v4.5.2

- A.16/A.17: `laTaberna_Insumos` incorpora el modelo de insumo
  vendible: columnas `vendible`, `precio_venta` y `destino`.
- A.16/A.18: se elimina `insumoId` de `laTaberna_Productos`.

---

## Nomenclatura

- `laTaberna_*`: tablas de negocio de La Taberna.
- `global_*`: tablas compartidas del ecosistema.

---

## Nota sobre Appwrite Console IV

La consola nueva usa términos unificados, pero la CLI conserva nombres clásicos.

En la consola:

- Tablas = Tables
- Filas = Rows
- Columnas = Columns

En la CLI:

- Tablas = collections
- Filas = documents
- Columnas = attributes

No modificar la terminología de los IDs.

---

## Nota sobre roles del ecosistema

El ecosistema Elisekai utiliza `jugador` como rol base global.
En LaTaberna, un jugador sin Team actúa como cliente.
No existe el rol `cliente` como etiqueta separada.

---

## Tablas de negocio (`laTaberna_*`)

### 1. `laTaberna_Productos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `precio` | float | No | — | `0` |
| `categoria` | varchar | No | 255 | — |
| `destino` | enum | No | `cocina`, `barra`, `ambos` | `cocina` |
| `descripcion` | varchar | No | 500 | — |
| `activo` | boolean | Sí | — | `true` |
| `imagen` | varchar | No | 1000 | — |
| `estado` | enum | Sí | `disponible`, `agotado` | `disponible` |
| `variantes_ids` | varchar | No | 2000 — JSON array | `[]` |
| `alergenos` | varchar | No | 500 — JSON array | `[]` |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_categoria` | Key | `categoria` |
| `index_activo` | Key | `activo` |
| `index_destino` | Key | `destino` |

> `variantes_ids` almacena un JSON array de strings con los IDs
> de variantes asignadas al producto. El orden del array define el
> orden de aparición en la UI. Ver `ARQUITECTURA-VARIANTES.md`.
>
> `alergenos` almacena un JSON array de strings con los alérgenos
> propios del producto base, sin depender de variantes. Los valores
> válidos están definidos en el enum cerrado
> `js/dominio/alergenos.js` (ver `ARQUITECTURA-VARIANTES.md §8.2`).

---

### 2. `laTaberna_Pedidos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `mesa` | varchar | No | 100 | — |
| `tipo` | enum | Sí | `local`, `retiro`, `reparto` | `local` |
| `origen` | enum | Sí | `staff`, `cliente` | `staff` |
| `estado` | enum | Sí | `abierta`, `en_proceso`, `cerrada`, `precarga` | `abierta` |
| `mozo` | varchar | No | 100 | — |
| `comensales` | integer | Sí | — | `1` |
| `items` | varchar | No | 7000 | `[]` |
| `total` | float | Sí | — | `0` |
| `observaciones` | varchar | No | 500 | — |
| `transacciones` | varchar | No | 5000 | `[]` |
| `descuento` | float | No | — | `0` |
| `direccion` | varchar | No | 500 | — |
| `telefono` | varchar | No | 50 | — |
| `repartidor` | varchar | No | 100 | — |
| `id_usuario` | varchar | No | 50 | — |
| `nombre_comensal` | varchar | No | 255 | — |
| `revisadoPor` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_mesa` | Key | `mesa` |
| `index_estado` | Key | `estado` |
| `index_tipo` | Key | `tipo` |

> Los items del pedido pueden incluir:
>   · `tipo`: `'producto'` o `'insumo'`.
>   · `opciones`: array de selecciones de variantes (ver
>     `ARQUITECTURA-VARIANTES.md §5`).
>   · `alergias_manuales`: array de alergias informadas por el
>     cliente, distinto del campo `alergenos` de las opciones.
>
> `revisadoPor` se completa cuando el mesero revisa una
> precarga. Es trazabilidad persistida del flujo cliente →
> mesero.

---

### 3. `laTaberna_Mesas`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `numero` | varchar | Sí | 100 | — |
| `estado` | enum | Sí | `libre`, `ocupada`, `esperando`, `cuenta`, `fusionada`, `pagada` | `libre` |
| `pedidoId` | varchar | No | 255 | — |
| `comensales` | integer | Sí | — | `1` |
| `zona` | varchar | No | 100 | `salon` |
| `esVirtual` | boolean | Sí | — | `false` |
| `mesasFusionadas` | varchar | No | 255 | — |
| `espacioId` | varchar | No | 255 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_zona` | Key | `zona` |

---

### 4. `laTaberna_Comandas`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `mesa` | varchar | Sí | 255 | — |
| `pedidoId` | varchar | No | 100 | — |
| `destino` | enum | Sí | `cocina`, `barra`, `ambos` | `cocina` |
| `items` | varchar | Sí | 5000 | — |
| `observaciones` | varchar | No | 500 | — |
| `estado` | enum | Sí | `nueva`, `en-proceso`, `lista`, `completada` | `nueva` |
| `subcomandas` | varchar | No | 5000 | `{}` |
| `ts` | integer | No | — | — |
| `deliveryId` | varchar | No | 255 | — |
| `mozo` | varchar | No | 255 | — |
| `espacioId` | varchar | No | 255 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_pedidoId` | Key | `pedidoId` |
| `index_destino` | Key | `destino` |

---

### 5. `laTaberna_Insumos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `unidad` | varchar | No | 50 | — |
| `categoria` | varchar | No | 100 | — |
| `ubicacion` | varchar | No | 255 | — |
| `stock` | float | No | — | `0` |
| `stock_minimo` | float | No | — | `0` |
| `tipo` | enum | Sí | `aseo`, `cocina`, `operativo`, `menaje` | `cocina` |
| `costo_manual` | float | No | — | `null` |
| `vendible` | boolean | No | — | `false` |
| `precio_venta` | integer | No | — | `0` |
| `destino` | enum | No | `cocina`, `barra`, `ambos` | `cocina` |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_tipo` | Key | `tipo` |
| `index_categoria` | Key | `categoria` |

> **Insumo vendible.** Si `vendible: true`, el insumo puede
> ofrecerse directamente al cliente (bebida en lata, pan casero,
> etc.) sin necesidad de una receta.

---

### 6. `laTaberna_Recetas`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `productoId` | varchar | Sí | 255 | — |
| `ingredientes` | varchar | No | 7000 | `[]` |
| `instrucciones` | varchar | No | 7000 | — |
| `es_intermedio` | boolean | No | — | `false` |
| `nivel` | varchar | No | 100 | — |
| `categoria` | varchar | No | 100 | — |
| `destino` | varchar | No | 100 | — |
| `unidadStock` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_productoId` | Key | `productoId` |
| `index_categoria` | Key | `categoria` |

---

### 7. `laTaberna_Staff`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 100 | — |
| `usuarioId` | varchar | Sí | 100 | — |
| `roles` | varchar | Sí | 500 | `[]` |
| `rolPrincipal` | varchar | Sí | 50 | `mesero` |
| `estado` | enum | Sí | `activo`, `inactivo`, `vacaciones` | `activo` |
| `fechaIngreso` | datetime | No | — | — |
| `telefono` | varchar | No | 50 | — |
| `email` | varchar | No | 50 | — |
| `notas` | varchar | No | 2000 | — |
| `tokenVinculacion` | varchar | No | 255 | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_espacioId` | Key | `espacioId` |
| `index_usuarioId_espacioId_unico` | Unique | `usuarioId`, `espacioId` |

---

### 8. `laTaberna_Configuracion`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `clave` | varchar | Sí | 100 | — |
| `valor` | varchar | Sí | 1000 | — |
| `espacioId` | varchar | Sí | 100 | — |

> Row Security activado. Permisos de tabla solo `master`. Acceso
> por equipo mediante permisos de fila.
>
> El `$id` de la fila sigue el patrón `{espacioId}_global`.
>
> Claves de la sección **Catálogo**:
>   · `kds_colapso_variantes` (integer, default 3).

Sin índices adicionales.

---

### 9. `laTaberna_Eventos_en_vivo`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `tipo` | enum | Sí | `bingo`, `karaoke`, `votacion` | — |
| `estado` | enum | Sí | `configuracion`, `activo`, `pausado`, `finalizado` | `configuracion` |
| `datos` | varchar | No | 2000 | — |
| `creadoPor` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | — |

Sin índices adicionales.

---

### 10. `laTaberna_Cartas`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 150 | — |
| `estado` | enum | Sí | `borrador`, `publicado` | `borrador` |
| `productos` | varchar | No | 10000 | `[]` |
| `creadoPor` | varchar | No | 255 | — |
| `fondo` | varchar | No | 50 | `#1a1a2e` |
| `tipografia` | varchar | No | 100 | `'Inter', sans-serif` |
| `grilla` | boolean | No | — | `false` |
| `espacioId` | varchar | No | 100 | — |

> Colección renombrada desde `laTaberna_Menus` en A.44
> (2026-09-16).

Sin índices adicionales.

---

### 11. `laTaberna_Proveedores`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `distribuidor`, `supermercado`, `feria`, `huerta`, `donacion`, `otro` | `otro` |
| `contacto` | varchar | No | 255 | — |
| `telefono` | varchar | No | 50 | — |
| `email` | varchar | No | 100 | — |
| `direccion` | varchar | No | 500 | — |
| `rubro` | varchar | No | 255 | — |
| `notas` | varchar | No | 2000 | — |
| `activo` | boolean | Sí | — | `true` |
| `espacioId` | varchar | No | 100 | — |

Sin índices adicionales.

---

### 12. `laTaberna_Entradas`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `insumoId` | varchar | Sí | 255 | — |
| `proveedorId` | varchar | Sí | 255 | — |
| `formato` | varchar | No | 100 | — |
| `cantidad` | float | Sí | — | — |
| `unidad_por_formato` | float | Sí | — | — |
| `costo_total` | float | Sí | — | — |
| `costo_unitario` | float | Sí | — | — |
| `fecha` | datetime | No | — | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_insumoId` | Key | `insumoId` |
| `index_proveedorId` | Key | `proveedorId` |
| `index_fecha` | Key | `fecha` |

---

### 13. `laTaberna_Comensales`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `mesaId` | varchar | Sí | 100 | — |
| `usuarioId` | varchar | No | 100 | `null` |
| `nombre` | varchar | Sí | 100 | — |
| `iniciales` | varchar | No | 4 | — |
| `activo` | boolean | Sí | — | `true` |
| `unidoEn` | datetime | No | — | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_mesaId` | Key | `mesaId` |
| `index_usuarioId` | Key | `usuarioId` |

---

### 14. `laTaberna_Avisos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `tipo` | enum | Sí | `vinculacion`, `llamado`, `precarga` | — |
| `mesaId` | varchar | Sí | 100 | — |
| `usuarioId` | varchar | No | 150 | — |
| `estado` | enum | Sí | `pendiente`, `atendido`, `descartado` | `pendiente` |
| `creadoEn` | datetime | No | — | — |
| `atendidoPor` | varchar | No | 100 | — |
| `atendidoEn` | datetime | No | — | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_mesaId` | Key | `mesaId` |
| `index_espacioId` | Key | `espacioId` |
| `index_tipo` | Key | `tipo` |

---

### 15. `laTaberna_Variantes`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 150 | — |
| `descripcion` | varchar | No | 500 | — |
| `tipo` | enum | Sí | `unica`, `multiple` | `unica` |
| `requerido` | boolean | Sí | — | `false` |
| `min_seleccion` | integer | Sí | — | `0` |
| `max_seleccion` | integer | Sí | — | `1` |
| `opciones` | varchar | Sí | 10000 — JSON array | `[]` |
| `espacioId` | varchar | No | 100 | — |
| `activo` | boolean | Sí | — | `true` |
| `orden` | integer | No | — | `0` |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_espacioId` | Key | `espacioId` |
| `index_activo` | Key | `activo` |

> Row Security activado. Permisos de tabla solo `label:master`.

---

### 16. `laTaberna_Movimientos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `insumoId` | varchar | Sí | 100 | — |
| `insumoNombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `entrada`, `salida`, `ajuste` | `ajuste` |
| `cantidad` | float | Sí | signo delata dirección | — |
| `unidad` | varchar | No | 50 | — |
| `motivo` | varchar | No | 255 | — |
| `referencia` | varchar | No | 100 | — |
| `usuario` | varchar | No | 100 | — |
| `usuarioId` | varchar | No | 100 | — |
| `fecha` | datetime | Sí | — | — |
| `espacioId` | varchar | Sí | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_espacioId` | Key | `espacioId` |
| `index_fecha` | Key | `fecha` |
| `index_insumoId` | Key | `insumoId` |
| `index_tipo` | Key | `tipo` |

> **Log append-only** de ajustes y consumos de stock. No se
> actualiza ni se elimina en operación normal. Solo `admin`
> puede hacer update/delete si surge un caso extraordinario.
>
> **Campos denormalizados:** `insumoNombre` y `unidad` se graban
> al momento del movimiento. Si el insumo se renombra después,
> el movimiento conserva el histórico.
>
> **`referencia`:** ata el movimiento a su causa.
>   · Consumo por comanda: `pedidoId`.
>   · Consumo por insumo vendible: `pedidoId`.
>   · Entrada por compra: `entradaId`.
>   · Ajuste manual: vacío.
>
> **Retención en el Store:** últimos 30 días. El histórico
> completo vive en Appwrite.
>
> **Migración de `localStorage`:** no aplicada. Los movimientos
> previos a esta colección no se migraron.
>
> **Row Security:** activado. Permisos de fila update/delete
> solo `admin`.

---

## Tablas globales (`global_*`)

### 17. `global_Perfiles`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `usuarioId` | varchar | Sí | 100 | — |
| `nombreUsuario` | varchar | Sí | 100 | — |
| `nombre` | varchar | Sí | 255 | — |
| `avatar` | varchar | No | 500 | — |
| `nivel` | integer | Sí | — | `1` |
| `xp` | float | Sí | — | `0` |
| `insignias` | varchar | No | 2000 | `[]` |
| `racha` | integer | Sí | — | `0` |
| `titulos` | varchar | No | 2000 | `[]` |
| `fechaRegistro` | datetime | No | — | — |
| `bio` | varchar | No | 2000 | — |
| `ultimaActividad` | datetime | No | — | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_nombreUsuario_unico` | Unique | `nombreUsuario` |
| `index_usuarioId_unico` | Unique | `usuarioId` |

---

### 18. `global_Puntos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `usuarioId` | varchar | Sí | 100 | — |
| `cantidad` | integer | Sí | — | `0` |
| `motivo` | varchar | No | 255 | — |
| `origen` | varchar | No | 100 | — |
| `app` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | — |
| `fecha` | datetime | No | — | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_usuarioId` | Key | `usuarioId` |
| `index_app` | Key | `app` |

---

### 19. `global_Eventos`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `titulo` | varchar | Sí | 255 | — |
| `descripcion` | varchar | No | 500 | — |
| `fecha` | datetime | No | — | — |
| `tipo` | enum | Sí | `promocion`, `concurso`, `aviso` | `aviso` |
| `estado` | enum | Sí | `pendiente`, `activo`, `finalizado` | `pendiente` |
| `creadoPor` | varchar | No | 100 | — |
| `app` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | — |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_fecha` | Key | `fecha` |

---

### 20. `global_Espacios`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | No | `bar`, `hogar`, `tienda`, `veterinaria`, `hotel`, `otro`, `pub`, `restaurant`, `eventos`, `taller`, `vitrina` | `otro` |
| `databaseId` | varchar | No | 100 | — |
| `adminAsignado` | varchar | No | 100 | — |
| `direccion` | varchar | No | 500 | — |
| `ciudad` | varchar | No | 100 | — |
| `pais` | varchar | No | 100 | — |
| `activo` | boolean | Sí | — | `true` |
| `app` | varchar | Sí | 50 | — |

> El `$id` de la fila es el `espacioId`.
> No existe columna `espacioId`.

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_tipo` | Key | `tipo` |
| `index_activo` | Key | `activo` |
| `index_app` | Key | `app` |

---

### 21. `global_Limites`

| Columna | Tipo | Obligatorio | Detalles | Default |
|---------|------|:----------:|----------|---------|
| `clave` | varchar | Sí | 255 | — |
| `marcaTiempo` | datetime | Sí | — | — |
| `contador` | integer | No | — | `0` |

Índices:

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_clave` | Key | `clave` |
| `index_marcaTiempo` | Key | `marcaTiempo` |

> Uso exclusivo de las funciones serverless para rate limiting.

---

## Funciones serverless

| Nombre | URL | Descripción |
|--------|-----|-------------|
| `registrar-usuario` | `https://6a81573b000d2f0660d5.tor.appwrite.run` | Crea cuenta, perfil global y espacio MiRefugio. |
| `asignar-rol` | `https://6a6b3c8a003b634646cc.tor.appwrite.run` | Sincroniza labels y membresías de Teams. Soporta creación segura de filas de negocio. |

---

## Notas al pie

### Insumo vendible

El modelo de **insumo vendible** reemplaza el campo `insumoId` de
productos. Un insumo puede ser ingrediente de receta, producto
vendible directo, o ambos.

### Sistema de variantes

El **sistema de variantes** permite que un producto padre ofrezca
opciones seleccionables (sabor, tamaño, extras) sin duplicar
productos. Se documenta en `ARQUITECTURA-VARIANTES.md`.

### Alérgenos

El enum cerrado de alérgenos vive en `js/dominio/alergenos.js`.

### Rename laTaberna_Menus → laTaberna_Cartas

La colección se renombró el 2026-09-16. La clave `cartas`
reemplaza a `menus` en `COLECCIONES`.

### revisadoPor

La columna `revisadoPor` de `laTaberna_Pedidos` se agregó en
A.72 (2026-10-08).

### Movimientos de inventario

La colección `laTaberna_Movimientos` se agregó en A.74
(2026-10-08). Es un log append-only de ajustes y consumos de
stock. Los movimientos previos a esta colección no se migraron
desde `localStorage`.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*