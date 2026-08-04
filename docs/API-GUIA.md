┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-08-03 07:00 UTC                        │
│ TIPO:      DOCUMENTO OFICIAL                           │
│ REFERENCIA: API de Integración v4.0                     │
└──────────────────────────────────────────────────────────┘

# 🧩 API de Integración – La Taberna (v4.0)

**Última actualización:** 2026-08-03

---

## 1. Principios Fundamentales

1. Ningún módulo accede directamente a la base de datos sin pasar por DBAppwrite.
2. Comunicación entre módulos solo por EventBus o CommandBus, nunca por llamadas directas a funciones de otro módulo.
3. Estado centralizado en Store, de solo lectura para las vistas. Las escrituras se hacen despachando acciones.
4. Toda escritura en Appwrite usa DBAppwrite, nunca fetch directo.
5. El Realtime es automático para todas las colecciones definidas en DBAppwrite.COLECCIONES. No necesitas crear canales manualmente.
6. Las operaciones que modifican datos y tienen lógica de negocio deben usar CommandBus, no llamadas directas a DBAppwrite desde las vistas.
7. La autenticación de usuarios se gestiona a través de `Auth`, que integra Appwrite Auth nativo con fallback local.
8. El sistema es multi-espacio: cada restaurante u hogar tiene sus datos aislados mediante `espacioId`.

---

## 2. Puntos de Conexión Disponibles

### 2.1 Leer datos desde Appwrite

    const recetas = await DBAppwrite.listar('laTaberna_Recetas');
    // Devuelve: array de objetos planos con propiedades y un campo 'id' (el $id de Appwrite)

Colecciones disponibles (definidas en DBAppwrite.COLECCIONES):

| Clave | Nombre en Appwrite | Tipo |
|-------|-------------------|------|
| productos | laTaberna_Productos | Negocio |
| pedidos | laTaberna_Pedidos | Negocio |
| mesas | laTaberna_Mesas | Negocio |
| comandas | laTaberna_Comandas | Negocio |
| ingredientes | laTaberna_Ingredientes | Negocio |
| recetas | laTaberna_Recetas | Negocio |
| pedidos_delivery | laTaberna_Pedidos_delivery | Negocio |
| usuarios | laTaberna_Usuarios | Negocio |
| configuracion | laTaberna_Configuracion | Negocio |
| precargas_cliente | laTaberna_Precargas_cliente | Negocio |
| eventos_en_vivo | laTaberna_Eventos_en_vivo | Negocio |
| menus | laTaberna_Menus | Negocio |
| proveedores | laTaberna_Proveedores | Negocio |
| global_perfiles | global_Perfiles | Global |
| global_puntos | global_Puntos | Global |
| global_eventos | global_Eventos | Global |
| global_espacios | global_Espacios | Global |

Importante: Si tu módulo necesita una colección nueva, debes solicitar a la Célula A (Core) que la agregue a COLECCIONES en db-appwrite.js. A partir de ese momento, el Realtime la propagará automáticamente.

**Nota sobre el filtro `espacioId`:** Todas las colecciones de tipo "Negocio" filtran automáticamente por el espacio activo del usuario. No necesitas agregar el filtro manualmente en tus consultas. Las colecciones "Global" no tienen filtro y son accesibles desde cualquier espacio.

---

### 2.2 Crear, actualizar y eliminar documentos

    // Crear (el ID es opcional; usa 'unique()' para autogenerado)
    await DBAppwrite.crear('productos', 'prod_123', {
      nombre: 'Hamburguesa',
      precio: 1500,
      categoria: 'platos',
      destino: 'cocina',
      tipo: 'compuesto',
      nivel: 'producto_final'
    });

    // Actualizar
    await DBAppwrite.actualizar('productos', 'prod_123', {
      precio: 1600
    });

    // Eliminar
    await DBAppwrite.eliminar('productos', 'prod_123');

---

### 2.3 Escuchar cambios en tiempo real

    EventBus.on('productos:actualizada', (datos) => {
      console.log('Un producto cambió:', datos);
    });

Convención de nombres: coleccion:accion (ej: mesa:actualizada, comanda:enviada). Las colecciones nuevas heredan automáticamente el evento coleccion:actualizada vía Realtime.

Consulta el catálogo completo en `docs/EVENTOS.md`.

---

### 2.4 Leer el estado actual (Store)

    const state = Store.obtenerEstado();
    const recetas = state.recetas;      // array actualizado en tiempo real
    const productos = state.productos;
    const mesas = state.mesas;
    const menus = state.menus;          // menús del espacio activo
    const cliente = state.cliente;      // { permitePrepedidos: boolean, mesa: number|null }
    const precargas = state.precargas_cliente; // precargas del cliente

    // Suscribirse a cambios del Store
    Store.suscribir((state, action) => {
      if (action.type.startsWith('RECETA')) {
        // Actualizar UI
      }
    });

---

### 2.5 Emitir eventos personalizados

    EventBus.emit('receta:creada', { id: 'rec_123', productoId: 'prod_1' });
    EventBus.emit('receta:eliminada', { id: 'rec_123' });

    // Suscripción con limpieza
    const unsubscribe = EventBus.on('receta:creada', (data) => {
      console.log('Nueva receta:', data);
    });
    // Para dejar de escuchar: unsubscribe();

---

### 2.6 Ejecutar comandos (CommandBus)

Para operaciones que modifican datos y tienen lógica de negocio, usa CommandBus en lugar de llamar directamente a DBAppwrite:

    const resultado = await CommandBus.ejecutar({
      type: 'producto:marcar_agotado',
      datos: { prodId: 'prod_123' }
    });

    if (resultado.exito) {
      console.log('Producto marcado como agotado');
    } else {
      console.error('Error:', resultado.error);
    }

Comandos disponibles:

| Comando | Propósito | Célula dueña |
|---------|-----------|--------------|
| `crearPedidoMesa` | Abrir una mesa y crear su pedido | A (Core) |
| `enviarComanda` | Enviar ítems a cocina/barra | A (Core) |
| `agregarMesa` | Agregar una nueva mesa al salón | A (Core) |
| `liberarMesa` | Liberar una mesa después del pago | A (Core) |
| `completarSubcomanda` | Marcar una subcomanda como completada | A (Core) |
| `producto:marcar_agotado` | Marcar un producto como no disponible (botón de pánico) | A (Core) |
| `turno:cerrar` | Cerrar el turno actual y resetear mesas | A (Core) |
| `precarga:revisar` | Marcar una precarga como revisada por el garzón | B1 (Mesero) |

---

### 2.7 Autenticación y gestión de usuarios

    // Iniciar sesión
    const exito = await Auth.login('admin', 'admin123');

    // Registrar un nuevo cliente
    const resultado = await Auth.registrarCliente('nuevoCliente', 'contraseña');
    // Retorna: { exito: true, nombre: 'nuevoCliente' }
    // o bien:  { exito: false, error: 'El usuario ya existe' }

    // Cambiar rol de un usuario (requiere permisos de master/admin)
    const cambio = await Auth.cambiarRol('nombreUsuario', 'mesero');
    // Retorna: { exito: true } o { exito: false, error: 'No tienes permiso...' }

    // Cambiar contraseña de un usuario
    await Auth.cambiarPassword('nombreUsuario', 'nuevaPassword');

    // Cerrar sesión
    Auth.logout();

    // Obtener ID del usuario autenticado en Appwrite
    const userId = await Auth.obtenerIdUsuarioAppwrite();

**Reglas de asignación de roles:**
  · Solo el `master` puede cambiar roles de `admin`.
  · El `admin` puede cambiar roles de todos excepto otros `admin` y `master`.
  · Nadie puede cambiar el rol de un `master`.
  · Nadie puede cambiar su propio rol.

---

### 2.8 Obtener ID de Appwrite del usuario autenticado

    const userId = await Auth.obtenerIdUsuarioAppwrite();
    // Devuelve el $id de la sesión de Appwrite, o null si no está disponible.

---

## 3. Comportamiento Offline

- DBAppwrite.listar(coleccion) devuelve array vacío [] si no hay conexión.
- DBAppwrite.crear / actualizar / eliminar devuelven null si no hay conexión.
- El Store mantiene el último estado conocido, incluso si Appwrite no responde.
- Auth tiene un sistema de fallback local: si Appwrite no está disponible, permite iniciar sesión con las credenciales almacenadas en localStorage.
- El `inventarioRepo` configurado en bootstrap.js guarda localmente con flag `_pendiente_sync` cuando Appwrite no responde.
- Recomendación: siempre usar try/catch al llamar a DBAppwrite y usar el Store como fallback.

---

## 4. Esquemas de Colecciones

### 4.1 Productos (laTaberna_Productos)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | Identificador único |
| nombre | string | Nombre del producto |
| precio | number | Precio de venta |
| categoria | string | Categoría (Bebidas, Comidas, etc.) |
| destino | string | 'cocina', 'barra', 'ambos' |
| descripcion | string | Descripción breve (opcional) |
| activo | boolean | Si está disponible en la carta |
| imagen | string | URL de imagen (opcional) |
| disponible | boolean | Control de disponibilidad (botón de pánico). Default: true |
| tipo | string | 'simple' (bebidas, snacks) o 'compuesto' (requiere receta) |
| nivel | string | 'insumo', 'preparacion', 'producto_final' |
| espacioId | string | ID del espacio al que pertenece |

### 4.2 Mesas (laTaberna_Mesas)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| numero | integer | Número de mesa |
| estado | string | 'libre', 'ocupada', 'esperando', 'cuenta', 'pagada', 'fusionada' |
| pedidoId | string | ID del pedido activo |
| items | string | JSON de items |
| mozo | string | Nombre del mozo asignado |
| comensales | integer | Cantidad de comensales |
| abiertaEn | string | ISO 8601 de apertura |
| observaciones | string | Notas |
| zona | string | Zona (salon, terraza, etc.) |
| esVirtual | boolean | Si es mesa virtual por fusión |
| mesasFusionadas | string | IDs de mesas fusionadas |
| permite_prepedidos | boolean | Habilita pedidos anticipados desde el menú digital. Default: false |
| espacioId | string | ID del espacio al que pertenece |

### 4.3 Precargas de Cliente (laTaberna_Precargas_cliente)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | ID autogenerado por Appwrite |
| mesa | integer | Número de mesa |
| items | string | JSON con items de la precarga |
| estado | string | 'por_confirmar' (inicial), 'revisado', etc. |
| id_usuario | string | ID del usuario de Appwrite |
| nombre_comensal | string | Nombre del comensal que envía la precarga |
| observaciones | string | Notas del cliente |
| revisadoPor | string | Nombre del garzón que la revisó |
| timestamp | number | Momento del envío |
| espacioId | string | ID del espacio al que pertenece |

### 4.4 Eventos en Vivo (laTaberna_Eventos_en_vivo)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | ID autogenerado por Appwrite |
| tipo | string | 'bingo', 'karaoke', 'votacion' |
| estado | string | 'configuracion', 'activo', 'pausado', 'finalizado' |
| datos | JSON | Estructura libre según el tipo de evento |
| creadoPor | string | Nombre del animador |
| updatedAt | number | Última modificación (timestamp) |
| espacioId | string | ID del espacio al que pertenece |

### 4.5 Pedidos (laTaberna_Pedidos)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | Identificador único |
| mesa | integer | Número de mesa asociada |
| mozo | string | Mozo asignado |
| comensales | integer | Cantidad de comensales |
| items | string | JSON de ítems del pedido |
| total | number | Total del pedido |
| estado | string | 'abierta', 'en_proceso', 'cerrada' |
| creadoEn | string | ISO 8601 de creación |
| actualizadoEn | string | ISO 8601 de última actualización |
| transacciones | string | JSON de transacciones (split bill) |
| observaciones | string | Notas del pedido |
| descuento | number | Porcentaje de descuento aplicado |
| espacioId | string | ID del espacio al que pertenece |

### 4.6 Recetas (laTaberna_Recetas)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | Identificador único |
| productoId | string | ID del producto asociado |
| nombre | string | Nombre de la receta |
| ingredientes | JSON | Array con estructura `[{ tipo: 'insumo'|'subreceta', id: string, cantidad: number }]` |
| instrucciones | string | Pasos de preparación |
| es_intermedio | boolean | Si es una preparación intermedia |
| nivel | string | 'insumo', 'preparacion', 'producto_final' |
| categoria | string | Categoría |
| destino | string | 'cocina', 'barra', 'ambos' |
| stockActual | number | Stock disponible (para preparaciones intermedias) |
| unidadStock | string | Unidad del stock (kg, L, etc.) |
| espacioId | string | ID del espacio al que pertenece |

### 4.7 Perfiles Globales (global_Perfiles)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| usuarioId | string | ID del usuario en Appwrite Auth |
| nombre | string | Nombre visible del usuario |
| avatar | string | URL del avatar |
| nivel | integer | Nivel del usuario (default: 1) |
| xp | integer | Puntos de experiencia (default: 0) |
| insignias | JSON | Array de insignias obtenidas |
| racha | integer | Días consecutivos de actividad |
| titulos | JSON | Array de títulos obtenidos |

---

## 5. Recetas Anidadas (Sub-recetas)

La Taberna soporta recetas que usan otras recetas como ingredientes. Esto permite modelar preparaciones intermedias (salsas, masas, guarniciones) que luego se integran en platos finales.

### 5.1 Estructura de ingredientes

El array `ingredientes` dentro de una receta acepta dos tipos de entradas:

    [
      { "tipo": "insumo", "id": "ins_cebolla", "cantidad": 200 },
      { "tipo": "subreceta", "id": "rec_cebolla_caramelizada", "cantidad": 1 }
    ]

- `insumo`: materia prima de Despensa. Descuenta stock de `laTaberna_Ingredientes`.
- `subreceta`: otra receta. Se resuelve recursivamente para calcular el stock necesario total.

### 5.2 Funciones disponibles en DBInventario

    // Obtener todos los ingredientes de una receta, resueltos recursivamente
    const ingredientes = DBInventario.getIngredientesDeProducto(
      productoId,
      cantidad,
      recetas,
      ingredientes
    );

    // Consumir ingredientes de una receta (descuenta stock de insumos y sub-recetas)
    await DBInventario.consumirIngredientesDeProducto(
      productoId,
      cantidad,
      'Consumo por comanda'
    );

### 5.3 Validación de stock con recetas anidadas

    // InventarioService ya soporta recetas anidadas
    const resultado = InventarioService.validarStockParaItems(items);
    if (!resultado.ok) {
      console.log('Faltantes:', resultado.faltantes);
    }

---

## 6. Modelo Multi-Espacio

Cada restaurante u hogar tiene sus datos aislados mediante `espacioId`. Las colecciones globales (`global_*`) no tienen este campo y son compartidas.

### 6.1 Espacios de un usuario

    const usuario = Auth.obtenerUsuarioActual();
    // usuario.espacios = [
    //   { id: 'esp_taberna', nombre: 'La Taberna', tipo: 'bar', rol: 'admin', databaseId: '...' },
    //   { id: 'esp_refugio', nombre: 'Mi Refugio', tipo: 'hogar', rol: 'admin', databaseId: '...' }
    // ]
    // usuario.espacioActivoId = 'esp_taberna'

### 6.2 Cambiar de espacio activo

    Auth.cambiarEspacio('esp_refugio');

---

## 7. Plantilla de Módulo

    // js/modulos/mi-modulo/mi-modulo-service.js
    import { DBAppwrite } from '../db-appwrite.js';
    import { Store } from '../lib/store.js';
    import { EventBus } from '../lib/eventBus.js';

    const MiModuloService = (() => {

      async function cargarDatos() {
        try {
          const datos = await DBAppwrite.listar('mi_coleccion');
          Store.despachar({ type: 'MI_MODULO_INICIALIZAR', payload: datos });
          return datos;
        } catch (e) {
          Logger.warn('[MiModulo] Usando caché local del Store.');
          return Store.obtenerEstado().miModuloDatos || [];
        }
      }

      async function guardar(datos) {
        try {
          const resultado = await DBAppwrite.crear('mi_coleccion', datos.id || 'unique()', datos);
          if (resultado) {
            EventBus.emit('mi_modulo:creado', resultado);
            await cargarDatos();
          }
          return resultado;
        } catch (e) {
          Logger.error('[MiModulo] Error al guardar:', e);
          return null;
        }
      }

      async function eliminar(id) {
        try {
          await DBAppwrite.eliminar('mi_coleccion', id);
          EventBus.emit('mi_modulo:eliminado', { id });
          await cargarDatos();
        } catch (e) {
          Logger.error('[MiModulo] Error al eliminar:', e);
        }
      }

      function _init() {
        EventBus.on('mi_modulo:actualizado', cargarDatos);
        EventBus.on('db:inicializada', cargarDatos);
        EventBus.on('sincronizacion:completada', cargarDatos);
      }

      _init();

      return { cargarDatos, guardar, eliminar };
    })();

    export { MiModuloService };

---

## 8. Lo que NO debe hacer un módulo

- Llamar directamente a fetch para acceder a Appwrite.
- Modificar el estado global sin pasar por DBAppwrite o Store.despachar.
- Acceder a DB.mesas, DB.pedidos desde un módulo que no es responsable de esas colecciones.
- Usar localStorage para datos que deberían estar en Appwrite.
- Emitir eventos con nombres que no siguen la convención modulo:accion.
- Modificar db-appwrite.js sin coordinación con la Célula A.
- Implementar lógica de autenticación propia (usar Auth.registrarCliente).
- Llamar directamente a métodos de otro módulo sin pasar por EventBus o CommandBus.
- Usar `var` en lugar de `let` o `const`.
- Usar nombres de funciones en inglés (todo el código debe estar en español).

---

## 9. Realtime Dinámico

El sistema se suscribe automáticamente a todas las colecciones definidas en DBAppwrite.COLECCIONES. Cuando un documento cambia en cualquiera de ellas, se emite un evento coleccion:actualizada con el documento modificado como payload.

Para añadir una nueva colección al Realtime:

1. Agrega la entrada en DBAppwrite.COLECCIONES en js/db-appwrite.js.
2. Asegúrate de que la colección exista en Appwrite con los atributos correctos.
3. A partir de ese momento, los cambios en esa colección se propagarán automáticamente a todos los dispositivos conectados.

---

## 10. Contacto y Soporte

- Célula A (Core): Responsable de la base de datos, sincronización y contratos.
- Coordinador de Integración: Revisa PRs, mantiene la documentación, veta si algo rompe la arquitectura.
- Documentación actualizada: docs/API-GUIA.md, docs/EVENTOS.md, docs/INTEGRACION.md, docs/PROPIEDAD.md, docs/COLECCIONES.md

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 4.0 — 2026-08-03*