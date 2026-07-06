import type { Metadata } from "next";
import { SeoLanding } from "@/components/seo-landing";
import { benefits } from "@/data/seed";
export const metadata: Metadata = { title: "Student discounts guide", description: "Find student discounts on technology, streaming, shopping, travel, banking, wellness, and more." };
export default function Page() { const picks = benefits.filter((item) => ["Shopping","Streaming","Travel","Finance"].includes(item.category)); return <SeoLanding eyebrow="Spend less" title="Student discounts that actually add up" intro="From laptops and music to travel and banking, these offers can reduce the recurring costs that follow students through the year." benefits={picks} guideTitle="Claim discounts safely" guide={["Start from the provider’s official offer page instead of an unverified coupon site.", "Read eligibility and renewal terms before entering payment details.", "Recheck the standard price before renewal and cancel offers you no longer use."]} />; }
