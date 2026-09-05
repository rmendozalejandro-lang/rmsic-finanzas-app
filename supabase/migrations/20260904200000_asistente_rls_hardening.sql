-- Asistente Tralixia
-- Endurecimiento RLS antes de habilitar sincronizacion productiva.
--
-- Objetivos:
--   * El asistente nunca puede superar los permisos del usuario.
--   * Separacion estricta por empresa y por dominio/modulo.
--   * Seguridad y veterinaria reutilizan las reglas existentes de PTS/Haras.
--   * Se elimina DELETE para authenticated: el historial se anula/cancela,
--     no se borra fisicamente desde el cliente.

begin;

create or replace function public.usuario_tiene_acceso_asistente(
  p_empresa_id uuid,
  p_dominio text
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
            and ue.rol in ('admin', 'tecnico_ot')
        )

      when p_dominio = 'general' then
        exists (
          select 1
          from public.usuario_empresas ue
          where ue.empresa_id = p_empresa_id
            and ue.usuario_id = auth.uid()
            and coalesce(ue.activo, true) = true
            and ue.rol = 'admin'
        )

      else
        exists (
          select 1
          from public.usuario_empresas ue
          where ue.empresa_id = p_empresa_id
            and ue.usuario_id = auth.uid()
            and coalesce(ue.activo, true) = true
            and ue.rol = 'admin'
        )
    end;
$$;

comment on function public.usuario_tiene_acceso_asistente(uuid, text) is
  'Autoriza acceso al nucleo Asistente Tralixia por empresa y dominio sin otorgar mas permisos que el modulo/rol del usuario.';

-- Caso raiz: el dominio esta en la propia fila.
drop policy if exists asistente_casos_empresa_access on public.asistente_casos;
drop policy if exists asistente_casos_select on public.asistente_casos;
drop policy if exists asistente_casos_insert on public.asistente_casos;
drop policy if exists asistente_casos_update on public.asistente_casos;

create policy asistente_casos_select
on public.asistente_casos
for select
to authenticated
using (public.usuario_tiene_acceso_asistente(empresa_id, dominio));

create policy asistente_casos_insert
on public.asistente_casos
for insert
to authenticated
with check (public.usuario_tiene_acceso_asistente(empresa_id, dominio));

create policy asistente_casos_update
on public.asistente_casos
for update
to authenticated
using (public.usuario_tiene_acceso_asistente(empresa_id, dominio))
with check (public.usuario_tiene_acceso_asistente(empresa_id, dominio));

-- Tablas hijas: heredan autorizacion desde su caso raiz.
do $$
declare
  t text;
  old_policy text;
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
    old_policy := t || '_empresa_access';
    select_policy := t || '_select';
    insert_policy := t || '_insert';
    update_policy := t || '_update';

    predicate := format(
      'exists (select 1 from public.asistente_casos c '
      || 'where c.id = %I.caso_id '
      || 'and c.empresa_id = %I.empresa_id '
      || 'and public.usuario_tiene_acceso_asistente(c.empresa_id, c.dominio))',
      t, t
    );

    execute format('drop policy if exists %I on public.%I', old_policy, t);
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

-- Eliminar capacidad de borrado fisico desde clientes autenticados.
revoke delete on public.asistente_casos from authenticated;
revoke delete on public.asistente_caso_ots from authenticated;
revoke delete on public.asistente_caso_pts from authenticated;
revoke delete on public.asistente_caso_equipos from authenticated;
revoke delete on public.asistente_caso_animales from authenticated;
revoke delete on public.asistente_caso_partos from authenticated;
revoke delete on public.asistente_caso_procedimientos_vet from authenticated;
revoke delete on public.asistente_sesiones from authenticated;
revoke delete on public.asistente_eventos from authenticated;
revoke delete on public.asistente_evento_relaciones from authenticated;
revoke delete on public.asistente_evidencias from authenticated;
revoke delete on public.asistente_evento_evidencias from authenticated;
revoke delete on public.asistente_fuentes from authenticated;
revoke delete on public.asistente_evento_fuentes from authenticated;
revoke delete on public.asistente_recomendaciones from authenticated;
revoke delete on public.asistente_decisiones from authenticated;

commit;
