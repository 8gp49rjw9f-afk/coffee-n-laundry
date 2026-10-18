/*
 * THE SITEMAP, AS PLAIN XML.
 *
 * This was `app/sitemap.ts` — Next's metadata convention, which
 * produces the same file at build time. It is gone, and this route
 * replaces it, for a reason worth writing down.
 *
 * WHAT WENT WRONG
 *
 * The site asked Search Console to read /sitemap.xml and got the
 * home page back instead of a file. Nothing in the repo explained
 * it: there is no public/sitemap.xml to shadow this one, no static
 * app/sitemap.xml, no catch-all route at the root, and the matcher
 * in proxy.ts excludes sitemap.xml outright. The file should have
 * been served, and it was not.
 *
 * So instead of arguing with the convention, this route builds the
 * XML by hand. It says what it is — a GET returning a string with an
 * explicit content type — which is the thing a crawler actually
 * needs, and which nothing in the framework can silently reinterpret.
 *
 * If this one serves XML and `app/sitemap.ts` did not, then the
 * metadata convention was the fault. If this one is ALSO swallowed,
 * then the problem is upstream of the app — the domain, a rewrite on
 * Vercel, or the deployment itself — and that is a different search
 * entirely.
 *
 * WHAT IS IN IT, AND WHAT IS NOT
 *
 * Five pages, the ones that exist without a database read. The place
 * pages under /place/ are NOT here: robots.ts allows them, so they
 * are crawlable, but a crawler only finds them through links — and
 * the map is a client component, so there is nothing for it to
 * follow. Listing them would mean a Supabase query in this route,
 * which is the real next step for search. It is left out on purpose
 * rather than by oversight.
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
