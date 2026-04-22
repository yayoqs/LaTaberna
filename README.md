# 🍺 PubPOS — Sistema de Gestión para Pub Restaurant

## Descripción
Sistema POS (Punto de Venta) completo para pub restaurant. Gestión de mesas, toma de pedidos, monitor de cocina (KDS) y emisión de tickets de 80mm. Funciona **100% sin conexión a internet** una vez descargado (las fuentes e íconos son locales).

---

## ✅ Funcionalidades implementadas

| Módulo | Descripción |
|---|---|
| 🪑 **Mesas** | Grilla visual con 4 estados (Libre/Ocupada/Lista/Cuenta) |
| 📋 **Pedidos** | Carta con categorías, buscador, aclaraciones por ítem |
| 🔥 **KDS Cocina** | Monitor en tiempo real, estados Nueva/En proceso/Lista |
| 🖨️ **Tickets 80mm** | Comanda Cocina, Comanda Barra, Cuenta, Cierre/Cobro, Prueba |
| 💰 **Cierre** | Formas de pago, descuento %, comprobante automático |
| 📊 **Caja** | KPIs del turno + tabla de todos los pedidos |
| ⚙️ **Config** | ABM productos, datos del local, config de impresoras |

---

## 📁 Estructura de archivos — Guía de edición por etapas

```
pubpos/
│
├── index.html              ← Estructura HTML (modales, vistas, orden de scripts)
│
├── css/                    ← Estilos modulares — editar uno a la vez
│   ├── vars.css            ← 🎨 COLORES Y TIPOGRAFÍA — empezar aquí para rediseñar
│   ├── base.css            ← Reset, botones genéricos, toasts
│   ├── layout.css          ← Header, nav, vistas, toolbar
│   ├── mesas.css           ← Tarjetas de mesa
│   ├── pedido.css          ← Modal de pedido, carta, comanda
│   ├── kds.css             ← Monitor de cocina
│   ├── caja.css            ← Vista de caja y tabla
│   ├── modals.css          ← Modales pequeños, config, impresoras
│   └── ticket.css          ← Estilos del ticket 80mm (preview)
│
├── js/                     ← Lógica modular — un archivo por responsabilidad
│   ├── db.js               ← 🗄️ DATOS: API REST + localStorage (editar para cambiar fuente de datos)
│   ├── utils.js            ← 🔧 HELPERS: formato de moneda, fechas, toast, etc.
│   ├── mesas.js            ← Render y gestión de tarjetas de mesa
│   ├── pedido.js           ← Modal de pedido, carta, comanda, cierre
│   ├── kds.js              ← Monitor de cocina
│   ├── caja.js             ← Vista de caja
│   ├── tickets.js          ← Generación de tickets 80mm
│   ├── config.js           ← ABM de productos y configuración del local
│   └── app.js              ← 🚀 ARRANQUE: init() y navegación (leer primero)
│
└── vendor/
    └── fontawesome/        ← Íconos FontAwesome LOCAL (sin internet)
        ├── css/all.min.css
        └── webfonts/       ← Archivos de fuente (.woff2)
```

---

## 🎨 ¿Cómo cambiar colores / tema?

Abrí **`css/vars.css`** y modificá las variables CSS:

```css
/* Ejemplo: cambiar el color de acento de dorado a verde */
--color-accent: #10b981;   /* era #f59e0b */
```

Todos los componentes heredan automáticamente el cambio.

---

## ➕ ¿Cómo agregar un producto?

**Desde la app:** Config → Productos → Nuevo Producto

**Directo en código:** Editá `js/db.js` → función `crearProducto()` o cargá datos directamente en la tabla `productos` de la API.

---

## 🖨️ ¿Cómo configurar impresoras de 80mm?

### Opción A: USB / Local (recomendada para empezar)
1. Conectar la impresora USB y instalar drivers
2. Configurarla como impresora predeterminada del sistema (Windows/Mac)
3. En PubPOS: Config → Impresoras → seleccionar "USB / Local" → Probar
4. Al imprimir un ticket, el sistema abre el diálogo del OS

### Opción B: Red (IP fija)
1. Asignarle una IP fija a la impresora en el router
2. En PubPOS: Config → Impresoras → ingresar la IP → seleccionar "Red"
3. La impresión igual pasa por el diálogo del OS

### Opción C: Impresión directa sin diálogo (avanzado)
Instalar **QZ Tray** (gratuito) en la PC que actúa como servidor de impresión. Esto permite enviar el ticket directamente a la impresora sin popup.

---

## 🗄️ Modelos de datos

### Tabla `productos`
| Campo | Tipo | Valores |
|---|---|---|
| nombre | text | Nombre del producto |
| precio | number | Precio de venta |
| categoria | text | Bebidas, Cervezas, Cocteles, Vinos, Entradas, Comidas, Postres |
| destino | text | `barra` / `cocina` / `ambos` |
| descripcion | text | Descripción breve (opcional) |
| activo | bool | `true` = disponible en la carta |

### Tabla `pedidos`
| Campo | Tipo | Valores |
|---|---|---|
| mesa | number | Número de mesa |
| items | rich_text | JSON array de ítems pedidos |
| estado | text | `abierta` / `en_proceso` / `lista` / `cerrada` / `cancelada` |
| total | number | Total cobrado |
| mozo | text | Nombre del mozo |
| comensales | number | Cantidad de personas |
| observaciones | text | Notas + forma de pago al cerrar |

---

## 🔜 Próximas mejoras recomendadas

- [ ] Exportación de cierre de caja en CSV / PDF
- [ ] Sistema de usuarios y contraseñas por rol (mozo / caja / admin)
- [ ] Reportes por período (día / semana / mes)
- [ ] Lista de espera y reservas
- [ ] División de cuenta por persona
- [ ] Módulo de stock e inventario (vinculado a las recetas)
- [ ] Integración con PedidosYa / Rappi
- [ ] Modo pantalla táctil para tablet de cocina (KDS dedicado)
