import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminContent } from "@/components/admin-content";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Content management | UnlockED Admin",robots:{index:false,follow:false}};
export default async function Page(){const session=await getAdminSession();if(!session)redirect("/api/auth/google");return <main className="px-5 py-10 sm:px-8"><div className="mx-auto max-w-7xl"><p className="rule-label text-forest">Authenticated administration</p><h1 className="mt-3 font-editorial text-4xl font-bold">Content management</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/50">Add, edit, archive, and delete production opportunity records. Changes are attributed to {session.user.email}.</p><div className="mt-8"><AdminContent/></div></div></main>}
