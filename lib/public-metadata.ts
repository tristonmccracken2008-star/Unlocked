import type { Metadata } from "next";

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "UnlockED",
      title,
      description,
      url: path,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "UnlockED student opportunity directory" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}
