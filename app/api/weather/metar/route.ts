export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = searchParams.get("icao");

  if (!icao) {
    return Response.json({ error: "Missing icao query param" }, { status: 400 });
  }

  const code = icao.toUpperCase();

  try {
    const res = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${code}&format=json`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) {
      return Response.json({ error: "Weather service unavailable" }, { status: 500 });
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({ error: "Airport not found" }, { status: 404 });
    }

    const m = data[0];

    // Wind
    const wdir = m.wdir;
    const wspd = m.wspd;
    let wind: string | undefined;
    if (wdir != null && wspd != null) {
      const dirStr = wdir === 0 || wdir === "VRB" ? "Variable" : `${wdir}°`;
      wind = `${dirStr} at ${wspd}kt`;
    }

    // Visibility
    const visibility: string | undefined =
      m.visib != null ? `${m.visib}SM` : undefined;

    // Ceiling — first BKN or OVC layer
    let ceiling: string | undefined;
    if (Array.isArray(m.sky_condition)) {
      const layer = m.sky_condition.find(
        (s: { sky_cover: string; cloud_base_ft_agl?: number }) =>
          s.sky_cover === "BKN" || s.sky_cover === "OVC"
      );
      if (layer) {
        ceiling = `${layer.cloud_base_ft_agl}ft ${layer.sky_cover}`;
      }
    }

    return Response.json({
      airport: code,
      raw: m.rawOb ?? m.raw_text ?? null,
      wind,
      visibility,
      ceiling,
      conditions: m.flight_category ?? null,
    });
  } catch {
    return Response.json({ error: "Failed to fetch weather data" }, { status: 500 });
  }
}
