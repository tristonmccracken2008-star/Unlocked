"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import styles from "./journey-editorial.module.css";
import { LoadingLines, LoadingRegion, SkeletonBlock } from "./loading-system";

// The authenticated Journey is server-composed. This component is only a recovery
// bridge when the public client session hydrates before the server sees its cookie.
export function StudentDashboard(_props: { profile: StudentProfile; session: AccountSession | null; syncError: string }) {
  const router = useRouter();
  useEffect(() => { router.refresh(); }, [router]);
  return <main className={styles.loadingPage}>
    <LoadingRegion label="Opening your Journey" className={styles.loadingArticle}>
      <p className={styles.loadingLabel}>Your Journey</p>
      <SkeletonBlock className="mt-4 h-11 w-[min(90%,32rem)] rounded-md" />
      <LoadingLines widths={["78%", "54%"]} className="mt-5 max-w-lg" />
      <p className={styles.loadingStatus}>Opening your story.</p>
    </LoadingRegion>
  </main>;
}
