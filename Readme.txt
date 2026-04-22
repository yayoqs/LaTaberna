
# 🍺 PubPOS — Sistema de Gestión para Pub Restaurant

## 🎯 Descripción
...
- [ ] Integración con PedidosYa / Rappi
- [ ] Lista de espera / queue de mesas
- [ ] División de cuenta por persona
- [ ] Stock e inventario de insumos
Please continue.

Pensamiento profundo
Total: 2 tareas
0 tareas pendientes
Verificar y debug de la aplicación
Actualizar README.md
¡Tu PubPOS está listo! 🍺🔥 Aquí te explico todo lo que se construyó:

🖥️ ¿Qué incluye el sistema?
🪑 Vista de Mesas (pantalla principal)
Grilla de 12 mesas con 4 estados visuales con colores:
⚫ Libre → 🔴 Ocupada → 🟡 Lista → 🔵 Cuenta
Cada mesa muestra: mozo, comensales, tiempo abierta y total acumulado
Podés agregar más mesas con el botón + Nueva Mesa
📋 Toma de Pedidos (al tocar una mesa)
Carta completa con filtro por categoría y buscador instantáneo
21 productos de ejemplo cargados (hamburguesas, cocteles, cervezas, entradas, postres...)
Cada producto indica su destino (🍺 Barra / 🔥 Cocina)
Control de cantidades + campo de aclaraciones por ítem ("sin sal", "cocción media"...)
3 botones de envío:
🍺 Enviar Barra — solo bebidas/cocteles
🔥 Enviar Cocina — solo comidas
📤 Enviar Todo — todos los pendientes
🖨️ Tickets 80mm
Al enviar cada comanda se genera vista previa del ticket lista para imprimir
Formatos diferenciados:
Comanda Cocina: header negro, mesa grande, ítems + aclaraciones
Comanda Barra: ídem para bebidas
Cuenta: detalle con subtotales para mostrar al cliente
Comprobante de Caja: forma de pago, descuento aplicado
🔥 Monitor de Cocina (KDS)
Vista en tiempo real de todas las comandas
Flujo: Nueva → En proceso → Lista
Alerta visual si supera 15 minutos
💰 Cierre de Mesa
Resumen agrupado, selección de forma de pago (Efectivo/Débito/Crédito/Transferencia/Mixto) y descuento porcentual
📊 Caja
KPIs del turno + tabla de todos los pedidos
🖨️ Sobre las impresoras de 80mm
La impresión usa el diálogo de impresión del sistema operativo, que es compatible con cualquier impresora térmica USB, red o Bluetooth configurada en Windows/Mac. Para impresión directa sin diálogo (como Fudo), necesitarías instalar QZ Tray en el equipo.

Vista previa / Explorador de archivos / Configuración / Publicar / Tutorial
Desarrollador de IA
Tu empleado 24/7
Pide a Genspark que modifique o mejore tu aplicación...
Claude Sonnet 4.6
Claude Sonnet 4.6
Tool Call
Function Name:
Write
Arguments:
content:
# 🍺 PubPOS — Sistema de Gestión para Pub Restaurant

## 🎯 Descripción
Sistema POS (Punto de Venta) completo para pub restaurant, similar en flujo a Fudo. Permite gestionar mesas, tomar pedidos, enviar comandas a cocina y barra, y emitir tickets de 80mm.

## ✅ Funcionalidades implementadas

### 🪑 Gestión de Mesas
- Grilla visual de mesas con estados diferenciados por color
  - **Libre** (gris) — Mesa disponible
  - **Ocupada** (rojo) — Mesa con pedido activo
  - **Lista** (amarillo) — Platos/bebidas listos para entregar
  - **Cuenta** (azul) — Cuenta pedida, esperando pago
- Indicador de mozo, comensales, tiempo transcurrido y total acumulado
- Agregar nuevas mesas dinámicamente
- Persistencia de estado entre sesiones (localStorage)

### 📋 Toma de Pedidos / Comanda
- Carta de productos organizada por categorías con buscador
- Indicador de destino por producto (Barra / Cocina / Ambos)
- Agregar/quitar ítems con control de cantidad
- Campo de aclaración por ítem ("sin sal", "punto medio", etc.)
- Observación general de mesa
- Botones de envío diferenciado:
  - **Enviar Barra** — Solo bebidas/cocteles
  - **Enviar Cocina** — Solo comidas
  - **Enviar Todo** — Todos los pendientes

### 🔥 Monitor de Cocina (KDS)
- Vista en tiempo real de todas las comandas pendientes
- Estados: **Nueva** → **En proceso** → **Lista**
- Animación de alerta para comandas nuevas
- Temporizador de tiempo desde el envío (con alerta roja si supera 15 min)
- Al marcar como "Lista", la mesa pasa automáticamente a estado "Esperando"

### 🖨️ Tickets de 80mm
- **Ticket de Comanda** para Cocina: header negro destacado, mesa grande, ítems con aclaraciones
- **Ticket de Comanda** para Barra: ídem con estilo diferenciado
- **Ticket de Cuenta**: detalle completo con subtotales, datos del local
- **Ticket de Cierre**: comprobante de pago con descuento, forma de pago
- **Impresión de prueba** por destino (cocina/barra/caja)
- Vista previa antes de imprimir
- Impresión a través del diálogo del sistema (compatible con impresoras USB, red y Bluetooth)
- Página configurada para `size: 80mm auto`

### 💰 Cierre de Mesa
- Resumen detallado agrupado por producto
- Selección de forma de pago: Efectivo, Débito, Crédito, Transferencia, Mixto
- Descuento porcentual con actualización en tiempo real
- Cierre y liberación automática de la mesa

### 📊 Caja (Resumen del Turno)
- 4 tarjetas de KPIs: Total ventas, Mesas cerradas, Ticket promedio, Mesas abiertas
- Tabla completa de todos los pedidos del turno con estado

### ⚙️ Configuración
- Gestión de productos: crear, editar, activar/desactivar, eliminar
- Datos del local: nombre, dirección, CUIT, pie de ticket
- Cantidad de mesas (ajustable en caliente)
- Panel de configuración de impresoras (Cocina, Barra, Caja)

## 📁 Estructura de archivos

```
index.html          — App principal
css/
  style.css         — Estilos completos (dark theme)
js/
  data.js           — Capa de datos (API REST + localStorage)
  pos.js            — Lógica POS: mesas, pedidos, KDS, caja
  tickets.js        — Generador de tickets 80mm
  config-ui.js      — UI de configuración y gestión de productos
```

## 🗄️ Modelos de datos

### Tabla `productos`
| Campo | Tipo | Descripción |
|---|---|---|
| nombre | text | Nombre del producto |
| precio | number | Precio de venta |
| categoria | text | Bebidas, Cervezas, Cocteles, Vinos, Entradas, Comidas, Postres |
| destino | text | barra / cocina / ambos |
| descripcion | text | Descripción breve |
| activo | bool | Disponibilidad |

### Tabla `pedidos`
| Campo | Tipo | Descripción |
|---|---|---|
| mesa | number | Número de mesa |
| items | rich_text | JSON array de ítems |
| estado | text | abierta / en_proceso / lista / cerrada |
| total | number | Total cobrado |
| mozo | text | Nombre del mozo |
| comensales | number | Cantidad de personas |
| observaciones | text | Notas + forma de pago |

## 🖨️ Guía de impresión de tickets

### Para impresoras USB locales:
1. Conectar impresora y configurarla como predeterminada en Windows
2. En el modal de ticket, hacer clic en **Imprimir**
3. En el diálogo de impresión, seleccionar la impresora correcta
4. Verificar que el papel sea de 80mm de ancho
5. Desactivar márgenes en opciones avanzadas

### Para impresoras de red (IP):
La configuración de IP en la sección Config es para referencia. La impresión se realiza siempre a través del sistema operativo. Para impresión directa por IP, se requiere software puente como **QZ Tray** o **PrintNode**.

### Configuración recomendada en Windows:
- Nombre: Epson TM-T20 (o el modelo de tu impresora)
- Papel: 80mm x Roll
- Márgenes: Ninguno/Mínimo

## 🔜 Próximas mejoras recomendadas
- [ ] Integración con QZ Tray para impresión directa sin diálogo
- [ ] Sistema de usuarios y roles (mozo / supervisor / caja)
- [ ] Reportes por período (día, semana, mes)
- [ ] Gestión de reservas
- [ ] Integración con PedidosYa / Rappi
- [ ] Lista de espera / queue de mesas
- [ ] División de cuenta por persona
- [ ] Stock e inventario de insumos