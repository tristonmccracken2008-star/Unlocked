import type { Metadata } from "next";
import { SubmitPerkForm } from "@/components/submit-perk-form";
export const metadata: Metadata = { title: "Submit a student perk", description: "Share a student discount, free resource, software offer, or campus benefit with the UnlockED directory." };
export default function SubmitPerkPage() { return <section className="px-5 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-2xl"><p className="rule-label text-forest">Community submissions</p><h1 className="mt-3 font-editorial text-4xl font-bold tracking-tight sm:text-5xl">Know a perk we missed?</h1><p className="mt-4 max-w-xl text-lg leading-8 text-ink/55">Send us the official details. Every submission is reviewed before it appears in the directory.</p><SubmitPerkForm /></div></section>; }
