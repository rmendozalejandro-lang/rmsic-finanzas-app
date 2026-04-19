type EmpresaBrandingInput = {
  empresaLogoUrl?: string | null;
  empresaNombre?: string | null;
  empresaActivaNombre?: string | null;
};

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function getEmpresaLogoSrc({
  empresaLogoUrl,
  empresaNombre,
  empresaActivaNombre,
}: EmpresaBrandingInput) {
  const explicitLogo = (empresaLogoUrl || "").trim();
  if (explicitLogo) return explicitLogo;

  const source = `${normalizeText(empresaNombre)} ${normalizeText(
    empresaActivaNombre
  )}`;

  if (source.includes("rm servicios") || source.includes("rmsic")) {
    return "/rmsic-logo.png";
  }

  if (source.includes("rukalaf")) {
    return "/rukalaf-logo.png";
  }

  return "";
}

export function getEmpresaWebFallback({
  empresaNombre,
  empresaActivaNombre,
}: Omit<EmpresaBrandingInput, "empresaLogoUrl">) {
  const source = `${normalizeText(empresaNombre)} ${normalizeText(
    empresaActivaNombre
  )}`;

  if (source.includes("rm servicios") || source.includes("rmsic")) {
    return "www.rmsic.cl";
  }

  return "";
}