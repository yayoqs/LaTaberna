┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-08-01 08:00 UTC                        │
│ TIPO:      DOCUMENTO OFICIAL                           │
│ REFERENCIA: Catálogo de Eventos del Sistema v4.0        │
└──────────────────────────────────────────────────────────┘

# 📡 Catálogo de Eventos del Sistema – La Taberna (v4.0)

**Última actualización:** 2026-08-01

---

## Cambios en v4.0 respecto a v3.1

- **Agregados**: eventos de autenticación con Appwrite Auth (`auth:login_exitoso`, `auth:login_fallido`, `auth:registro_completado`).
- **Agregados**: eventos de perfil global (`perfil:actualizado`, `perfil:cargado`).
- **Agregados**: eventos de multi-espacio (`espacio:cambiado`).
- **Actualizados**: emisor de `cliente:cuenta_creada` ahora incluye `perfil_global`.
- **Actualizados**: payload de `app:cambiarVista` ahora incluye `espacioActivoId`.

---

## Convenciones

- **Nombre del evento:** `modulo:accion` (ej: `mesa:actualizada`, `cliente:precarga_enviada`)
- **Payload:** objeto JSON con los datos del evento
- **Emisor:** módulo que emite el evento
- **Consumidores:** módulos que se suscriben al evento

---

## 1. Eventos del Núcleo (Core)

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `db:inicializada` | DB (db.js) | *(sin payload)* | Todas las vistas |
| `sincronizacion:completada` | DB (db.js) | *(sin payload)* | Vistas principales |
| `vista:cambiada` | App (app.js) | `string` (nombre de vista) | Módulos de cliente, guía, KDS |
| `state:cambiado` | Store (store.js) | `{ state, action }` | Cualquier suscriptor del Store |

---

## 2. Eventos de Mesa

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `mesa:seleccionada` | Mesas (renderer.js) | `number` (número de mesa) | MesaDetalles, Pedido |
| `mesa:actualizada` | DB / Store / Comanda | `{ mesa: number, estado: string }` | Mesas, KDS, Caja, Cliente |
| `mesa:liberada` | PedidoRepository | `{ numero: number }` | Mesas, Store |
| `mesa:abierta` | Pedido (pedido-ui.js) | `objeto mesa` | Comanda |
| `mesa:cerrada` | Pedido (pedido-ui.js) | *(sin payload)* | — |
| `mesas:guardadas` | DB (db-core.js) | `array de mesas` | App (para re-render) |
| `mesa:agregada` | Comando agregarMesa | `objeto mesa` | Mesas |
| `mesa:badge_click` | Mesas (renderer.js) | `{ mesa: number, precargaId: string }` | PrecargaControl |
| `mesas:limpiar_badge` | Comanda | `{ mesa: number }` | Mesas |
| `mesa-detalle:abierto` | MesaDetalles | *(sin payload)* | Pedido (bloqueo de apertura) |
| `mesa-detalle:cerrado` | MesaDetalles | *(sin payload)* | Pedido (desbloqueo de apertura) |
| `mesa:tomar_pedido` | MesaDetalles | `{ mesa: number }` | Pedido |

---

## 3. Eventos de Pedido y Comanda

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `pedido:creado` | PedidoService | `objeto pedido` | Store |
| `pedido:cerrado` | PedidoService / Cobro | `{ mesa, pedidoId, total, formaPago }` | App (Caja.render), Store |
| `pedido:item_agregado` | PedidoService | `{ pedidoId, nombre, cantidad }` | Store |
| `pedido:transaccion_agregada` | PedidoService | `{ pedidoId, persona, monto, formaPago, saldoRestante, pedidoCerrado }` | Store |
| `comanda:enviada` | PedidoRepository | `objeto comanda` | KDS, App (para re-render) |
| `comanda:lista` | KDS | `{ id: string, mesa: number }` | App, Store |
| `comanda:completada` | Comando completarSubcomanda | `{ id: string, mesa: number }` | Store |
| `comanda:subcomanda_completada` | Comando completarSubcomanda | `{ id, destino, ambasListas }` | KDS |
| `comandas:guardadas` | DB (db-core.js) | `array de comandas` | App (KDS.refresh) |
| `producto:seleccionado` | Carta | `objeto producto` | Comanda |
| `cuenta:solicitada` | Cuenta | *(sin payload)* | Cuenta (autoinvocado) |
| `cobro:solicitado` | Cuenta / MesaDetalles | *(sin payload)* | Cobro |
| `pago:confirmado` | Cobro | `{ mesa, pedidoId, total }` | Pedido (cerrar modal), Store |

---

## 4. Eventos de Productos e Inventario

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `productos:cargados` | DB (db.js) | `array de productos` | Recetas, Menu, App |
| `productos:actualizada` | Realtime (Appwrite) | `objeto producto` | Vistas de menú |
| `producto:agotado` | Comando marcarAgotado | `{ prodId: string }` | KDS, Menu, Carta |
| `ingredientes:actualizados` | DBInventario | `array de ingredientes` | Store |
| `inventario:actualizado` | DBInventario | *(sin payload)* | Store |
| `inventario:stock_bajo` | DBInventario | `{ ingrediente, stock, unidad }` | App (mostrarToast) |
| `recetas:actualizadas` | DBInventario | *(sin payload)* | Recetas, App |

---

## 5. Eventos de Delivery

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `delivery:creado` | DeliveryService | `objeto delivery` | Store |
| `delivery:enviado_a_cocina` | PedidoManager | `{ deliveryId, items }` | Store |
| `delivery:listo` | KDS | `{ deliveryId, comandaId, estado }` | Store |
| `pedidosDelivery:guardados` | DB (db-core.js) | `array de pedidos` | Reparto, App |

---

## 6. Eventos de Turno y Auditoría

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `turno:iniciado` | PedidoManager | `objeto turno` | App (Caja.render) |
| `turno:solicitar_cierre` | PedidoManager | *(sin payload)* | TurnoManager |
| `turno:cerrado` | TurnoManager | `{ timestamp: string }` | App (Caja.render, mostrarToast) |
| `audit:actualizado` | PedidoManager | `{ turnoId, total }` | App |

---

## 7. Eventos de Cliente y Precarga

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `cliente:mesa_ingresada` | PantallaBienvenida | `{ mesa: number }` | Mesas (badge de espera) |
| `cliente:cuenta_creada` | Auth | `{ nombre, timestamp, perfil_global }` | ClienteModulo (cambio de vista) |
| `cliente:precarga_enviada` | MenuDigital | `{ id, mesa, items, clienteId, id_usuario, nombre_comensal }` | PrecargaControl |
| `cliente:llamar_garzon` | PantallaBienvenida | `{ mesa: number }` | Mesas (notificación visual) |
| `cliente:comensal_agregado` | PantallaBienvenida | `{ mesa, nombre, iniciales }` | Mesas |
| `precarga:nueva` | PrecargaControl | `{ mesa, cantidad, precargaId }` | Mesas (setBadge) |
| `precarga:items_listos` | PrecargaControl | `{ mesa, items, precargaId }` | Comanda (agregarItems) |
| `precarga:cargar_en_comanda` | MesaDetalles | `{ precargaId, mesa }` | PrecargaControl |
| `precarga:revisada` | PrecargaControl | `{ precargaId, revisadoPor, timestamp }` | EventBus (registro) |
| `precargas_cliente:actualizada` | Realtime (Appwrite) | `objeto precarga` | PantallaBienvenida |

---

## 8. Eventos de Configuración

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `config:actualizada` | Config | *(sin payload)* | Mesas (ciclo-vida: renderGrid + renderZoneButtons) |

---

## 9. Eventos de Sincronización

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `sync:colaActualizada` | DBShim | `number` (pendientes) | App (badge) |
| `sync:completada` | DBShim | `timestamp` | App (indicador visual) |
| `realtime:documento_actualizado` | DBAppwrite | `{ coleccion, tipo, datos }` | — (interno) |

---

## 10. Eventos de UI

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `app:cambiarVista` | Auth / EventBus | `{ vista: string, espacioActivoId: string }` | App (showView) |
| `app:error` | DB | `string` (mensaje) | App (mostrarToast) |

---

## 11. Eventos de Autenticación (v4.0 — Appwrite Auth)

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `auth:mostrarRegistro` | Auth | *(sin payload)* | PantallaInicio |
| `auth:login_exitoso` | Auth (login) | `{ nombre, rol, vistaInicial }` | App, Store (sincronizar estado) |
| `auth:login_fallido` | Auth (login) | `{ nombre, motivo }` | App (mostrarToast) |
| `auth:registro_completado` | Auth (registrarCliente) | `{ nombre, perfil_global }` | App, ClienteModulo |
| `auth:sesion_expirada` | Auth (logout) | *(sin payload)* | App (redirigir a inicio) |

---

## 12. Eventos de Perfil Global (v4.0 — multi-espacio)

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `perfil:actualizado` | Auth / Perfil UI | `{ usuarioId, cambios }` | Store (global_perfiles), vistas de perfil |
| `perfil:cargado` | Auth (login) | `{ usuarioId, perfil }` | PantallaBienvenida, Perfil |
| `espacio:cambiado` | Auth (cambiarEspacio) | `{ espacioId, nombre, rol }` | App (reiniciar Store con nuevo espacioId) |

---

## 13. Cómo suscribirse a un evento

    // Suscripción simple
    EventBus.on('mesa:actualizada', (data) => {
      console.log('Mesa', data.mesa, 'cambió a estado', data.estado);
    });

    // Suscripción con limpieza
    const callback = (data) => { /* ... */ };
    const unsubscribe = EventBus.on('comanda:enviada', callback);
    // Para dejar de escuchar:
    unsubscribe();

---

## 14. Convención para nuevos eventos

1. Usar el formato `modulo:accion` (ej: `receta:creada`, `cliente:pedido_confirmado`).
2. Documentar el evento en este archivo antes de hacer el PR.
3. Incluir siempre el payload en la emisión para que los consumidores puedan reaccionar.
4. Usar `EventBus.emit()` para emitir y `EventBus.on()` para suscribirse.
5. La función `EventBus.on()` devuelve una función de limpieza; usarla para evitar memory leaks.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 4.0 — 2026-08-01*