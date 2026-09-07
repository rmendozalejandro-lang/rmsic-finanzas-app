# Tralixia - Auth hardening checklist

Estado: preparado para revision antes de cambios productivos.

## Hallazgos confirmados

- El login actual usa `supabase.auth.signInWithPassword`.
- La redireccion post-login consulta la sesion con `supabase.auth.getSession()` desde cliente.
- La autorizacion real de datos no debe depender de esa sesion cliente; debe seguir descansando en RLS/RBAC de Supabase.
- Supabase recomienda usar `getClaims()` o `getUser()` cuando se necesita validar identidad de forma confiable, especialmente para controles sensibles o del lado servidor.

## Recomendaciones prioritarias

1. Mantener JWT de acceso en torno a 1 hora; evitar expiraciones superiores salvo necesidad justificada.
2. Verificar que email confirmation este habilitado para altas normales de usuarios.
3. Configurar longitud minima de contrasena >= 8; preferencia RMSIC: 10-12 caracteres para cuentas administrativas.
4. Requerir letras mayusculas, minusculas, numeros y simbolos para nuevas contrasenas si el flujo actual lo soporta sin friccion excesiva.
5. Activar leaked-password protection cuando el plan de Supabase lo permita. Actualmente esta funcion requiere Pro o superior.
6. Habilitar reautenticacion / contrasena actual para cambios de contrasena sensibles.
7. Proteger login, registro y recuperacion con CAPTCHA (preferencia: Cloudflare Turnstile) antes de una apertura SaaS publica.
8. Revisar y mantener los Auth rate limits; no ampliarlos sin una razon operacional clara.
9. Evaluar MFA TOTP para roles `admin`, super-admin y cuentas con acceso financiero; para tecnicos puede quedar inicialmente opcional si el flujo en terreno requiere menor friccion.
10. Proteger tambien las cuentas de administracion de Supabase, GitHub y Vercel con MFA/2FA.
11. No usar `getSession()` como decision de autorizacion para operaciones sensibles en servidor. Usar `getUser()` o `getClaims()` segun corresponda.
12. Validar URLs de redireccion de Auth y evitar comodines innecesarios.
13. Mantener secretos de servidor fuera del bundle cliente; nunca exponer `service_role` ni claves secretas en variables `NEXT_PUBLIC_*`.
14. Antes de activar cambios de Auth, ejecutar regresion: login, logout, recordar sesion, recuperacion de contrasena, cambio de contrasena, usuarios de multiples empresas y rol tecnico.

## Sesiones

- Supabase mantiene sesiones hasta logout o evento de terminacion por defecto.
- Time-box, inactivity timeout y single-session son opciones de planes Pro+; no se deben asumir disponibles en el plan actual.
- Mantener refresh-token reuse detection habilitado con valores por defecto, salvo evidencia concreta para cambiarlo.

## Cambios que NO se haran de golpe

- No se forzara MFA a todos los usuarios sin piloto.
- No se reducira drasticamente la duracion JWT.
- No se modificaran flujos de login/recuperacion productivos sin prueba previa.
- No se activara CAPTCHA hasta integrar correctamente el token en frontend y validar Demo.

## Orden sugerido de implementacion

1. Confirmar configuracion actual en Dashboard de Supabase: Email provider, password strength, redirect URLs, rate limits y protection settings.
2. Endurecer requisitos de contrasena compatibles con el plan actual.
3. Implementar Turnstile en login/registro/recuperacion en rama y probar Demo.
4. Introducir MFA para administradores como piloto.
5. Revisar guards de rutas sensibles para usar identidad validada en servidor cuando aplique.
6. Solo despues promover a produccion.
