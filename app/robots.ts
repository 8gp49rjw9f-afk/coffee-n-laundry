import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  /* Same fallback as the sitemap route. On Vercel the variable is
     set, so this reads the real domain — but if it were ever missing,
     declaring `localhost:3000` to a crawler is worse than declaring
     nothing, and it is the same mistake that made the first sitemap
     unusable. */
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://coffee-n-laundry.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/place/", "/about"],
        disallow: ["/admin", "/profile", "/update/"],
      },
    ],

    /* NOT `/sitemap.xml`. That path belongs to Next's metadata
       convention, and a route placed there never ran — the request
       fell through to the 404 page and Search Console was handed
       HTML. The file is served from `app/sitemap/route.ts` instead,
       which is why this line points at `/sitemap`. */
    sitemap: `${base}/sitemap`,
  };
}
