import type { NextConfig } from "next";

/*
 * Five photos travel with the add-a-place form, compressed in the
 * browser to roughly 400 KB each. That is already over the one
 * megabyte a Server Action accepts by default, so the request was
 * refused with a 413 before createPlace ever ran — and because the
 * browser only sees an opaque "Server Components render" digest, it
 * looked like a database fault for a long time.
 *
 * 8 MB covers five compressed photos plus the rest of the form with
 * room to spare. It is the fix Next.js itself points at in the error
 * message (serverActions#bodysizelimit).
 *
 * The limit is per request, not per photo: the form caps photos at
 * five in NewPlaceForm, and each is reduced to 1400px before upload,
 * so this number cannot be reached by ordinary use.
 */

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
