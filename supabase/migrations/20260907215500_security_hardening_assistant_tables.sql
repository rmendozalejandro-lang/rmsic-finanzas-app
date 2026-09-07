-- Security hardening: Asistente Tralixia table grants
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
-- RLS policies already restrict the assistant core to authenticated users.
-- This migration removes unnecessary direct table privileges from anon and
-- keeps authenticated access explicit for the current RLS-controlled flows.

begin;

revoke all on table public.asistente_casos from anon;
revoke all on table public.asistente_caso_ots from anon;
revoke all on table public.asistente_caso_pts from anon;
revoke all on table public.asistente_caso_equipos from anon;
revoke all on table public.asistente_caso_animales from anon;
revoke all on table public.asistente_caso_partos from anon;
revoke all on table public.asistente_caso_procedimientos_vet from anon;
revoke all on table public.asistente_sesiones from anon;
revoke all on table public.asistente_eventos from anon;
revoke all on table public.asistente_evento_relaciones from anon;
revoke all on table public.asistente_evidencias from anon;
revoke all on table public.asistente_evento_evidencias from anon;
revoke all on table public.asistente_fuentes from anon;
revoke all on table public.asistente_evento_fuentes from anon;
revoke all on table public.asistente_recomendaciones from anon;
revoke all on table public.asistente_decisiones from anon;

grant select, insert, update, delete on table public.asistente_casos to authenticated;
grant select, insert, update, delete on table public.asistente_caso_ots to authenticated;
grant select, insert, update, delete on table public.asistente_caso_pts to authenticated;
grant select, insert, update, delete on table public.asistente_caso_equipos to authenticated;
grant select, insert, update, delete on table public.asistente_caso_animales to authenticated;
grant select, insert, update, delete on table public.asistente_caso_partos to authenticated;
grant select, insert, update, delete on table public.asistente_caso_procedimientos_vet to authenticated;
grant select, insert, update, delete on table public.asistente_sesiones to authenticated;
grant select, insert, update, delete on table public.asistente_eventos to authenticated;
grant select, insert, update, delete on table public.asistente_evento_relaciones to authenticated;
grant select, insert, update, delete on table public.asistente_evidencias to authenticated;
grant select, insert, update, delete on table public.asistente_evento_evidencias to authenticated;
grant select, insert, update, delete on table public.asistente_fuentes to authenticated;
grant select, insert, update, delete on table public.asistente_evento_fuentes to authenticated;
grant select, insert, update, delete on table public.asistente_recomendaciones to authenticated;
grant select, insert, update, delete on table public.asistente_decisiones to authenticated;

commit;
