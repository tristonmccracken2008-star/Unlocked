"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import styles from "./journey-editorial.module.css";

// The authenticated Journey is server-composed. This component is only a recovery
// bridge when the public client session hydrates before the server sees its cookie.
export function StudentDashboard(_props: { profile: StudentProfile; session: AccountSession | null; syncError: string }) {
  const router = useRouter();
  useEffect(() => { router.refresh(); }, [router]);
  return <main className={styles.loadingPage} aria-busy="true" aria-label="Opening your Journey">
    <div className={styles.loadingArticle}>
      <p className={styles.loadingLabel}>Your Journey</p>
      <div className={styles.loadingNarrative}><span /><span /><span /></div>
      <p className={styles.loadingStatus}>Opening your story.</p>
    </div>
  </main>;
}
