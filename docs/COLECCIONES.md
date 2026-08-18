# 📦 COLECCIONES.md — Estructura de la Base de Datos "EkyzD"

**Versión:** 3.3.0
**Fecha:** 17 de agosto de 2026
**Base de datos:** `EkyzD` (ID: `6a0275cb0022ebf7d30d`)
**Propósito:** Especificación canónica de colecciones, columnas, configuración, permisos y jerarquía de roles para Appwrite Cloud.

---

## 🏷️ Nomenclatura

- `laTaberna_*`: Colecciones de negocio de La Taberna (tienen `espacioId`).
- `global_*`: Colecciones compartidas entre todas las apps del ecosistema (no tienen `espacioId`).

---

## 🔐 Jerarquía y asignación de roles

| Rol | Nivel | Puede asignar |
|-----|-------|---------------|
| `master` | Plataforma | `admin` |
| `admin` | Tenant | `gerente`, `chef`, `cocina_ayudante`, `barman`, `barra_ayudante`, `mesero`, `caja`, `repartidor`, `artista` |
| `gerente` | Staff | `chef`, `cocina_ayudante`, `barman`, `barra_ayudante`, `mesero`, `caja`, `repartidor`, `artista` |
| `chef` | Staff | No asigna roles |
| `cocina_ayudante` | Staff | No asigna roles |
| `barman` | Staff | No asigna roles |
| `barra_ayudante` | Staff | No asigna roles |
| `mesero` | Staff | No asigna roles |
| `caja` | Staff | No asigna roles |
| `repartidor` | Staff | No asigna roles |
| `artista` | Staff | No asigna roles |
| `cliente` | Usuario | No asigna roles |

Los usuarios pueden tener múltiples roles staff simultáneamente. El campo `rolPrincipal` define la vista inicial.

---

## 🔐 Matriz de permisos por colección

### Leyenda

- **CRUD**: CREATE, READ, UPDATE, DELETE
- **R/U**: READ, UPDATE
- **C/R/U**: CREATE, READ, UPDATE
- **—**: Sin permiso

---

### 1. `laTaberna_Productos`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | CRUD |
| `chef` | READ |
| `cocina_ayudante` | — |
| `barman` | READ |
| `barra_ayudante` | — |
| `mesero` | READ |
| `caja` | READ |
| `repartidor` | READ |
| `artista` | — |
| `cliente` | READ |

---

### 2. `laTaberna_Pedidos`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | R/U |
| `chef` | READ |
| `cocina_ayudante` | — |
| `barman` | READ |
| `barra_ayudante` | — |
| `mesero` | C/R/U |
| `caja` | READ |
| `repartidor` | R/U |
| `artista` | — |
| `cliente` | READ (propios) |

---

### 3. `laTaberna_Mesas`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | R/U |
| `chef` | — |
| `cocina_ayudante` | — |
| `barman` | — |
| `barra_ayudante` | — |
| `mesero` | R/U |
| `caja` | READ |
| `repartidor` | — |
| `artista` | — |
| `cliente` | READ |

---

### 4. `laTaberna_Comandas`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | R/U |
| `chef` | R/U |
| `cocina_ayudante` | R/U |
| `barman` | R/U |
| `barra_ayudante` | R/U |
| `mesero` | C/R |
| `caja` | — |
| `repartidor` | READ |
| `artista` | — |
| `cliente` | — |

---

### 5. `laTaberna_Insumos`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | CRUD |
| `chef` | READ |
| `cocina_ayudante` | — |
| `barman` | READ |
| `barra_ayudante` | — |
| `mesero` | — |
| `caja` | — |
| `repartidor` | — |
| `artista` | — |
| `cliente` | — |

---

### 6. `laTaberna_Recetas`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | R/U |
| `chef` | CRUD |
| `cocina_ayudante` | READ |
| `barman` | CRUD (barra) |
| `barra_ayudante` | READ |
| `mesero` | — |
| `caja` | — |
| `repartidor` | — |
| `artista` | — |
| `cliente` | — |

---

### 7. `laTaberna_Staff`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | C/R |
| `chef` | READ |
| `cocina_ayudante` | READ |
| `barman` | READ |
| `barra_ayudante` | READ |
| `mesero` | READ |
| `caja` | READ |
| `repartidor` | READ |
| `artista` | READ |
| `cliente` | READ |

---

### 8. `laTaberna_Configuracion`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | READ |
| Resto de roles | — |

---

### 9. `laTaberna_Eventos_en_vivo`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | C/R/U |
| `artista` | R/U |
| `cliente` | READ |
| Resto de roles | — |

---

### 10. `laTaberna_Menus`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | C/R/U |
| `mesero` | READ |
| `cliente` | READ |
| Resto de roles | — |

---

### 11. `laTaberna_Proveedores`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | CRUD |
| Resto de roles | — |

---

### 12. `laTaberna_Entradas`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | CRUD |
| `chef` | READ |
| `barman` | READ |
| Resto de roles | — |

---

### 13. `laTaberna_Comensales`

| Label | Permisos |
|-------|----------|
| `master` | CRUD |
| `admin` | CRUD |
| `gerente` | C/R/U |
| `mesero` | C/R/U |
| `caja` | READ |
| Resto de roles | — |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_categoria` | Key | `categoria` |
| `index_activo` | Key | `activo` |
| `index_destino` | Key | `destino` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_mesa` | Key | `mesa` |
| `index_estado` | Key | `estado` |
| `index_tipo` | Key | `tipo` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_zona` | Key | `zona` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_pedidoId` | Key | `pedidoId` |
| `index_destino` | Key | `destino` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_tipo` | Key | `tipo` |
| `index_categoria` | Key | `categoria` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_productoId` | Key | `productoId` |
| `index_categoria` | Key | `categoria` |

---

## 7. `laTaberna_Staff`

**Name:** laTaberna_Staff
**Table ID:** laTaberna_Staff
**Propósito:** Personal del restaurante con múltiples roles por espacio.

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `nombre` | varchar | Sí | 100 | — |
| `usuarioId` | varchar | No | 100 | — |
| `roles` | varchar | Sí | 16383 | `[]` |
| `rolPrincipal` | varchar | Sí | 50 | `mesero` |
| `estado` | enum | Sí | `activo`, `inactivo`, `vacaciones` | `activo` |
| `fechaIngreso` | datetime | No | — | — |
| `telefono` | varchar | No | 50 | — |
| `email` | varchar | No | 255 | — |
| `notas` | varchar | No | 2000 | — |
| `tokenVinculacion` | varchar | No | 100 | — |
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_usuarioId_espacioId_unico` | Unique | `usuarioId`, `espacioId` |
| `index_estado` | Key | `estado` |
| `index_espacioId` | Key | `espacioId` |

---

## 8. `laTaberna_Configuracion`

**Name:** laTaberna_Configuracion
**Table ID:** laTaberna_Configuracion
**Propósito:** Configuración por local (nombre, dirección, zonas, etc.).

| Columna | Tipo | Obligatorio | Tamaño / Detalles | Default |
|---------|------|:----------:|-------------------|---------|
| `clave` | varchar | Sí | 100 | — |
| `valor` | varchar | Sí | 16383 | — |
| `espacioId` | varchar | No | 100 | — |

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
| `espacioId` | varchar | No | 100 | — |

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
| `espacioId` | varchar | No | 100 | — |

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
| `espacioId` | varchar | No | 100 | — |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_insumoId` | Key | `insumoId` |
| `index_proveedorId` | Key | `proveedorId` |
| `index_fecha` | Key | `fecha` |

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
| `espacioId` | varchar | No | 100 | — |

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_mesaId` | Key | `mesaId` |
| `index_usuarioId` | Key | `usuarioId` |

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
| `nombreUsuario` | varchar | Sí | 100 | — |
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

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_nombreUsuario_unico` | Unique | `nombreUsuario` |
| `index_usuarioId_unico` | Unique | `usuarioId` |

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

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_usuarioId` | Key | `usuarioId` |
| `index_app` | Key | `app` |

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

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_estado` | Key | `estado` |
| `index_fecha` | Key | `fecha` |

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

**Índices:**

| Nombre | Tipo | Columna(s) |
|--------|------|-----------|
| `index_tipo` | Key | `tipo` |
| `index_activo` | Key | `activo` |

---

## ⚡ Funciones serverless

| Nombre | URL | Descripción |
|--------|-----|-------------|
| `registrar-usuario` | `https://6a81573b000d2f0660d5.tor.appwrite.run` | Registro seguro de cuentas del ecosistema. Crea usuario en Appwrite Auth, perfil global y asigna label cliente. |
| `asignar-rol` | `https://6a6b3c8a003b634646cc.tor.appwrite.run` | Sincroniza labels de roles múltiples en Appwrite Auth según `usuarioId`, `espacioId` y `roles`. También canjea token de vinculación Staff. |

---

*Documento mantenido por la Célula A (Core). Cualquier modificación debe solicitarse formalmente.*