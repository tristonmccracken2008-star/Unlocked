import { satQuestionBank, satTaxonomy, type SatDomain, type SatPracticeStore } from './sat-practice';

export type BluebookResult = { id: string; test: string; date: string; readingWriting: number; math: number; total: number; domains: Partial<Record<SatDomain, number>>; notes: string };
export type SatPreparation = { bluebook: BluebookResult[]; studyTime: 'light' | 'regular' | 'focused'; bluebookDate?: string };
export const validSatDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
export const validSectionScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 200 && v <= 800 && v % 10 === 0;
export function normalizeSatPreparation(value: unknown): SatPreparation {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<SatPreparation>;
  return { studyTime: raw.studyTime === 'light' || raw.studyTime === 'focused' ? raw.studyTime : 'regular', bluebookDate: validSatDate(raw.bluebookDate) ? raw.bluebookDate : undefined,
    bluebook: (Array.isArray(raw.bluebook) ? raw.bluebook : []).filter(r => r && typeof r.id === 'string' && validSatDate(r.date) && validSectionScore(r.readingWriting) && validSectionScore(r.math)).slice(-100).map(r => ({ id:r.id.slice(0,100), test:String(r.test || 'Bluebook practice').slice(0,80), date:r.date, readingWriting:r.readingWriting, math:r.math, total:r.readingWriting+r.math, notes:String(r.notes || '').slice(0,2000), domains:Object.fromEntries(Object.entries(r.domains || {}).filter(([d,v]) => Object.values(satTaxonomy).some(s => d in s.domains) && Number.isInteger(v) && v >= 1 && v <= 7)) })) };
}
export function recentSatDomains(store: SatPracticeStore) {
  const attempts = store.sessions.flatMap(s => s.attempts).sort((a,b)=>b.attemptedAt.localeCompare(a.attemptedAt));
  return Object.entries(satTaxonomy).flatMap(([section,meta]) => Object.entries(meta.domains).map(([domain,d]) => {
    const all = attempts.filter(a => satQuestionBank.find(q=>q.id===a.questionId)?.domain === domain);
    const recent = all.slice(0,15);
    return { section:section as 'math'|'reading_writing', domain:domain as SatDomain, label:d.label, attempts:all.length, recent:recent.length, correct:recent.filter(a=>a.correct).length, unique:new Set(recent.map(a=>a.questionId)).size, last:recent[0]?.attemptedAt };
  }));
}
export function satNextAction(store: SatPracticeStore, nextTest?: string, today = new Date().toISOString().slice(0,10)) {
  const prep = normalizeSatPreparation(store.preparation);
  const latest = [...prep.bluebook].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const days = nextTest ? Math.ceil((Date.parse(nextTest)-Date.parse(today))/86400000) : undefined;
  if (!latest) return { kind:'bluebook' as const, title:'Take a diagnostic in Bluebook', reason:'Start with an official full-length practice test, then record your result here.' };
  const due = prep.bluebookDate && prep.bluebookDate <= today && latest.date < prep.bluebookDate;
  if (due && (days === undefined || days > 2)) return { kind:'bluebook' as const, title:'Take your planned Bluebook test', reason:'Your planned practice date has arrived. Take it when you have time, or choose a new date.' };
  const mistakes = store.sessions.flatMap(s=>s.attempts).filter(a=>!a.correct && !a.reviewedAt);
  if (mistakes.length) return { kind:'review' as const, title:`Review ${mistakes.length} ${mistakes.length === 1 ? 'mistake' : 'mistakes'}`, reason:'These answers are waiting for review. Read the explanation and choose what to practice again.' };
  const evidence = recentSatDomains(store).filter(d=>d.recent>=8 && d.unique>=4 && d.correct/d.recent<0.8).sort((a,b)=>a.correct/a.recent-b.correct/b.recent || a.domain.localeCompare(b.domain))[0];
  if (evidence) return { kind:'focused' as const, title:`Practice ${evidence.label}`, domain:evidence.domain, reason:`You missed ${evidence.recent-evidence.correct} of your last ${evidence.recent} answers in this domain (${evidence.unique} different questions).` };
  const reported = Object.entries(latest.domains).filter(([,v])=>v <= 3).sort((a,b)=>a[1]-b[1])[0];
  if (reported) return { kind:'learn' as const, title:`Learn ${recentSatDomains(store).find(d=>d.domain===reported[0])?.label}`, domain:reported[0] as SatDomain, reason:`You recorded ${reported[1]} of 7 performance bands for this area on your latest Bluebook test. This is a reported band, not a percent correct.` };
  return { kind:'quick' as const, title:days !== undefined && days <= 2 ? 'Keep it light with a short practice set' : 'Take a balanced practice set', reason:'There is not enough varied recent evidence to select a weak domain. Keep both sections in your practice.' };
}
