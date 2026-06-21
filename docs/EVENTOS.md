# 📡 Catálogo de Eventos del Sistema – La Taberna (v2.1)

> **Convención de nombres:** `modulo:accion` (ej: `mesa:actualizada`, `cliente:precarga_enviada`).

---

## Eventos emitidos por el Núcleo (Core)

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `mesa:actualizada` | `{ mesa: number, estado: string }` | Al cambiar el estado de una mesa |
| `mesa:liberada` | `{ numero: number }` | Al liberar una mesa después del pago |
| `mesas:guardadas` | `array de mesas` | Al sincronizar todas las mesas |
| `pedido:creado` | `objeto pedido` | Al crear un nuevo pedido |
| `pedido:cerrado` | `{ mesa: number, pedidoId: string, total: number, formaPago: string }` | Al cerrar un pedido |
| `comanda:enviada` | `objeto comanda` | Al enviar una comanda a cocina/barra |
| `comanda:lista` | `{ id: string, mesa: number }` | Al marcar una comanda como lista |
| `comandas:guardadas` | `array de comandas` | Al sincronizar todas las comandas |
| `productos:cargados` | `array de productos` | Al cargar/actualizar productos |
| `recetas:actualizadas` | *(sin payload)* | Al modificar recetas (señal para refrescar) |
| `inventario:actualizado` | *(sin payload)* | Al cambiar el inventario |
| `inventario:stock_bajo` | `{ ingrediente: string, stock: number, unidad: string }` | Al detectar stock bajo |
| `sincronizacion:completada` | *(sin payload)* | Al completar una sincronización |
| `db:inicializada` | *(sin payload)* | Al terminar la carga inicial |
| `vista:cambiada` | `string` (nombre de vista) | Al cambiar de pestaña en la UI |

---

## Eventos Genéricos de Realtime (v2.10+)

Para **cada colección** definida en `DBAppwrite.COLECCIONES`, el sistema emite automáticamente:

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `{coleccion}:actualizada` | `objeto documento` (el documento modificado) | Al crearse, actualizarse o eliminarse un documento en Appwrite |

**Ejemplos:**
- `productos:actualizada` → payload: `{ id: 'prod_1', nombre: '...', precio: 1500, ... }`
- `precargas_cliente:actualizada` → payload: `{ id: 'pre_1', mesa: 5, items: [...], estado: 'pendiente', ... }`
- `eventos_en_vivo:actualizada` → payload: `{ id: 'evt_1', tipo: 'bingo', datos: {...}, estado: 'activo', ... }`

---

## Eventos de la Célula C (Frontend Cliente)

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `cliente:precarga_enviada` | `{ id: string, mesa: number, items: array, clienteId: string }` | Al confirmar una precarga desde el menú cliente |
| `cliente:cuenta_creada` | `{ nombre: string, timestamp: number }` | Al registrarse un nuevo cliente desde el frontend |

---

## Eventos de la Célula D (Administración)

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `eventos_en_vivo:actualizada` | `objeto documento` (el documento modificado) | Automático por Realtime al crearse, actualizarse o eliminarse un documento en la colección `Eventos_en_vivo`. |

**Nota importante:** Los eventos `evento:creado` y `evento:actualizado` han sido eliminados del catálogo oficial. El sistema ya cubre estos cambios automáticamente a través del Realtime. Ningún módulo debe emitirlos manualmente.

---

## Cómo suscribirse a un evento

```javascript
// Suscripción simple
EventBus.on('mesa:actualizada', (data) => {
  console.log('Mesa', data.mesa, 'cambió a estado', data.estado);
});

// Suscripción con limpieza
const callback = (data) => { /* ... */ };
EventBus.on('comanda:enviada', callback);
// Para dejar de escuchar:
EventBus.off('comanda:enviada', callback);