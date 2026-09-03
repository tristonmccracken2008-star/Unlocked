import Link from "next/link";
import type { AnswerBankStore } from "@/lib/account-types";
import { BuildNavigation } from "./build-navigation";
import styles from "./answer-bank.module.css";

export function AnswerBank({ store }: { store: AnswerBankStore }) {
  const stories = Object.values(store.records).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <main className={`${styles.page} application-studio-theme`}><div className={styles.shell}><BuildNavigation current="answer_bank" /><header><div><p className="rule-label text-forest">Build</p><h1>Answer Bank</h1><p>Reusable factual story material for written applications—not canned essays.</p></div><span>{stories.length} saved</span></header>{stories.length ? <div className={styles.grid}>{stories.map((story) => <article id={`story-${story.id}`} key={story.id}><span>{story.category}</span><h2>{story.title}</h2>{story.situation ? <p><strong>Context</strong>{story.situation}</p> : null}{story.action ? <p><strong>What you did</strong>{story.action}</p> : null}{story.challenge ? <p><strong>Challenge</strong>{story.challenge}</p> : null}{story.result ? <p><strong>Result</strong>{story.result}</p> : null}{story.learning ? <p><strong>Learning</strong>{story.learning}</p> : null}</article>)}</div> : <section className={styles.empty}><h2>Your factual stories will live here.</h2><p>Open an active application to save a leadership, teamwork, challenge, research, service, or motivation story. UnlockED will surface potentially relevant entries without copying them automatically.</p><Link className="button button-primary" href="/applications">Open Applications</Link></section>}</div></main>;
}
