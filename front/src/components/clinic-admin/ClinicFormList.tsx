"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clinicAdminApi, type AdminQuestionnaire } from "@/lib/clinic-admin";

export default function ClinicFormList() {
  const [forms, setForms] = useState<AdminQuestionnaire[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { clinicAdminApi.forms().then(setForms).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "We could not load your clinic forms.")).finally(() => setLoading(false)); }, []);
  if (loading) return <p className="text-sm text-gray-500">Loading clinic forms…</p>;
  if (error) return <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">{error}</div>;
  if (!forms.length) return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03]">This clinic does not have any forms yet.</div>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{forms.map((form) => <article key={form.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${form.status === "published" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"}`}>{form.status ?? "draft"}</span><span className="text-xs text-gray-500">{form.submissionsCount ?? 0} responses</span></div><h2 className="mt-4 text-base font-bold text-gray-900 dark:text-white">{form.name}</h2>{form.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">{form.description}</p>}<div className="mt-5 flex gap-4"><Link href={`/admin/forms/${form.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">Edit form</Link><Link href={`/admin/responses?form=${form.id}`} className="text-sm font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Responses</Link></div></article>)}</div>;
}
