# PubPOS — La Taberna

Sistema de punto de venta (POS) diseñado para bares, tabernas y locales de bohemia.  
Gestiona mesas, pedidos, cocina, barra, reparto, inventario, eventos y más, integrando **Google Sheets** como base de datos y **Google Drive** como almacenamiento documental.

---

## 🧱 Arquitectura

- **Domain‑Driven Design (DDD)** — Value Objects (`Dinero`, `Cantidad`, `Direccion`), Agregados (`PedidoAgregado`, `Delivery`, `Ingrediente`) y Servicios de Aplicación (`PedidoService`, `DeliveryService`, `InventarioService`).
- **CQRS** — Separación de comandos y consultas mediante `CommandBus` y handlers.
- **Puertos y Adaptadores (Hexagonal)** — La lógica de negocio no depende de la infraestructura. Los repositorios son intercambiables.
- **EventBus tipado** — Comunicación desacoplada entre módulos.
- **Turno Manager** — Control de turnos con registro de auditoría y cierre automático.

---

## 📁 Estructura del proyecto

```

/pubpos
├── index.html
├── README.md
├── css/               # Estilos modulares
│   ├── vars.css, base.css, layout.css, mesas.css, pedido.css, kds.css, caja.css
│   ├── modals.css, ticket.css, despensa.css, recetas.css, reparto.css, menu.css
│   ├── perfil.css, responsive.css
├── js/
│   ├── dominio/       # Value Objects y Agregados (DDD)
│   │   ├── dinero.js, cantidad.js, resultado.js, direccion.js
│   │   ├── pedido.js, delivery.js, ingrediente.js
│   ├── servicios/     # Servicios de aplicación (DDD)
│   │   ├── pedido-service.js, delivery-service.js, inventario-service.js
│   ├── repositorios/  # Implementaciones de persistencia
│   │   └── pedido-repository.js
│   ├── comandos/      # Comandos CQRS
│   │   └── crear-pedido-mesa.js
│   ├── managers/      # Turno y pedido (fachada)
│   │   ├── pedido-manager.js, turno-manager.js
│   ├── lib/           # Librerías transversales
│   │   ├── command-bus.js, eventBus.js
│   ├── ui/            # Vistas y controladores de interfaz
│   │   ├── mesas.js, carta.js, comanda.js, cuenta.js, cobro.js
│   │   ├── pedido-ui.js, kds.js, caja.js, tickets.js, config.js
│   │   ├── despensa.js, recetas.js, reparto.js, menu.js, eventos.js, perfil.js
│   ├── utils.js
│   ├── roles.js
│   ├── auth.js
│   ├── db-core.js, db-sync.js, db-inventario.js, db-fusion.js, db.js
│   ├── bootstrap.js
│   └── app.js
└── Code.gs           # Backend para Google Apps Script

```

---

## 🚀 Tecnologías

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+), Font Awesome |
| Persistencia local | `localStorage` |
| Base de datos remota | Google Sheets (lectura/escritura bidireccional) |
| Almacenamiento de archivos | Google Drive (PDF, JSON, documentos) |
| Backend | Google Apps Script (`Code.gs`) |

---

## 👥 Roles de usuario

| Rol | Vista por defecto | Permisos destacados |
|-----|-------------------|---------------------|
| `master` | Mesas | Todos los permisos. Puede simular otros roles. |
| `admin` | Mesas | Gestión completa (productos, zonas, mozos, turnos). |
| `mesero` | Mesas | Abrir mesas, tomar pedidos, enviar comandas, pedir cuenta. |
| `cocina` | Cocina (KDS) | Ver y cambiar estado de comandas de cocina. Recetas, inventario de cocina. |
| `barra` | Cocina (KDS) | Ver y cambiar estado de comandas de barra. Recetas, inventario de barra. |
| `caja` | Caja | Ver resumen del turno, cerrar mesas, cerrar turno. |
| `despensa` | Despensa | Gestionar inventario, ajustar stock. |
| `eventos` | Eventos | Crear eventos, generar carpetas y documentos en Drive. |
| `reparto` | Reparto | Crear pedidos de delivery, cambiar estados, enviar a cocina. |
| `cliente` | Menú | Ver el menú digital, consultar productos y precios. |

Las credenciales por defecto están en `js/auth.js`.

---

## 📦 Funcionalidades principales

- **Mapa de mesas** con zonas configurables (salón, terraza, VIP…), colores por estado y posibilidad de fusión.
- **Toma de pedidos** desde una carta de productos con búsqueda y filtros por categoría.
- **Envío de comandas** a cocina y barra con tickets individuales y edición de comentarios.
- **KDS (Kitchen Display System)** que muestra las comandas en tiempo real, con filtro por destino.
- **Caja** con resumen del turno, cierre de mesas con split bill y múltiples formas de pago.
- **Reparto / Delivery** con creación de pedidos ligados al menú, cambio de estados y notificación a cocina.
- **Despensa / Inventario** con alertas de stock bajo, ajustes rápidos y valorización del inventario.
- **Recetario digital** con pasos de preparación e indicación de stock disponible.
- **Menú digital** atractivo para clientes, con imágenes desde Google Sheets o placeholders de color.
- **Perfil de usuario** con foto, datos de contacto y visualización de documentos desde Drive.
- **Gestión de eventos** con generación automática de carpetas, presupuesto y menú en Drive.
- **Cierre de turno** que empaqueta todos los datos en un JSON, lo sube a Drive y resetea el sistema.
- **Sincronización bidireccional** con Google Sheets (productos, mozos, insumos, pedidos, etc.).

---

## 🔧 Configuración del backend (Google Apps Script)

1. Abre [Google Apps Script](https://script.google.com) y crea un nuevo proyecto.
2. Copia el contenido de `Code.gs` en el editor.
3. Sustituye `SPREADSHEET_ID` por el ID de tu hoja de cálculo.
4. Implementa como aplicación web (Ejecutar como: Yo, Acceso: Cualquiera).
5. Copia la URL generada y pégala en `js/db-sync.js` en la variable `module.urlSheets`.

La hoja de cálculo debe contener las pestañas `Productos`, `Mozos`, `insumos`, `recetas`, `Eventos`, `Empleados`, `Pedidos` y `AppConfig`.

---

## 📝 Licencia

Este proyecto es software privado. Todos los derechos reservados.

---

**Desarrollado con pasión por la bohemia.** 🍻