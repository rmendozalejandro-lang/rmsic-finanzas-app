-- Security hardening: OT evidence Storage, stage 1
-- Prepared in feature branch only. Do not apply to production until regression tests pass.
--
-- IMPORTANT:
-- The ot-evidencias bucket is currently PUBLIC and ot_evidencias.archivo_url stores
-- public URLs. Making the bucket private immediately would break existing image/file
-- rendering. Stage 1 therefore tightens WRITE permissions only while preserving the
-- current public read behavior. Stage 2 will migrate reads to authenticated/signed URLs
-- and then make the bucket private.

begin;

-- Remove duplicate/broad write policies that allow any authenticated user to write
-- anywhere inside the bucket.
drop policy if exists ot_evidencias_insert on storage.objects;
drop policy if exists ot_evidencias_insert_authenticated on storage.objects;
drop policy if exists ot_evidencias_update on storage.objects;
drop policy if exists ot_evidencias_update_authenticated on storage.objects;
drop policy if exists ot_evidencias_delete on storage.objects;
drop policy if exists ot_evidencias_delete_authenticated on storage.objects;

-- Keep current public SELECT policy temporarily to avoid breaking existing public URLs.
-- It will be removed in stage 2 after application code uses private downloads/signed URLs.

create policy ot_evidencias_insert_empresa_ot
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ot-evidencias'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.usuario_empresas ue
    join public.ot_ordenes_trabajo ot
      on ot.empresa_id = ue.empresa_id
    where ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
      and ot.id::text = (storage.foldername(name))[2]
      and ot.empresa_id::text = (storage.foldername(name))[1]
  )
);

create policy ot_evidencias_update_empresa_ot
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ot-evidencias'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.usuario_empresas ue
    join public.ot_ordenes_trabajo ot
      on ot.empresa_id = ue.empresa_id
    where ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
      and ot.id::text = (storage.foldername(name))[2]
      and ot.empresa_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'ot-evidencias'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.usuario_empresas ue
    join public.ot_ordenes_trabajo ot
      on ot.empresa_id = ue.empresa_id
    where ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
      and ot.id::text = (storage.foldername(name))[2]
      and ot.empresa_id::text = (storage.foldername(name))[1]
  )
);

create policy ot_evidencias_delete_empresa_ot
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ot-evidencias'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.usuario_empresas ue
    join public.ot_ordenes_trabajo ot
      on ot.empresa_id = ue.empresa_id
    where ue.usuario_id = auth.uid()
      and coalesce(ue.activo, true) = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
      and ot.id::text = (storage.foldername(name))[2]
      and ot.empresa_id::text = (storage.foldername(name))[1]
  )
);

commit;
