"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QuestionnaireForm from "@/components/questionnaires/QuestionnaireForm";
import { questionnaireApi, type Questionnaire } from "@/lib/questionnaires";

export default function QuestionnaireDetail({ id }: { id: string }) {
  const [item, setItem] = useState<Questionnaire | null>(null); const [error, setError] = useState("");
  useEffect(() => { questionnaireApi.get(id).then(setItem).catch((e: Error) => setError(e.message)); }, [id]);
  if (error) return <div className="rounded-xl border border-error-200 bg-error-50 p-5 text-error-700">{error}<Link className="mr-3 underline" href="/">بازگشت به فهرست</Link></div>;
  if (!item) return <p className="text-sm text-gray-500">در حال بارگذاری پرسشنامه…</p>;
  return <><div className="mb-7"><Link href="/" className="text-sm font-medium text-brand-500">← همه پرسشنامه‌ها</Link><h1 className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{item.title ?? item.name}</h1>{item.description && <p className="mt-2 text-gray-500">{item.description}</p>}</div><QuestionnaireForm questionnaire={item} /></>;
}
