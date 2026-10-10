# LaTaberna - Ecosistema Elisekai — GUÍA INTERNA
# Archivo: guia-appwrite-console-auth.md
# Versión: 1.1.0
# Propósito: Guía resumen de Appwrite Authentication para equipos Core.
# Cambios relevantes:
#   v1.1.0: agrega JWT en frontend (obtenerJWT con cache),
#           uso de JWT en llamadas serverless, notas sobre
#           migración cliente→jugador, rate limiting con
#           global_Limites y arranque único de Auth.
#   v1.0.0: creación inicial.

---

# Guía de Appwrite Console IV — Autenticación

## 1. Introducción

Appwrite Authentication permite gestionar usuarios, sesiones y
permisos de forma segura. Ofrece múltiples métodos de autenticación
y herramientas para controlar el acceso a recursos.

Esta guía resume los conceptos y métodos más relevantes para el
ecosistema Elisekai.

## 2. Métodos de autenticación disponibles

| Método | Descripción |
|--------|-------------|
| Email y contraseña | Login clásico con email y password (hash Argon2) |
| Phone (SMS) | Login con número de teléfono y código SMS |
| Magic URL | Login sin contraseña mediante enlace mágico enviado por email |
| Email OTP | Código de un solo uso enviado por email |
| OAuth 2 | Login con proveedores externos (Google, GitHub, etc.) |
| Anonymous | Sesiones de invitado, convertibles a cuenta completa |
| JWT | Token para que un backend actúe en nombre del usuario |
| Custom token | Permite implementar métodos de autenticación personalizados |
| MFA | Autenticación multifactor (email, teléfono, TOTP, recovery codes) |
| Presences | Rastrear usuarios activos y su estado en tiempo real |

En nuestro ecosistema usamos actualmente:

- **Email/password** (mapeado a nombre de usuario) para login.
- **Anonymous** para inicialización de sesión antes del login.
- **JWT** para que el frontend invoque funciones serverless que
  exigen credenciales de sesión.

Los demás métodos son opciones a futuro.

## 3. Accounts vs Users

- **Account API (Client SDK):** permite a los usuarios registrarse,
  iniciar sesión, gestionar su propia cuenta.
- **Users API (Server SDK):** permite administrar usuarios desde el
  backend (crear, actualizar, eliminar, listar). Requiere API key.

Nosotros usamos `Account` en `auth.js` para login y `Users` en las
funciones serverless para registro y asignación de roles.

## 4. Registro y login con email/password

### 4.1 Crear cuenta

    import { Client, Account, ID } from "appwrite";
    const client = new Client()
      .setEndpoint('https://tor.cloud.appwrite.io/v1')
      .setProject('6a025322001f24c57d1d');
    const account = new Account(client);
    await account.create({
      userId: ID.unique(),
      email: 'usuario@elisekai.com',
      password: 'password'
    });

En Elisekai el registro se realiza exclusivamente a través de la
función serverless `registrar-usuario`, que crea la cuenta con
dominio interno `@elisekai.com` y asigna el label `jugador`.

### 4.2 Iniciar sesión

    await account.createEmailPasswordSession({
      email: 'usuario@elisekai.com',
      password: 'password'
    });

El email se construye a partir del nombre de usuario con el
formato `nombreUsuario@elisekai.com`.

### 4.3 Verificar sesión

    try {
      const user = await account.get();
      // usuario autenticado
    } catch (error) {
      // no autenticado
    }

## 5. Anonymous login

Las sesiones anónimas permiten implementar usuarios invitados. Si
luego crean una cuenta, la información se hereda.

    await account.createAnonymousSession();

**Importante:** Los usuarios anónimos no pueden volver a iniciar
sesión si pierden la sesión. Se debe pedir que creen una cuenta
para no perder datos.

En nuestro bootstrap la sesión anónima se crea durante
`DBAppwrite.iniciar()`, antes del login. Si el usuario no inicia
sesión, se queda como invitado con esa sesión.

## 6. OAuth 2

Permite login con proveedores externos. Requiere configurar el
proveedor en Appwrite Console (Auth > Settings > OAuth).

    await account.createOAuth2Session({
      provider: OAuthProvider.Github,
      success: 'https://tudominio.com/exito',
      failure: 'https://tudominio.com/error',
      scopes: ['repo', 'user']
    });

Las sesiones OAuth2 deben refrescarse periódicamente con
`account.updateSession()`.

## 7. Magic URL y Email OTP

- **Magic URL:** envía un enlace mágico. Al hacer clic, redirige
  con `userId` y `secret`.
- **Email OTP:** envía un código de 6 dígitos. El usuario lo
  ingresa en la app.

Ambos son passwordless. Pueden ser útiles para simplificar el
acceso desde dispositivos móviles.

## 8. Phone (SMS)

Permite login con número de teléfono y código SMS. Requiere
proveedor SMS configurado. No lo usamos por ahora.

## 9. Custom token login

Permite implementar flujos de autenticación personalizados (por
ejemplo, login con nombre de usuario sin depender del dominio
`@elisekai.com`).

Flujo:

1. Backend (Server SDK) valida al usuario y genera un token con
   `users.createToken({ userId })`.
2. El token incluye `secret`.
3. El cliente usa `account.createSession({ userId, secret })` para
   iniciar sesión.

Es una mejora futura para simplificar el login en nuestro
ecosistema.

## 10. JWT (JSON Web Tokens)

Los JWT permiten que un backend actúe en nombre de un usuario
respetando sus permisos.

### 10.1 Uso en server SDK

- Se generan con `users.createJWT({ userId, duration })`.
- Se usan con `client.setJWT(jwt)` en Server SDK.
- Útiles para SSR o para que funciones serverless accedan a
  recursos con los permisos del usuario.

**Diferencia clave:** Con API key se omite la validación de
permisos; con JWT se respetan los permisos del usuario.

### 10.2 Uso en el frontend (Elisekai)

El frontend también puede obtener un JWT de la sesión activa y
enviarlo a funciones serverless que lo exigen. Este es el patrón
usado por `asignar-rol` desde su versión 1.6.0.

El módulo `js/auth.js` expone:

    Auth.obtenerJWT()      // devuelve Promise<string|null>
    Auth.limpiarJWTCache() // limpia el cache manualmente

**Comportamiento de `obtenerJWT`:**

- Genera el JWT con `account.createJWT()` la primera vez.
- Lo cachea en memoria por 12 minutos (80% del TTL por defecto de
  15 minutos de Appwrite).
- Devuelve el mismo token cacheado mientras no expire.
- Se limpia automáticamente en `Auth.cerrarSesion()`.

**Ejemplo de uso:**

    const jwt = await Auth.obtenerJWT();
    if (!jwt) return;

    const response = await fetch(URL_FUNCION_ASIGNAR_ROL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-appwrite-user-jwt': jwt
      },
      body: JSON.stringify({ userId, espacioId, roles })
    });

**Reglas:**

- No usar el JWT para llamadas que no lo exigen; es un costo
  innecesario de generación.
- No enviar el JWT a dominios externos.
- No exponerlo en logs ni en URLs.

## 11. MFA (Multi-Factor Authentication)

Appwrite soporta MFA con email, teléfono, TOTP y códigos de
recuperación.

### 11.1 Factores disponibles

- `email`: código enviado por email.
- `phone`: código enviado por SMS.
- `totp`: aplicación autenticadora (Google Authenticator, etc.).
- `recoverycode`: códigos de recuperación generados una sola vez.

### 11.2 Habilitar MFA

1. Generar y mostrar códigos de recuperación:
   `account.createMfaRecoveryCodes()`.
2. Verificar factores (email, teléfono, TOTP).
3. Habilitar MFA con `account.updateMFA({ enabled: true })`.
4. Al iniciar sesión, si se requiere MFA, se recibe
   `error.type === 'user_more_factors_required'`.
5. Crear desafío con `account.createMfaChallenge({ factor })` y
   completarlo con `account.updateMfaChallenge({ challengeId, otp })`.

Es una mejora de seguridad recomendada para roles sensibles
(`owner`, `admin`) en el futuro.

## 12. Teams

Teams permiten agrupar usuarios y asignar roles. Son la base de la
multi-tenencia en Elisekai.

### 12.1 Crear team

    await teams.create({
      teamId: 'LaTaberna',
      name: 'La Taberna',
      roles: ['owner', 'admin', 'mesero', 'chef', 'caja']
    });

### 12.2 Invitar miembro

    await teams.createMembership({
      teamId: 'LaTaberna',
      roles: ['mesero'],
      email: 'usuario@elisekai.com',
      url: 'https://lataberna.281093.xyz/aceptar-invitacion'
    });

### 12.3 Permisos con Teams

    Permission.read(Role.team('LaTaberna'))
    Permission.update(Role.team('LaTaberna', 'admin'))

Nosotros ya usamos Teams para los locales operativos (`LaTaberna`,
`PubPrueba`).

## 13. Labels

Labels permiten categorizar usuarios y asignar permisos globales.
En Elisekai usamos `label:master` para el rol de plataforma y
`label:jugador` como label base de toda cuenta.

    await users.updateLabels({
      userId: '<USER_ID>',
      labels: ['master']
    });

Luego se puede usar:

    Permission.read(Role.label('master'))

**Nota:** el label `jugador` está presente en todas las cuentas.
El label `master` se asigna manualmente solo a operadores de
plataforma.

## 14. Preferences (preferencias)

Permiten guardar preferencias de usuario (tema, idioma,
notificaciones) y de equipo.

    await account.updatePrefs({ temaOscuro: true, idioma: 'es' });

Pueden ser útiles para sincronizar configuración entre
dispositivos. Máximo 64 kB.

## 15. Presences

La API de Presences permite rastrear usuarios activos y su estado
en tiempo real.

    await presences.upsert({
      presenceId: ID.unique(),
      status: 'online',
      metadata: { pagina: '/mesas' },
      permissions: [Permission.read(Role.team('LaTaberna'))]
    });

Se puede suscribir a cambios con Realtime:

    await realtime.subscribe(Channel.presences(), response => {
      // manejar eventos de presencia
    });

**Casos de uso en Elisekai:** eventos en vivo, concursos, ver
quién está activo en un local.

## 16. Verificación de email y teléfono

Appwrite permite verificar email y teléfono. No es obligatorio
para iniciar sesión, pero se puede restringir el acceso a
usuarios verificados mediante permisos:

    Permission.read(Role.users('verified'))

Actualmente no lo usamos, pero puede ser una mejora futura.

## 17. Rate limiting en autenticación

Además del rate limiting de Appwrite Cloud (que aplica a nivel de
endpoint), Elisekai mantiene rate limiting propio en las
funciones serverless que crean cuentas o asignan roles.

### 17.1 Colección global_Limites

Toda limitación persistente usa la colección `global_Limites` con
columnas `clave`, `marcaTiempo` y `contador`. El `contador` se
incrementa atómicamente con `incrementRowColumn`.

### 17.2 Límites por acción

- `registrar-usuario`: 5 registros por minuto por IP.
- `asignar-rol` con `accion: 'crear'`: 60/min por usuario.
- `asignar-rol` con `accion: 'roles'`: 10/min por usuario.
- `asignar-rol` con `token` (vinculación): 5/min por usuario.

Los límites están documentados en `docs/FUNCIONES-SERVERLESS.md` y
`docs/EstadoAppwrite.md`.

### 17.3 Resolución del cliente

El cliente obtiene un error `429` con el mensaje "Demasiadas
solicitudes" si excede el límite. El código de error de negocio se
mapea a `error.type === 'general_rate_limit_exceeded'` cuando
proviene de Appwrite Cloud, o a un mensaje personalizado cuando
proviene de nuestras funciones.

## 18. Migración de nomenclatura cliente → jugador

En versiones anteriores existía un rol `cliente`. Fue eliminado en
la migración a `jugador` como rol base global del ecosistema.

### 18.1 Estado actual

- `cliente` **no existe** como rol separado.
- `jugador` es el rol base de toda cuenta.
- En LaTaberna, un jugador sin Team actúa funcionalmente como
  cliente (puede ver el menú, hacer pedidos, etc.).
- El evento `cliente:cuenta_creada` se renombró a
  `jugador:cuenta_creada`.
- El enum `origen` de `laTaberna_Pedidos` mantiene el valor
  `'cliente'` por compatibilidad histórica. No se renombra.

### 18.2 APIs afectadas

- `Auth.esJugador()` existe.
- `Auth.esCliente()` **no existe**. Fue eliminado.
- Los listeners de `cliente:cuenta_creada` deben migrarse a
  `jugador:cuenta_creada`.

## 19. Arranque único de Auth

El arranque de Auth se realiza **exclusivamente** en `bootstrap.js`.
`DB.init()` no debe llamar a `inicializarAuth()`.

**Motivo:** evitar listeners duplicados en los botones del header
y doble ejecución de `aplicarRestriccionesUI()`.

Si alguna célula agrega código que llama a `Auth.iniciar()`,
debe removerlo y delegar el arranque a `bootstrap.js`.

## 20. Seguridad

- Las contraseñas se hashean con Argon2.
- Appwrite aplica rate limits y protección contra fuerza bruta.
- Se recomienda usar `httpOnly`, `secure` y `sameSite` en cookies
  de sesión.
- No guardar API keys en el frontend.
- Usar `error.type` para manejar errores de forma amigable.
- Los códigos de recuperación y secretos solo se muestran una vez.
- El JWT cacheado se limpia automáticamente al cerrar sesión.
- Las funciones serverless que actúan en nombre del usuario
  exigen `x-appwrite-user-jwt` válido.

## 21. Nota final

Esta guía es un resumen operativo. Si algún equipo necesita
profundizar en un método de autenticación específico (OAuth2, MFA,
JWT, etc.), puede solicitar el documento oficial al Coordinador de
Integración, quien lo derivará a Core.

---

*Documento mantenido por la Célula A (Core) del ecosistema Elisekai.*