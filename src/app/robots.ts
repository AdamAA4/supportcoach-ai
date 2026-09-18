import type { MetadataRoute } from "next";

const SITE_URL = "https://supportcoach-ai-ten.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/call", "/report"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
