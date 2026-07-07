"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { StudentSetup } from "./personalized-home";

export function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setProfile(readStudentProfile()); }, []);
  if (profile === undefined) return <div className="min-h-[60vh]" />;
  return <div><StudentSetup initialProfile={profile} onSave={(next)=>{writeStudentProfile(next);setProfile(next);setSaved(true)}} onCancel={profile ? undefined : undefined}/>{saved&&<div role="status" className="fixed bottom-5 left-5 right-5 z-40 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#10243e] sm:left-auto">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Return to dashboard</Link></div>}</div>;
}
