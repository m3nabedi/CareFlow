"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { questionnaireApi, type Question, type QuestionOption, type Questionnaire } from "@/lib/questionnaires";

const optionValue = (option: QuestionOption) => typeof option === "string" ? option : option.value ?? option.label;
const optionLabel = (option: QuestionOption) => typeof option === "string" ? option : option.label;

export default function QuestionnaireForm({ questionnaire }: { questionnaire: Questionnaire }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({}); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const key = (q: Question) => String(q.key ?? q.id);
  const update = (q: Question, value: unknown) => setAnswers((a) => ({ ...a, [key(q)]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); try { await questionnaireApi.submit(String(questionnaire.slug ?? questionnaire.id), answers); setMessage("پاسخ شما با موفقیت ثبت شد."); setAnswers({}); } catch (e) { setMessage(e instanceof Error ? e.message : "ثبت پاسخ ناموفق بود."); } finally { setSaving(false); } }
  function field(q: Question) { const value = answers[key(q)]; const options = q.options ?? [];
    if (q.type === "textarea" || q.type === "paragraph") return <textarea value={String(value ?? "")} onChange={(e) => update(q, e.target.value)} placeholder={q.placeholder ?? ""} required={q.required} className="min-h-28 w-full rounded-lg border border-gray-300 bg-transparent p-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700" />;
    if (q.type === "select" || q.type === "dropdown") return <select value={String(value ?? "")} onChange={(e) => update(q, e.target.value)} required={q.required} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700"><option value="">انتخاب کنید</option>{options.map((o, i) => <option key={i} value={optionValue(o)}>{optionLabel(o)}</option>)}</select>;
    if (q.type === "radio" || q.type === "multiple_choice") return <div className="space-y-2">{options.map((o, i) => <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"><input type="radio" name={key(q)} value={optionValue(o)} checked={value === optionValue(o)} onChange={(e) => update(q, e.target.value)} required={q.required} />{optionLabel(o)}</label>)}</div>;
    if (q.type === "checkbox" || q.type === "multiple_checkboxes") return <div className="space-y-2">{options.map((o, i) => { const selected = Array.isArray(value) ? value : []; return <label key={i} className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={selected.includes(optionValue(o))} onChange={(e) => update(q, e.target.checked ? [...selected, optionValue(o)] : selected.filter((v) => v !== optionValue(o)))} />{optionLabel(o)}</label>; })}</div>;
    return <input type={q.type === "email" ? "email" : q.type === "number" ? "number" : q.type === "date" ? "date" : "text"} value={String(value ?? "")} onChange={(e) => update(q, e.target.value)} placeholder={q.placeholder ?? ""} required={q.required} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700" />;
  }
  return <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">{questionnaire.questions.map((q, index) => <section key={q.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><label className="mb-3 block font-medium text-gray-800 dark:text-white/90">{index + 1}. {q.label}{q.required && <span className="mr-1 text-error-500">*</span>}</label>{q.description && <p className="mb-3 text-sm text-gray-500">{q.description}</p>}{field(q)}</section>)}<div className="flex flex-wrap items-center gap-3"><button disabled={saving} className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? "در حال ثبت…" : "ثبت پاسخ"}</button><Link href={`/questionnaires/${questionnaire.slug ?? questionnaire.id}/responses`} className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium dark:border-gray-700">مشاهده پاسخ‌ها</Link>{message && <span className={message.includes("موفقیت") ? "text-success-600" : "text-error-600"}>{message}</span>}</div></form>;
}
