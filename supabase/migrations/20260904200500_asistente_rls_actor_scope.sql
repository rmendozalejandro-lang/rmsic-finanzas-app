-- Asistente Tralixia
-- Ajuste final de alcance por actor antes de produccion.
--
-- Para el dominio tecnico, un tecnico_ot solo puede operar sus propios casos.
-- Admin/super-admin conserva acceso transversal dentro de la empresa.
-- Seguridad y veterinaria mantienen las reglas de sus modulos especializados.

begin;

create or replace function public.usuario_puede_acceder_caso_asistente(
  p_empresa_id uuid,
  p_dominio text,
  p_responsable_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.es_super_admin()
    or case
      when p_dominio = 'seguridad' then
        public.usuario_tiene_acceso_pts(p_empresa_id)

      when p_dominio = 'veterinaria' then
        public.usuario_tiene_acceso_haras(p_empresa_id)

      when p_dominio in ('tecnico', 'activos') then
        exists (
          select 1
          from public.usuario_empresas ue
          join public.empresa_modulos em
            on em.empresa_id = ue.empresa_id
           and em.modulo = 'operacional'
           and em.habilitado = true
          where ue.empresa_id = p_empresa_id
            and ue.usuario_id = auth.uid()
            and coalesce(ue.activo, true) = true
            and (
              ue.rol = 'admin'
              or (ue.rol = 'tecnico_ot' and p_responsable_id = auth.uid())
            )
        )

      when p_dominio in ('general', 'otro') then
        exists (
          select 1
          from public.usuario_empresas ue
          where ue.empresa_id = p_empresa_id
            and ue.usuario_id = auth.uid()
            and coalesce(ue.activo, true) = true
            and ue.rol = 'admin'
        )

      else
        false
    end;
$$;

comment on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) is
  'Autoriza un caso Asistente por empresa, dominio y responsable. Los tecnicos OT quedan limitados a sus propios casos.';

revoke all on function public.usuario_tiene_acceso_asistente(uuid, text) from public;
revoke all on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) from public;
grant execute on function public.usuario_tiene_acceso_asistente(uuid, text) to authenticated;
grant execute on function public.usuario_puede_acceder_caso_asistente(uuid, text, uuid) to authenticated;

-- Caso raiz: aplicar alcance por responsable.
drop policy if exists asistente_casos_select on public.asistente_casos;
drop policy if exists asistente_casos_insert on public.asistente_casos;
drop policy if exists asistente_casos_update on public.asistente_casos;

create policy asistente_casos_select
on public.asistente_casos
for select
to authenticated
using (
  public.usuario_puede_acceder_caso_asistente(empresa_id, dominio, responsable_id)
);

create policy asistente_casos_insert
on public.asistente_casos
for insert
to authenticated
with check (
  public.usuario_puede_acceder_caso_asistente(empresa_id, dominio, responsable_id)
);

create policy asistente_casos_update
on public.asistente_casos
for update
to authenticated
using (
  public.usuario_puede_acceder_caso_asistente(empresa_id, dominio, responsable_id)
)
with check (
  public.usuario_puede_acceder_caso_asistente(empresa_id, dominio, responsable_id)
);

-- Hijas: heredan el alcance exacto del caso raiz.
do $$
declare
  t text;
  select_policy text;
  insert_policy text;
  update_policy text;
  predicate text;
begin
  foreach t in array array[
    'asistente_caso_ots','asistente_caso_pts','asistente_caso_equipos',
    'asistente_caso_animales','asistente_caso_partos','asistente_caso_procedimientos_vet',
    'asistente_sesiones','asistente_eventos','asistente_evento_relaciones',
    'asistente_evidencias','asistente_evento_evidencias','asistente_fuentes',
    'asistente_evento_fuentes','asistente_recomendaciones','asistente_decisiones'
  ]
  loop
    select_policy := t || '_select';
    insert_policy := t || '_insert';
    update_policy := t || '_update';

    predicate := format(
      'exists (select 1 from public.asistente_casos c '
      || 'where c.id = %I.caso_id '
      || 'and c.empresa_id = %I.empresa_id '
      || 'and public.usuario_puede_acceder_caso_asistente(c.empresa_id, c.dominio, c.responsable_id))',
      t, t
    );

    execute format('drop policy if exists %I on public.%I', select_policy, t);
    execute format('drop policy if exists %I on public.%I', insert_policy, t);
    execute format('drop policy if exists %I on public.%I', update_policy, t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      select_policy, t, predicate
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      insert_policy, t, predicate
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      update_policy, t, predicate, predicate
    );
  end loop;
end;
$$;

commit;
