# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-functions.md
# Versión: 1.0.0
# Propósito: Guía resumen de Appwrite Functions para equipos Core.
# Cambios relevantes: Creación inicial basada en documentación oficial actualizada.

---

# Guía de Appwrite Console IV — Functions

## 1. Introducción

Appwrite Functions permite ejecutar código serverless de forma escalable y segura. Cada función tiene su propio dominio, variables de entorno, permisos y puede ser invocada por HTTP, SDK, eventos o programación.

En Elisekai usamos funciones para operaciones sensibles como registro de usuarios y asignación de roles. Esta guía resume los conceptos esenciales.

## 2. Creación de una función

Se puede crear de tres formas:

- **Git (recomendado):** conecta un repositorio y despliega automáticamente desde commits.  
- **Manual:** subir archivo `.tar.gz` con el código y entrypoint.  
- **CLI:** mediante `appwrite init functions` y `appwrite push functions`.

Al crear, se define nombre, ID y runtime.

## 3. Despliegues (deployments)

Cada cambio de código genera un deployment (versión). Estados:

- `active`: desplegado y activo.  
- `ready`: construido, pero no activo.  
- `building`: en construcción.  
- `failed`: error en build.

Solo un deployment puede estar activo. Para aplicar cambios de configuración (variables, entrypoint, build settings) se debe **redeployar**.

Build logs disponibles en **Deployments** > menú de tres puntos > **Logs**.

**Recomendación:** usar Git para versionar y automatizar despliegues. Configurar build triggers por rama y ruta.

## 4. Desarrollo de funciones

### 4.1 Ciclo de vida

1. La función es invocada.  
2. El executor maneja la petición.  
3. Recibe `context.req` con headers, body, path, etc.  
4. Ejecuta código, usa `log()` y `error()` para registrar.  
5. Retorna respuesta con `context.res.text()`, `res.json()`, `res.empty()`, `res.binary()`, `res.redirect()`.

### 4.2 Entrada y salida

- `req.bodyText`: cuerpo como texto.  
- `req.bodyJson`: cuerpo parseado como JSON.  
- `req.headers`, `req.method`, `req.path`, `req.query`.  
- `res.json(data, statusCode, headers)`, `res.text(...)`, etc.

**Nota:** Usar `req.bodyText` / `req.bodyJson` en lugar de `req.bodyRaw` (obsoleto).

### 4.3 Logging

- `log()` y `error()` solo visibles en Appwrite Console.  
- No se registran request/response por privacidad.  
- En plan Free, logs se retienen 24 horas; en Pro, 7 días.

## 5. Variables de entorno

Se pueden configurar en **Settings** > **Environment variables**.

### 5.1 Fuentes y precedencia

1. Project variables (compartidas por todas las funciones).  
2. Function variables (específicas de la función).  
3. Appwrite-injected variables (no se pueden sobrescribir, prefijo `APPWRITE_`).

### 5.2 Secretos

- Marcar como **Secret** oculta el valor después de crearlo.  
- Solo la función puede leerlo en build/runtime.  
- No reversible; para cambiar, eliminar y crear de nuevo.

### 5.3 Límites

- Clave: 255 caracteres.  
- Valor: 8192 caracteres.

### 5.4 Variables inyectadas importantes

- `APPWRITE_FUNCTION_PROJECT_ID`: ID del proyecto.  
- `APPWRITE_FUNCTION_API_KEY`: dynamic API key (solo build).  
- Otras según runtime.

## 6. Autenticación en funciones

### 6.1 Dynamic API key

- Se recibe en el header `x-appwrite-key`.  
- Otorga acceso tipo admin, sin sesión de usuario.  
- Configurar scopes mínimos en **Settings** > **Scopes**.  
- Solo usar para operaciones que requieren privilegios elevados.

### 6.2 JWT

- Header `x-appwrite-user-jwt` se incluye si la función es invocada por usuario autenticado.  
- Permite actuar en nombre del usuario respetando sus permisos.  
- Usar `client.setJWT(jwt)` en Server SDK.

**Recomendación:** para la futura función de escritura segura, usar JWT para validar `espacioId` y permisos.

## 7. Dominios

Cada función tiene dominios:

- **Generado:** `https://<func-id>.<region>.appwrite.run`.  
- **Edge network:** `https://<func-id>.appwrite.network` (mejor latencia global).  
- **Custom:** dominio propio con CNAME y certificado TLS automático.

Para usar dominios, la función debe tener permiso de ejecución `Any`.  
Si se requiere autenticación, usar JWT en headers.

## 8. Ejecución

### 8.1 Modos

- **Síncrona:** espera respuesta, timeout 30 segundos. Usar para operaciones cortas.  
- **Asíncrona:** se encola, sin timeout más allá del configurado. Usar para tareas en segundo plano.

### 8.2 Métodos

- Desde SDK con `functions.createExecution()`.  
- Desde HTTP al dominio.  
- Desde la consola con **Execute now**.  
- Por eventos de Appwrite.  
- Programadas (cron) o con retardo (`scheduledAt`).

### 8.3 Permisos de ejecución

- Client SDK: requiere permiso explícito en **Settings** > **Execute access**.  
- Server SDK: requiere API key con scopes.  
- Dominios: sin autenticación; usar JWT para restringir.

## 9. Programación y eventos

### 9.1 Cron

Se configura en **Settings** > **Schedule**. Ejemplos:

    */15 * * * *   Cada 15 minutos
    0 * * * *      Cada hora
    0 0 * * *      Diario a medianoche
    0 0 * * 1      Lunes a medianoche

### 9.2 Eventos

Se pueden disparar funciones ante eventos de Appwrite (crear fila, actualizar usuario, etc.).  
Evitar bucles: no suscribir la función a eventos que ella misma genera.

## 10. Permisos y scopes

- **Execute access:** controla quién puede invocar la función.  
- **Scopes:** configuran los permisos del dynamic API key. Otorgar solo lo necesario.

## 11. Runtimes disponibles

Appwrite Cloud soporta Node.js, Bun, Deno, Go, Python, Dart, PHP, Ruby, .NET, Java, Swift, Kotlin, Flutter, C++, Rust.  
Nosotros usamos **Node.js** para nuestras funciones actuales.

## 12. Templates

Appwrite ofrece plantillas para casos comunes: starter, sync con Meilisearch, WhatsApp, ChatGPT, Stripe, Slack, etc.  
Útiles para acelerar desarrollo de integraciones.

## 13. Mejores prácticas para Elisekai

- Usar **Git deployments** para versionar funciones.  
- Mantener **secretos en variables de entorno**, no hardcodear.  
- Usar **JWT** en funciones que actúan en nombre del usuario.  
- Usar **dynamic API key** solo para operaciones admin.  
- Configurar **scopes mínimos** en cada función.  
- Registrar logs útiles con `log()` y `error()`.  
- Para retención prolongada de logs, guardar en tabla de Appwrite con limpieza programada.  
- Considerar **custom domains** en producción para imagen profesional.

## 14. Próximas acciones

- Revisar funciones actuales (`registrar-usuario`, `asignar-rol`) para migrar a `req.bodyText`/`req.bodyJson`.  
- Evaluar despliegue por Git.  
- Preparar documentación de variables y scopes para el equipo.  
- Implementar función de escritura segura con JWT cuando se autorice (límite de 2 funciones en Free).

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*