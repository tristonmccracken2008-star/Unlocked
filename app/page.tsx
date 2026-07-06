import type { Metadata } from "next";
import { PersonalizedHome } from "@/components/personalized-home";

export const metadata: Metadata = {
  title: { absolute: "UnlockED — Your personalized student opportunity dashboard" },
  description: "Build a personalized student dashboard with verified benefits for your school and a foundation for future academic, career, and local opportunities.",
};

export default function Home() {
  return <PersonalizedHome />;
}
