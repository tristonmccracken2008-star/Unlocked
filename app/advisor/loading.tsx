import styles from "@/components/advisor-page.module.css";

export default function Loading() {
  return <main className={styles.page}>
    <section className={styles.loading} aria-busy="true" aria-live="polite" aria-label="Loading For You recommendations">
      <p>For You</p>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeleton} ${styles.skeletonCopy}`} />
      <div className={styles.loadingContext}><span /><span /><span /></div>
      <div className={styles.loadingFeature}><div /><div /><div /></div>
      <span className={styles.srStatus}>Selecting your strongest verified matches.</span>
    </section>
  </main>;
}
