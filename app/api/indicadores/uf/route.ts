import { NextRequest, NextResponse } from "next/server";

type MindicadorResponse = {
  serie?: Array<{
    fecha?: string;
    valor?: number;
  }>;
};

function toApiDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get("fecha")?.trim() || "";
  const apiDate = toApiDate(fecha);

  if (!apiDate) {
    return NextResponse.json(
      { error: "Fecha inválida. Usa formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://mindicador.cl/api/uf/${encodeURIComponent(apiDate)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar el valor UF." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as MindicadorResponse;
    const valor = Number(data.serie?.[0]?.valor);

    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json(
        { error: "No existe un valor UF válido para la fecha seleccionada." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      fecha,
      valor,
      fuente: "mindicador.cl",
    });
  } catch {
    return NextResponse.json(
      { error: "No fue posible conectar con el servicio de indicadores." },
      { status: 502 }
    );
  }
}
