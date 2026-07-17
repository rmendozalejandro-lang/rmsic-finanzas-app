alter table public.invitaciones_empresa
  add column if not exists email_enviado_at timestamp with time zone null,
  add column if not exists email_resend_id text null,
  add column if not exists email_error text null,
  add column if not exists email_reintentos integer not null default 0,
  add column if not exists email_ultimo_estado text null,
  add column if not exists ultimo_reenvio_at timestamp with time zone null;

comment on column public.invitaciones_empresa.email_enviado_at is
  'Fecha del último envío aceptado por Resend.';
comment on column public.invitaciones_empresa.email_resend_id is
  'Identificador del último correo aceptado por Resend.';
comment on column public.invitaciones_empresa.email_error is
  'Mensaje del error ocurrido en el último intento de envío.';
comment on column public.invitaciones_empresa.email_reintentos is
  'Cantidad total de intentos de envío, incluido el envío inicial.';
comment on column public.invitaciones_empresa.email_ultimo_estado is
  'Resultado del último intento de envío: enviado o error.';
comment on column public.invitaciones_empresa.ultimo_reenvio_at is
  'Fecha del último intento de envío del correo de invitación.';
