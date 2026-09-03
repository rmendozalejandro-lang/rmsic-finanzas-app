alter table public.pts_checklist_respuestas
add constraint pts_checklist_izaje_na_hiperseguridad_check
check (
  not (
    codigo_item like 'IZA-CHK-%'
    and respuesta = 'na'
    and (
      codigo_item not in ('IZA-CHK-06','IZA-CHK-12','IZA-CHK-13')
      or nullif(trim(observacion), '') is null
    )
  )
);
