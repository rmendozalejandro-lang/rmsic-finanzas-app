# Baseline de seguridad de producción — 2026-09-08

Proyecto Supabase: `whhfmlfiplpltpanusee`

Capturado mediante consultas **solo lectura** antes de aplicar hardening.

## Entorno

- Base de datos: `postgres`
- PostgreSQL: 17.6
- Captura UTC: 2026-09-08 02:17:36+00

## SECURITY DEFINER

El baseline confirma que producción todavía conserva numerosas funciones `SECURITY DEFINER` con `anon_execute=true`, incluyendo funciones administrativas, financieras, OT, helpers de acceso, veterinaria y funciones trigger/event-trigger.

Esto es esperado en este punto porque las migraciones de hardening están preparadas únicamente en la rama `feature/ot-viva-asistente-rmsic` y aún no se aplican a producción.

Excepciones relevantes ya bien restringidas en producción:

- `usuario_tiene_acceso_pts(uuid)`: `anon_execute=false`, `authenticated_execute=true`.
- varias RPC PTS sensibles tienen `anon_execute=false`.
- `pts_verificar_publico(uuid)` permanece deliberadamente pública para verificación por token.

Funciones con `search_path` aún pendiente en producción:

- `ot_aplicar_tipo_servicio_config()` → `proconfig=null`
- `ot_asignar_checklist_dyf_por_plantilla()` → `proconfig=null`
- `ot_autorizar_correccion_tecnica(uuid,text)` → `proconfig=null`
- `ot_bloquear_edicion_tecnica(uuid,text)` → `proconfig=null`

Las migraciones preparadas corrigen estos casos según corresponda.

## RLS / políticas — tablas críticas

| Tabla | RLS | Políticas |
|---|---:|---:|
| `asistente_casos` | sí | 3 |
| `asistente_sesiones` | sí | 3 |
| `asistente_eventos` | sí | 3 |
| `asistente_evento_relaciones` | sí | 3 |
| `ot_ordenes_trabajo` | sí | 3 |
| `ot_evidencias` | sí | 1 |
| `banco_conciliacion_movimientos` | sí | 0 |
| `cotizaciones_folios` | sí | 0 |
| `ot_historial_asignaciones` | sí | 0 |
| `ot_plantilla_items` | sí | 0 |
| `ot_recepcion_trabajo` | sí | 0 |
| `ot_folios` | **no** | 0 |

Interpretación:

- RLS habilitado sin políticas normalmente bloquea acceso directo de roles sujetos a RLS; requiere revisar si alguna ruta legítima depende de acceso directo.
- `ot_folios` permanece como punto pendiente específico. Es usada por el trigger `ot_generar_folio()` y no se tocará hasta probar creación de OT de punta a punta.

## Estado de rollout

- Ninguna migración de hardening aplicada a producción todavía.
- OT Viva sync real sigue deshabilitado por entorno.
- Storage `ot-evidencias` sigue en Stage 0/compatibilidad de lectura pública; Stage 1 está preparado en rama.

## Regla de comparación post-migración

Después de cada fase se debe volver a capturar:

1. `SECURITY DEFINER` + grants `anon/authenticated`.
2. `search_path` de funciones afectadas.
3. RLS/policy count de tablas afectadas.
4. smoke tests funcionales del dominio.
5. pruebas negativas de `anon`, rol incorrecto y empresa cruzada.

Si una función legítima deja de operar, detener el rollout y revertir la fase antes de continuar.
