import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/profile", "/my-opportunities"] },
    sitemap: "https://unlocked.education/sitemap.xml",
  };
}
