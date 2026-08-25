┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-08-23 20:00 UTC                        │
│ TIPO:      DOCUMENTO OFICIAL                           │
│ REFERENCIA: API de Integración v5.0                     │
└──────────────────────────────────────────────────────────┘

# 🧩 API de Integración – La Taberna (v5.0)

**Última actualización:** 2026-08-23

---

## 1. Principios Fundamentales

1. Ningún módulo accede directamente a Appwrite sin pasar por DBAppwrite o DB.
2. Comunicación entre módulos solo por EventBus o CommandBus.
3. Estado centralizado en Store, de solo lectura para las vistas.
4. Toda escritura en Appwrite usa DBAppwrite.
5. El Realtime es automático para todas las colecciones definidas en DBAppwrite.COLECCIONES.
6. Las operaciones con lógica de negocio se ejecutan mediante CommandBus.
7. La autenticación es exclusivamente online con Appwrite Account.
8. El sistema es multi-espacio. Los datos de negocio se aíslan con `espacioId`.

---

## 2. Puntos de Conexión

### 2.1 Leer datos

    const recetas = await DBAppwrite.listar('recetas');

Colecciones disponibles:

| Clave | Nombre en Appwrite | Tipo |
|-------|-------------------|------|
| productos | laTaberna_Productos | Negocio |
| pedidos | laTaberna_Pedidos | Negocio |
| mesas | laTaberna_Mesas | Negocio |
| comandas | laTaberna_Comandas | Negocio |
| insumos | laTaberna_Insumos | Negocio |
| recetas | laTaberna_Recetas | Negocio |
| staff | laTaberna_Staff | Negocio |
| configuracion | laTaberna_Configuracion | Negocio |
| eventos_en_vivo | laTaberna_Eventos_en_vivo | Negocio |
| menus | laTaberna_Menus | Negocio |
| proveedores | laTaberna_Proveedores | Negocio |
| entradas | laTaberna_Entradas | Negocio |
| comensales | laTaberna_Comensales | Negocio |
| global_perfiles | global_Perfiles | Global |
| global_puntos | global_Puntos | Global |
| global_eventos | global_Eventos | Global |
| global_espacios | global_Espacios | Global |

Las colecciones de negocio filtran automáticamente por `espacioId`.

---

### 2.2 Crear, actualizar y eliminar

    await DBAppwrite.crear('productos', 'unique()', {
      nombre: 'Hamburguesa',
      precio: 1500,
      categoria: 'platos',
      destino: 'cocina',
      activo: true,
      estado: 'disponible'
    });

    await DBAppwrite.actualizar('productos', 'prod_123', { precio: 1600 });

    await DBAppwrite.eliminar('productos', 'prod_123');

---

### 2.3 Escuchar cambios en tiempo real

    EventBus.on('productos:actualizada', (datos) => {
      console.log('Producto actualizado:', datos);
    });

---

### 2.4 Leer el estado

    const state = Store.obtenerEstado();
    const mesas = state.mesas;
    const pedidos = state.pedidos;
    const productos = state.productos;
    const insumos = state.insumos;
    const recetas = state.recetas;
    const menus = state.menus;
    const config = state.config;

    Store.suscribir((state, action) => {
      if (action.type.startsWith('PEDIDO')) {
        // actualizar UI
      }
    });

---

### 2.5 Emitir eventos

    EventBus.emit('receta:creada', { id: 'rec_123', productoId: 'prod_1' });

    const unsubscribe = EventBus.on('receta:creada', (data) => {
      console.log(data);
    });

---

### 2.6 Ejecutar comandos

    const resultado = await CommandBus.ejecutar({
      type: 'crearPedidoMesa',
      datos: { numeroMesa: '5', mozo: 'Trini', comensales: 2 }
    });

Comandos disponibles:

| Comando | Propósito | Célula dueña |
|---------|-----------|--------------|
| `crearPedidoMesa` | Abrir mesa y crear pedido | A |
| `enviarComanda` | Enviar ítems a cocina/barra | A |
| `agregarMesa` | Agregar mesa | A |
| `liberarMesa` | Liberar mesa después del pago | A |
| `completarSubcomanda` | Completar subcomanda | A |
| `producto:marcar_agotado` | Marcar producto agotado | A |
| `turno:cerrar` | Cerrar turno | A |
| `precarga:revisar` | Revisar precarga de cliente | B1 |

---

### 2.7 Autenticación y Staff

    // Iniciar sesión
    const exito = await Auth.iniciarSesion(nombreUsuario, password);

    // Cerrar sesión
    Auth.cerrarSesion();

    // Obtener usuario actual
    const usuario = Auth.obtenerUsuarioActual();

    // Obtener roles efectivos
    const roles = Auth.obtenerRolesEfectivos();

    // Obtener rol principal
    const rolPrincipal = Auth.obtenerRolPrincipal();

    // Verificar permiso
    const puede = Auth.tienePermiso('accederCocina');

    // Vincular cuenta de staff
    const resultado = await Auth.vincularCuentaStaff(token);

---

### 2.8 Acceso a Staff

    const staff = await DB.obtenerStaffPorUsuario(usuarioId, espacioId);
    const personal = await DB.obtenerStaffPorEspacio(espacioId);

    await DB.crearOActualizarStaff({
      nombre: 'Trinidad Quilodran',
      usuarioId: 'usr_123',
      espacioId: 'lataberna',
      roles: ['mesero', 'caja'],
      rolPrincipal: 'mesero',
      estado: 'activo',
      tokenVinculacion: ''
    });

    await DB.sincronizarLabelsStaff(usuarioId, espacioId, roles);

---

### 2.9 Métodos de Inventario

    const costo = DBInventario.obtenerCostoUnitario(insumoId);
    const costoPromedio = DBInventario.obtenerCostoPromedio(insumoId);
    const recetaConProducto = DBInventario.obtenerRecetaConProducto(recetaId);

---

## 3. Comportamiento Offline

- DBAppwrite.listar devuelve `[]` si no hay conexión.
- DBAppwrite.crear / actualizar / eliminar devuelven `null` si no hay conexión.
- El Store mantiene el último estado conocido.
- La autenticación no usa credenciales locales.
- Si no hay conexión, se usa la sesión cacheada por el SDK.
- Las operaciones que requieren comunicación entre dispositivos quedan bloqueadas hasta reconectar.

---

## 4. Esquemas Resumidos

### 4.1 Productos

    {
      id,
      nombre,
      precio,
      categoria,
      destino,
      descripcion,
      activo,
      imagen,
      estado,
      espacioId
    }

### 4.2 Pedidos

    {
      id,
      mesa,
      tipo,
      origen,
      estado,
      mozo,
      comensales,
      items,
      total,
      observaciones,
      transacciones,
      descuento,
      direccion,
      telefono,
      repartidor,
      id_usuario,
      nombre_comensal,
      espacioId
    }

### 4.3 Mesas

    {
      id,
      numero,
      estado,
      pedidoId,
      comensales,
      zona,
      esVirtual,
      mesasFusionadas,
      espacioId
    }

### 4.4 Staff

    {
      id,
      nombre,
      usuarioId,
      roles,
      rolPrincipal,
      estado,
      fechaIngreso,
      telefono,
      email,
      notas,
      tokenVinculacion,
      espacioId
    }

---

## 5. Lo que NO debe hacer un módulo

- Usar credenciales hardcodeadas.
- Implementar autenticación propia.
- Acceder directamente a localStorage para datos de producción.
- Llamar a fetch para acceder a Appwrite.
- Usar roles viejos como `despensa`, `eventos`, `reparto`.
- Usar métodos eliminados de Auth.
- Emitir eventos sin documentar.
- Usar `var`.
- Usar nombres de funciones en inglés.

---

## 6. Realtime Dinámico

Toda colección definida en `DBAppwrite.COLECCIONES` genera automáticamente el evento `coleccion:actualizada`.

---

## 7. Contacto y Soporte

- Célula A: Core, base de datos y contratos.
- Coordinador de Integración: revisión de PRs, documentación y arquitectura.
- Documentos: `docs/EVENTOS.md`, `docs/API-GUIA.md`, `docs/COLECCIONES.md`, `docs/INTEGRACION.md`, `docs/PROPIEDAD.md`.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 5.0 — 2026-08-23*