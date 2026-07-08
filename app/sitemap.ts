import type { MetadataRoute } from "next";
import { benefits, categories, schools } from "@/data/seed";
import { listPublishedOpportunities } from "@/lib/content-store";
const base = "https://unlocked.education";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const opportunities=await listPublishedOpportunities();
  const staticPages = ["", "/updates", "/get-ahead", "/build-career", "/save-money", "/ai", "/career", "/research", "/scholarships", "/software", "/benefits", "/financial", "/local", "/about", "/contact", "/privacy", "/disclaimer", "/submit-perk", "/opportunities", "/best-edu-email-perks", "/student-discounts", "/free-student-software", "/student-ai-tools"];
  return [
    ...staticPages.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-07-06"), changeFrequency: "monthly" as const, priority: path === "" ? 1 : .7 })),
    ...schools.map((school) => ({ url: `${base}/schools/${school.slug}`, lastModified: new Date("2026-07-06"), changeFrequency: "monthly" as const, priority: .8 })),
    ...benefits.map((item) => ({ url: `${base}/benefits/${item.slug}`, lastModified: new Date(item.verifiedAt), changeFrequency: "monthly" as const, priority: .8 })),
    ...opportunities.map((item) => ({ url: `${base}/opportunities/${item.id}`, lastModified: new Date(item.last_verified), changeFrequency: "monthly" as const, priority: .75 })),
    ...categories.slice(1).map((category) => ({ url: `${base}/categories/${category.toLowerCase()}`, lastModified: new Date("2026-07-06"), changeFrequency: "monthly" as const, priority: .7 })),
  ];
}
