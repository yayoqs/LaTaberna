# 📦 COLECCIONES.md — Estructura de la Base de Datos "EkyzD"

**Versión:** 3.0.1 (Final)
**Fecha:** 9 de agosto de 2026
**Base de datos:** `EkyzD` (ID: `6a0275cb0022ebf7d30d`)
**Propósito:** Especificación canónica de colecciones, columnas, configuración y permisos para Appwrite Cloud.

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
| `despensa` | Gestión de inventario, insumos y proveedores. |
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

#### 5. `laTaberna_Insumos`

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

#### 7. `laTaberna_Staff`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |

#### 8. `laTaberna_Configuracion`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |

#### 9. `laTaberna_Eventos_en_vivo`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `eventos` | CREATE, READ, UPDATE |
| `artista` | READ, UPDATE |
| `cliente` | READ |

#### 10. `laTaberna_Menus`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `mesero` | READ |
| `cliente` | READ |

#### 11. `laTaberna_Proveedores`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `despensa` | CREATE, READ, UPDATE |

#### 12. `laTaberna_Entradas`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `despensa` | CREATE, READ, UPDATE |
| `cocina` | READ |
| `barra` | READ |

#### 13. `laTaberna_Comensales`

| Label | Permisos |
|-------|----------|
| `master` | CREATE, READ, UPDATE, DELETE |
| `admin` | CREATE, READ, UPDATE, DELETE |
| `mesero` | CREATE, READ, UPDATE |
| `caja` | READ |

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
| `estado` | enum | Sí | `disponible`, `agotado` | `disponible` |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `categoria`, `activo`, `destino`

---

## 2. `laTaberna_Pedidos`

**Name:** laTaberna_Pedidos
**Table ID:** laTaberna_Pedidos

Colección unificada para todos los tipos de pedido: local, reparto, retiro y precargas de clientes.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesa` | varchar | No | 100 | — |
| `tipo` | enum | Sí | `local`, `reparto`, `retiro` | `local` |
| `origen` | enum | Sí | `staff`, `cliente` | `staff` |
| `estado` | enum | Sí | `abierta`, `en_proceso`, `cerrada`, `precarga` | `abierta` |
| `mozo` | varchar | No | 100 | — |
| `comensales` | integer | Sí | — | `1` |
| `items` | varchar | No | 16383 | `[]` |
| `total` | float | Sí | — | `0` |
| `observaciones` | varchar | No | 500 | — |
| `transacciones` | varchar | No | 16383 | `[]` |
| `descuento` | float | No | — | `0` |
| `direccion` | varchar | No | 500 | — |
| `telefono` | varchar | No | 50 | — |
| `repartidor` | varchar | No | 100 | — |
| `id_usuario` | varchar | No | 255 | — |
| `nombre_comensal` | varchar | No | 255 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `mesa`, `estado`, `tipo`

---

## 3. `laTaberna_Mesas`

**Name:** laTaberna_Mesas
**Table ID:** laTaberna_Mesas

Colección simplificada que gestiona exclusivamente la disponibilidad física de las mesas.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `numero` | varchar | Sí | 100 | — |
| `estado` | enum | Sí | `libre`, `ocupada`, `esperando`, `cuenta`, `fusionada`, `pagada` | `libre` |
| `pedidoId` | varchar | No | 100 | — |
| `comensales` | integer | Sí | — | `1` |
| `zona` | varchar | No | 100 | `salon` |
| `esVirtual` | boolean | Sí | — | `false` |
| `mesasFusionadas` | varchar | No | 500 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `estado`, `zona`

---

## 4. `laTaberna_Comandas`

**Name:** laTaberna_Comandas
**Table ID:** laTaberna_Comandas

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesa` | varchar | Sí | 100 | — |
| `pedidoId` | varchar | No | 100 | — |
| `destino` | enum | Sí | `cocina`, `barra`, `ambos` | `cocina` |
| `items` | varchar | Sí | 16383 | — |
| `observaciones` | varchar | No | 500 | — |
| `estado` | enum | Sí | `nueva`, `en-proceso`, `lista`, `completada` | `nueva` |
| `subcomandas` | varchar | No | 16383 | `{}` |
| `ts` | integer | No | — | — |
| `deliveryId` | varchar | No | 100 | — |
| `mozo` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `estado`, `pedidoId`, `destino`

---

## 5. `laTaberna_Insumos`

**Name:** laTaberna_Insumos
**Table ID:** laTaberna_Insumos

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `unidad` | varchar | No | 50 | `u` |
| `categoria` | varchar | No | 100 | — |
| `ubicacion` | varchar | No | 255 | — |
| `stock` | float | No | — | `0` |
| `stock_minimo` | float | No | — | `0` |
| `tipo` | enum | Sí | `cocina`, `operativo`, `menaje`, `aseo` | `cocina` |
| `costo_manual` | float | No | — | `null` |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `tipo`, `categoria`

---

## 6. `laTaberna_Recetas`

**Name:** laTaberna_Recetas
**Table ID:** laTaberna_Recetas

> **Nota:** La colección no almacena el nombre del producto. El nombre se obtiene mediante la relación `productoId` → `laTaberna_Productos.$id`. Para obtener una receta con el nombre del producto resuelto, usar el método `DBInventario.obtenerRecetaConProducto(recetaId)`.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `productoId` | varchar | Sí | 255 | — |
| `ingredientes` | varchar | No | 16383 | `[]` |
| `instrucciones` | varchar | No | 2000 | — |
| `es_intermedio` | boolean | No | — | `false` |
| `nivel` | varchar | No | 100 | — |
| `categoria` | varchar | No | 100 | — |
| `destino` | varchar | No | 50 | — |
| `unidadStock` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `productoId`, `categoria`

---

## 7. `laTaberna_Staff`

**Name:** laTaberna_Staff
**Table ID:** laTaberna_Staff
**Propósito:** Personal del restaurante (admin, meseros, cocineros, etc.). Vinculable a perfiles globales.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 100 | — |
| `rol` | varchar | Sí | 100 | `cliente` |
| `usuarioId` | varchar | No | 100 | — |
| `estado` | enum | Sí | `activo`, `inactivo`, `vacaciones` | `activo` |
| `fechaIngreso` | datetime | No | — | — |
| `telefono` | varchar | No | 50 | — |
| `email` | varchar | No | 255 | — |
| `notas` | varchar | No | 2000 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `usuarioId`

---

## 8. `laTaberna_Configuracion`

**Name:** laTaberna_Configuracion
**Table ID:** laTaberna_Configuracion
**Propósito:** Configuración por local (nombre, dirección, zonas, etc.).

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `clave` | varchar | Sí | 100 | — |
| `valor` | varchar | Sí | 16383 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 9. `laTaberna_Eventos_en_vivo`

**Name:** laTaberna_Eventos_en_vivo
**Table ID:** laTaberna_Eventos_en_vivo

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `tipo` | enum | Sí | `bingo`, `karaoke`, `votacion` | — |
| `estado` | enum | Sí | `configuracion`, `activo`, `pausado`, `finalizado` | `configuracion` |
| `datos` | varchar | No | 16383 | — |
| `creadoPor` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 10. `laTaberna_Menus`

**Name:** laTaberna_Menus
**Table ID:** laTaberna_Menus

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `estado` | enum | Sí | `borrador`, `publicado` | `borrador` |
| `productos` | varchar | No | 16383 | `[]` |
| `creadoPor` | varchar | No | 255 | — |
| `fondo` | varchar | No | 50 | `#1a1a2e` |
| `tipografia` | varchar | No | 100 | `'Inter', sans-serif` |
| `grilla` | boolean | No | — | `false` |
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 11. `laTaberna_Proveedores`

**Name:** laTaberna_Proveedores
**Table ID:** laTaberna_Proveedores

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `distribuidor`, `supermercado`, `feria`, `huerta`, `donacion`, `otro` | `otro` |
| `contacto` | varchar | No | 255 | — |
| `telefono` | varchar | No | 50 | — |
| `email` | varchar | No | 255 | — |
| `direccion` | varchar | No | 500 | — |
| `rubro` | varchar | No | 100 | — |
| `notas` | varchar | No | 2000 | — |
| `activo` | boolean | Sí | — | `true` |
| `espacioId` | varchar | No | 100 | `lataberna` |

---

## 12. `laTaberna_Entradas`

**Name:** laTaberna_Entradas
**Table ID:** laTaberna_Entradas
**Propósito:** Registro de cada recepción de mercadería.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `insumoId` | varchar | Sí | 255 | — |
| `proveedorId` | varchar | Sí | 255 | — |
| `formato` | varchar | No | 100 | — |
| `cantidad` | float | Sí | — | — |
| `unidad_por_formato` | float | Sí | — | — |
| `costo_total` | float | Sí | — | — |
| `costo_unitario` | float | Sí | — | — |
| `fecha` | datetime | No | — | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `insumoId`, `proveedorId`, `fecha`

---

## 13. `laTaberna_Comensales`

**Name:** laTaberna_Comensales
**Table ID:** laTaberna_Comensales
**Propósito:** Registro de personas en una mesa, con o sin cuenta del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `mesaId` | varchar | Sí | 100 | — |
| `usuarioId` | varchar | No | 100 | `null` |
| `nombre` | varchar | Sí | 100 | — |
| `iniciales` | varchar | No | 4 | — |
| `activo` | boolean | Sí | — | `true` |
| `unidoEn` | datetime | No | — | — |
| `espacioId` | varchar | No | 100 | `lataberna` |

**Índices:** `mesaId`, `usuarioId`

---

## 📋 Colecciones obsoletas

Las siguientes colecciones han sido reemplazadas por `laTaberna_Pedidos` unificada y deben eliminarse de Appwrite:

| Colección | Reemplazada por |
|-----------|-----------------|
| `laTaberna_Pedidos_delivery` | `laTaberna_Pedidos` con `tipo = reparto` |
| `laTaberna_Precargas_cliente` | `laTaberna_Pedidos` con `estado = precarga` y `origen = cliente` |

---

## 🌐 Colecciones globales (`global_*`)

---

## 14. `global_Perfiles`

**Name:** global_Perfiles
**Table ID:** global_Perfiles
**Propósito:** Perfil de usuario del ecosistema (avatar, nivel, XP).

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
| `fechaRegistro` | datetime | No | — | — |
| `bio` | varchar | No | 500 | — |
| `ultimaActividad` | datetime | No | — | — |

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
| `app` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | — |
| `fecha` | datetime | No | — | — |

**Índices:** `usuarioId`, `app`

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
| `app` | varchar | No | 50 | — |
| `espacioId` | varchar | No | 100 | — |

**Índices:** `estado`, `fecha`

---

## 17. `global_Espacios`

**Name:** global_Espacios
**Table ID:** global_Espacios
**Propósito:** Registro de locales y hogares del ecosistema.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 255 | — |
| `tipo` | enum | Sí | `bar`, `hogar`, `tienda`, `veterinaria`, `hotel`, `otro` | `bar` |
| `databaseId` | varchar | No | 100 | — |
| `adminAsignado` | varchar | No | 100 | — |
| `direccion` | varchar | No | 500 | — |
| `ciudad` | varchar | No | 100 | — |
| `pais` | varchar | No | 100 | — |
| `activo` | boolean | Sí | — | `true` |

**Índices:** `tipo`, `activo`

---

*Documento mantenido por la Célula A (Core). Cualquier modificación debe solicitarse formalmente.*