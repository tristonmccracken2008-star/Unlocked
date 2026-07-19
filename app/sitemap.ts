import type { MetadataRoute } from "next";
const base = "https://www.unlockededu.com";
const publicPages = ["", "/about", "/contact", "/help", "/privacy", "/terms", "/disclaimer", "/pricing"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-07-18"),
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : .7,
  }));
}
