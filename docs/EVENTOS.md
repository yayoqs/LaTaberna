# 📡 Catálogo de Eventos del Sistema – La Taberna (v1.8.0)

**Última actualización:** 2026-10-08

---

## Cambios en v1.8.0 respecto a v1.7.0

- A.74: se agrega `movimientos:actualizados`, emitido por
  `js/db-inventario.js` tras cada ajuste manual de stock o
  consumo por comanda. Consumidor: panel de Movimientos de
  Despensa (Célula D).
- A.74: se registra `INSUMO_GUARDADO` despachado desde
  `consumirInsumosDeProducto` al Store para sincronizar el
  slice de insumos tras descuentos por comanda.
- A.71: se aclara que `sincronizarLabelsStaff` y
  `vincularCuentaStaff` invocan la función serverless vía SDK
  oficial, sin emitir eventos adicionales.

## Cambios en v1.7.0 respecto a v1.6.0

- A.62: se agregan tres eventos de Célula C.

## Cambios en v1.6.0 respecto a v1.5.1

- A.55.bis: se eliminan del catálogo tres eventos sin emisor.

## Cambios en v1.5.1 respecto a v1.5.0

- A.55: auditoría contra código real de B1.
- A.55: se agrega `producto:agregado_a_comanda`.

## Cambios en v1.5.0 respecto a v1.4.0

- A.55: se agrega `producto:con_variantes`.

## Cambios en v1.4.0 respecto a v1.3.0

- A.42: se agrega `variantes:actualizadas`.

## Cambios en v1.3.0 respecto a v1.2.0

- A.38: se agrega `inventario:descuento_incompleto`.

## Cambios en v1.2.0 respecto a v1.1.0

- Actualización de eventos de autenticación.

---

## Convenciones

- Nombre del evento: `modulo:accion`, por ejemplo `mesa:actualizada`.
- Payload: objeto JSON con los datos del evento.
- Emisor: módulo que emite el evento.
- Consumidores: módulos que se suscriben.
- Evento deprecado: figura en el catálogo pero no se emite en
  la versión actual del código. Conservado para rastro histórico.

---

## 1. Eventos del Núcleo

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `db:inicializada` | DB | *(sin payload)* | Todas las vistas |
| `vista:cambiada` | App | `string` (nombre de vista) | Módulos de cliente, guía, KDS |
| `vista:activada` | App | `string` (nombre de vista) | Módulos que renderizan al entrar |
| `state:cambiado` | Store | `{ state, action }` | Cualquier suscriptor del Store |

---

## 2. Eventos de Mesa

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `mesa:seleccionada` | Mesas | `string` (número o identificador de mesa) | MesaDetalles, Pedido |
| `mesa:actualizada` | DB / Store / Realtime | `{ mesa: string, estado: string }` | Mesas, KDS, Caja, Cliente |
| `mesa:liberada` | PedidoRepository | `{ numero: string }` | Mesas, Store |
| `mesa:abierta` | Pedido | `objeto mesa` | Comanda |
| `mesa:cerrada` | Pedido | *(sin payload)* | Componentes internos |
| `mesas:guardadas` | DBCore | `array de mesas` | App |
| `mesa:agregada` | Comando agregarMesa | `objeto mesa` | Mesas |
| `mesa:badge_click` | Mesas | `{ mesa: string, precargaId: string }` | PrecargaControl |
| `mesas:limpiar_badge` | Comanda / PrecargaControl | `{ mesa: string }` | Mesas |
| `mesa-detalle:abierto` | MesaDetalles | *(sin payload)* | Pedido |
| `mesa-detalle:cerrado` | MesaDetalles | *(sin payload)* | Pedido |
| `mesa:tomar_pedido` | MesaDetalles | `{ mesa: string }` | Pedido |

---

## 3. Eventos de Pedido y Comanda

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `pedido:creado` | PedidoService / Comando crearPedidoMesa | `objeto pedido` | Store, Caja |
| `pedido:cerrado` | PedidoService / Cobro | `{ mesa, pedidoId, total, formaPago }` | App, Store |
| `pedido:item_agregado` | PedidoService | `{ pedidoId, nombre, cantidad }` | Store |
| `pedido:transaccion_agregada` | PedidoService | `{ pedidoId, persona, monto, formaPago, saldoRestante, pedidoCerrado }` | Store |
| `pedidos:actualizada` | Realtime / DB | `objeto pedido` | PantallaBienvenida, Reparto, Caja |
| `comanda:enviada` | PedidoRepository / Realtime | `objeto comanda` | KDS, App |
| `comanda:lista` | KDS | `{ id, mesa }` | App, Store |
| `comanda:completada` | Comando completarSubcomanda | `{ id, mesa }` | Store |
| `comanda:subcomanda_completada` | Comando completarSubcomanda | `{ id, destino, ambasListas }` | KDS |
| `comandas:guardadas` | DBCore | `array de comandas` | App, KDS |
| `producto:seleccionado` | Carta | `objeto producto` | Comanda |
| `producto:con_variantes` | Carta (js/ui/carta.js) | `{ producto, variantes }` | modal-opciones.js |
| `producto:agregado_a_comanda` | modal-opciones.js | `{ item }` | B1 (bandeja/pedido) |
| `cuenta:solicitada` | Cuenta | *(sin payload)* | Cuenta |
| `cobro:solicitado` | Cuenta / MesaDetalles | *(sin payload)* | Cobro |
| `pago:confirmado` | Cobro | `{ mesa, pedidoId, total }` | Pedido, Store |

---

## 4. Eventos de Productos, Insumos e Inventario

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `productos:cargados` | DB | `array de productos` | Recetas, Menu, App |
| `productos:actualizada` | Realtime / DB | `objeto producto` | Vistas de menú |
| `producto:seleccionado` | Carta | `objeto producto` | Comanda |
| `producto:con_variantes` | Carta (js/ui/carta.js) | `{ producto, variantes }` | modal-opciones.js |
| `producto:agregado_a_comanda` | modal-opciones.js | `{ item }` | B1 (bandeja/pedido) |
| `producto:agotado` | Comando marcarAgotado | `{ prodId }` | KDS, Menu, Carta |
| `insumos:actualizados` | DBInventario | `array de insumos` | Store, Despensa |
| `inventario:actualizado` | DBInventario | *(sin payload)* | Store, Despensa |
| `inventario:stock_bajo` | DBInventario | `{ insumo, stock, unidad }` | App |
| `inventario:descuento_incompleto` | enviar-comanda.js | `{ pedidoId, insumosFallidos, insumosOk, total }` | Despensa (D), Store (E) |
| `recetas:actualizadas` | DBInventario (saveRecetas) | `array de recetas` | Recetas, App |
| `variantes:actualizadas` | variante-repository.js | `objeto variante` | D (editor), B1 (carta), C (menú), B2 (KDS) |
| `movimientos:actualizados` | db-inventario.js | `objeto movimiento` | D (panel de Movimientos) |

### 4.1 Detalle de `inventario:descuento_incompleto`

Emitido cuando el descuento de stock de una comanda quedó
parcialmente aplicado por fallos en operaciones individuales.
No bloquea el envío de la comanda.

**Payload:**

    {
      pedidoId: "ped_xxx" | null,
      insumosFallidos: [
        { insumoId: "ins_xxx", cantidad: 5, error: "mensaje" }
      ],
      insumosOk: [
        { insumoId: "ins_yyy", cantidad: 3 }
      ],
      total: 2
    }

**Comportamiento de los consumidores:**

- **Despensa (D):** muestra advertencia al operador sobre los
  insumos cuyo stock no se descontó.
- **Store (E):** actualiza el estado local de los insumos que
  sí se descontaron.

**Modo de descuento:** Fase 1 opera en best-effort. Los fallos
individuales se registran en Logger con nivel ERROR. Fase 2
migrará a transacciones atómicas.

### 4.2 Detalle de `variantes:actualizadas`

Emitido por `js/repositorios/variante-repository.js` tras cada
operación de creación, actualización o borrado lógico de una
variante del catálogo.

**Payload:** `objeto variante` con los campos según
`COLECCIONES.md` (§ laTaberna_Variantes). El campo `opciones`
viaja como array parseado.

### 4.3 Detalle de `producto:con_variantes`

Emitido por `js/ui/carta.js` (Célula B1) cuando el mesero toca
un producto que tiene al menos una variante activa con al menos
una opción activa.

**Payload:** `{ producto, variantes }`.

El modal `modal-opciones.js` re-resuelve las variantes desde el
Store al abrirse (no usa el payload). Si no encuentra variantes
activas (race condition), emite `producto:seleccionado` como
fallback.

### 4.4 Detalle de `producto:agregado_a_comanda`

Emitido por `js/ui/pedido/modal-opciones.js` (Célula B1) tras
agregar un ítem con opciones a la comanda activa.

**Payload:** `{ item }` con el ítem completo.

### 4.5 Detalle de `movimientos:actualizados`

Emitido por `js/db-inventario.js` tras cada ajuste manual de
stock (vía `ajustarStock`) o tras cada descuento por comanda
(vía `consumirInsumosDeProducto`). Un movimiento por cada insumo
afectado.

**Payload:**

    {
      id,
      insumoId,
      insumoNombre,
      tipo,            // 'entrada' | 'salida' | 'ajuste'
      cantidad,        // delta efectivo, con signo
      unidad,
      motivo,
      referencia,      // pedidoId, entradaId, o ''
      usuario,
      usuarioId,
      fecha,
      espacioId
    }

**Comportamiento de los consumidores:**

- **D (panel de Movimientos):** refresca la lista. Prepende el
  nuevo movimiento si el slice está en vivo.
- **Otras células (futuro):** la suscripción es opcional. La API
  pública es el slice `movimientos` del Store.

**Notas:**

- Un ajuste que se recorta a 0 registra el **delta efectivo**, no
  el solicitado. Ejemplo: stock 5, ajuste -100 → movimiento
  `cantidad: -5`.
- Un ajuste con delta === 0 no emite evento.
- El evento se emite después de despachar al Store. Es
  notificación post-acción, no reemplaza el flujo de datos.


---

## 5. Eventos de Reparto y Pedidos Unificados

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `pedidos:actualizada` | Realtime / DB | `objeto pedido` | Reparto, Caja, Cliente |
| `delivery:creado` | DeliveryService | `objeto delivery` | Store |
| `delivery:enviado_a_cocina` | PedidoManager / DeliveryService | `{ deliveryId, items }` | Store |
| `delivery:listo` | KDS | `{ deliveryId, comandaId, estado }` | Store |

> `pedidos:actualizada` figura también en la sección 3. Es el
> mismo evento. Se unificará en una próxima revisión.

---

## 6. Eventos de Turno y Auditoría

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `turno:iniciado` | PedidoManager | `objeto turno` | App, Caja |
| `turno:solicitar_cierre` | PedidoManager | *(sin payload)* | TurnoManager |
| `turno:cerrado` | TurnoManager | `{ timestamp }` | App, Caja |
| `audit:actualizado` | PedidoManager | `{ turnoId, total }` | App |

---

## 7. Eventos de Cliente y Precarga

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `cliente:mesa_ingresada` | PantallaBienvenida | `{ mesa: string }` | Mesas, AvisosMesero |
| `jugador:cuenta_creada` | Auth | `{ nombre, timestamp }` | ClienteModulo |
| `cliente:precarga_enviada` | MenuDigital | `{ id, mesa, items, clienteId, id_usuario, nombreComensal }` | PrecargaControl |
| `cliente:llamar_garzon` | PantallaBienvenida | `{ mesa: string }` | Mesas, AvisosMesero |
| `cliente:comensal_agregado` | PantallaBienvenida | `{ mesa, nombre, iniciales }` | Mesas |
| `precarga:nueva` | PrecargaControl | `{ mesa, cantidad, precargaId }` | Mesas |
| `precarga:items_listos` | PrecargaControl | `{ mesa, items, precargaId }` | Comanda |
| `precarga:cargar_en_comanda` | MesaDetalles | `{ precargaId, mesa }` | PrecargaControl |
| `precarga:revisada` | PrecargaControl | `{ precargaId, revisadoPor, timestamp }` | EventBus |
| `cliente:producto_con_variantes` | menu-digital.js (C) | `{ producto, variantes }` | modal-opciones.js (C) |
| `cliente:producto_agregado_a_orden` | modal-opciones.js (C) | `{ item }` | menu-digital.js (C) |
| `cliente:alergias_actualizadas` | alergias-cliente.js (C) | `{ alergias: string[] }` | menu-digital.js (C) |

### 7.1 Detalle de `cliente:producto_con_variantes`

Emitido por `js/modulos/cliente/menu-digital.js` (Célula C) cuando
el cliente toca un producto que tiene al menos una variante activa
con al menos una opción activa.

**Payload:** `{ producto, variantes }`.

- `producto`: objeto con los campos del producto que el cliente
  tocó. Incluye `variantes_ids`.
- `variantes`: array con las variantes activas resueltas desde
  `Store.obtenerEstado().variantes`.

**Comportamiento del consumidor:**

- **modal-opciones.js (C):** escucha el evento y abre el modal de
  selección de opciones.

**Nota de diseño:** es el evento análogo a `producto:con_variantes`
de Célula B1, pero en el flujo del cliente. Se mantiene separado
para no cruzar contratos entre células. Si en el futuro se
unifican, se documentará el cambio en este catálogo.

### 7.2 Detalle de `cliente:producto_agregado_a_orden`

Emitido por `js/modulos/cliente/modal-opciones.js` (Célula C) tras
agregar un ítem con opciones a la orden del cliente.

**Payload:** `{ item }` con el ítem completo.

**Comportamiento del consumidor:**

- **menu-digital.js (C):** refresca la vista de la orden en curso.

**Nota de diseño:** es el evento análogo a
`producto:agregado_a_comanda` de Célula B1, pero en el flujo del
cliente.

### 7.3 Detalle de `cliente:alergias_actualizadas`

Emitido por `js/modulos/cliente/alergias-cliente.js` (Célula C)
cuando el cliente modifica su lista de alergias desde el modal de
la orden.

**Payload:**

    {
      alergias: ["gluten", "lactosa", ...]
    }

**Comportamiento del consumidor:**

- **menu-digital.js (C):** actualiza la vista de alergias activas
  del cliente y refleja el estado en el modal de orden.

**Nota de diseño:** este evento es del flujo del cliente. El campo
`alergias` es un array de strings con valores del enum cerrado
`js/dominio/alergenos.js`. No confundir con `alergias_manuales`
del item, que es un campo del pedido y se llena por el mesero
(B1).

---

## 8. Eventos de Configuración

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `config:actualizada` | Config | *(sin payload)* | Mesas, App |

---

## 9. Eventos de Sincronización y Realtime

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `realtime:documento_actualizado` | DBAppwrite | `{ coleccion, tipo, datos }` | Interno |
| `coleccion:actualizada` | DBAppwrite / Realtime | `objeto fila` | Vistas según colección |

> El evento genérico `coleccion:actualizada` se emite para cada
> colección. El nombre exacto depende de la clave usada en
> `DBAppwrite.COLECCIONES`.
>
> Nota: para la colección `variantes`, Realtime emite
> `variantes:actualizada` (singular) por la clave `variantes`.
> El repositorio emite `variantes:actualizadas` (plural).
>
> Nota: `movimientos:actualizados` es un evento de dominio
> emitido por `db-inventario.js`, distinto del evento genérico
> que Realtime emitiría si `movimientos` estuviera suscrito.
> En Fase 1, no hay suscripción de Realtime a `movimientos`.
> El evento llega por EventBus local.
>
> Nota: `producto:con_variantes`, `producto:agregado_a_comanda`,
> `cliente:producto_con_variantes`,
> `cliente:producto_agregado_a_orden` y
> `cliente:alergias_actualizadas` son eventos de dominio, no de
> sincronización. No tienen relación con Realtime.
>

---

## 10. Eventos de UI

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `app:cambiarVista` | Auth / EventBus | `string` (nombre de vista) | App |
| `app:error` | DB | `string` (mensaje) | App |

---

## 11. Eventos de Autenticación y Staff

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `auth:mostrarRegistro` ⚠️ deprecado | Auth | *(sin payload)* | PantallaInicio |
| `jugador:cuenta_creada` | Auth | `{ nombre, timestamp }` | ClienteModulo |
| `auth:staff_vinculado` | Auth | `membresia` | Store, D |

> **Nota:** los eventos `auth:login_exitoso`, `auth:login_fallido`,
> `auth:registro_completado` y `auth:sesion_expirada` ya no se
> emiten directamente por `auth.js`.
>
> **Nota deprecación:** `auth:mostrarRegistro` figura en esta
> tabla marcado como deprecado. No se emite en la versión actual
> de `auth.js`.

---

## 12. Eventos de Perfil Global

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `perfil:actualizado` | Perfil UI | `{ usuarioId, cambios }` | Store, vistas de perfil |
| `perfil:cargado` ⚠️ deprecado | Auth | `{ usuarioId, perfil }` | PantallaBienvenida, Perfil |

> En `auth.js`, el perfil se incluye dentro del objeto
> `usuarioActual` y no se emite un evento separado.
> `perfil:cargado` queda marcado como deprecado.

---

## 13. Cómo suscribirse

    EventBus.on('avisos:actualizada', (aviso) => {
      console.log('Nuevo aviso:', aviso);
    });

    const unsubscribe = EventBus.on('mesa:actualizada', callback);
    unsubscribe();

---

## 14. Convención para nuevos eventos

1. Usar `modulo:accion`.
2. Documentar antes del PR.
3. Incluir siempre payload.
4. Usar `EventBus.emit` y `EventBus.on`.
5. Guardar la función de limpieza para evitar memory leaks.

---

## 15. Auditoría pendiente

La auditoría v1.5.0/v1.5.1 sobre eventos de Core quedó
resuelta en v1.6.0. Los 6 eventos originalmente marcados sin
emisor se resolvieron así:

| Evento | Resolución |
|--------|------------|
| `sincronizacion:completada` | Eliminado del catálogo. |
| `sync:colaActualizada` | Eliminado del catálogo. |
| `sync:completada` | Eliminado del catálogo. |
| `recetas:actualizadas` | Emisión confirmada por `saveRecetas`. |
| `auth:mostrarRegistro` | Marcado deprecado. |
| `perfil:cargado` | Marcado deprecado. |

**Pendiente:** auditar los eventos de las secciones 2, 3, 5, 8 y
12 con emisor B1, B2, B3, D contra su código real. Se requiere
acceso a esos archivos vía Coordinación.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*
*Versión 1.7.0 — 2026-10-08*