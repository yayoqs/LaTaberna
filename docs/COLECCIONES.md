# 📦 COLECCIONES.md — Estructura de la Base de Datos "EkyzD"

**Versión:** 1.1.0  
**Fecha:** 28 de julio de 2026  
**Base de datos:** `EkysD` (ID: `6a0275cb0022ebf7d30d`)  
**Propósito:** Especificación de colecciones, columnas y configuración para Appwrite Cloud.

---

## 🏷️ Nomenclatura

- `laTaberna_*`: Colecciones de negocio de La Taberna (tienen `espacioId`).
- `global_*`: Colecciones compartidas por todo el ecosistema (no tienen `espacioId`).

---

## 🔐 Configuración general

Todas las colecciones deben tener los siguientes permisos a nivel tabla (Settings > Permissions):

| Rol | Permisos |
|-----|----------|
| `Any` | CREATE, READ, UPDATE, DELETE |

**Row Security:** No se habilita por ahora, excepto donde se indique lo contrario.

---

## 📋 Colecciones de negocio (`laTaberna_*`)

---

## 1. `laTaberna_Productos`

**Name:** laTaberna_Productos  
**Table ID:** laTaberna_Productos

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `precio` | float | No | — | `0` |
| `categoria` | varchar | No | 100 | — |
| `destino` | enum | No | `cocina`, `barra`, `ambos` | `cocina` |
| `descripcion` | varchar | No | 500 | — |
| `activo` | boolean | Sí | — | `true` |
| `imagen` | varchar | No | 500 | — |
| `disponible` | boolean | Sí | — | `true` |
| `tipo` | enum | Sí | `simple`, `compuesto` | `simple` |
| `nivel` | enum | No | `insumo`, `preparacion`, `producto_final` | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 2. `laTaberna_Pedidos`

**Name:** laTaberna_Pedidos  
**Table ID:** laTaberna_Pedidos

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesa` | integer | Sí | — | — |
| `mozo` | varchar | No | 100 | — |
| `comensales` | integer | Sí | — | `1` |
| `estado` | enum | Sí | `abierta`, `en_proceso`, `cerrada` | `abierta` |
| `items` | varchar | No | 16383 | `[]` |
| `total` | float | Sí | — | `0` |
| `observaciones` | varchar | No | 500 | — |
| `transacciones` | varchar | No | 16383 | `[]` |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 3. `laTaberna_Mesas`

**Name:** laTaberna_Mesas  
**Table ID:** laTaberna_Mesas

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `numero` | integer | Sí | — | — |
| `estado` | enum | Sí | `libre`, `ocupada`, `esperando`, `cuenta`, `fusionada`, `pagada` | `libre` |
| `pedidoId` | varchar | No | 100 | — |
| `items` | varchar | No | 16383 | `[]` |
| `mozo` | varchar | No | 100 | — |
| `comensales` | integer | Sí | — | `1` |
| `abiertaEn` | datetime | No | — | — |
| `observaciones` | varchar | No | 500 | — |
| `zona` | varchar | No | 100 | `salon` |
| `esVirtual` | boolean | Sí | — | `false` |
| `mesasFusionadas` | varchar | No | 500 | — |
| `permite_prepedidos` | boolean | Sí | — | `false` |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 4. `laTaberna_Comandas`

**Name:** laTaberna_Comandas  
**Table ID:** laTaberna_Comandas

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesa` | varchar | Sí | 100 | — |
| `destino` | enum | Sí | `cocina`, `barra`, `ambos` | `cocina` |
| `items` | varchar | Sí | 16383 | — |
| `observaciones` | varchar | No | 500 | — |
| `estado` | enum | Sí | `nueva`, `lista`, `completada` | `nueva` |
| `ts` | integer | No | — | — |
| `deliveryId` | varchar | No | 100 | — |
| `mozo` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 5. `laTaberna_Ingredientes`

**Name:** laTaberna_Ingredientes  
**Table ID:** laTaberna_Ingredientes

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `unidad` | varchar | No | 50 | `u` |
| `categoria` | varchar | No | 100 | — |
| `ubicacion` | varchar | No | 255 | — |
| `stock` | float | No | — | `0` |
| `stock_minimo` | float | No | — | `0` |
| `valor_unitario` | float | No | — | `0` |
| `proveedor` | varchar | No | 255 | — |
| `precio_proveedor` | float | No | — | `0` |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 6. `laTaberna_Recetas`

**Name:** laTaberna_Recetas  
**Table ID:** laTaberna_Recetas

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `productoId` | varchar | No | 255 | — |
| `nombre` | varchar | Sí | 255 | — |
| `ingredientes` | varchar | No | 16383 | `[]` |
| `instrucciones` | varchar | No | 2000 | — |
| `es_intermedio` | boolean | No | — | `false` |
| `nivel` | varchar | No | 100 | — |
| `categoria` | varchar | No | 100 | — |
| `destino` | varchar | No | 50 | — |
| `stockActual` | float | No | — | `0` |
| `unidadStock` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 7. `laTaberna_Pedidos_delivery`

**Name:** laTaberna_Pedidos_delivery  
**Table ID:** laTaberna_Pedidos_delivery

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `direccion` | varchar | Sí | 500 | — |
| `telefono` | varchar | Sí | 50 | — |
| `items` | varchar | Sí | 16383 | — |
| `estado` | enum | Sí | `pendiente`, `en_preparacion`, `en_camino`, `entregado` | `pendiente` |
| `repartidor` | varchar | No | 100 | — |
| `observaciones` | varchar | No | 500 | — |
| `total` | float | Sí | — | `0` |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 8. `laTaberna_Usuarios`

**Name:** laTaberna_Usuarios  
**Table ID:** laTaberna_Usuarios  
**Propósito:** Personal del restaurante (admin, meseros, cocineros, etc.).

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 100 | — |
| `hash` | varchar | Sí | 255 | — |
| `rol` | varchar | Sí | 100 | `cliente` |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 9. `laTaberna_Configuracion`

**Name:** laTaberna_Configuracion  
**Table ID:** laTaberna_Configuracion  
**Propósito:** Configuración por restaurante (nombre, dirección, zonas, etc.).  
**Nota:** Corregido en v1.1.0. Esta colección ahora tiene `espacioId`.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `clave` | varchar | Sí | 100 | — |
| `valor` | varchar | Sí | 16383 | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 10. `laTaberna_Precargas_cliente`

**Name:** laTaberna_Precargas_cliente  
**Table ID:** laTaberna_Precargas_cliente

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesa` | integer | Sí | — | — |
| `items` | varchar | Sí | 16383 | — |
| `estado` | enum | Sí | `por_confirmar`, `revisado` | `por_confirmar` |
| `id_usuario` | varchar | Sí | 255 | — |
| `nombre_comensal` | varchar | Sí | 255 | — |
| `observaciones` | varchar | No | 500 | — |
| `revisadoPor` | varchar | No | 100 | — |
| `timestamp` | integer | No | — | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 11. `laTaberna_Eventos_en_vivo`

**Name:** laTaberna_Eventos_en_vivo  
**Table ID:** laTaberna_Eventos_en_vivo

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `tipo` | enum | Sí | `bingo`, `karaoke`, `votacion` | — |
| `estado` | enum | Sí | `configuracion`, `activo`, `pausado`, `finalizado` | `configuracion` |
| `datos` | varchar | No | 16383 | — |
| `creadoPor` | varchar | No | 100 | — |
| `updatedAt` | integer | No | — | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 12. `laTaberna_Menus`

**Name:** laTaberna_Menus  
**Table ID:** laTaberna_Menus

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `activo` | boolean | Sí | — | `true` |
| `productos` | varchar | No | 16383 | `[]` |
| `creadoPor` | varchar | No | 255 | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 13. `laTaberna_Proveedores`

**Name:** laTaberna_Proveedores  
**Table ID:** laTaberna_Proveedores

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `notas` | varchar | No | 2000 | — |
| `espacioId` | varchar | No | 100 | `esp_taberna` |

---

## 🌐 Colecciones globales (`global_*`)

Estas colecciones son compartidas por todo el ecosistema. **No tienen columna `espacioId`.**

---

## 14. `global_Perfiles`

**Name:** global_Perfiles  
**Table ID:** global_Perfiles  
**Propósito:** Perfil de cliente del ecosistema (avatar, nivel, XP). Compartido entre todas las apps.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `usuarioId` | varchar | Sí | 100 | — |
| `nombre` | varchar | Sí | 255 | — |
| `avatar` | varchar | No | 500 | — |
| `nivel` | integer | Sí | — | `1` |
| `xp` | integer | Sí | — | `0` |
| `insignias` | varchar | No | 16383 | `[]` |
| `racha` | integer | Sí | — | `0` |
| `titulos` | varchar | No | 16383 | `[]` |

---

## 15. `global_Puntos`

**Name:** global_Puntos  
**Table ID:** global_Puntos  
**Propósito:** Historial de puntos de fidelización del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `usuarioId` | varchar | Sí | 100 | — |
| `cantidad` | integer | Sí | — | `0` |
| `motivo` | varchar | No | 255 | — |
| `origen` | varchar | No | 100 | — |

---

## 16. `global_Eventos`

**Name:** global_Eventos  
**Table ID:** global_Eventos  
**Propósito:** Eventos globales visibles desde cualquier app del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `titulo` | varchar | Sí | 255 | — |
| `descripcion` | varchar | No | 500 | — |
| `fecha` | datetime | No | — | — |
| `tipo` | enum | Sí | `promocion`, `concurso`, `aviso` | `aviso` |
| `estado` | enum | Sí | `pendiente`, `activo`, `finalizado` | `pendiente` |
| `creadoPor` | varchar | No | 100 | — |

---

## 17. `global_Espacios`

**Name:** global_Espacios  
**Table ID:** global_Espacios  
**Propósito:** Registro de restaurantes y hogares del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `bar`, `hogar` | `bar` |
| `databaseId` | varchar | No | 100 | — |
| `adminAsignado` | varchar | No | 100 | — |

---

*Documento mantenido por la Célula A (Core). Cualquier modificación debe solicitarse formalmente.*