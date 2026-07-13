import type { ReferralAdminSummary } from "@/lib/referrals";

export function AdminReferrals({ summary }: { summary: ReferralAdminSummary }) {
  return <div className="grid gap-6">
    <section className="rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8">
      <h2 className="font-editorial text-2xl font-bold">Top referrers</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="text-xs font-black uppercase tracking-[.14em] text-ink/35"><tr><th className="py-3">Code</th><th>Completed</th><th>Pending</th><th>Rewards</th><th>Updated</th></tr></thead>
          <tbody className="divide-y divide-ink/8">{summary.topReferrers.length ? summary.topReferrers.map((item) => <tr key={item.userId}><td className="py-3 font-black text-forest">{item.code}</td><td>{item.completed}</td><td>{item.pending}</td><td>{item.rewards}</td><td className="text-ink/45">{item.updatedAt.slice(0, 10)}</td></tr>) : <tr><td className="py-6 text-ink/45" colSpan={5}>No referral activity yet.</td></tr>}</tbody>
        </table>
      </div>
    </section>
    <section className="grid gap-6 lg:grid-cols-3">
      <AdminList title="Pending referrals" items={summary.pendingReferrals.map((item) => `${item.code} · ${item.joinedAt.slice(0, 10)}`)} empty="No pending referrals." />
      <AdminList title="Reward history" items={summary.rewardHistory.slice(-20).reverse().map((item) => `${item.code} · ${item.rewardKey.replaceAll("_", " ")} · ${item.unlockedAt.slice(0, 10)}`)} empty="No rewards unlocked." />
      <AdminList title="Abuse flags" items={summary.abuseFlags.slice(-20).reverse().map((item) => `${item.reason}${item.code ? ` · ${item.code}` : ""} · ${item.createdAt.slice(0, 10)}`)} empty="No abuse flags." />
    </section>
  </div>;
}

function AdminList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8">
    <h2 className="font-editorial text-2xl font-bold">{title}</h2>
    {items.length ? <ul className="mt-4 divide-y divide-ink/8">{items.map((item) => <li key={item} className="py-3 text-sm font-bold text-ink/58">{item}</li>)}</ul> : <p className="mt-4 text-sm text-ink/45">{empty}</p>}
  </section>;
}
