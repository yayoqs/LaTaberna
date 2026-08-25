# 📡 Catálogo de Eventos del Sistema – La Taberna (v5.1.0)

**Última actualización:** 2026-08-25

---

## Cambios en v5.1.0 respecto a v5.0

- Se incorpora `avisos:actualizada` para la nueva colección
  `laTaberna_Avisos`.

---

## Convenciones

- Nombre del evento: `modulo:accion`, por ejemplo `mesa:actualizada`, `avisos:actualizada`.
- Payload: objeto JSON con los datos del evento.
- Emisor: módulo que emite el evento.
- Consumidores: módulos que se suscriben.

---

## 1. Eventos del Núcleo

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `db:inicializada` | DB | *(sin payload)* | Todas las vistas |
| `sincronizacion:completada` | DB | *(sin payload)* | Vistas principales |
| `vista:cambiada` | App | `string` (nombre de vista) | Módulos de cliente, guía, KDS |
| `vista:activada` | App | `string` (nombre de vista) | Módulos que renderizan al entrar |
| `state:cambiado` | Store | `{ state, action }` | Cualquier suscriptor del Store |

---

## 2. Eventos de Mesa

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `mesa:seleccionada` | Mesas | `string` (número o identificador de mesa) | MesaDetalles, Pedido |
| `mesa:actualizada` | DB / Store / Comanda | `{ mesa: string, estado: string }` | Mesas, KDS, Caja, Cliente |
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
| `comanda:enviada` | PedidoRepository | `objeto comanda` | KDS, App |
| `comanda:lista` | KDS | `{ id, mesa }` | App, Store |
| `comanda:completada` | Comando completarSubcomanda | `{ id, mesa }` | Store |
| `comanda:subcomanda_completada` | Comando completarSubcomanda | `{ id, destino, ambasListas }` | KDS |
| `comandas:guardadas` | DBCore | `array de comandas` | App, KDS |
| `producto:seleccionado` | Carta | `objeto producto` | Comanda |
| `cuenta:solicitada` | Cuenta | *(sin payload)* | Cuenta |
| `cobro:solicitado` | Cuenta / MesaDetalles | *(sin payload)* | Cobro |
| `pago:confirmado` | Cobro | `{ mesa, pedidoId, total }` | Pedido, Store |

---

## 4. Eventos de Productos, Insumos e Inventario

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `productos:cargados` | DB | `array de productos` | Recetas, Menu, App |
| `productos:actualizada` | Realtime / DB | `objeto producto` | Vistas de menú |
| `producto:agotado` | Comando marcarAgotado | `{ prodId }` | KDS, Menu, Carta |
| `insumos:actualizados` | DBInventario | `array de insumos` | Store, Despensa |
| `inventario:actualizado` | DBInventario | *(sin payload)* | Store, Despensa |
| `inventario:stock_bajo` | DBInventario | `{ insumo, stock, unidad }` | App |
| `recetas:actualizadas` | DBInventario | *(sin payload)* | Recetas, App |

---

## 5. Eventos de Reparto y Pedidos Unificados

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `pedidos:actualizada` | Realtime / DB | `objeto pedido` | Reparto, Caja, Cliente |
| `delivery:creado` | DeliveryService | `objeto delivery` | Store |
| `delivery:enviado_a_cocina` | PedidoManager / DeliveryService | `{ deliveryId, items }` | Store |
| `delivery:listo` | KDS | `{ deliveryId, comandaId, estado }` | Store |

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
| `cliente:cuenta_creada` | Auth | `{ nombreUsuario, usuarioId, perfilGlobal }` | ClienteModulo |
| `cliente:precarga_enviada` | MenuDigital | `{ id, mesa, items, clienteId, id_usuario, nombreComensal }` | PrecargaControl |
| `cliente:llamar_garzon` | PantallaBienvenida | `{ mesa: string }` | Mesas, AvisosMesero |
| `cliente:comensal_agregado` | PantallaBienvenida | `{ mesa, nombre, iniciales }` | Mesas |
| `precarga:nueva` | PrecargaControl | `{ mesa, cantidad, precargaId }` | Mesas |
| `precarga:items_listos` | PrecargaControl | `{ mesa, items, precargaId }` | Comanda |
| `precarga:cargar_en_comanda` | MesaDetalles | `{ precargaId, mesa }` | PrecargaControl |
| `precarga:revisada` | PrecargaControl | `{ precargaId, revisadoPor, timestamp }` | EventBus |

---

## 8. Eventos de Configuración

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `config:actualizada` | Config | *(sin payload)* | Mesas, App |

---

## 9. Eventos de Sincronización y Realtime

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `sync:colaActualizada` | DBShim | `number` (pendientes) | App |
| `sync:completada` | DBShim | `timestamp` | App |
| `realtime:documento_actualizado` | DBAppwrite | `{ coleccion, tipo, datos }` | Interno |
| `avisos:actualizada` | DBAppwrite / Realtime | `objeto aviso` | B1 (bandeja), C (cliente) |

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
| `auth:mostrarRegistro` | Auth | *(sin payload)* | PantallaInicio |
| `auth:login_exitoso` | Auth | `{ nombreUsuario, usuarioId, roles, rolPrincipal, vistaInicial }` | App, Store |
| `auth:login_fallido` | Auth | `{ nombreUsuario, motivo }` | App |
| `auth:registro_completado` | Auth | `{ nombreUsuario, usuarioId, perfilGlobal }` | App, ClienteModulo |
| `auth:sesion_expirada` | Auth | *(sin payload)* | App |
| `staff:creado` | DB | `objeto staff` | Store, D |
| `staff:actualizado` | DB | `objeto staff` | Store, D |
| `staff:vinculado` | Auth | `{ usuarioId, espacioId, roles }` | Store, D |

---

## 12. Eventos de Perfil Global

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `perfil:actualizado` | Auth / Perfil UI | `{ usuarioId, cambios }` | Store, vistas de perfil |
| `perfil:cargado` | Auth | `{ usuarioId, perfil }` | PantallaBienvenida, Perfil |

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

*Documento mantenido por el Coordinador de Integración.*
*Versión 5.1.0 — 2026-08-25*