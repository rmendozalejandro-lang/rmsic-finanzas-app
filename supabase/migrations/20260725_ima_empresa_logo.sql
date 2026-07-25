-- Logo canónico de IMA Industrial. Las nuevas cotizaciones copian este valor
-- como snapshot, por lo que cambios futuros en la empresa no alteran documentos.
update public.empresas
set logo_url = '/logos/ima-industrial-logo.png',
    updated_at = now()
where lower(coalesce(nombre, '')) like '%ima industrial%'
   or lower(coalesce(razon_social, '')) like '%ima industrial%';
