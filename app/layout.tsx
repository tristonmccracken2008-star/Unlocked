import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AccountSync } from "@/components/account-auth";
import { ProductAnalytics } from "@/components/product-analytics";
import { AuthBoundary } from "@/components/auth-boundary";
import { ThemeBootstrapScript, ThemeController } from "@/components/theme-controller";
import { journeyThemeCss } from "@/lib/journey-theme";

export const metadata: Metadata = {
  metadataBase: new URL("https://unlocked.education"),
  title: { default: "UnlockED — Everything your student status unlocks", template: "%s | UnlockED" },
  description: "Discover verified student benefits, free software, AI tools, discounts, and campus resources available through your student status.",
  keywords: ["student discounts", ".edu email perks", "free student software", "student AI tools", "college discounts"],
  applicationName: "UnlockED",
  authors: [{ name: "UnlockED" }],
  creator: "UnlockED",
  icons: { icon: "/icon", apple: "/apple-icon" },
  openGraph: { type: "website", siteName: "UnlockED", title: "UnlockED — Everything your student status unlocks", description: "Find verified benefits, free software, AI tools, discounts, and campus resources.", url: "https://unlocked.education", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "UnlockED student opportunity directory" }] },
  twitter: { card: "summary_large_image", title: "UnlockED", description: "Everything your student status unlocks.", images: ["/opengraph-image"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" data-theme="light" suppressHydrationWarning><head><style id="unlocked-journey-theme-tokens" dangerouslySetInnerHTML={{ __html: journeyThemeCss() }} /></head><body><ThemeBootstrapScript/><AccountSync /><ThemeController/><ProductAnalytics/><Header /><AuthBoundary>{children}</AuthBoundary><Footer /></body></html>;
}
