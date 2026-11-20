import { load } from "cheerio";
import { NextResponse } from "next/server";

type ScrapedTee = {
  name: string;
  par: number;
  courseRating: number;
  slopeRating: number;
};

const MAX_HTML_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;

function isGolfifyCourseUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || !["golfify.io", "www.golfify.io"].includes(url.hostname.toLowerCase())
      || !url.pathname.startsWith("/courses/")
      || url.username
      || url.password
      || (url.port && url.port !== "443")
    ) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function parseNumber(value: string): number | undefined {
  const cleaned = value.replace(/,/g, ".").match(/\d{1,3}(?:\.\d+)?/);
  if (!cleaned) return undefined;
  const number = Number(cleaned[0]);
  return Number.isFinite(number) ? number : undefined;
}

function parseTable(html: string): ScrapedTee[] {
  const $ = load(html);
  const results: ScrapedTee[] = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    for (const [rowIndex, row] of rows.entries()) {
      const headers = $(row).find("th,td").toArray().map((cell) => normalizeHeader($(cell).text().trim()));
      const teeIndex = headers.findIndex((header) =>
        header.startsWith("tee") || header === "color" || header === "colour",
      );
      const parIndex = headers.findIndex((header) => header.startsWith("par"));
      const crIndex = headers.findIndex((header) =>
        header === "cr" || header.includes("courserating") || header === "rating",
      );
      const slopeIndex = headers.findIndex((header) => header.startsWith("slope"));
      if ([teeIndex, parIndex, crIndex, slopeIndex].some((index) => index < 0)) continue;

      for (const dataRow of rows.slice(rowIndex + 1)) {
        const cells = $(dataRow).find("th,td").toArray().map((cell) => $(cell).text().replace(/\s+/g, " ").trim());
        const name = cells[teeIndex];
        const par = parseNumber(cells[parIndex] ?? "");
        const courseRating = parseNumber(cells[crIndex] ?? "");
        const slopeRating = parseNumber(cells[slopeIndex] ?? "");
        if (
          name
          && par !== undefined && Number.isInteger(par) && par >= 54 && par <= 90
          && courseRating !== undefined && courseRating >= 50 && courseRating <= 100
          && slopeRating !== undefined && Number.isInteger(slopeRating) && slopeRating >= 55 && slopeRating <= 155
        ) {
          results.push({ name, par, courseRating, slopeRating });
        }
      }
      return false;
    }
  });

  return results.filter((tee, index, tees) =>
    tees.findIndex((candidate) =>
      candidate.name.toLowerCase() === tee.name.toLowerCase()
      && candidate.par === tee.par
      && candidate.courseRating === tee.courseRating
      && candidate.slopeRating === tee.slopeRating,
    ) === index,
  );
}

async function fetchGolfifyPage(initialUrl: URL): Promise<Response> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "WinterTourCourseImporter/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === MAX_REDIRECTS) throw new Error("Golfify redirected too many times.");
    const redirectedUrl = isGolfifyCourseUrl(new URL(location, url).toString());
    if (!redirectedUrl) throw new Error("Golfify redirected to an unsupported address.");
    url = redirectedUrl;
  }
  throw new Error("Golfify redirected too many times.");
}

async function readHtml(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new Error("Golfify-siden er for stor til å lese.");
  }
  if (!response.body) throw new Error("Golfify-siden hadde ikke noe innhold.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("Golfify-siden er for stor til å lese.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const urlValue = body && typeof body === "object" && "url" in body
    ? (body as { url?: unknown }).url
    : undefined;
  const url = typeof urlValue === "string" ? isGolfifyCourseUrl(urlValue) : undefined;
  if (!url) {
    return NextResponse.json(
      { error: "Oppgi en HTTPS-URL til en kurs-side på golfify.io/courses/." },
      { status: 400 },
    );
  }

  try {
    const response = await fetchGolfifyPage(url);
    if (!response.ok) {
      return NextResponse.json({ error: `Golfify svarte med HTTP ${response.status}.` }, { status: 502 });
    }
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      return NextResponse.json({ error: "Golfify-siden inneholder ikke HTML." }, { status: 502 });
    }
    const html = await readHtml(response);
    const tees = parseTable(html);
    if (!tees.length) {
      return NextResponse.json(
        { error: "Fant ingen tee-tabell med Par, Course Rating og Slope på Golfify-siden." },
        { status: 404 },
      );
    }
    return NextResponse.json({ tees });
  } catch (error) {
    console.error("Could not import course data from Golfify.", error);
    return NextResponse.json({ error: "Kunne ikke lese Golfify-siden. Prøv igjen senere." }, { status: 502 });
  }
}
