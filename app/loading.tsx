import styles from "@/components/journey-editorial.module.css";

export default function JourneyLoading() {
  return <main className={styles.loadingPage} aria-busy="true" aria-label="Preparing your Journey">
    <div className={styles.loadingArticle}>
      <div className={styles.loadingLabel}>Your Journey</div>
      <div className={styles.loadingNarrative}><span /><span /><span /></div>
      <div className={styles.loadingIdentity} />
      <div className={styles.loadingComposition}>
        <div className={styles.loadingLine}><i /><b /></div>
        <div className={styles.loadingWaypoint}><span /><span /><span /></div>
      </div>
      <p className={styles.loadingStatus}>Preparing the next page of your story.</p>
    </div>
  </main>;
}
