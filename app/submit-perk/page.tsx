import type { Metadata } from "next";
import { SubmitPerkForm } from "@/components/submit-perk-form";
export const metadata: Metadata = { title: "Submit a student perk", description: "Share a student discount, free resource, software offer, or campus benefit with the UnlockED directory." };
export default function SubmitPerkPage() { return <section className="px-5 py-14 sm:px-8 sm:py-20"><div className="mx-auto max-w-2xl"><p className="mb-3 text-sm font-bold uppercase tracking-widest text-forest">Community powered</p><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Know a perk we missed?</h1><p className="mt-4 max-w-xl text-lg leading-8 text-ink/55">Send us the details. We’ll verify the offer before adding it to the directory.</p><SubmitPerkForm /></div></section>; }
