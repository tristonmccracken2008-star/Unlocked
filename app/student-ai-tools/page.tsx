import type { Metadata } from "next";
import { SeoLanding } from "@/components/seo-landing";
import { benefits } from "@/data/seed";
export const metadata: Metadata = { title: "AI tools for students", description: "Compare AI research, writing, study, and problem-solving tools with student access or education pricing." };
export default function Page() { return <SeoLanding eyebrow="Study smarter" title="AI tools built for student workflows" intro="Find research, writing, computation, and study tools that offer education access—and understand what each one requires before signing up." benefits={benefits.filter((item) => item.category === "AI")} guideTitle="Use student AI responsibly" guide={["Check your course and institution’s AI policy before using generated material in graded work.", "Use tools to explore, organize, and verify ideas—not as a substitute for original analysis.", "Review citations and factual claims against primary sources before submitting work."]} />; }
