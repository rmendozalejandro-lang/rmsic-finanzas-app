-- OT Viva / Asistente Tecnico RMSIC
-- Consistencia semantica entre tipo de evento y nivel de certeza.
--
-- Objetivo:
-- Evitar que la Memoria Tecnica acumule combinaciones contradictorias como:
--   hipotesis + observado
--   medicion + hipotesis
--   decision_cliente + medido
--
-- La aplicacion debe declarar la certeza de forma explicita. La base mantiene
-- una ultima barrera de integridad para los casos con significado inequívoco.

begin;

-- Evitamos que una insercion que omita nivel_certeza termine marcada de forma
-- silenciosa como 'observado'. A partir de esta migracion cada insercion debe
-- declarar su nivel de certeza de manera explicita.
alter table public.ot_eventos_tecnicos
  alter column nivel_certeza drop default;

-- Limpieza defensiva para ambientes de prueba en que estas tablas ya hayan
-- recibido datos antes de aplicar esta correccion. En produccion OT Viva aun
-- no ha sido desplegado, por lo que normalmente no habra filas que ajustar.
update public.ot_eventos_tecnicos
set nivel_certeza = 'hipotesis'
where tipo_evento = 'hipotesis'
  and nivel_certeza <> 'hipotesis';

update public.ot_eventos_tecnicos
set nivel_certeza = 'medido'
where tipo_evento = 'medicion'
  and nivel_certeza <> 'medido';

update public.ot_eventos_tecnicos
set nivel_certeza = 'informado'
where tipo_evento = 'decision_cliente'
  and nivel_certeza <> 'informado';

-- Si la migracion se reejecuta en un entorno de desarrollo, sustituimos la
-- regla anterior de manera controlada.
alter table public.ot_eventos_tecnicos
  drop constraint if exists ot_eventos_tecnicos_tipo_certeza_check;

alter table public.ot_eventos_tecnicos
  add constraint ot_eventos_tecnicos_tipo_certeza_check
  check (
    (tipo_evento <> 'hipotesis' or nivel_certeza = 'hipotesis')
    and
    (tipo_evento <> 'medicion' or nivel_certeza = 'medido')
    and
    (tipo_evento <> 'decision_cliente' or nivel_certeza = 'informado')
  );

comment on constraint ot_eventos_tecnicos_tipo_certeza_check
  on public.ot_eventos_tecnicos
  is 'Protege coherencia semantica: hipotesis=HIPOTESIS, medicion=MEDIDO y decision_cliente=INFORMADO.';

comment on column public.ot_eventos_tecnicos.nivel_certeza
  is 'Debe informarse explicitamente. Casos estrictos: hipotesis->hipotesis, medicion->medido, decision_cliente->informado.';

commit;
