┌──────────────────────────────────────────────────────────┐
│ REMITENTE: Coordinador de Integración                   │
│ FECHA:     2026-10-08 16:00 UTC                        │
│ TIPO:      DOCUMENTO OFICIAL                           │
│ REFERENCIA: API de Integración v6.2.0                   │
└──────────────────────────────────────────────────────────┘

# 🧩 API de Integración – La Taberna (v6.2.0)

**Última actualización:** 2026-10-08

---

## Cambios en v6.2.0 respecto a v6.1.0

- A.68: se actualiza §2.4 y §6 tras el rename del slice del
  Store `menus` → `cartas` (E.x13). El slice `menus` sigue
  existiendo por compatibilidad hasta que Célula E aplique el
  rename. Este documento ya refleja el estado objetivo.
- Se actualiza §5 (Lo que NO debe hacer un módulo) para
  prohibir el uso de `state.menus`.

## Cambios en v6.1.0 respecto a v6.0.1

- A.67: se agrega §2.11 "Invocar funciones serverless desde el
  frontend". Se documenta que las funciones se invocan
  exclusivamente vía SDK oficial de Appwrite. No se usa `fetch`
  directo al dominio `*.tor.appwrite.run` porque el navegador
  bloquea el header `x-appwrite-user-jwt` en el preflight
  OPTIONS (CORS).
- A.67: se amplía §5 (Lo que NO debe hacer un módulo).
- A.67: se amplía §1 con el nuevo principio.

## Cambios en v6.0.1 respecto a v6.0

- Ajuste aprobado por Coordinación: eliminada la línea
  `const menus = state.menus;` de §2.4.

## Cambios en v6.0 respecto a v5.0

- Actualización mayor tras el ciclo de variantes y el rename.

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
9. Las funciones serverless se invocan exclusivamente vía SDK oficial de Appwrite, nunca por `fetch` directo.

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
| cartas | laTaberna_Cartas | Negocio |
| proveedores | laTaberna_Proveedores | Negocio |
| entradas | laTaberna_Entradas | Negocio |
| comensales | laTaberna_Comensales | Negocio |
| avisos | laTaberna_Avisos | Negocio |
| variantes | laTaberna_Variantes | Negocio |
| global_perfiles | global_Perfiles | Global |
| global_puntos | global_Puntos | Global |
| global_eventos | global_Eventos | Global |
| global_espacios | global_Espacios | Global |

Las colecciones de negocio filtran automáticamente por `espacioId`.

> La clave `menus` fue renombrada a `cartas` en A.44 (2026-09-16).
> Cualquier código que aún use `DBAppwrite.listar('menus')`
> obtiene `[]` silenciosamente. Migrar a `cartas`.

---

### 2.2 Crear, actualizar y eliminar

    await DBAppwrite.crear('productos', 'unique()', {
      nombre: 'Hamburguesa',
      precio: 1500,
      categoria: 'platos',
      destino: 'cocina',
      activo: true,
      estado: 'disponible',
      variantes_ids: ['sabor_hamburguesa'],
      alergenos: ['gluten', 'lactosa']
    });

    await DBAppwrite.actualizar('productos', 'prod_123', { precio: 1600 });

    await DBAppwrite.eliminar('productos', 'prod_123');

---

### 2.3 Escuchar cambios en tiempo real

    EventBus.on('productos:actualizada', (datos) => {
      console.log('Producto actualizado:', datos);
    });

    EventBus.on('variantes:actualizadas', (variante) => {
      console.log('Variante modificada:', variante);
    });

---

### 2.4 Leer el estado

    const state = Store.obtenerEstado();
    const mesas = state.mesas;
    const pedidos = state.pedidos;
    const productos = state.productos;
    const insumos = state.insumos;
    const recetas = state.recetas;
    const cartas = state.cartas;
    const variantes = state.variantes;
    const config = state.config;

    Store.suscribir((state, action) => {
      if (action.type.startsWith('PEDIDO') || action.type.startsWith('VARIANTE') || action.type.startsWith('CARTA')) {
        // actualizar UI
      }
    });

> Nota: el slice del Store para cartas se llama `cartas` tras
> el rename aprobado por Coordinación (E.x13). Mientras Célula E
> no lo aplique, el slice se sigue llamando `menus` en el código,
> pero nunca se puebla (la acción `MENUS_INICIALIZAR` ya no se
> emite desde A.44). Cualquier consumidor debe leer `state.cartas`
> cuando E cierre E.x13. Hasta entonces, no depender del slice.

---

### 2.5 Emitir eventos

    EventBus.emit('receta:creada', { id: 'rec_123', productoId: 'prod_1' });

    const unsubscribe = EventBus.on('receta:creada', (data) => {
      console.log(data);
    });

    // Emitir un evento de variante
    EventBus.emit('variantes:actualizadas', variante);

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

    // Obtener JWT para llamar funciones serverless sensibles
    const jwt = await Auth.obtenerJWT();

    // Limpiar cache de JWT (se limpia automáticamente al cerrar sesión)
    Auth.limpiarJWTCache();

**Uso de JWT:** Appwrite emite JWT con 15 minutos de TTL.
`Auth.obtenerJWT()` genera y cachea un JWT al 80% del TTL
(12 minutos). Se usa en el header `x-appwrite-user-jwt` al
invocar funciones serverless que lo exigen. **Sin embargo,
desde A.67 la invocación se hace vía SDK, que maneja el JWT
automáticamente. No se usa `fetch` directo (ver §2.11).**

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

    // Consumir insumos de un producto, con opciones de variante
    const resultado = await DBInventario.consumirInsumosDeProducto(
      {
        tipo: 'producto',
        id: 'prod_michelada',
        qty: 2,
        opciones: [/* selecciones de variantes */]
      },
      2,
      'Envío de comanda'
    );
    // Devuelve { ok, exitosos, fallidos, cambios }

---

### 2.10 Variantes

    // Repositorio del catálogo de variantes
    import { crearVarianteRepo } from './js/repositorios/variante-repository.js';
    const repoVariantes = crearVarianteRepo();

    // Guardar o actualizar
    const variante = await repoVariantes.guardarVariante({
      nombre: 'Sabor Michelada',
      tipo: 'unica',
      requerido: true,
      min_seleccion: 1,
      max_seleccion: 1,
      opciones: [ /* ... */ ]
    });

    // Cargar todas las variantes del espacio activo
    const lista = await repoVariantes.cargarVariantes();

    // Desactivar (borrado lógico)
    await repoVariantes.desactivarVariante(id);

    // El repositorio despacha a Store (VARIANTE_GUARDADA) y emite
    // EventBus 'variantes:actualizadas' tras cada operación.

---

### 2.11 Invocar funciones serverless desde el frontend

**Regla:** todas las invocaciones a funciones serverless se
hacen vía SDK oficial de Appwrite. Nunca por `fetch` directo al
dominio de la función.

**Motivo:** el navegador bloquea por CORS el header
`x-appwrite-user-jwt` en el preflight `OPTIONS` cuando el
`fetch` apunta a `https://<function-id>.tor.appwrite.run`.
Aunque el usuario tenga sesión activa y JWT válido, la petición
nunca llega a la función. Falla con `TypeError: Failed to
fetch`.

**Solución:** usar `Appwrite.Functions` del SDK oficial. El SDK
usa el endpoint de Appwrite Cloud (`tor.cloud.appwrite.io`) que
ya tiene CORS configurado, e inyecta automáticamente el JWT de
la sesión activa en el header correspondiente.

**Patrón canónico:**

    import { ID_FUNCION_ASIGNAR_ROL } from './config-appwrite.js';

    async function invocarAsignarRol(payload) {
      const funciones = new Appwrite.Functions(DBAppwrite.cliente);
      const ejecucion = await funciones.createExecution({
        functionId: ID_FUNCION_ASIGNAR_ROL,
        body: JSON.stringify(payload),
        async: false
      });

      const cuerpo = ejecucion.responseBody || ejecucion.body || ejecucion.response;
      let respuesta;
      try {
        respuesta = JSON.parse(cuerpo);
      } catch (e) {
        respuesta = { _crudo: String(cuerpo).substring(0, 500) };
      }

      const status = ejecucion.responseStatusCode || ejecucion.statusCode;
      return { status, respuesta };
    }

**Manejo de errores:**

- Si la función responde 401/403, `respuesta.error` trae el
  motivo.
- Si el SDK lanza excepción, es porque Appwrite Cloud rechazó
  la ejecución antes de llegar a la función (por ejemplo,
  execute access denegado). En ese caso, la excepción tiene
  `e.code` con el status real y `e.message` con el detalle.
- El SDK **no lanza por CORS**. Si el `catch` se ejecuta, es
  porque el rechazo es legítimo.

**Aplicación en el bundle:**

- `js/db-appwrite.js` → `_crearFilaSegura` ya usa este patrón.
- `test-A-Seguridad.html` §8 usa este patrón desde v1.1.0.
- Célula C debe usar este patrón para invocar `asignar-rol`
  cuando envíe precargas desde el cliente.
- `js/auth.js` → `registrarUsuario` sigue usando `fetch` porque
  `registrar-usuario` no requiere JWT ni headers custom. Es la
  única excepción válida.

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
      variantes_ids,   // array de strings
      alergenos,       // array de strings (enum cerrado)
      espacioId
    }

**Notas:**

- `variantes_ids`: array de strings con los IDs de variantes
  asignadas. Ver `ARQUITECTURA-VARIANTES.md`.
- `alergenos`: array de strings. Los valores válidos están
  definidos en `js/dominio/alergenos.js`. Valores posibles:
  `mani`, `gluten`, `lactosa`, `mariscos`, `huevo`, `soya`,
  `frutos_secos`, `pescado`, `otro`.

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

**Nota sobre items:** cada item puede incluir `tipo`
(`'producto'` o `'insumo'`), `opciones` (array de selecciones de
variantes) y `alergias_manuales` (array). Ver
`ARQUITECTURA-VARIANTES.md §5`.

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

### 4.5 Variantes

    {
      id,
      nombre,
      descripcion,
      tipo,            // 'unica' | 'multiple'
      requerido,
      min_seleccion,
      max_seleccion,
      opciones,        // array de objetos (ver ARQUITECTURA-VARIANTES.md)
      espacioId,
      activo,
      orden
    }

---

## 5. Lo que NO debe hacer un módulo

- Usar credenciales hardcodeadas.
- Implementar autenticación propia.
- Acceder directamente a localStorage para datos de producción.
- Llamar a `fetch` para acceder a Appwrite.
- **Llamar a `fetch` directo al dominio de una función
  serverless (`*.tor.appwrite.run`).** Usar el SDK oficial de
  Appwrite (`Appwrite.Functions.createExecution`). El `fetch`
  directo falla por CORS cuando lleva el header
  `x-appwrite-user-jwt`. Ver §2.11.
- Usar roles viejos como `despensa`, `eventos`, `reparto`.
- Usar métodos eliminados de Auth.
- Emitir eventos sin documentar.
- Usar `var`.
- Usar nombres de funciones en inglés.
- Usar la clave `menus` para listar cartas (usar `cartas`).
- Leer `state.menus` del Store. El slice se renombra a
  `cartas` (E.x13). Mientras E no aplique el cambio, el slice
  `menus` existe pero nunca se puebla. Leer `state.cartas`
  cuando E cierre E.x13.
- Hardcodear el enum de alérgenos (importar desde
  `js/dominio/alergenos.js`).

---

## 6. Realtime Dinámico

Toda colección definida en `DBAppwrite.COLECCIONES` genera
automáticamente el evento `coleccion:actualizada`.

La colección `laTaberna_Variantes` emite `variantes:actualizada`
(singular) por la clave `variantes` en `COLECCIONES`.

El repositorio `variante-repository.js` emite
`variantes:actualizadas` (plural) tras cada operación explícita.
Son eventos distintos con propósitos distintos. Ver
`docs/EVENTOS.md §9`.

La colección `laTaberna_Cartas` emite `cartas:actualizada`
(singular) por la clave `cartas`. No confundir con el evento de
dominio `variantes:actualizadas` del repo de variantes.

---

## 7. Contacto y Soporte

- Célula A: Core, base de datos y contratos.
- Coordinador de Integración: revisión de PRs, documentación y arquitectura.
- Documentos canónicos:
  - `docs/COLECCIONES.md` — esquema de la base de datos.
  - `docs/EVENTOS.md` — catálogo de eventos.
  - `docs/FUNCIONES-SERVERLESS.md` — funciones desplegadas.
  - `docs/EstadoAppwrite.md` — configuración real de Appwrite.
  - `docs/GUIA-APPWRITE-CONSOLE-IV.md` — manual de operación.
  - `docs/ARQUITECTURA-VARIANTES.md` — sistema de variantes.
  - `docs/PROPIEDAD.md` — mapa de propiedad.
  - `docs/INTEGRACION.md` — tablero de integración.
  - `docs/regla-control-regresiones.md` — protocolo de entrega.

---

*Documento mantenido por el Coordinador de Integración.*
*Versión 6.2.0 — 2026-10-08*