$ErrorActionPreference = "Stop"

$path = ".\app\(private)\ot\nueva\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "No se encontro el archivo $path. Ejecuta este script desde la raiz del proyecto rmsic-finanzas-app."
}

$content = Get-Content -Raw -LiteralPath $path
$backup = "$path.bak-seguridad-softys"
Copy-Item -LiteralPath $path -Destination $backup -Force

# 1) Agrega campos al estado del formulario.
if ($content -notmatch "seguridad_permiso_trabajo") {
  $content = $content.Replace(
    "  recomendaciones_seguridad: string;",
    "  recomendaciones_seguridad: string;`r`n  seguridad_permiso_trabajo: boolean;`r`n  seguridad_uso_epp: boolean;`r`n  seguridad_bloqueo_tarjeta: boolean;`r`n  seguridad_observacion: string;"
  )

  $content = $content.Replace(
    '    recomendaciones_seguridad: "",',
    '    recomendaciones_seguridad: "",' + "`r`n" +
    '    seguridad_permiso_trabajo: false,' + "`r`n" +
    '    seguridad_uso_epp: false,' + "`r`n" +
    '    seguridad_bloqueo_tarjeta: false,' + "`r`n" +
    '    seguridad_observacion: "",'
  )
}

# 2) Crea bandera para mostrar checklist solo en DyF / Softys.
if ($content -notmatch "const mostrarSeguridadSoftys") {
  $patternFormato = '  const mostrarFormatoSoftys\s*=\s*(?s:.*?)\;\r?\n'
  $matchFormato = [regex]::Match($content, $patternFormato)

  if ($matchFormato.Success) {
    $insert = $matchFormato.Value + @'

  const mostrarSeguridadSoftys =
    mostrarFormatoSoftys ||
    selectedPlantilla?.formato_ot?.includes("softys") ||
    selectedTipo?.codigo?.includes("dyf_softys") ||
    selectedTipo?.codigo?.includes("softys");
'@
    $content = $content.Substring(0, $matchFormato.Index) + $insert + $content.Substring($matchFormato.Index + $matchFormato.Length)
  } else {
    $patternFlujo = '  const esFlujoDyfSoftys\s*=\s*.*?;\r?\n'
    $matchFlujo = [regex]::Match($content, $patternFlujo)
    if ($matchFlujo.Success) {
      $insert = $matchFlujo.Value + @'

  const mostrarSeguridadSoftys =
    esFlujoDyfSoftys ||
    selectedPlantilla?.formato_ot?.includes("softys") ||
    selectedTipo?.codigo?.includes("dyf_softys") ||
    selectedTipo?.codigo?.includes("softys");
'@
      $content = $content.Substring(0, $matchFlujo.Index) + $insert + $content.Substring($matchFlujo.Index + $matchFlujo.Length)
    } else {
      Write-Warning "No pude insertar const mostrarSeguridadSoftys automaticamente. Revisa manualmente el archivo."
    }
  }
}

# 3) Guarda los campos de seguridad en Supabase al crear la OT.
if ($content -notmatch "seguridad_validada_at") {
  $oldPayload = @'
        recomendaciones_seguridad:
          form.recomendaciones_seguridad.trim() || null,
'@
  $newPayload = @'
        recomendaciones_seguridad: mostrarSeguridadSoftys
          ? null
          : form.recomendaciones_seguridad.trim() || null,
        seguridad_permiso_trabajo: mostrarSeguridadSoftys
          ? form.seguridad_permiso_trabajo
          : false,
        seguridad_uso_epp: mostrarSeguridadSoftys
          ? form.seguridad_uso_epp
          : false,
        seguridad_bloqueo_tarjeta: mostrarSeguridadSoftys
          ? form.seguridad_bloqueo_tarjeta
          : false,
        seguridad_observacion: mostrarSeguridadSoftys
          ? form.seguridad_observacion.trim() || null
          : null,
        seguridad_validada_at:
          mostrarSeguridadSoftys &&
          (form.seguridad_permiso_trabajo ||
            form.seguridad_uso_epp ||
            form.seguridad_bloqueo_tarjeta)
            ? new Date().toISOString()
            : null,
        seguridad_validada_by:
          mostrarSeguridadSoftys &&
          (form.seguridad_permiso_trabajo ||
            form.seguridad_uso_epp ||
            form.seguridad_bloqueo_tarjeta)
            ? user.id
            : null,
'@
  if ($content.Contains($oldPayload)) {
    $content = $content.Replace($oldPayload, $newPayload)
  } else {
    Write-Warning "No encontre el bloque exacto de recomendaciones_seguridad en el payload. Revisa manualmente cerca del insert de ot_ordenes_trabajo."
  }
}

# 4) Reemplaza el textarea antiguo por checklist Softys condicional.
if ($content -notmatch "1.0 REQUERIMIENTOS DE SEGURIDAD SOFTYS") {
  $oldUi = @'
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Recomendaciones de seguridad para la ejecución del trabajo
                  </label>
                  <textarea
                    value={form.recomendaciones_seguridad}
                    onChange={(e) =>
                      handleChange("recomendaciones_seguridad", e.target.value)
                    }
                    rows={3}
                    placeholder="Indica recomendaciones o condiciones de seguridad generales de la OM."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
'@

  $newUi = @'
                {mostrarSeguridadSoftys ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-3 rounded-lg border border-blue-300 bg-white px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-900">
                        1.0 REQUERIMIENTOS DE SEGURIDAD SOFTYS
                      </p>
                      <p className="mt-1 text-xs text-blue-700">
                        Marca los requisitos aplicados antes de ejecutar la OM.
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-800">
                      <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={form.seguridad_permiso_trabajo}
                          onChange={(e) =>
                            handleChange("seguridad_permiso_trabajo", e.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="font-semibold">1.1</span> Permiso de trabajo seguro debidamente completado y autorizado
                        </span>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={form.seguridad_uso_epp}
                          onChange={(e) =>
                            handleChange("seguridad_uso_epp", e.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="font-semibold">1.2</span> Uso de elementos de protección personal
                          <span className="mt-1 block text-xs text-slate-500">
                            Casco de seguridad + protectores auditivos + lentes de seguridad + guantes
                          </span>
                        </span>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={form.seguridad_bloqueo_tarjeta}
                          onChange={(e) =>
                            handleChange("seguridad_bloqueo_tarjeta", e.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="font-semibold">1.3</span> Uso de candado de bloqueo + tarjeta NO OPERAR
                        </span>
                      </label>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Observación de seguridad
                      </label>
                      <textarea
                        value={form.seguridad_observacion}
                        onChange={(e) =>
                          handleChange("seguridad_observacion", e.target.value)
                        }
                        rows={2}
                        placeholder="Observación opcional asociada a los requisitos de seguridad Softys."
                        className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Recomendaciones de seguridad para la ejecución del trabajo
                    </label>
                    <textarea
                      value={form.recomendaciones_seguridad}
                      onChange={(e) =>
                        handleChange("recomendaciones_seguridad", e.target.value)
                      }
                      rows={3}
                      placeholder="Indica recomendaciones o condiciones de seguridad generales de la OM."
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>
                )}
'@

  if ($content.Contains($oldUi)) {
    $content = $content.Replace($oldUi, $newUi)
  } else {
    Write-Warning "No encontre el bloque visual exacto del textarea de seguridad. Revisa manualmente cerca de 'Recomendaciones de seguridad para la ejecucion del trabajo'."
  }
}

Set-Content -LiteralPath $path -Value $content -Encoding UTF8

Write-Host "Patch aplicado. Backup creado en: $backup"
Write-Host "Ahora ejecuta: npm run build"
