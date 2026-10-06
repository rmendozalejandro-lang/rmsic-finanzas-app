import { NextRequest, NextResponse } from "next/server";

function parseFecha(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { year, month, day };
}

function cleanCellText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseValorUf(value: string) {
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extraerUfDesdeSii(html: string, month: number, day: number) {
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    cellRegex.lastIndex = 0;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanCellText(cellMatch[1]));
    }

    // La tabla resumen anual del SII tiene una columna de día + 12 meses.
    // Las tablas mensuales tienen menos columnas, por lo que se descartan.
    if (cells.length < 13) continue;
    if (Number(cells[0]) !== day) continue;

    const valor = parseValorUf(cells[month]);
    if (valor) return valor;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get("fecha")?.trim() || "";
  const parsedFecha = parseFecha(fecha);

  if (!parsedFecha) {
    return NextResponse.json(
      { error: "Fecha inválida. Usa formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const { year, month, day } = parsedFecha;
  const siiUrl = `https://www.sii.cl/valores_y_fechas/uf/uf${year}.htm`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(siiUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Tralixia/1.0 (consulta UF para cotizaciones)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar la UF publicada por el SII." },
        { status: 502 }
      );
    }

    const html = await response.text();
    const valor = extraerUfDesdeSii(html, month, day);

    if (!valor) {
      return NextResponse.json(
        {
          error:
            "El SII todavía no publica un valor UF para la fecha seleccionada.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      fecha,
      valor,
      fuente: "sii.cl",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "La consulta al SII tardó demasiado. Intenta nuevamente." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "No fue posible conectar con el SII para consultar la UF." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
