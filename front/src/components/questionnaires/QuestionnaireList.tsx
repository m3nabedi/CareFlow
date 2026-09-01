"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { questionnaireApi, type Questionnaire } from "@/lib/questionnaires";

export default function QuestionnaireList() {
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { questionnaireApi.list().then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <p className="text-sm text-gray-500">Loading questionnaires…</p>;
  if (error) return <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-error-700">{error}<p className="mt-1 text-sm">Confirm that the CareFlow API is running.</p></div>;
  if (!items.length) return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:bg-gray-900">There are no questionnaires to display yet.</div>;
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Link key={item.id} href={`/questionnaires/${item.slug ?? item.id}`} className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]"><div className="mb-4 flex items-center justify-between"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/10">{item.questionsCount ?? item.questions?.length ?? 0} questions</span><span className="text-xs text-gray-400">{item.submissionsCount ?? item.responses_count ?? item.submissions_count ?? 0} responses</span></div>{(item.clinic?.name ?? item.clinic_name) && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-500">{item.clinic?.name ?? item.clinic_name}</p>}<h2 className="text-lg font-semibold text-gray-800 group-hover:text-brand-600 dark:text-white/90">{item.title ?? item.name}</h2>{item.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">{item.description}</p>}<p className="mt-5 text-sm font-medium text-brand-500">Open questionnaire →</p></Link>)}</div>;
}
