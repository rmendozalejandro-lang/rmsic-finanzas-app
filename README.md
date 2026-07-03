# Tralixia - Checklist seguridad Softys en Crear nueva OT

Este paquete corrige la pantalla:

```txt
app/(private)/ot/nueva/page.tsx
```

Objetivo:

```txt
Crear nueva OT DyF / Softys
-> mostrar checklist 1.0 Requerimientos de seguridad Softys
-> guardar campos seguridad_* en ot_ordenes_trabajo
```

## Aplicación recomendada

1. Copia el script en la raíz del proyecto `rmsic-finanzas-app`.
2. Ejecuta en PowerShell:

```powershell
.\scripts\apply_ot_nueva_seguridad_softys.ps1
```

3. Compila:

```bash
npm run build
```

4. Si compila bien:

```bash
git add .
git commit -m "Agrega checklist seguridad Softys al crear OT"
git push origin main
```

## Nota

El script crea backup automático:

```txt
app/(private)/ot/nueva/page.tsx.bak-seguridad-softys
```

Si el script muestra advertencias, no subas cambios todavía: revisa el archivo o comparte la advertencia.
