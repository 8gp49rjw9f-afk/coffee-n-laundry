/*
 * THE SITEMAP, AS PLAIN XML — at /sitemap, not /sitemap.xml.
 *
 * WHY THE PATH CHANGED
 *
 * There was a route at `app/sitemap.xml/route.ts`. It never ran. A
 * folder literally named `sitemap.xml` under `app/` collides with
 * Next's own metadata convention for that path — the framework
 * reserves it, so the request fell through to `app/not-found.tsx`
 * and Search Console was handed an HTML page with the message
 * “Votre sitemap semble correspondre à une page HTML”.
 *
 * Two attempts were spent before that was clear: first the
 * convention (`app/sitemap.ts`), then a route under the same
 * reserved name. The name was the problem both times, never the
 * content.
 *
 * WHAT THIS IS NOW
 *
 * A URL that nothing reserves. A plain GET returning a string with
 * an explicit content type — the thing a crawler needs, with no
 * framework layer left to reinterpret it.
 *
 * The address is declared in `app/robots.ts`, which is the only
 * place that needs to know it. Nothing else links here.
 *
 * WHAT IS IN IT, AND WHAT IS NOT
 *
 * Five pages, the ones that exist without a database read. The
 * place pages under /place/ are NOT here: robots.ts allows them, so
 * they are crawlable, but a crawler only finds pages through links
 * — and the map is a client component, so there is nothing for it
 * to follow. Listing them would mean a Supabase query here, and
 * that is the real next step for search. Left out on purpose.
 */

export const dynamic = "force-static";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://coffee-n-laundry.com";

const PATHS = ["", "/about", "/new", "/login", "/signup"];

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const urls = PATHS.map(
    (path) =>
      `  <url>\n` +
      `    <loc>${BASE}${path}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `  </url>`
  ).join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
