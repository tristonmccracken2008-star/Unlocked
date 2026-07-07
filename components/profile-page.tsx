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
  return <div><StudentSetup initialProfile={profile} onSave={(next)=>{writeStudentProfile(next);setProfile(next);setSaved(true)}} onCancel={profile ? undefined : undefined}/>{saved&&<div className="fixed bottom-5 right-5 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#10243e]">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Dashboard</Link></div>}</div>;
}
