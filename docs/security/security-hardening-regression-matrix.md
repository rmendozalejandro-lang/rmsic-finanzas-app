# Matriz de regresión y orden de despliegue — Security Hardening

Estado: preparada para revisión. **No aplicar a producción en bloque sin ejecutar esta matriz.**

Principio rector: **seguridad nueva sin alterar comportamiento legítimo existente.**

## Hallazgo confirmado adicional: `public.ot_folios`

Auditoría read-only en producción confirma:

- `ot_folios`: RLS **deshabilitado**, 0 políticas.
- `cotizaciones_folios`: RLS habilitado, 0 políticas.
- `banco_conciliacion_movimientos`: RLS habilitado, 0 políticas.
- `ot_historial_asignaciones`: RLS habilitado, 0 políticas.
- `ot_plantilla_items`: RLS habilitado, 0 políticas.
- `ot_recepcion_trabajo`: RLS habilitado, 0 políticas.

`ot_folios` es usado por `public.ot_generar_folio()` (trigger SECURITY DEFINER). Como el trigger genera el folio internamente, es candidato a habilitar RLS sin políticas de cliente, pero **primero debe probarse creación de OT de punta a punta**. No habilitar todavía en producción.

## Fases propuestas

| Fase | Cambio | Riesgo funcional | Prueba obligatoria | Criterio de aprobación |
|---|---|---:|---|---|
| 0 | Baseline / respaldo lógico de permisos y funciones | Bajo | Capturar grants, definiciones y advisor antes de cambios | Baseline guardado |
| 1 | Revocar `anon EXECUTE` en RPC sensibles ya autenticadas internamente | Bajo | Login, invitaciones, OT, cotizaciones, finanzas, Haras | Flujos autenticados sin cambios |
| 2 | Revocar acceso directo a funciones trigger/event-trigger y helpers de test | Bajo | INSERT/UPDATE que disparan triggers | Triggers siguen ejecutándose; RPC directa falla |
| 3 | Endurecer permisos OT corrección técnica | Medio | admin autoriza/bloquea; técnico no puede | Admin OK, técnico denegado |
| 4 | Endurecer funciones contables/folios/conciliación | Medio-Alto | depreciación, asientos, cartola, préstamos, cotización | Roles válidos OK; otros roles/empresa ajena denegados |
| 5 | Hardening tablas Asistente + Storage stage 1 | Medio | OT Viva local, preview, carga evidencias actuales | Sin pérdida de lectura/escritura legítima |
| 6 | Habilitar RLS en `ot_folios` sin política cliente (si pruebas pasan) | Medio | crear OT nueva y verificar folio correlativo | Folio se genera; cliente no accede directo a tabla |
| 7 | Advisor final + pruebas adversariales cross-tenant | Bajo | REST/RPC/IDs cruzados/anon | Sin acceso cruzado ni RPC anon inesperada |
| 8 | Recién después: considerar activar sync real OT Viva | Alto | sync controlado con OT de prueba | Solo usuario autorizado escribe; idempotencia OK |

## Matriz mínima de actores

Usar al menos estos perfiles reales o equivalentes de prueba:

- `super_admin`
- `admin`
- `administracion_financiera`
- `gerencia`
- `comercial`
- `tecnico_ot` responsable de OT
- `tecnico_ot` no responsable de OT
- `cobranzas`
- usuario autenticado de otra empresa
- `anon`

## Pruebas de regresión por dominio

### Autenticación / empresa / usuarios

- Login normal funciona.
- Cambio de empresa activa funciona.
- Admin lista usuarios de su empresa.
- Admin invita/agrega usuario.
- Admin cambia rol/estado.
- Usuario no admin no puede administrar usuarios.
- Usuario de otra empresa no puede administrar la empresa objetivo.
- `anon` no puede ejecutar RPC administrativas.
- Aceptación de invitación autenticada sigue funcionando.

### OT

- Crear OT genera folio válido.
- Editar OT según permisos actuales.
- Técnico responsable accede a su OT.
- Técnico no responsable no obtiene acceso OT Viva por helper específico.
- Admin autoriza corrección técnica.
- Admin bloquea edición técnica.
- Técnico/cobranzas no pueden autorizar ni bloquear.
- Eliminación administrativa requiere admin y motivo.
- Checklists automáticos siguen generándose por trigger.

### Cotizaciones / Comercial

- Crear cotización genera folio.
- Recalcular totales funciona dentro de empresa autorizada.
- Usuario de otra empresa no puede recalcular cotización por UUID directo.
- Contacto destinatario mantiene validación por empresa/cliente.
- `anon` no genera folios ni recalcula.

### Finanzas / Bancos / Contabilidad

- Importación bancaria existente funciona para rol permitido.
- Conciliación manual 1:1 funciona.
- Conciliación múltiple funciona.
- Conciliación automática exacta exige empresa explícita.
- No se puede pasar `empresa_id` ajena.
- Crear movimiento simple/tributario desde cartola funciona para rol permitido.
- Vincular transferencia existente funciona solo misma empresa/cuenta.
- Reversa de conciliación funciona para rol permitido.
- Generar depreciaciones funciona para rol permitido.
- Crear asientos de depreciación funciona para rol permitido.
- Crear préstamo/abono/pago/reversa funciona para rol permitido.
- `cobranzas`, `tecnico_ot`, otra empresa y `anon` son denegados en operaciones contables críticas.

### Haras / Veterinaria

- Admin/gerencia con módulo Haras puede registrar procedimiento.
- Descuento de stock por lote funciona.
- Anulación repone stock correctamente.
- Usuario sin módulo/rol no puede registrar/anular.
- `anon` no puede ejecutar RPC veterinarias.

### PTS

- Flujo autenticado PTS sigue funcionando.
- `usuario_tiene_acceso_pts` permanece solo autenticado.
- `pts_verificar_publico(token)` sigue funcionando sin login para estados permitidos.
- Token inválido no devuelve información.
- No se exponen campos internos adicionales en verificación pública.

### Asistente / OT Viva

- Endpoint RMSIC exige token válido.
- OT se carga mediante cliente sujeto a RLS.
- Responsable/admin autorizado pasa.
- Técnico no responsable falla donde corresponde.
- Usuario de otra empresa no puede obtener OT por ID.
- Sync UI permanece con escritura deshabilitada mientras `NEXT_PUBLIC_TRALIXIA_ASSISTANT_SYNC_ENABLED` no sea `true`.
- Plan inválido nunca llega al executor.

### Storage OT evidencias

- Lectura actual de URLs públicas no se rompe en Stage 1.
- Escritura nueva respeta path `empresa_id/ot_id/archivo`.
- Usuario ajeno no puede INSERT/UPDATE/DELETE en carpeta de otra empresa.
- Stage 2 (bucket privado) no se aplica hasta migrar la app a lecturas autenticadas/signed URLs.

## Pruebas adversariales obligatorias

1. Cambiar manualmente `empresa_id` en request.
2. Cambiar UUID de OT/cotización/movimiento por recurso de otra empresa.
3. Invocar RPC sensible directamente desde REST, sin pasar por UI.
4. Ejecutar la misma RPC como `anon`.
5. Ejecutar como usuario autenticado con rol incorrecto.
6. Ejecutar como usuario de otra empresa.
7. Repetir operaciones idempotentes para detectar duplicados.
8. Verificar que service-role nunca aparezca en navegador ni variables `NEXT_PUBLIC_*`.

## Orden de aplicación recomendado

No aplicar todas las migraciones de una vez. Orden sugerido:

1. `20260907214500_security_hardening_phase1.sql`
2. `20260907215500_security_hardening_assistant_tables.sql`
3. `20260907223000_security_hardening_phase2_financial_rpc.sql`
4. `20260907224000_security_hardening_ot_correction_permissions.sql`
5. `20260907225000_security_hardening_accounting_and_folios.sql`
6. `20260907230500_security_hardening_banking_remaining.sql`
7. `20260907232000_security_hardening_helpers_vet_pts.sql`
8. `20260907233500_security_hardening_final_secdef_cleanup.sql`
9. `20260907220500_security_hardening_ot_storage_stage1.sql`
10. Migración separada futura para `ot_folios` RLS, solo después de prueba controlada.

Entre cada fase: ejecutar smoke test del dominio afectado y detener rollout ante cualquier regresión.

## Criterio para habilitar OT Viva Sync real

No habilitar `NEXT_PUBLIC_TRALIXIA_ASSISTANT_SYNC_ENABLED=true` hasta que:

- todas las fases relevantes estén aplicadas y validadas;
- advisor no reporte SECDEF anónimas inesperadas;
- las pruebas cross-tenant sean negativas;
- Storage esté al menos en Stage 1 seguro;
- endpoint Asistente mantenga autorización server-side;
- exista rollback definido para la ventana de despliegue.
