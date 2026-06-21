# 🧩 API de Integración – La Taberna (v2.2)

---

## 1. Principios Fundamentales

1. Ningún módulo accede directamente a la base de datos sin pasar por DBAppwrite.
2. Comunicación entre módulos solo por EventBus, nunca por llamadas directas a funciones de otro módulo.
3. Estado centralizado en Store, de solo lectura para las vistas.
4. Toda escritura en Appwrite usa DBAppwrite, nunca fetch directo.
5. El Realtime es automático para todas las colecciones definidas en DBAppwrite.COLECCIONES. No necesitas crear canales manualmente.

---

## 2. Puntos de Conexión Disponibles

### 2.1 Leer datos desde Appwrite

    const recetas = await DBAppwrite.listar('recetas');
    // Devuelve: array de objetos planos con propiedades y un campo 'id' (el $id de Appwrite)

Colecciones disponibles (definidas en DBAppwrite.COLECCIONES):

| Clave | Nombre en Appwrite |
|-------|-------------------|
| productos | Productos |
| pedidos | Pedidos |
| mesas | Mesas |
| comandas | Comandas |
| ingredientes | Ingredientes |
| recetas | Recetas |
| pedidos_delivery | Pedidos_delivery |
| usuarios | Usuarios |
| configuracion | Configuracion |
| precargas_cliente | Precargas_cliente |
| eventos_en_vivo | Eventos_en_vivo |

Importante: Si tu módulo necesita una colección nueva, debes solicitar a la Célula A (Core) que la agregue a COLECCIONES en db-appwrite.js. A partir de ese momento, el Realtime la propagará automáticamente.

---

### 2.2 Crear, actualizar y eliminar documentos

    // Crear (el ID es opcional; usa 'unique()' para autogenerado)
    await DBAppwrite.crear('recetas', 'rec_123', {
      productoId: 'prod_1',
      ingredientes: '[]',
      instrucciones: '...'
    });

    // Actualizar
    await DBAppwrite.actualizar('recetas', 'rec_123', {
      instrucciones: 'Nuevas instrucciones'
    });

    // Eliminar
    await DBAppwrite.eliminar('recetas', 'rec_123');

---

### 2.3 Escuchar cambios en tiempo real

    EventBus.on('receta:actualizada', (datos) => {
      console.log('Una receta cambió:', datos);
    });

Convención de nombres: coleccion:accion (ej: mesa:actualizada, comanda:enviada). Las colecciones nuevas heredan automáticamente el evento coleccion:actualizada vía Realtime.

---

### 2.4 Leer el estado actual (Store)

    const state = Store.getState();
    const recetas = state.recetas;      // array actualizado en tiempo real
    const productos = state.productos;
    const mesas = state.mesas;
    // ... etc.

    // Suscribirse a cambios del Store
    Store.subscribe((state, action) => {
      if (action.type.startsWith('RECETA')) {
        // Actualizar UI
      }
    });

---

### 2.5 Emitir eventos personalizados

    EventBus.emit('receta:creada', { id: 'rec_123', productoId: 'prod_1' });
    EventBus.emit('receta:eliminada', { id: 'rec_123' });

---

### 2.6 Registro de clientes

    const resultado = await Auth.registrarCliente('nombreUsuario', 'contraseña');
    // Retorna: { exito: true, nombre: 'nombreUsuario' }
    // o bien:  { exito: false, error: 'El usuario ya existe' }

---

### 2.7 Obtener ID de Appwrite del usuario autenticado

    const userId = await Auth.getAppwriteUserId();
    // Devuelve el $id de la sesión anónima de Appwrite, o null si no está disponible.

---

## 3. Comportamiento Offline

- DBAppwrite.listar(coleccion) devuelve array vacío [] si no hay conexión.
- DBAppwrite.crear / actualizar / eliminar devuelven null si no hay conexión.
- El Store mantiene el último estado conocido, incluso si Appwrite no responde.
- Recomendación: siempre usar try/catch al llamar a DBAppwrite y usar el Store como fallback.

---

## 4. Esquemas de Colecciones

### 4.1 Productos

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
| disponible | boolean | Nuevo: control de disponibilidad (botón de pánico). Default: true |

### 4.2 Mesas

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| numero | integer | Número de mesa |
| estado | string | 'libre', 'ocupada', etc. |
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

### 4.3 Precargas de Cliente (Precargas_cliente)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | ID autogenerado por Appwrite |
| mesa | integer | Número de mesa |
| items | string | JSON con items de la precarga |
| estado | string | 'por_confirmar' (inicial), 'revisado', etc. |
| id_usuario | string | ID del usuario anónimo de Appwrite |
| nombre_comensal | string | Nombre del comensal que envía la precarga |
| observaciones | string | Notas del cliente |
| revisadoPor | string | Nombre del garzón que la revisó |
| timestamp | number | Momento del envío |

### 4.4 Eventos en Vivo (Eventos_en_vivo)

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id | string | ID autogenerado por Appwrite |
| tipo | string | 'bingo', 'karaoke', 'votacion' |
| estado | string | 'configuracion', 'activo', 'pausado', 'finalizado' |
| datos | JSON | Estructura libre según el tipo de evento |
| creadoPor | string | Nombre del animador |
| updatedAt | number | Última modificación (timestamp) |

---

## 5. Plantilla de Módulo

    // js/modulos/mi-modulo/mi-modulo-service.js
    const MiModuloService = (() => {

      async function cargarDatos() {
        try {
          const datos = await DBAppwrite.listar('mi_coleccion');
          Store.dispatch({ type: 'MI_MODULO_INICIALIZAR', payload: datos });
          return datos;
        } catch (e) {
          console.warn('[MiModulo] Usando caché local del Store.');
          return Store.getState().miModuloDatos || [];
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
          console.error('[MiModulo] Error al guardar:', e);
          return null;
        }
      }

      async function eliminar(id) {
        try {
          await DBAppwrite.eliminar('mi_coleccion', id);
          EventBus.emit('mi_modulo:eliminado', { id });
          await cargarDatos();
        } catch (e) {
          console.error('[MiModulo] Error al eliminar:', e);
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

---

## 6. Lo que NO debe hacer un módulo

- Llamar directamente a fetch para acceder a Appwrite.
- Modificar el estado global sin pasar por DBAppwrite o Store.dispatch.
- Acceder a DB.mesas, DB.pedidos desde un módulo que no es responsable de esas colecciones.
- Usar localStorage para datos que deberían estar en Appwrite.
- Emitir eventos con nombres que no siguen la convención modulo:accion.
- Modificar db-appwrite.js sin coordinación con la Célula A.
- Implementar lógica de autenticación propia (usar Auth.registrarCliente).

---

## 7. Realtime Dinámico (v2.10+)

A partir de la versión 2.10 de db-appwrite.js, el sistema se suscribe automáticamente a todas las colecciones definidas en DBAppwrite.COLECCIONES. Cuando un documento cambia en cualquiera de ellas, se emite un evento coleccion:actualizada con el documento modificado como payload.

Para añadir una nueva colección al Realtime:

1. Agrega la entrada en DBAppwrite.COLECCIONES en js/core/db-appwrite.js.
2. Asegúrate de que la colección exista en Appwrite con los atributos correctos.
3. A partir de ese momento, los cambios en esa colección se propagarán automáticamente a todos los dispositivos conectados.

---

## 8. Contacto y Soporte

- Célula A (Core): Responsable de la base de datos, sincronización y contratos.
- Coordinador de Integración: Revisa PRs, mantiene la documentación, veta si algo rompe la arquitectura.
- Documentación actualizada: docs/API-GUIA.md, docs/EVENTOS.md