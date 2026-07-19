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
  metadataBase: new URL("https://www.unlockededu.com"),
  title: { default: "UnlockED — Student opportunities, chosen for you", template: "%s | UnlockED" },
  description: "Discover scholarships, internships, research, student benefits, and other opportunities from official sources.",
  keywords: ["college scholarships", "student internships", "undergraduate research", "student opportunities", "student benefits"],
  applicationName: "UnlockED",
  authors: [{ name: "UnlockED" }],
  creator: "UnlockED",
  icons: { icon: "/icon", apple: "/apple-icon" },
  openGraph: { type: "website", siteName: "UnlockED", title: "UnlockED — Student opportunities, chosen for you", description: "Discover scholarships, internships, research, student benefits, and other opportunities from official sources.", url: "https://www.unlockededu.com", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "UnlockED student opportunity directory" }] },
  twitter: { card: "summary_large_image", title: "UnlockED", description: "Student opportunities, chosen for you.", images: ["/opengraph-image"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" data-theme="light" suppressHydrationWarning><head><style id="unlocked-journey-theme-tokens" dangerouslySetInnerHTML={{ __html: journeyThemeCss() }} /></head><body><ThemeBootstrapScript/><AccountSync /><ThemeController/><ProductAnalytics/><Header /><AuthBoundary>{children}</AuthBoundary><Footer /></body></html>;
}
