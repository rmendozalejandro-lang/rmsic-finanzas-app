begin;

-- Principio de minimo privilegio para las tablas nuevas del modulo PTS.
-- Se eliminan privilegios heredados como TRUNCATE, REFERENCES y TRIGGER.

revoke all privileges on table public.pts_ast from public, anon, authenticated, service_role;
revoke all privileges on table public.pts_permisos_complementarios from public, anon, authenticated, service_role;
revoke all privileges on table public.pts_checklist_respuestas from public, anon, authenticated, service_role;
revoke all privileges on table public.pts_vigilancia_post_trabajo from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.pts_ast to authenticated, service_role;
grant select, insert, update, delete on table public.pts_permisos_complementarios to authenticated, service_role;
grant select, insert, update, delete on table public.pts_checklist_respuestas to authenticated, service_role;
grant select, insert, update, delete on table public.pts_vigilancia_post_trabajo to authenticated, service_role;

commit;
