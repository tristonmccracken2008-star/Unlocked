import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://unlocked.education"),
  title: { default: "UnlockED — Everything your student status unlocks", template: "%s | UnlockED" },
  description: "Discover verified student benefits, free software, AI tools, discounts, and campus resources available through your student status.",
  keywords: ["student discounts", ".edu email perks", "free student software", "student AI tools", "college discounts"],
  applicationName: "UnlockED",
  authors: [{ name: "UnlockED" }],
  creator: "UnlockED",
  openGraph: { type: "website", siteName: "UnlockED", title: "UnlockED — Everything your student status unlocks", description: "Find verified benefits, free software, AI tools, discounts, and campus resources.", url: "https://unlocked.education" },
  twitter: { card: "summary_large_image", title: "UnlockED", description: "Everything your student status unlocks." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header /><main>{children}</main><Footer /></body></html>;
}
