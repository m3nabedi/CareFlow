"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QuestionnaireForm from "@/components/questionnaires/QuestionnaireForm";
import { questionnaireApi, type Questionnaire } from "@/lib/questionnaires";

export default function QuestionnaireDetail({ id }: { id: string }) {
  const [item, setItem] = useState<Questionnaire | null>(null); const [error, setError] = useState("");
  useEffect(() => { questionnaireApi.get(id).then(setItem).catch((e: Error) => setError(e.message)); }, [id]);
  if (error) return <div className="rounded-xl border border-error-200 bg-error-50 p-5 text-error-700">{error}<Link className="ml-3 underline" href="/">Back to questionnaires</Link></div>;
  if (!item) return <p className="text-sm text-gray-500">Loading questionnaire…</p>;
  const clinicName = item.clinic?.name ?? item.clinic_name;
  return <><div className="mx-auto mb-7 max-w-5xl"><Link href="/" className="inline-flex items-center text-sm font-medium text-brand-500 hover:text-brand-600">← All questionnaires</Link>{clinicName && <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{clinicName}</p>}<h1 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{item.title ?? item.name}</h1>{item.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">{item.description}</p>}</div><QuestionnaireForm questionnaire={item} /></>;
}
