# Tralixia - Auditoria de autenticacion y autorizacion en APIs sensibles

Estado: revision de codigo en rama `feature/ot-viva-asistente-rmsic`. No aplica cambios productivos.

## Resumen

Se revisaron rutas sensibles representativas: Asistente RMSIC, envio de OT por email y confirmacion de importacion bancaria. El patron general es mejor de lo esperado: las rutas sensibles verifican el Bearer token con `auth.getUser(token)` antes de operar. Sin embargo, hay diferencias importantes en el nivel de autorizacion posterior.

## 1. Asistente RMSIC - prioridad ALTA

Ruta: `app/api/asistente/rmsic/route.ts`

Positivo:
- exige Authorization Bearer;
- valida el token con `auth.getUser(token)`;
- OPENAI_API_KEY permanece en servidor;
- no usa service_role.

Riesgo:
- despues de autenticar al usuario, no valida empresa, rol, modulo ni acceso a una OT concreta;
- acepta desde el cliente el contexto OT, eventos y relaciones;
- cualquier usuario autenticado podria invocar directamente el endpoint aunque no tenga acceso al modulo Asistente;
- puede generar consumo de OpenAI fuera del flujo UI esperado.

Correccion recomendada:
- incorporar `empresa_id` y `ot_id` al request;
- comprobar servidor-side que el usuario pertenece activamente a la empresa;
- comprobar que la OT pertenece a esa empresa y es accesible para el usuario;
- comprobar permiso al Asistente/modulo antes de llamar a OpenAI;
- aplicar limitacion de frecuencia/costo por usuario y empresa;
- no confiar en el nombre de cliente/equipo enviado por el navegador cuando esos datos puedan cargarse desde Supabase con RLS.

## 2. Envio de informe OT por email - prioridad MEDIA/BAJA

Ruta: `app/api/ot/[id]/enviar-email/route.ts`

Positivo:
- valida Bearer con `auth.getUser(token)`;
- service_role se usa solamente en servidor;
- primero obtiene la OT y luego valida que el usuario pertenezca a la empresa de la OT;
- ademas restringe por rol a administradores/supervisores;
- valida que el contacto pertenezca a empresa y cliente de la OT;
- registra usuario responsable del envio.

Observacion:
- el patron es adecuado como referencia para otras APIs con `service_role`;
- conviene centralizar esta validacion en un helper comun para evitar diferencias entre endpoints.

## 3. Importacion bancaria - prioridad MEDIA

Ruta: `app/api/bancos/confirmar-importacion/route.ts`

Positivo:
- valida Bearer con `auth.getUser(token)`;
- service_role solo en servidor;
- obtiene la cuenta bancaria y verifica pertenencia activa del usuario a la empresa antes de insertar;
- inserta `created_by` con el usuario autenticado.

Riesgo / mejora:
- la comprobacion observada valida pertenencia a empresa, pero no un rol financiero especifico;
- si todos los miembros de una empresa no deben importar cartolas, hay que exigir permiso/rol de Finanzas/Bancos antes de escribir;
- validar limites de cantidad/tamano de filas para prevenir abuso de payload.

## 4. Login cliente

Ruta: `app/login/page.tsx`

- `getSession()` se usa para UX/redireccion, lo que es aceptable;
- la autorizacion de operaciones sensibles no debe depender de ese resultado;
- las APIs revisadas correctamente vuelven a validar identidad con `getUser(token)`.

## Patron recomendado para Tralixia

Toda API sensible debe aplicar, en este orden:

1. Extraer Bearer token.
2. Validar identidad con `auth.getUser(token)` o equivalente verificado.
3. Resolver el recurso real (empresa/OT/cuenta/caso) en servidor.
4. Verificar pertenencia activa a empresa.
5. Verificar rol/modulo/accion especifica.
6. Solo entonces usar `service_role` o secretos de terceros si fueran necesarios.
7. Registrar actor y accion para auditoria.
8. Limitar frecuencia/tamano en endpoints costosos o destructivos.

## Siguiente cambio recomendado

Prioridad inmediata: endurecer `app/api/asistente/rmsic/route.ts` antes de habilitar sincronizacion/uso extendido del Asistente. Debe verificar empresa + OT + permiso del Asistente en servidor y aplicar un limite de uso razonable.
