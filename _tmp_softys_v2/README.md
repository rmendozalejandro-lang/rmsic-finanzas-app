# Tralixia - Informe Softys: seguridad y técnicos participantes

Este paquete corrige el flujo posterior a crear la OT DyF / Softys.

## Archivos incluidos

- `app/(private)/ot/[id]/informe-softys/page.tsx`
- `app/api/ot-pdf/[id]/route.ts`
- `components/ot/ot-pdf-document.tsx`

## Qué corrige

1. En el informe final Softys se leen y muestran los campos:
   - `seguridad_permiso_trabajo`
   - `seguridad_uso_epp`
   - `seguridad_bloqueo_tarjeta`
   - `seguridad_observacion`

2. En el informe final Softys se leen y muestran los técnicos participantes desde:
   - `ot_orden_equipo_trabajo`

3. En el PDF se pasan y muestran:
   - checklist de seguridad Softys
   - técnicos participantes registrados en la OT

## Aplicación

Copiar/reemplazar estos archivos en el proyecto y ejecutar:

```bash
npm run build
```

Si compila bien:

```bash
git add .
git commit -m "Muestra seguridad Softys y tecnicos participantes en informe y PDF"
git push origin main
```

Recordatorio: producción está asociada a `main` en Vercel.
