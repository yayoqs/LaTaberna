# 📦 COLECCIONES.md — Estructura de la Base de Datos "EkyzD"

**Versión:** 1.2.0
**Fecha:** 2 de agosto de 2026
**Base de datos:** `EkyzD` (ID: `6a0275cb0022ebf7d30d`)
**Propósito:** Especificación de colecciones, columnas, configuración y permisos para Appwrite Cloud.

---

## 🏷️ Nomenclatura

- `laTaberna_*`: Colecciones de negocio de La Taberna (tienen `espacioId`).
- `global_*`: Colecciones compartidas entre todas las apps del ecosistema (no tienen `espacioId`).

---

## 🔐 Configuración de permisos (Labels)

Los permisos se asignan mediante **Labels** de Appwrite. Cada rol tiene asociado un label que se sincroniza automáticamente al iniciar sesión o al cambiar el rol de un usuario.

### Roles del sistema

| Rol | Descripción |
|-----|-------------|
| `master` | Administrador global del ecosistema. Acceso total. |
| `admin` | Administrador de un local específico. |
| `cocina` | Encargado de cocina. Prepara recetas y gestiona stock. |
| `barra` | Encargado de barra. Prepara bebidas y cócteles. |
| `mesero` | Atención de mesas, toma de pedidos. |
| `caja` | Cobro y cierre de turno. |
| `despensa` | Gestión de inventario, ingredientes y proveedores. |
| `eventos` | Organización de eventos en vivo. |
| `reparto` | Gestión de pedidos de delivery. |
| `artista` | Participación en eventos como artista. |
| `cliente` | Usuario registrado desde la app pública. |

### Matriz de permisos por colección

#### 1. `laTaberna_Productos`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `cocina` | READ |
| `barra` | READ |
| `mesero` | READ |
| `despensa` | READ |
| `eventos` | READ |
| `artista` | READ |
| `reparto` | READ |
| `cliente` | READ |

#### 2. `laTaberna_Pedidos`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `mesero` | CREATE, READ, UPDATE |
| `cocina` | READ |
| `barra` | READ |
| `caja` | READ, UPDATE |

#### 3. `laTaberna_Mesas`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `mesero` | READ, UPDATE |
| `caja` | READ |

#### 4. `laTaberna_Comandas`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `cocina` | READ, UPDATE |
| `barra` | READ, UPDATE |
| `mesero` | CREATE, READ |

#### 5. `laTaberna_Ingredientes`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `despensa` | CREATE, READ, UPDATE |
| `cocina` | READ |
| `barra` | READ |

#### 6. `laTaberna_Recetas`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `cocina` | CREATE, READ, UPDATE |
| `barra` | CREATE, READ, UPDATE |
| `despensa` | READ |

#### 7. `laTaberna_Pedidos_delivery`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `reparto` | READ, UPDATE |
| `caja` | READ, UPDATE |

#### 8. `laTaberna_Usuarios`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |

#### 9. `laTaberna_Configuracion`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |

#### 10. `laTaberna_Precargas_cliente`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `cliente` | CREATE, READ, UPDATE |
| `mesero` | READ, UPDATE |

#### 11. `laTaberna_Eventos_en_vivo`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `eventos` | CREATE, READ, UPDATE |
| `artista` | READ, UPDATE |
| `cliente` | READ |

#### 12. `laTaberna_Menus`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `mesero` | READ |
| `cliente` | READ |

#### 13. `laTaberna_Proveedores`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `despensa` | CREATE, READ, UPDATE |

#### 14. `global_Perfiles`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | READ, UPDATE |
| `cocina` | READ |
| `barra` | READ |
| `mesero` | READ |
| `despensa` | READ |
| `eventos` | READ |
| `artista` | READ |
| `reparto` | READ |
| `caja` | READ |
| `cliente` | READ, UPDATE |

#### 15. `global_Puntos`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | READ |
| `cliente` | READ |

#### 16. `global_Eventos`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `eventos` | CREATE, READ, UPDATE |
| `artista` | READ, UPDATE |
| `cliente` | READ |

#### 17. `global_Espacios`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | READ |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 9. `laTaberna_Configuracion`

**Name:** laTaberna_Configuracion
**Table ID:** laTaberna_Configuracion
**Propósito:** Configuración por local (nombre, dirección, zonas, etc.).

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `clave` | varchar | Sí | 100 | — |
| `valor` | varchar | Sí | 16383 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

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
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 13. `laTaberna_Proveedores`

**Name:** laTaberna_Proveedores
**Table ID:** laTaberna_Proveedores

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `notas` | varchar | No | 2000 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 🌐 Colecciones globales (`global_*`)

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
**Propósito:** Registro de locales y hogares del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `bar`, `hogar` | `bar` |
| `databaseId` | varchar | No | 100 | — |
| `adminAsignado` | varchar | No | 100 | — |

---

*Documento mantenido por la Célula A (Core). Cualquier modificación debe solicitarse formalmente.*